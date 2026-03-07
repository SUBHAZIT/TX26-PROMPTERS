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
  const [warningCount, setWarningCount] = useState(0);
  const [teamStatus, setTeamStatus] = useState<string | null>(null);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [isEliminated, setIsEliminated] = useState(false);

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

  // Dedicated useEffect for qualified_teams realtime subscription
  // This directly checks against round_state.current_round for instant elimination
  useEffect(() => {
    if (!session) return;
    
    let isMounted = true;
    const teamId = session.teamId;

    const checkEliminationStatus = async () => {
      if (!isMounted) return;
      
      // First check if the team is disqualified
      const { data: teamData } = await supabase
        .from('teams')
        .select('status')
        .eq('team_id', teamId)
        .maybeSingle();
      
      if (!isMounted) return;
      
      if (teamData?.status === 'disqualified') {
        setIsDisqualified(true);
        setIsEliminated(false);
        return;
      }
      
      setIsDisqualified(false);
      
      // Get current round from round_state table
      const { data: roundStateData } = await supabase
        .from('round_state')
        .select('*')
        .limit(1)
        .single();
      
      if (!isMounted) return;
      
      // If there's no valid round state, don't set elimination
      if (!roundStateData) {
        setIsEliminated(false);
        return;
      }
      
      const currentRound = roundStateData.round_number;
      
      // For rounds 2-4, check if the team qualified from the previous round
      if (currentRound > 1) {
        const previousRound = currentRound - 1;
        
        // Check if the team is in qualified_teams for the previous round
        const { data: qualifiedData } = await supabase
          .from('qualified_teams')
          .select('*')
          .eq('team_id', teamId)
          .eq('qualified_from_round', previousRound)
          .maybeSingle();
        
        if (!isMounted) return;
        
        // If not qualified for this round, set isEliminated to true
        if (!qualifiedData) {
          // Check if any teams were qualified (to confirm round was evaluated)
          const { data: anyQualified } = await supabase
            .from('qualified_teams')
            .select('id')
            .eq('qualified_from_round', previousRound)
            .limit(1);
          
          if (!isMounted) return;
          
          // Only set eliminated if there are qualified teams (round was evaluated)
          if (anyQualified && anyQualified.length > 0) {
            setIsEliminated(true);
          }
        } else {
          setIsEliminated(false);
        }
      } else {
        // Round 1 - reset elimination
        setIsEliminated(false);
      }
    };

    // Initial check
    checkEliminationStatus();

    // Subscribe to qualified_teams table for real-time updates
    const qualifiedTeamsChannel = supabase
      .channel('elimination_check_qualified_teams')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'qualified_teams'
        },
        (payload) => {
          console.log('[Realtime] Qualified teams changed:', payload);
          checkEliminationStatus();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Qualified teams channel status:', status);
      });

    // Subscribe to round_state for current_round changes
    const roundStateChannel = supabase
      .channel('elimination_check_round_state')
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

    return () => {
      isMounted = false;
      supabase.removeChannel(qualifiedTeamsChannel);
      supabase.removeChannel(roundStateChannel);
    };
  }, [session]);

  // useEffect for disqualification status
  useEffect(() => {
    if (!session) return;
    
    let isMounted = true;
    const teamId = session.teamId;

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
        setIsEliminated(false);
      } else {
        setIsDisqualified(false);
      }
    };

    checkDisqualificationStatus();

    const teamsChannel = supabase
      .channel('disqualification_check')
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
            setIsEliminated(false);
          } else {
            setIsDisqualified(false);
          }
          setWarningCount(payload.new.warning_count || 0);
          setTeamStatus(payload.new.status);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Teams channel status:', status);
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(teamsChannel);
    };
  }, [session]);

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
      setIsEliminated(false);
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
  
  // STATE PRIORITY: Disqualified check first - blocks everything
  if (isDisqualified) {
    return <DisqualificationOverlay teamId={session.teamId} />;
  }

  // ELIMINATION LOCK: Eliminated check second - blocks round components
  if (isEliminated) {
    // Get current round to display in overlay
    const currentRound = rounds.find(r => r.status === 'active' || r.status === 'countdown');
    return (
      <EliminationOverlay 
        isEliminated={true} 
        isQualified={false} 
        roundNumber={currentRound?.round_number || 1} 
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

        {/* LOGIC GATE: Only render round components if NOT eliminated AND NOT disqualified */}
        {!isEliminated && !isDisqualified && activeRound?.status === 'active' && activeRound.round_number === 1 && currentQuestion && (
          <Round1 question={currentQuestion} questionStartedAt={activeRound.question_started_at} onSubmitted={() => {}} />
        )}

        {!isEliminated && !isDisqualified && activeRound?.status === 'active' && activeRound.round_number === 2 && currentQuestion && (
          <Round2 question={currentQuestion} questionStartedAt={activeRound.question_started_at} onSubmitted={() => {}} />
        )}

        {!isEliminated && !isDisqualified && activeRound?.status === 'active' && activeRound.round_number === 3 && currentQuestion && (
          <Round3 question={currentQuestion} questionStartedAt={activeRound.question_started_at} onSubmitted={() => {}} />
        )}

        {!isEliminated && !isDisqualified && activeRound?.status === 'active' && activeRound.round_number === 4 && currentQuestion && (
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

