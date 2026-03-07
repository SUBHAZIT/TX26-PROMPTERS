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
 * Tracks three main statuses for a team:
 * - isDisqualified: If team is disqualified by admin
 * - isEliminated: PERMANENT - once eliminated, cannot re-enter
 * - isQualified: If team qualified for current round
 * 
 * Priority: Disqualified (Highest) > Eliminated > Qualified > Active Play
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

  // Use refs to track if elimination has been set (for permanent elimination)
  const eliminationRef = useRef<{ eliminated: boolean; round: number | null }>({
    eliminated: false,
    round: null,
  });

  // Use ref to prevent re-qualification on first mount
  const isInitialMount = useRef(true);

  /**
   * Check and update team status based on current database state
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
      // Step 1: Check if team is disqualified (HIGHEST PRIORITY)
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('status')
        .eq('team_id', teamId)
        .maybeSingle();

      if (teamError) {
        console.error('[AccessControl] Error fetching team status:', teamError);
        currentState.error = teamError.message;
      }

      if (teamData?.status === 'disqualified') {
        // Team is disqualified - highest priority blocks everything
        currentState.isDisqualified = true;
        currentState.isEliminated = false;
        currentState.isQualified = false;
        currentState.qualificationRound = null;
        
        setState(currentState);
        return;
      }

      // Step 2: Check if team was PERMANENTLY eliminated (check localStorage or state)
      // Once eliminated, they stay eliminated PERMANENTLY
      if (eliminationRef.current.eliminated) {
        currentState.isEliminated = true;
        currentState.isQualified = false;
        currentState.qualificationRound = eliminationRef.current.round;
        
        setState(currentState);
        return;
      }

      // Step 3: Get current round from round_state
      const { data: roundStateData, error: roundError } = await supabase
        .from('round_state')
        .select('*')
        .limit(1)
        .single();

      if (roundError) {
        console.error('[AccessControl] Error fetching round state:', roundError);
      }

      const currentRound = roundStateData?.round_number || 1;

      // Step 4: For rounds 2+, check if team qualified from previous round
      if (currentRound > 1) {
        const previousRound = currentRound - 1;

        // Check if team is in qualified_teams for the PREVIOUS round
        // This determines if they were eliminated (not qualified) or qualified
        const { data: qualifiedData, error: qualifiedError } = await supabase
          .from('qualified_teams')
          .select('*')
          .eq('team_id', teamId)
          .eq('qualified_from_round', previousRound)
          .maybeSingle();

        if (qualifiedError) {
          console.error('[AccessControl] Error fetching qualified teams:', qualifiedError);
        }

        // Check if any teams were qualified (to confirm round was evaluated)
        const { data: anyQualified } = await supabase
          .from('qualified_teams')
          .select('id')
          .eq('qualified_from_round', previousRound)
          .limit(1);

        const roundWasEvaluated = anyQualified && anyQualified.length > 0;

        if (qualifiedData) {
          // Team is QUALIFIED for current round
          currentState.isQualified = true;
          currentState.isEliminated = false;
          currentState.qualificationRound = previousRound;
        } else if (roundWasEvaluated) {
          // Team is ELIMINATED - PERMANENT!
          // Once eliminated, they stay eliminated forever
          eliminationRef.current = {
            eliminated: true,
            round: previousRound,
          };
          
          // Persist to localStorage for persistence across page refreshes
          try {
            localStorage.setItem(
              `eliminated_${teamId}`, 
              JSON.stringify({ eliminated: true, round: previousRound })
            );
          } catch (e) {
            console.error('[AccessControl] Error saving to localStorage:', e);
          }

          currentState.isEliminated = true;
          currentState.isQualified = false;
          currentState.qualificationRound = previousRound;
        } else {
          // Round not yet evaluated - no overlay yet
          currentState.isEliminated = false;
          currentState.isQualified = false;
          currentState.qualificationRound = null;
        }
      } else {
        // Round 1 - no elimination/qualification check needed
        currentState.isEliminated = false;
        currentState.isQualified = false;
        currentState.qualificationRound = null;
      }

      setState(currentState);

    } catch (error) {
      console.error('[AccessControl] Exception in checkTeamStatus:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: String(error),
      }));
    }
  }, [session]);

  // Load persisted elimination state on mount
  useEffect(() => {
    if (!session) return;

    // Load from localStorage
    try {
      const saved = localStorage.getItem(`eliminated_${session.teamId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.eliminated) {
          eliminationRef.current = {
            eliminated: true,
            round: parsed.round,
          };
        }
      }
    } catch (e) {
      console.error('[AccessControl] Error loading from localStorage:', e);
    }
  }, [session]);

  // Main useEffect for real-time subscriptions
  useEffect(() => {
    if (!session) return;
    
    // Skip initial check on first mount (useEffect runs before state is ready)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      checkTeamStatus();
    }

    const teamId = session.teamId;

    // Channel 1: Subscribe to teams table (for disqualification status)
    const teamsChannel = supabase
      .channel('access_control_teams')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          console.log('[AccessControl] Teams table updated:', payload.new);
          
          const newStatus = (payload.new as { status?: string })?.status;
          
          if (newStatus === 'disqualified') {
            // Team got disqualified
            setState(prev => ({
              ...prev,
              isDisqualified: true,
              isEliminated: false,
              isQualified: false,
              qualificationRound: null,
              isLoading: false,
            }));
          } else if (newStatus === 'active' || newStatus === null) {
            // Disqualification was LIFTED - re-qualify for current round
            // Clear elimination state and re-check
            eliminationRef.current = { eliminated: false, round: null };
            try {
              localStorage.removeItem(`eliminated_${teamId}`);
            } catch (e) {}
            
            checkTeamStatus();
          }
        }
      )
      .subscribe((status) => {
        console.log('[AccessControl] Teams channel status:', status);
      });

    // Channel 2: Subscribe to qualified_teams table (for elimination/qualification)
    const qualifiedTeamsChannel = supabase
      .channel('access_control_qualified_teams')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'qualified_teams',
        },
        (payload) => {
          console.log('[AccessControl] Qualified teams changed:', payload);
          // Re-check status when qualified_teams changes
          checkTeamStatus();
        }
      )
      .subscribe((status) => {
        console.log('[AccessControl] Qualified teams channel status:', status);
      });

    // Channel 3: Subscribe to round_state (for round changes)
    const roundStateChannel = supabase
      .channel('access_control_round_state')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_state',
        },
        (payload) => {
          console.log('[AccessControl] Round state changed:', payload);
          // Re-check status when round changes
          checkTeamStatus();
        }
      )
      .subscribe((status) => {
        console.log('[AccessControl] Round state channel status:', status);
      });

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(teamsChannel);
      supabase.removeChannel(qualifiedTeamsChannel);
      supabase.removeChannel(roundStateChannel);
    };
  }, [session, checkTeamStatus]);

  /**
   * Manually refresh the access control state
   */
  const refreshStatus = useCallback(() => {
    checkTeamStatus();
  }, [checkTeamStatus]);

  /**
   * Clear qualified status (call when new round actually starts)
   * Note: This does NOT clear elimination - once eliminated, always eliminated
   */
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

