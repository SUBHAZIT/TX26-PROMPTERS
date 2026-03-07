import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useTeamSession } from '@/hooks/useTeamSession';
import { useRoundState } from '@/hooks/useRoundState';
import { useTeamAccessControl } from '@/hooks/useTeamAccessControl';
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
  const { activeRound, rounds, loading: roundsLoading, error: roundsError } = useRoundState();
  
  // ============================================================
  // STATE-BASED ACCESS CONTROL HOOK
  // Handles: isDisqualified, isEliminated (permanent), isQualified
  // Priority: Disqualified > Eliminated > Qualified > Active
  // ============================================================
  const { 
    isDisqualified, 
    isEliminated, 
    isQualified, 
    qualificationRound,
    clearQualifiedStatus,
    isLoading: accessLoading
  } = useTeamAccessControl(session);
  
  useAntiCheat();
  const { isMuted, toggleMute, play } = useBackgroundMusic();

  const [showIntro, setShowIntro] = useState(true);
  const [showCountdown, setShowCountdown] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [warningCount, setWarningCount] = useState(0);

  // Redirect if no session
  useEffect(() => {
    if (!session) navigate('/');
  }, [session, navigate]);

  // Fetch initial warning count
  useEffect(() => {
    if (!session) return;
    
    const fetchTeamStatus = async () => {
      const { data } = await supabase
        .from('teams')
        .select('warning_count')
        .eq('team_id', session.teamId)
        .maybeSingle();
      
      if (data) {
        setWarningCount(data.warning_count || 0);
      }
    };
    fetchTeamStatus();
  }, [session]);

  // Handle intro video completion
  const handleIntroEnd = useCallback(() => {
    setShowIntro(false);
    play();
  }, [play]);

  // Clear qualified status when new round starts (but NOT elimination - that's permanent!)
  useEffect(() => {
    if (activeRound?.status === 'countdown' || activeRound?.status === 'active') {
      // Clear qualified status when round actually starts
      // Note: isEliminated stays true permanently - this is intentional!
      clearQualifiedStatus();
    }
  }, [activeRound?.status, clearQualifiedStatus]);

  // Show countdown when round enters countdown status
  useEffect(() => {
    if (activeRound?.status === 'countdown') {
      setShowCountdown(true);
    }
  }, [activeRound?.status]);

  // Fetch current question for active rounds
  useEffect(() => {
    if (!activeRound || activeRound.status !== 'active') {
      setCurrentQuestion(null);
      return;
    }

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

  // Wait for session
  if (!session) return null;

  // Show intro video first
  if (showIntro) {
    return <IntroVideo onVideoEnd={handleIntroEnd} />;
  }

  // Show loading state
  if (roundsLoading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <WaitingScreen message="Loading competition..." />
      </div>
    );
  }

  // Show error state
  if (roundsError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-lg max-w-md">
          <h3 className="font-bold mb-2">Connection Error</h3>
          <p className="text-sm">{roundsError}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

  // ============================================================
  // PRIORITY 1: DISQUALIFIED (Highest) - Blocks everything
  // If admin sets is_disqualified back to false, re-qualify immediately
  // ============================================================
  if (isDisqualified) {
    return <DisqualificationOverlay teamId={session.teamId} />;
  }

  // ============================================================
  // PRIORITY 2: ELIMINATED (Permanent) - Blocks everything
  // Once eliminated, they can NEVER re-enter the competition
  // ============================================================
  if (isEliminated) {
    return (
      <EliminationOverlay 
        isEliminated={true} 
        isQualified={false} 
        roundNumber={qualificationRound || 1} 
      />
    );
  }

  // ============================================================
  // PRIORITY 3: QUALIFIED - Show success message until next round starts
  // ============================================================
  if (isQualified) {
    return (
      <EliminationOverlay 
        isEliminated={false} 
        isQualified={true} 
        roundNumber={qualificationRound || 1} 
      />
    );
  }

  // ============================================================
  // PRIORITY 4: ACTIVE PLAY - Normal competition flow
  // ============================================================

  return (
    <div className="min-h-screen relative">
      {/* Background grid pattern */}
      <div className="absolute inset-0 grid-bg opacity-10" />

      <MuteButton isMuted={isMuted} onToggle={toggleMute} />

      <header className="relative z-10 flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-primary" />
          <span className="font-display text-sm uppercase tracking-wider text-gradient-neon">
            The Prompters
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-muted-foreground">
            {session.teamId} • Section {session.section}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout} 
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <WarningNotice warningCount={warningCount} />

      {/* Countdown overlay */}
      {activeRound && (
        <CountdownOverlay 
          isVisible={showCountdown} 
          onComplete={handleCountdownComplete} 
          roundNumber={activeRound.round_number} 
        />
      )}

      <main className="relative z-10 p-6">
        {/* No active round - show waiting screen */}
        {!activeRound && <WaitingScreen />}

        {/* Round in countdown but not showing countdown overlay */}
        {activeRound?.status === 'countdown' && !showCountdown && (
          <WaitingScreen message="Round starting..." />
        )}

        {/* ============================================================ */}
        {/* LOGIC GATE: Round components are blocked if: */}
        {/* - isDisqualified is true (already handled above) */}
        {/* - isEliminated is true (already handled above) */}
        {/* - isQualified is true (already handled above) */}
        {/* ============================================================ */}
        
        {/* Round 1 */}
        {activeRound?.status === 'active' && activeRound.round_number === 1 && currentQuestion && (
          <Round1 
            question={currentQuestion} 
            questionStartedAt={activeRound.question_started_at} 
            onSubmitted={() => {}} 
          />
        )}

        {/* Round 2 */}
        {activeRound?.status === 'active' && activeRound.round_number === 2 && currentQuestion && (
          <Round2 
            question={currentQuestion} 
            questionStartedAt={activeRound.question_started_at} 
            onSubmitted={() => {}} 
          />
        )}

        {/* Round 3 */}
        {activeRound?.status === 'active' && activeRound.round_number === 3 && currentQuestion && (
          <Round3 
            question={currentQuestion} 
            questionStartedAt={activeRound.question_started_at} 
            onSubmitted={() => {}} 
          />
        )}

        {/* Final Round */}
        {activeRound?.status === 'active' && activeRound.round_number === 4 && currentQuestion && (
          <FinalRound 
            question={currentQuestion} 
            questionStartedAt={activeRound.question_started_at} 
            onSubmitted={() => {}} 
          />
        )}

        {/* Round completed */}
        {activeRound?.status === 'completed' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="flex flex-col items-center justify-center min-h-[60vh] gap-4"
          >
            <h2 className="font-display text-2xl text-primary neon-glow uppercase">
              {activeRound.round_number === 4 ? 'Final Round' : `Round ${activeRound.round_number}`} Complete
            </h2>
            <p className="font-mono text-sm text-muted-foreground">
              Results are being evaluated...
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Competition;

