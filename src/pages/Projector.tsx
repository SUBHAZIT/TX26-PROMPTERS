
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useRoundState } from '@/hooks/useRoundState';
import { useBackgroundMusic } from '@/hooks/useBackgroundMusic';
import { CircularTimer } from '@/components/competition/CircularTimer';
import { IntroVideo } from '@/components/competition/IntroVideo';
import { MuteButton } from '@/components/competition/MuteButton';
import { useServerTimer } from '@/hooks/useServerTimer';
import { Zap, RefreshCw } from 'lucide-react';

const Projector = () => {
  const { activeRound, refetch } = useRoundState();
  const { isMuted, toggleMute, play } = useBackgroundMusic();
  const [showIntro, setShowIntro] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleIntroEnd = useCallback(() => {
    setShowIntro(false);
    play();
  }, [play]);

  // Auto-refresh: Subscribe to round_state changes for real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('projector_round_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'round_state' 
      }, () => {
        refetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  // Additional polling fallback every 3 seconds
  useEffect(() => {
    const pollInterval = setInterval(() => {
      refetch();
      setIsRefreshing(true);
      setTimeout(() => setIsRefreshing(false), 500);
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [refetch]);

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

  const roundLabel = (n: number) => n === 4 ? 'Final Round' : `Round ${n}`;

  if (showIntro) {
    return <IntroVideo onVideoEnd={handleIntroEnd} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-10" />
      <div className="absolute inset-0 scanline" />

      <MuteButton isMuted={isMuted} onToggle={toggleMute} />
      
      {/* Auto-refresh indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-2 text-muted-foreground">
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        <span className="font-mono text-xs">Auto-refreshing</span>
      </div>

      <AnimatePresence mode="wait">
        {!activeRound && (
          <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
            <Zap className="w-32 h-32 text-primary mx-auto mb-8" style={{ filter: 'drop-shadow(0 0 30px hsl(var(--primary)))' }} />
            <h1 className="font-display text-8xl font-black uppercase text-gradient-neon mb-6">The Prompters</h1>
            <p className="font-mono text-3xl text-muted-foreground animate-pulse-neon">Competition will begin shortly...</p>
          </motion.div>
        )}

        {activeRound?.status === 'countdown' && (
          <motion.div key="countdown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
            <h2 className="font-display text-6xl text-primary neon-glow uppercase mb-6">{roundLabel(activeRound.round_number)}</h2>
            <p className="font-mono text-4xl text-muted-foreground animate-pulse-neon">Starting...</p>
          </motion.div>
        )}

        {activeRound?.status === 'active' && currentQuestion && (
          <ProjectorQuestion question={currentQuestion} round={activeRound} />
        )}

        {activeRound?.status === 'completed' && (
          <motion.div key="completed" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center">
            <h2 className="font-display text-7xl text-primary neon-glow uppercase mb-6">{roundLabel(activeRound.round_number)} Complete</h2>
            <p className="font-mono text-2xl text-muted-foreground animate-pulse-neon mt-6">Results are being evaluated...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function ProjectorQuestion({ question, round }: { question: any; round: any }) {
  const { timeLeft } = useServerTimer({
    questionStartedAt: round.question_started_at,
    timerSeconds: question.timer_seconds,
    isActive: true,
  });

  const roundLabel = round.round_number === 4 ? 'Final' : `Round ${round.round_number}`;
  const isAIRound = round.round_number === 3 || round.round_number === 4;

  return (
    <motion.div
      key={`q-${round.round_number}-${question.question_number}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      className="text-center w-full max-w-6xl px-8"
    >
      <div className="flex items-center justify-between mb-10">
        <span className="font-mono text-3xl text-muted-foreground">
          {roundLabel} • Question {question.question_number}
        </span>
        <CircularTimer timeLeft={timeLeft} totalTime={question.timer_seconds} size={140} />
      </div>

      {question.image_url && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-10">
          <img 
            src={question.image_url} 
            alt="Question" 
            className="max-h-[70vh] mx-auto rounded-3xl border-4 border-border shadow-2xl" 
            draggable={false} 
            onContextMenu={(e) => e.preventDefault()} 
          />
        </motion.div>
      )}

      {question.question_type === 'text_hint' && question.question_text && (
        <div className="glass-panel neon-border p-10 rounded-3xl mb-10 max-w-4xl mx-auto">
          <p className="font-mono text-xl text-muted-foreground uppercase tracking-wider mb-4">Text Hint</p>
          <h2 className="font-display text-5xl text-foreground">{question.question_text}</h2>
        </div>
      )}

      <div className="glass-panel p-6 rounded-xl inline-block">
        <p className="font-mono text-2xl text-muted-foreground">
          {isAIRound ? '🎨 Use AI to recreate this image & upload' : '🔍 Search & upload this image'}
        </p>
      </div>
    </motion.div>
  );
}

export default Projector;

