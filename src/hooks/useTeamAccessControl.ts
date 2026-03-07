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
 * useTeamAccessControl - Custom hook for state-based access control
 * 
 * Logic Flow:
 * 1. Check if team is disqualified (blocks everything)
 * 2. Check if team was permanently eliminated
 * 3. Check if team is in qualified_teams for the most recent evaluated round
 * 4. If in qualified_teams → show "Qualified!" overlay
 * 5. If NOT in qualified_teams but round was evaluated → show "Eliminated" overlay
 * 
 * Priority: Disqualified > Eliminated > Qualified > Active
 */
export function useTeamAccessControl(session: TeamSession | null) {
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

  // Track if initial check is done
  const isInitialCheckDone = useRef(false);

  /**
   * Core logic to check team status against database
   * This compares teamId against qualified_teams table
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
      console.log('[AccessControl] Checking status for team:', teamId);

      // STEP 1: Check if disqualified (HIGHEST PRIORITY)
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('status')
        .eq('team_id', teamId)
        .maybeSingle();

      if (teamError) {
        console.error('[AccessControl] Error fetching team:', teamError);
      }

      if (teamData?.status === 'disqualified') {
        console.log('[AccessControl] Team IS disqualified');
        currentState.isDisqualified = true;
        setState(currentState);
        return;
      }

      // STEP 2: Check if permanently eliminated (from localStorage)
      if (eliminationRef.current.eliminated) {
        console.log('[AccessControl] Team is PERMANENTLY eliminated from round', eliminationRef.current.round);
        currentState.isEliminated = true;
        currentState.qualificationRound = eliminationRef.current.round;
        setState(currentState);
        return;
      }

      // STEP 3: Get the LATEST round that has been evaluated
      // We look for qualified_teams entries to find the highest evaluated round
      const { data: qualifiedTeamsData, error: qError } = await supabase
        .from('qualified_teams')
        .select('qualified_from_round')
        .eq('team_id', teamId)
        .order('qualified_from_round', { ascending: false })
        .limit(1);

      if (qError) {
        console.error('[AccessControl] Error fetching qualified teams:', qError);
      }

      // Check if THIS team is in qualified_teams
      if (qualifiedTeamsData && qualifiedTeamsData.length > 0) {
        // Team IS qualified for the latest evaluated round
        const qualifiedRound = qualifiedTeamsData[0].qualified_from_round;
        console.log('[AccessControl] Team qualified for round:', qualifiedRound);
        
        currentState.isQualified = true;
        currentState.isEliminated = false;
        currentState.qualificationRound = qualifiedRound;
        setState(currentState);
        return;
      }

      // STEP 4: Team is NOT in qualified_teams
      // Check if ANY teams have been qualified for any round (round was evaluated)
      const { data: anyQualified } = await supabase
        .from('qualified_teams')
        .select('qualified_from_round')
        .order('qualified_from_round', { ascending: false })
        .limit(1);

      if (anyQualified && anyQualified.length > 0) {
        // Round HAS been evaluated and this team is NOT in qualified list → ELIMINATED!
        const evaluatedRound = anyQualified[0].qualified_from_round;
        console.log('[AccessControl] Round', evaluatedRound, 'evaluated - team NOT qualified → ELIMINATED');
        
        // Mark as PERMANENTLY eliminated
        eliminationRef.current = {
          eliminated: true,
          round: evaluatedRound,
        };
        
        // Persist to localStorage
        try {
          localStorage.setItem(
            `eliminated_${teamId}`, 
            JSON.stringify({ eliminated: true, round: evaluatedRound })
          );
        } catch (e) {
          console.error('[AccessControl] localStorage error:', e);
        }

        currentState.isEliminated = true;
        currentState.isQualified = false;
        currentState.qualificationRound = evaluatedRound;
        setState(currentState);
        return;
      }

      // No qualified teams yet - no overlay (everyone can play)
      console.log('[AccessControl] No rounds evaluated yet - everyone can play');
      currentState.isEliminated = false;
      currentState.isQualified = false;
      currentState.qualificationRound = null;
      setState(currentState);

    } catch (error) {
      console.error('[AccessControl] Exception:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: String(error),
      }));
    }
  }, [session]);

  // Load persisted elimination from localStorage on mount
  useEffect(() => {
    if (!session) return;

    try {
      const saved = localStorage.getItem(`eliminated_${session.teamId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.eliminated) {
          eliminationRef.current = {
            eliminated: true,
            round: parsed.round,
          };
          console.log('[AccessControl] Loaded persisted elimination for round', parsed.round);
        }
      }
    } catch (e) {
      console.error('[AccessControl] Error loading localStorage:', e);
    }
  }, [session]);

  // Main effect with real-time subscriptions
  useEffect(() => {
    if (!session) return;

    const teamId = session.teamId;

    // Channel 1: Teams table - for disqualification
    const teamsChannel = supabase
      .channel('access_teams')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          console.log('[AccessControl] Teams updated:', payload);
          const newStatus = (payload.new as { status?: string })?.status;
          
          if (newStatus === 'disqualified') {
            setState(prev => ({
              ...prev,
              isDisqualified: true,
              isEliminated: false,
              isQualified: false,
            }));
          } else if (newStatus === 'active' || newStatus === null) {
            // Disqualification lifted - re-check
            eliminationRef.current = { eliminated: false, round: null };
            try {
              localStorage.removeItem(`eliminated_${teamId}`);
            } catch (e) {}
            checkTeamStatus();
          }
        }
      )
      .subscribe();

    // Channel 2: qualified_teams table - THE KEY TRIGGER
    // When admin adds teams to qualified_teams, ALL teams check their status
    const qualifiedChannel = supabase
      .channel('access_qualified')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, DELETE, UPDATE
          schema: 'public',
          table: 'qualified_teams',
        },
        (payload) => {
          console.log('[AccessControl] qualified_teams changed:', payload);
          // IMMEDIATELY re-check status
          checkTeamStatus();
        }
      )
      .subscribe();

    // Channel 3: round_state - for round changes
    const roundChannel = supabase
      .channel('access_round')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_state',
        },
        (payload) => {
          console.log('[AccessControl] round_state changed:', payload);
          checkTeamStatus();
        }
      )
      .subscribe();

    // Initial check after a small delay to ensure subscriptions are ready
    const timer = setTimeout(() => {
      checkTeamStatus();
      isInitialCheckDone.current = true;
    }, 500);

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(teamsChannel);
      supabase.removeChannel(qualifiedChannel);
      supabase.removeChannel(roundChannel);
    };
  }, [session, checkTeamStatus]);

  const refreshStatus = useCallback(() => {
    checkTeamStatus();
  }, [checkTeamStatus]);

  // Clear qualified status (not elimination - that's permanent!)
  const clearQualifiedStatus = useCallback(() => {
    setState(prev => ({
      ...prev,
      isQualified: false,
      qualificationRound: null,
    }));
  }, []);

  return {
    ...state,
    refreshStatus,
    clearQualifiedStatus,
  };
}

