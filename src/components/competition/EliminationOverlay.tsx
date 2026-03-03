import { motion } from 'framer-motion';
import { XCircle, Trophy } from 'lucide-react';

interface EliminationOverlayProps {
  isEliminated: boolean;
  isQualified: boolean;
  roundNumber: number;
}

export function EliminationOverlay({ isEliminated, isQualified, roundNumber }: EliminationOverlayProps) {
  if (!isEliminated && !isQualified) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
    >
      {isEliminated ? (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.8 }}
          className="text-center max-w-md px-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
          >
            <XCircle className="w-24 h-24 text-destructive mx-auto mb-6" style={{ filter: 'drop-shadow(0 0 20px hsl(var(--destructive)))' }} />
          </motion.div>
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="font-display text-4xl text-destructive uppercase mb-4"
          >
            Eliminated
          </motion.h2>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="font-mono text-muted-foreground"
          >
            You did not qualify from Round {roundNumber}. Thank you for participating!
          </motion.p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.8 }}
          className="text-center max-w-md px-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
          >
            <Trophy className="w-24 h-24 text-primary mx-auto mb-6" style={{ filter: 'drop-shadow(0 0 20px hsl(var(--primary)))' }} />
          </motion.div>
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="font-display text-4xl text-primary neon-glow uppercase mb-4"
          >
            Qualified!
          </motion.h2>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="font-mono text-muted-foreground"
          >
            You've advanced to the next round! Get ready...
          </motion.p>
        </motion.div>
      )}
    </motion.div>
  );
}
