import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface CountdownOverlayProps {
  isVisible: boolean;
  onComplete: () => void;
  roundNumber: number;
}

export function CountdownOverlay({ isVisible, onComplete, roundNumber }: CountdownOverlayProps) {
  const [count, setCount] = useState(5);

  useEffect(() => {
    if (!isVisible) {
      setCount(5);
      return;
    }

    if (count <= 0) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(timer);
  }, [isVisible, count, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
        >
          <div className="absolute inset-0 grid-bg scanline opacity-30" />

          <motion.h2
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="font-display text-2xl font-bold text-primary neon-glow mb-8 uppercase tracking-widest"
          >
            Round {roundNumber} Starting
          </motion.h2>

          <motion.div
            key={count}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative"
          >
            {count > 0 ? (
              <span className="font-display text-[150px] font-black text-primary neon-glow leading-none">
                {count}
              </span>
            ) : (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="font-display text-6xl font-black text-primary neon-glow uppercase"
              >
                GO!
              </motion.span>
            )}
          </motion.div>

          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: `${(count / 5) * 100}%` }}
            className="absolute bottom-0 left-0 h-1 bg-primary"
            style={{ boxShadow: '0 0 20px hsl(var(--primary))' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
