import { motion } from 'framer-motion';
import { XCircle, AlertTriangle } from 'lucide-react';

interface DisqualificationOverlayProps {
  teamId: string;
}

export function DisqualificationOverlay({ teamId }: DisqualificationOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
    >
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
          Disqualified
        </motion.h2>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex items-center justify-center gap-2 mb-4"
        >
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <span className="font-mono text-sm text-destructive">Team: {teamId}</span>
        </motion.div>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="font-mono text-muted-foreground"
        >
          Your team has been disqualified from the competition due to suspicious activity.
          Please contact the admin for more information.
        </motion.p>
      </motion.div>
    </motion.div>
  );
}

