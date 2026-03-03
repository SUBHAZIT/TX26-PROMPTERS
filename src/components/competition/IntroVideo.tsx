import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface IntroVideoProps {
  onVideoEnd: () => void;
}

export function IntroVideo({ onVideoEnd }: IntroVideoProps) {
  const [show, setShow] = useState(true);

  const handleEnd = () => {
    setShow(false);
    setTimeout(onVideoEnd, 500);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background flex items-center justify-center"
        >
          <video
            src="/intro-video.mp4"
            autoPlay
            playsInline
            onEnded={handleEnd}
            className="w-full h-full object-contain"
          />
          <button
            onClick={handleEnd}
            className="absolute bottom-8 right-8 font-mono text-xs text-muted-foreground hover:text-primary px-4 py-2 glass-panel rounded-lg transition-colors"
          >
            Skip →
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
