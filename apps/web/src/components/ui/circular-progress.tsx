interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Tailwind stroke-color class for the filled arc, e.g. "stroke-destructive". Defaults to the primary accent. */
  colorClassName?: string;
  children?: React.ReactNode;
}

/** A radial progress ring with the value rendered in its center — used for
 * the deployment-progress gauge, where a single glanceable percentage
 * matters more than a bar's left-to-right fill direction. */
export function CircularProgress({ value, size = 96, strokeWidth = 8, className, colorClassName = "stroke-primary", children }: CircularProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={className} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className="stroke-muted" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={`${colorClassName} transition-[stroke-dashoffset] duration-500 ease-out`}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="relative flex h-full w-full items-center justify-center" style={{ marginTop: -size }}>
        {children ?? <span className="text-lg font-semibold">{Math.round(clamped)}%</span>}
      </div>
    </div>
  );
}
