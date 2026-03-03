import { motion } from 'framer-motion';

export function WaitingScreen({ message }: { message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-[60vh] gap-6"
    >
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-transparent border-b-neon-purple animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
      </div>
      <h2 className="font-display text-xl text-primary neon-glow uppercase tracking-widest">
        {message || 'Waiting for Round to Start'}
      </h2>
      <p className="font-mono text-sm text-muted-foreground animate-pulse-neon">
        Stay on this page. The round will begin automatically.
      </p>
    </motion.div>
  );
}
