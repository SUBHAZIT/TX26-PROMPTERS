import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useTeamSession } from '@/hooks/useTeamSession';
import { useRoundState } from '@/hooks/useRoundState';
import { useAntiCheat } from '@/hooks/useAntiCheat';
import { useBackgroundMusic } from '@/hooks/useBackgroundMusic';
import { CountdownOverlay } from '@/components/competition/CountdownOverlay';
import { WaitingScreen } from '@/components/competition/WaitingScreen';
import { EliminationOverlay } from '@/components/competition/EliminationOverlay';
import { DisqualificationOverlay } from '@/components/competition/DisqualificationOverlay';
import { IntroVideo } from '@/components/competition/IntroVideo';
import { MuteButton } from '@/components/competition/MuteButton';
import { WarningNotice } from '@/components/competition/WarningNotice';
import { Round1 } from '@/components/competition/Round1';
import { Round2 } from '@/components/competition/Round2';
import { Round3 } from '@/components/competition/Round3';
import { FinalRound } from '@/components/competition/FinalRound';
import { Zap, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Competition = () => {
  const navigate = useNavigate();
  const { session, logout } = useTeamSession();
  const { activeRound, rounds, loading, error } = useRoundState();
  useAntiCheat();
  const { isMuted, toggleMute, play } = useBackgroundMusic();

  const [showIntro, setShowIntro] = useState(true);
  const [showCountdown, setShowCountdown] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [eliminationState, setEliminationState] = useState<{ eliminated: boolean; qualified: boolean; round: number } | null>(null);
  const [warningCount, setWarningCount] = useState(0);
  const [teamStatus, setTeamStatus] = useState<string | null>(null);
  const [isDisqualified, setIsDisqualified] = useState(false);

  useEffect(() => {
    if (!session) navigate('/');
  }, [session, navigate]);

  // Initial fetch of team status
  useEffect(() => {
    if (!session) return;
    
    const fetchTeamStatus = async () => {
      const { data } = await supabase.from('teams').select('warning_count, status').eq('team_id', session.teamId).maybeSingle();
      if (data) {
        setWarningCount(data.warning_count);
        setTeamStatus(data.status);
        if (data.status === 'disqualified') {
          setIsDisqualified(true);
        }
      }
    };
    fetchTeamStatus();
  }, [session]);

  // ============================================================
  // REAL-TIME SUBSCRIPTIONS FOR DISQUALIFICATION & ELIMINATION
  // ============================================================
  
  useEffect(() => {
    if (!session) return;
    
    let isMounted = true;
    const teamId = session.teamId;

    // Function to check and update disqualification status
    const checkDisqualificationStatus = async () => {
      if (!isMounted) return;
      
      const { data: teamData } = await supabase
        .from('teams')
        .select('status')
        .eq('team_id', teamId)
        .maybeSingle();
      
      if (!isMounted) return;
      
      if (teamData?.status === 'disqualified') {
        setIsDisqualified(true);
        setEliminationState(null); // Clear elimination state to show disqualification overlay
      } else {
        setIsDisqualified(false);
      }
    };

    // Function to check and update elimination/qualification status
    const checkEliminationStatus = async () => {
      if (!isMounted) return;
      
      // First check if disqualified
      const { data: teamData } = await supabase
        .from('teams')
        .select('status')
        .eq('team_id', teamId)
        .maybeSingle();
      
      if (!isMounted) return;
      
      if (teamData?.status === 'disqualified') {
        setIsDisqualified(true);
        return;
      }
      
      setIsDisqualified(false);
      
      // Get current rounds state
      const completedRounds = rounds.filter(r => r.status === 'completed');
      if (completedRounds.length === 0) return;

      const lastCompleted = completedRounds[completedRounds.length - 1];
      const nextRound = rounds.find(r => r.round_number === lastCompleted.round_number + 1);
      
      // Only show elimination if next round is pending (not started yet)
      if (!nextRound || nextRound.status === 'pending') {
        const { data: qualified } = await supabase
          .from('qualified_teams')
          .select('*')
          .eq('team_id', teamId)
          .eq('qualified_from_round', lastCompleted.round_number)
          .maybeSingle();

        if (!isMounted) return;
        
        if (qualified) {
          setEliminationState({ eliminated: false, qualified: true, round: lastCompleted.round_number });
        } else {
          // Check if there are any qualified teams (to confirm round was evaluated)
          const { data: anyQualified } = await supabase
            .from('qualified_teams')
            .select('id')
            .eq('qualified_from_round', lastCompleted.round_number)
            .limit(1);
            
          if (!isMounted) return;
            
          if (anyQualified && anyQualified.length > 0) {
            setEliminationState({ eliminated: true, qualified: false, round: lastCompleted.round_number });
          }
        }
      }
    };

    // ============================================================
    // CHANNEL 1: Subscribe to teams table for disqualification
    // ============================================================
    const teamsChannel = supabase
      .channel('competition_teams_realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'teams',
          filter: `team_id=eq.${teamId}`
        },
        (payload) => {
          console.log('[Realtime] Teams table updated:', payload.new);
          if (payload.new.status === 'disqualified') {
            setIsDisqualified(true);
            setEliminationState(null);
          } else {
            setIsDisqualified(false);
            // Re-check elimination status when team is re-qualified
            checkEliminationStatus();
          }
          setWarningCount(payload.new.warning_count || 0);
          setTeamStatus(payload.new.status);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Teams channel status:', status);
      });

    // ============================================================
    // CHANNEL 2: Subscribe to qualified_teams table for elimination/qualification
    // ============================================================
    const qualifiedTeamsChannel = supabase
      .channel('competition_qualified_teams_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'qualified_teams'
        },
        (payload) => {
          console.log('[Realtime] Qualified teams changed:', payload);
          // Check if this change affects the current team
          checkEliminationStatus();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Qualified teams channel status:', status);
      });

    // ============================================================
    // CHANNEL 3: Subscribe to round_state for round completion
    // ============================================================
    const roundStateChannel = supabase
      .channel('competition_round_state_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_state'
        },
        (payload) => {
          console.log('[Realtime] Round state changed:', payload);
          checkEliminationStatus();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Round state channel status:', status);
      });

    // Cleanup all channels on unmount
    return () => {
      isMounted = false;
      console.log('[Realtime] Cleaning up subscriptions');
      supabase.removeChannel(teamsChannel);
      supabase.removeChannel(qualifiedTeamsChannel);
      supabase.removeChannel(roundStateChannel);
    };
  }, [session, rounds]);

  // ============================================================
  // END REAL-TIME SUBSCRIPTIONS
  // ============================================================

  const handleIntroEnd = useCallback(() => {
    setShowIntro(false);
    play();
  }, [play]);

  // Clear elimination when new round starts
  useEffect(() => {
    if (activeRound?.status === 'countdown' || activeRound?.status === 'active') {
      setEliminationState(null);
    }
  }, [activeRound?.status]);

  useEffect(() => {
    if (activeRound?.status === 'countdown') {
      setShowCountdown(true);
    }
  }, [activeRound?.status]);

  // Fetch current question for active rounds
  useEffect(() => {
    if (!activeRound || activeRound.status !== 'active') return;
    setCurrentQuestion(null);

    supabase.from('questions')
      .select('*')
      .eq('round_number', activeRound.round_number)
      .eq('question_number', activeRound.current_question || 1)
      .maybeSingle()
      .then(({ data }) => setCurrentQuestion(data));
  }, [activeRound?.round_number, activeRound?.current_question, activeRound?.status]);

  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!session) return null;

  if (showIntro) {
    return <IntroVideo onVideoEnd={handleIntroEnd} />;
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><WaitingScreen message="Loading..." /></div>;

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-lg max-w-md">
          <h3 className="font-bold mb-2">Connection Error</h3>
          <p className="text-sm">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">Reload Page</Button>
        </div>
      </div>
    );
  }

  // ============================================================
  // CONDITIONAL OVERLAYS - Render at top level for instant display
  // ============================================================
  
  // Show disqualification overlay immediately when isDisqualified is true
  if (isDisqualified) {
    return <DisqualificationOverlay teamId={session.teamId} />;
  }

  // Show elimination/qualification overlay when eliminationState is set
  if (eliminationState) {
    return (
      <EliminationOverlay 
        isEliminated={eliminationState.eliminated} 
        isQualified={eliminationState.qualified} 
        roundNumber={eliminationState.round} 
      />
    );
  }

  // ============================================================
  // MAIN COMPETITION UI
  // ============================================================

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 grid-bg opacity-10" />

      <MuteButton isMuted={isMuted} onToggle={toggleMute} />

      <header className="relative z-10 flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-primary" />
          <span className="font-display text-sm uppercase tracking-wider text-gradient-neon">The Prompters</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-muted-foreground">
            {session.teamId} • Section {session.section}
          </span>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <WarningNotice warningCount={warningCount} />

      {activeRound && (
        <CountdownOverlay isVisible={showCountdown} onComplete={handleCountdownComplete} roundNumber={activeRound.round_number} />
      )}

      <main className="relative z-10 p-6">
        {!activeRound && <WaitingScreen />}

        {activeRound?.status === 'countdown' && !showCountdown && <WaitingScreen message="Round starting..." />}

        {activeRound?.status === 'active' && activeRound.round_number === 1 && currentQuestion && (
          <Round1 question={currentQuestion} questionStartedAt={activeRound.question_started_at} onSubmitted={() => {}} />
        )}

        {activeRound?.status === 'active' && activeRound.round_number === 2 && currentQuestion && (
          <Round2 question={currentQuestion} questionStartedAt={activeRound.question_started_at} onSubmitted={() => {}} />
        )}

        {activeRound?.status === 'active' && activeRound.round_number === 3 && currentQuestion && (
          <Round3 question={currentQuestion} questionStartedAt={activeRound.question_started_at} onSubmitted={() => {}} />
        )}

        {activeRound?.status === 'active' && activeRound.round_number === 4 && currentQuestion && (
          <FinalRound question={currentQuestion} questionStartedAt={activeRound.question_started_at} onSubmitted={() => {}} />
        )}

        {activeRound?.status === 'completed' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <h2 className="font-display text-2xl text-primary neon-glow uppercase">
              {activeRound.round_number === 4 ? 'Final Round' : `Round ${activeRound.round_number}`} Complete
            </h2>
            <p className="font-mono text-sm text-muted-foreground">Results are being evaluated...</p>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Competition;

