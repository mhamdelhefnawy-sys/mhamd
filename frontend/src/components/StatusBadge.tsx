const SEVERITY_STYLES: Record<string, string> = {
  GREEN: "bg-emerald-500/15 text-emerald-400",
  YELLOW: "bg-amber-500/15 text-amber-400",
  RED: "bg-rose-500/15 text-rose-400",
  BLACK: "bg-slate-100/15 text-slate-100",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`badge ${SEVERITY_STYLES[severity] ?? "bg-slate-500/15 text-slate-300"}`}>{severity}</span>;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-500/15 text-slate-300",
  SUBMITTED: "bg-sky-500/15 text-sky-400",
  REVIEWED: "bg-indigo-500/15 text-indigo-400",
  APPROVED: "bg-emerald-500/15 text-emerald-400",
  POSTED: "bg-emerald-500/15 text-emerald-400",
  REVERSED: "bg-rose-500/15 text-rose-400",
  REJECTED: "bg-rose-500/15 text-rose-400",
  FINALIZED: "bg-emerald-500/15 text-emerald-400",
  UNDER_REVIEW: "bg-amber-500/15 text-amber-400",
  ACTIVE: "bg-emerald-500/15 text-emerald-400",
  ON_HOLD: "bg-amber-500/15 text-amber-400",
  CLOSED: "bg-slate-500/15 text-slate-300",
  PLANNING: "bg-sky-500/15 text-sky-400",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLES[status] ?? "bg-slate-500/15 text-slate-300"}`}>{status.replace(/_/g, " ")}</span>;
}
