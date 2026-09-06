interface Segment {
  label: string;
  value: number;
  color: string; // tailwind stroke-* class
  legendColor: string; // tailwind bg-* class
}

/** A genuinely proportional donut — each segment's real share of the real
 * total, drawn as its own arc (stacked stroke-dasharray/-dashoffset circles),
 * not a single solid-color ring standing in for the whole chart. */
export function DeploymentsDonut({ total, segments }: { total: number; segments: Segment[] }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="flex flex-col items-center justify-around gap-6 sm:flex-row">
      <div className="relative flex h-36 w-36 items-center justify-center">
        <svg className="h-36 w-36 -rotate-90" viewBox="0 0 144 144">
          <circle cx="72" cy="72" r={radius} fill="none" stroke="currentColor" strokeWidth="18" className="text-slate-800" />
          {total > 0 &&
            segments
              .filter((s) => s.value > 0)
              .map((s) => {
                const length = (s.value / total) * circumference;
                const dashoffset = -cumulative;
                cumulative += length;
                return (
                  <circle
                    key={s.label}
                    cx="72"
                    cy="72"
                    r={radius}
                    fill="none"
                    strokeWidth="18"
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={dashoffset}
                    className={s.color}
                  />
                );
              })}
        </svg>
        <div className="absolute text-center">
          <p className="text-2xl font-semibold text-white">{total}</p>
          <p className="text-xs text-slate-500">Total</p>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        {segments.map((s) => (
          <Legend key={s.label} color={s.legendColor} label={s.label} value={String(s.value)} percent={total > 0 ? `${Math.round((s.value / total) * 100)}%` : "0%"} />
        ))}
      </div>
    </div>
  );
}

function Legend({ color, label, value, percent }: { color: string; label: string; value: string; percent: string }) {
  return (
    <div className="grid grid-cols-[12px_100px_45px_40px] items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
      <span className="text-right text-slate-600">{percent}</span>
    </div>
  );
}
