interface RingProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  showIcon?: boolean;
}

export const RingProgress = ({
  percentage,
  size = 120,
  strokeWidth = 10,
  color = "black",
  showIcon = true,
}: RingProgressProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--ring-bg))"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {showIcon && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">🔥</span>
        </div>
      )}
    </div>
  );
};
