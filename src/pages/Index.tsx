import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useTeamSession } from '@/hooks/useTeamSession';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { session, setSession } = useTeamSession();
  const [teamId, setTeamId] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect
  if (session) {
    navigate('/competition');
    return null;
  }

  const handleLogin = async () => {
    setError('');
    setLoading(true);

    const { data: team, error: fetchError } = await supabase
      .from('teams')
      .select('*')
      .eq('team_id', teamId.trim())
      .eq('leader_name', leaderName.trim())
      .maybeSingle();

    if (fetchError || !team) {
      setError('Invalid Team ID or Leader Name. Contact admin.');
      setLoading(false);
      return;
    }

    if (team.status === 'disqualified') {
      setError('Your team has been disqualified.');
      setLoading(false);
      return;
    }

    // Create session token
    const token = crypto.randomUUID();
    await supabase.from('teams').update({ session_token: token }).eq('team_id', teamId.trim());

    setSession({
      teamId: team.team_id,
      leaderName: team.leader_name,
      section: team.section,
      sessionToken: token,
    });

    await supabase.from('activity_logs').insert([{
      team_id: team.team_id,
      event_type: 'login',
      metadata: {} as Record<string, never>,
    }]);

    navigate('/competition');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="absolute inset-0 scanline" />

      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md px-6"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="inline-flex items-center gap-3 mb-4"
          >
            <Zap className="w-10 h-10 text-primary" style={{ filter: 'drop-shadow(0 0 12px hsl(var(--primary)))' }} />
          </motion.div>
          <h1 className="font-display text-4xl md:text-5xl font-black uppercase tracking-wider text-gradient-neon">
            The Prompters
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-3 tracking-wider">
            HACKATHON COMPETITION // 220 TEAMS
          </p>
        </div>

        {/* Login Form */}
        <div className="glass-panel neon-border p-8 space-y-6">
          <div className="space-y-2">
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              Team ID
            </label>
            <Input
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="Enter your Team ID"
              className="bg-secondary border-border font-mono text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              Leader Name
            </label>
            <Input
              value={leaderName}
              onChange={(e) => setLeaderName(e.target.value)}
              placeholder="Enter Leader Name"
              className="bg-secondary border-border font-mono text-foreground placeholder:text-muted-foreground"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-mono text-sm text-destructive"
            >
              {error}
            </motion.p>
          )}

          <Button
            onClick={handleLogin}
            disabled={loading || !teamId.trim() || !leaderName.trim()}
            className="w-full bg-primary text-primary-foreground font-display uppercase tracking-wider text-lg py-6 hover:shadow-[0_0_30px_hsl(var(--primary)/0.5)] transition-shadow"
          >
            {loading ? 'Authenticating...' : 'Enter Competition'}
          </Button>
        </div>

        <p className="text-center font-mono text-xs text-muted-foreground mt-6">
          <button onClick={() => navigate('/admin')} className="text-primary/60 hover:text-primary transition-colors">
            Admin Access →
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Index;
