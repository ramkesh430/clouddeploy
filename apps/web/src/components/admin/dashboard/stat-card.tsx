export interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon: React.ReactNode;
}

export function StatCard({ title, value, change, positive = true, icon }: StatCardProps) {
  return (
    <div className="rounded-lg border border-[#20313e] bg-[#101e28] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400">{title}</p>
          <h3 className="mt-1 text-xl font-semibold text-white">{value}</h3>
          {change && (
            <p className={`mt-1 text-xs ${positive ? "text-emerald-400" : "text-amber-400"}`}>
              {positive ? "↑" : "↓"} {change}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
