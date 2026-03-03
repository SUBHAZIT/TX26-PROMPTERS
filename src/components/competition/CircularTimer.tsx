import { motion } from 'framer-motion';

interface CircularTimerProps {
  timeLeft: number;
  totalTime: number;
  size?: number;
}

export function CircularTimer({ timeLeft, totalTime, size = 120 }: CircularTimerProps) {
  const progress = totalTime > 0 ? timeLeft / totalTime : 0;
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const getColor = () => {
    if (progress > 0.5) return 'hsl(var(--primary))';
    if (progress > 0.2) return 'hsl(var(--neon-orange))';
    return 'hsl(var(--destructive))';
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="6"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ filter: `drop-shadow(0 0 8px ${getColor()})` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-2xl font-bold" style={{ color: getColor() }}>
          {timeLeft}
        </span>
      </div>
    </div>
  );
}
