import { useState, useEffect, useCallback } from 'react';

interface UseServerTimerProps {
  questionStartedAt: string | null;
  timerSeconds: number;
  isActive: boolean;
}

export function useServerTimer({ questionStartedAt, timerSeconds, isActive }: UseServerTimerProps) {
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [isExpired, setIsExpired] = useState(false);

  const calculateTimeLeft = useCallback(() => {
    if (!questionStartedAt || !isActive) return timerSeconds;
    const started = new Date(questionStartedAt).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - started) / 1000);
    return Math.max(0, timerSeconds - elapsed);
  }, [questionStartedAt, timerSeconds, isActive]);

  useEffect(() => {
    if (!isActive) {
      setTimeLeft(timerSeconds);
      setIsExpired(false);
      return;
    }

    const update = () => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) setIsExpired(true);
    };

    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [isActive, calculateTimeLeft, timerSeconds]);

  const progress = timerSeconds > 0 ? timeLeft / timerSeconds : 0;

  return { timeLeft, isExpired, progress };
}
