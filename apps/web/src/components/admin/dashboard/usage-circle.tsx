export function UsageCircle({ title, percentage, caption }: { title: string; percentage: number; caption: string }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percentage));
  const progress = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <span className="mb-3 text-sm text-slate-400">{title}</span>
      <div className="relative h-20 w-20">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth="7" className="text-slate-800" />
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            className="text-blue-500 transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-base font-semibold text-white">{Math.round(clamped)}%</div>
      </div>
      <span className="mt-3 text-center text-xs text-slate-500">{caption}</span>
    </div>
  );
}
