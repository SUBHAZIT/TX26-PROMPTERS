import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal, Award, Zap } from 'lucide-react';
import { MuteButton } from '@/components/competition/MuteButton';
import { useBackgroundMusic } from '@/hooks/useBackgroundMusic';

const podiumColors = [
  'from-yellow-400 to-yellow-600', // 1st - gold
  'from-gray-300 to-gray-500',     // 2nd - silver
  'from-amber-600 to-amber-800',   // 3rd - bronze
];

const podiumHeights = ['h-48', 'h-36', 'h-28'];
const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd for display

const Winners = () => {
  const { isMuted, toggleMute, play } = useBackgroundMusic();
  const [winners, setWinners] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    play();
    const fetchWinners = async () => {
      const [{ data: qt }, { data: t }] = await Promise.all([
        supabase.from('qualified_teams').select('*').eq('qualified_from_round', 4),
        supabase.from('teams').select('*'),
      ]);
      if (qt) setWinners(qt.slice(0, 3));
      if (t) setTeams(t);
    };
    fetchWinners();

    const channel = supabase
      .channel('winners_watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qualified_teams' }, () => fetchWinners())
      .subscribe();

    setTimeout(() => setRevealed(true), 1000);
    return () => { supabase.removeChannel(channel); };
  }, []);

  const getTeam = (teamId: string) => teams.find(t => t.team_id === teamId);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-10" />
      <div className="absolute inset-0 scanline" />

      {/* Ambient glows */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[200px]" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[200px]" />

      <MuteButton isMuted={isMuted} onToggle={toggleMute} />

      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="text-center mb-16 relative z-10"
      >
        <Zap className="w-16 h-16 text-primary mx-auto mb-4" style={{ filter: 'drop-shadow(0 0 20px hsl(var(--primary)))' }} />
        <h1 className="font-display text-5xl md:text-7xl font-black uppercase text-gradient-neon mb-4">
          The Prompters
        </h1>
        <p className="font-mono text-xl text-muted-foreground tracking-wider animate-pulse-neon">
          WINNERS ANNOUNCEMENT
        </p>
      </motion.div>

      {winners.length === 0 ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-mono text-lg text-muted-foreground"
        >
          Winners will be announced soon...
        </motion.p>
      ) : (
        <div className="flex items-end justify-center gap-6 md:gap-10 relative z-10">
          {podiumOrder.map((pos, displayIdx) => {
            const winner = winners[pos];
            if (!winner) return <div key={pos} className="w-32" />;
            const team = getTeam(winner.team_id);
            const icons = [Trophy, Medal, Award];
            const Icon = icons[pos];

            return (
              <motion.div
                key={winner.id}
                initial={{ opacity: 0, y: 100 }}
                animate={revealed ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.5 + pos * 0.8, duration: 0.8, type: 'spring' }}
                className="flex flex-col items-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={revealed ? { scale: 1 } : {}}
                  transition={{ delay: 1.5 + pos * 0.8, type: 'spring' }}
                  className="mb-4"
                >
                  <Icon className={`w-12 h-12 ${pos === 0 ? 'text-yellow-400' : pos === 1 ? 'text-gray-300' : 'text-amber-600'}`}
                    style={{ filter: `drop-shadow(0 0 15px ${pos === 0 ? '#facc15' : pos === 1 ? '#9ca3af' : '#d97706'})` }}
                  />
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={revealed ? { opacity: 1 } : {}}
                  transition={{ delay: 2 + pos * 0.8 }}
                  className="font-display text-2xl md:text-3xl font-black uppercase text-foreground mb-1"
                >
                  {winner.team_id}
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={revealed ? { opacity: 1 } : {}}
                  transition={{ delay: 2.2 + pos * 0.8 }}
                  className="font-mono text-sm text-muted-foreground mb-4"
                >
                  {team?.leader_name || ''} • Section {team?.section || ''}
                </motion.p>

                <motion.div
                  initial={{ height: 0 }}
                  animate={revealed ? { height: 'auto' } : {}}
                  transition={{ delay: 0.3 + pos * 0.8, duration: 1 }}
                  className={`w-28 md:w-36 ${podiumHeights[pos]} bg-gradient-to-t ${podiumColors[pos]} rounded-t-xl flex items-center justify-center`}
                >
                  <span className="font-display text-4xl font-black text-background/80">
                    #{pos + 1}
                  </span>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Winners;
