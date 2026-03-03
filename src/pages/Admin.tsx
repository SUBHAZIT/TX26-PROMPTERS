import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';

const Admin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    navigate('/admin/dashboard');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-20" />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <div className="text-center mb-10">
          <Shield className="w-10 h-10 text-neon-purple mx-auto mb-4" style={{ filter: 'drop-shadow(0 0 12px hsl(var(--neon-purple)))' }} />
          <h1 className="font-display text-3xl font-black uppercase tracking-wider neon-glow-purple">
            Admin Panel
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-2">THE PROMPTERS // CONTROL CENTER</p>
        </div>

        <div className="glass-panel neon-border p-8 space-y-6">
          <div className="space-y-2">
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="bg-secondary border-border font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-secondary border-border font-mono"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          {error && <p className="font-mono text-sm text-destructive">{error}</p>}
          <Button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-accent text-accent-foreground font-display uppercase tracking-wider py-6"
          >
            {loading ? 'Authenticating...' : 'Access Dashboard'}
          </Button>
        </div>

        <p className="text-center mt-6">
          <button onClick={() => navigate('/')} className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors">
            ← Back to Team Login
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Admin;
