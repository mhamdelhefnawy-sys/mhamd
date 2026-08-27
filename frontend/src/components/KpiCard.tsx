import { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  sub,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
  icon?: ReactNode;
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-400"
      : tone === "warn"
      ? "text-amber-400"
      : tone === "bad"
      ? "text-rose-400"
      : "text-slate-100";
  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
        {icon}
      </div>
      <span className={`text-xl font-semibold ${toneClass}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}
