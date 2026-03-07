import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TeamAccessState {
  isDisqualified: boolean;
  isEliminated: boolean;
  isQualified: boolean;
  qualificationRound: number | null;
  isLoading: boolean;
  error: string | null;
}

interface TeamSession {
  teamId: string;
  leaderName: string;
  section: string;
  sessionToken: string;
}

/**
 * useTeamAccessControl - Real-time state-based access control
 * 
 * Key behaviors:
 * 1. Subscribes to qualified_teams in REAL-TIME - no refresh needed
 * 2. Shows Qualified overlay until round actually becomes ACTIVE
 * 3. Shows Eliminated overlay PERMANENTLY once triggered
 * 4. Priority: Disqualified > Eliminated > Qualified > Active
 */
export function useTeamAccessControl(
  session: TeamSession | null, 
  roundStatus?: string // 'waiting' | 'countdown' | 'active' | 'completed'
) {
  const [state, setState] = useState<TeamAccessState>({
    isDisqualified: false,
    isEliminated: false,
    isQualified: false,
    qualificationRound: null,
    isLoading: true,
    error: null,
  });

  // Track permanent elimination
  const eliminationRef = useRef<{ eliminated: boolean; round: number | null }>({
    eliminated: false,
    round: null,
  });

  // Track previous round status to detect transitions
  const prevRoundStatusRef = useRef<string | null>(null);

  /**
   * Check team status against database
   */
  const checkTeamStatus = useCallback(async () => {
    if (!session) return;

    const teamId = session.teamId;
    let currentState: TeamAccessState = {
      isDisqualified: false,
      isEliminated: false,
      isQualified: false,
      qualificationRound: null,
      isLoading: false,
      error: null,
    };

    try {
      console.log('[AccessControl] Checking status for:', teamId);

      // STEP 1: Check disqualification (highest priority)
      const { data: teamData } = await supabase
        .from('teams')
        .select('status')
        .eq('team_id', teamId)
        .maybeSingle();

      if (teamData?.status === 'disqualified') {
        console.log('[AccessControl] Disqualified!');
        currentState.isDisqualified = true;
        setState(currentState);
        return;
      }

      // STEP 2: Check permanent elimination
      if (eliminationRef.current.eliminated) {
        console.log('[AccessControl] Permanently eliminated from round', eliminationRef.current.round);
        currentState.isEliminated = true;
        currentState.qualificationRound = eliminationRef.current.round;
        setState(currentState);
        return;
      }

      // STEP 3: Get latest qualified round for this team
      const { data: qualifiedData } = await supabase
        .from('qualified_teams')
        .select('qualified_from_round')
        .eq('team_id', teamId)
        .order('qualified_from_round', { ascending: false })
        .limit(1);

      // STEP 4: Check if ANY team has been qualified for any round
      const { data: anyQualified } = await supabase
        .from('qualified_teams')
        .select('qualified_from_round')
        .order('qualified_from_round', { ascending: false })
        .limit(1);

      if (qualifiedData && qualifiedData.length > 0) {
        // This team IS qualified
        const qRound = qualifiedData[0].qualified_from_round;
        console.log('[AccessControl] Qualified for round:', qRound);
        currentState.isQualified = true;
        currentState.qualificationRound = qRound;
      } else if (anyQualified && anyQualified.length > 0) {
        // Round evaluated but this team NOT in list → ELIMINATED
        const evalRound = anyQualified[0].qualified_from_round;
        console.log('[AccessControl] Eliminated from round:', evalRound);
        
        eliminationRef.current = { eliminated: true, round: evalRound };
        try {
          localStorage.setItem(`eliminated_${teamId}`, JSON.stringify({ eliminated: true, round: evalRound }));
        } catch (e) {}
        
        currentState.isEliminated = true;
        currentState.qualificationRound = evalRound;
      } else {
        // No rounds evaluated yet
        console.log('[AccessControl] No rounds evaluated - allow play');
      }

      setState(currentState);
    } catch (error) {
      console.error('[AccessControl] Error:', error);
    }
  }, [session]);

  // Load persisted elimination
  useEffect(() => {
    if (!session) return;
    try {
      const saved = localStorage.getItem(`eliminated_${session.teamId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.eliminated) {
          eliminationRef.current = { eliminated: true, round: parsed.round };
        }
      }
    } catch (e) {}
  }, [session]);

  // Main subscription effect - runs ONCE with all channels
  useEffect(() => {
    if (!session) return;

    const teamId = session.teamId;
    let mounted = true;

    // Channel 1: Teams - disqualification
    const teamsChannel = supabase
      .channel('ac_teams')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `team_id=eq.${teamId}` },
        (payload) => {
          if (!mounted) return;
          const newStatus = (payload.new as { status?: string })?.status;
          if (newStatus === 'disqualified') {
            setState(s => ({ ...s, isDisqualified: true, isEliminated: false, isQualified: false }));
          } else {
            eliminationRef.current = { eliminated: false, round: null };
            try { localStorage.removeItem(`eliminated_${teamId}`); } catch (e) {}
            checkTeamStatus();
          }
        }
      )
      .subscribe((status) => {
        console.log('[AccessControl] Teams channel:', status);
      });

    // Channel 2: qualified_teams - THE KEY REAL-TIME TRIGGER
    const qualifiedChannel = supabase
      .channel('ac_qualified')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'qualified_teams' },
        (payload) => {
          if (!mounted) return;
          console.log('[AccessControl] qualified_teams REAL-TIME update:', payload);
          // IMMEDIATELY check status - no waiting!
          checkTeamStatus();
        }
      )
      .subscribe((status) => {
        console.log('[AccessControl] Qualified channel:', status);
      });

    // Channel 3: round_state
    const roundChannel = supabase
      .channel('ac_round')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'round_state' },
        (payload) => {
          if (!mounted) return;
          console.log('[AccessControl] Round state changed:', payload);
          checkTeamStatus();
        }
      )
      .subscribe();

    // Initial check
    checkTeamStatus();

    return () => {
      mounted = false;
      supabase.removeChannel(teamsChannel);
      supabase.removeChannel(qualifiedChannel);
      supabase.removeChannel(roundChannel);
    };
  }, [session, checkTeamStatus]);

  // Effect to handle round status transitions
  // Qualified overlay shows from teams selection until next round countdown STARTS
  useEffect(() => {
    if (!roundStatus) {
      prevRoundStatusRef.current = roundStatus || null;
      return;
    }

    const prev = prevRoundStatusRef.current;
    const current = roundStatus;

    // Clear qualified when: any status → countdown (new round countdown starts!)
    // This is the key: show qualified overlay until the NEXT round countdown begins
    if (prev !== 'countdown' && current === 'countdown') {
      console.log('[AccessControl] Next round countdown started - clear qualified status');
      setState(s => ({ ...s, isQualified: false, qualificationRound: null }));
    }

    prevRoundStatusRef.current = current;
  }, [roundStatus]);

  // Force check when roundStatus changes to countdown (new round coming)
  useEffect(() => {
    if (roundStatus === 'countdown') {
      console.log('[AccessControl] Round in countdown - check status');
      checkTeamStatus();
    }
  }, [roundStatus, checkTeamStatus]);

  const refreshStatus = useCallback(() => checkTeamStatus(), [checkTeamStatus]);

  // Clear only qualified (not elimination!) - use sparingly
  const clearQualifiedStatus = useCallback(() => {
    setState(s => ({ ...s, isQualified: false, qualificationRound: null }));
  }, []);

  return {
    ...state,
    refreshStatus,
    clearQualifiedStatus,
  };
}

