"use client";

import { useState } from "react";
import { useAdminResource } from "@/hooks/use-phase3";

type Metric = "users" | "projects" | "deployments" | "revenue";
const TABS: { metric: Metric; label: string }[] = [
  { metric: "users", label: "Users" },
  { metric: "projects", label: "Projects" },
  { metric: "deployments", label: "Deployments" },
  { metric: "revenue", label: "Revenue" },
];

interface GrowthPoint { date: string; value: number }
interface GrowthResponse { metric: Metric; days: number; points: GrowthPoint[] }

const WIDTH = 800;
const HEIGHT = 180;
const PAD_X = 30;
const PAD_TOP = 15;
const PAD_BOTTOM = 15;

/** Builds a real polyline (and its filled-area twin) from actual data
 * points — no hand-drawn path. A flat series (all-zero, e.g. revenue with
 * no payments yet) still renders as a flat real line rather than dividing
 * by zero. */
function buildPaths(points: GrowthPoint[]) {
  if (points.length === 0) return { line: "", area: "" };
  const values = points.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, min + 1);
  const plotWidth = WIDTH - PAD_X * 2;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const coords = points.map((p, i) => {
    const x = PAD_X + (points.length === 1 ? 0 : (i / (points.length - 1)) * plotWidth);
    const y = PAD_TOP + plotHeight - ((p.value - min) / (max - min)) * plotHeight;
    return [x, y] as const;
  });

  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [firstX] = coords[0]!;
  const [lastX] = coords[coords.length - 1]!;
  const area = `${line} L${lastX.toFixed(1)} ${HEIGHT - PAD_BOTTOM + 5} L${firstX.toFixed(1)} ${HEIGHT - PAD_BOTTOM + 5} Z`;
  return { line, area };
}

export function GrowthChart() {
  const [metric, setMetric] = useState<Metric>("users");
  const { data, isLoading } = useAdminResource<GrowthResponse>(`/admin/growth?metric=${metric}&days=30`);
  const points = data?.points ?? [];
  const { line, area } = buildPaths(points);
  const latest = points[points.length - 1]?.value;

  return (
    <section className="rounded-lg border border-[#20313e] bg-[#101e28] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-white">Platform Growth</h2>
          {latest !== undefined && (
            <p className="text-xs text-slate-500">
              {metric === "revenue" ? `$${(latest / 100).toLocaleString()}` : latest.toLocaleString()} · last 30 days
            </p>
          )}
        </div>

        <div className="flex rounded-lg bg-slate-800 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.metric}
              onClick={() => setMetric(tab.metric)}
              className={`rounded-md px-4 py-1.5 text-xs transition-colors ${tab.metric === metric ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 h-[190px] w-full">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-600">Loading…</div>
        ) : points.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-600">No data yet for this metric.</div>
        ) : (
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full">
            {[30, 70, 110, 150].map((y) => (
              <line key={y} x1={PAD_X} y1={y} x2={WIDTH - PAD_X} y2={y} stroke="#1e293b" strokeWidth="1" />
            ))}
            <defs>
              <linearGradient id="growthArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#growthArea)" />
            <path d={line} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </section>
  );
}
