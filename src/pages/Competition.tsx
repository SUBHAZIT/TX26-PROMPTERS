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

  // Fetch warning count
  useEffect(() => {
    if (!session) return;
    const fetchWarnings = async () => {
      const { data } = await supabase.from('teams').select('warning_count, status').eq('team_id', session.teamId).maybeSingle();
      if (data) {
        setWarningCount(data.warning_count);
        setTeamStatus(data.status);
        // Check if disqualified
        if (data.status === 'disqualified') {
          setIsDisqualified(true);
        }
      }
    };
    fetchWarnings();
    
    // Subscribe to team status changes (disqualification, warnings)
    const channel = supabase
      .channel('team_status_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams', filter: `team_id=eq.${session.teamId}` }, (payload: any) => {
        setWarningCount(payload.new.warning_count);
        setTeamStatus(payload.new.status);
        // Check if disqualified
        if (payload.new.status === 'disqualified') {
          setIsDisqualified(true);
        } else {
          setIsDisqualified(false);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const handleIntroEnd = useCallback(() => {
    setShowIntro(false);
    play();
  }, [play]);

  // Real-time subscription for qualified_teams changes - auto refresh elimination status
  useEffect(() => {
    if (!session) return;
    
    const channel = supabase
      .channel('competition_qualified_teams')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'qualified_teams' 
      }, () => {
        // Refetch elimination status when qualified_teams changes
        checkEliminationStatus();
      })
      .subscribe();

    // Also subscribe to round_state changes for auto-refresh
    const roundChannel = supabase
      .channel('competition_round_state')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'round_state' 
      }, () => {
        // Refetch elimination status when round state changes
        checkEliminationStatus();
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel);
      supabase.removeChannel(roundChannel);
    };
  }, [session]);

  // Check elimination status function - extracted for reusability
  const checkEliminationStatus = useCallback(async () => {
    if (!session) return;
    
    // First check if team is disqualified
    const { data: teamData } = await supabase.from('teams')
      .select('status')
      .eq('team_id', session.teamId)
      .maybeSingle();
    
    if (teamData?.status === 'disqualified') {
      setIsDisqualified(true);
      return;
    }
    
    setIsDisqualified(false);
    
    const completedRounds = rounds.filter(r => r.status === 'completed');
    if (completedRounds.length === 0) return;

    const lastCompleted = completedRounds[completedRounds.length - 1];
    const nextRound = rounds.find(r => r.round_number === lastCompleted.round_number + 1);
    
    // Only show elimination if next round is pending (not started yet)
    if (!nextRound || nextRound.status === 'pending') {
      const { data: qualified } = await supabase.from('qualified_teams')
        .select('*')
        .eq('team_id', session.teamId)
        .eq('qualified_from_round', lastCompleted.round_number)
        .maybeSingle();

      if (qualified) {
        setEliminationState({ eliminated: false, qualified: true, round: lastCompleted.round_number });
      } else {
        // Check if there are any qualified teams (to confirm round was evaluated)
        const { data: anyQualified } = await supabase.from('qualified_teams')
          .select('id')
          .eq('qualified_from_round', lastCompleted.round_number)
          .limit(1);
          
        if (anyQualified && anyQualified.length > 0) {
          setEliminationState({ eliminated: true, qualified: false, round: lastCompleted.round_number });
        }
      }
    }
  }, [session, rounds]);

  // Check elimination status when rounds complete
  useEffect(() => {
    checkEliminationStatus();
  }, [rounds, checkEliminationStatus]);

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

  // Show elimination overlay
  if (isDisqualified) {
    return <DisqualificationOverlay teamId={session.teamId} />;
  }

  if (eliminationState) {
    return <EliminationOverlay isEliminated={eliminationState.eliminated} isQualified={eliminationState.qualified} roundNumber={eliminationState.round} />;
  }

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
