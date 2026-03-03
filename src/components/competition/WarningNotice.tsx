import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface WarningNoticeProps {
  warningCount: number;
}

export function WarningNotice({ warningCount }: WarningNoticeProps) {
  if (warningCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`mx-4 mt-4 p-4 rounded-lg border flex items-center gap-3 ${
          warningCount >= 3
            ? 'bg-destructive/20 border-destructive/50 text-destructive'
            : warningCount >= 2
            ? 'bg-accent/20 border-accent/50 text-accent'
            : 'bg-primary/10 border-primary/30 text-primary'
        }`}
      >
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="font-display text-sm uppercase tracking-wider">
            {warningCount >= 3 ? 'DISQUALIFIED' : `Warning ${warningCount}/3`}
          </p>
          <p className="font-mono text-xs opacity-80 mt-1">
            {warningCount >= 3
              ? 'Your team has been disqualified for suspicious activity.'
              : `You have ${3 - warningCount} warning(s) remaining. Switching tabs or using developer tools will result in disqualification.`}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
