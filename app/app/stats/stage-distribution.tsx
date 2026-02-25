type StageDistributionProps = {
  totalReviewWords: number;
  activeNow: number;
  frozenNow: number;
  mastered: number;
  phase0: number;
  phase1: number;
  phase2: number;
  reviewCoverage: number;
  newWords: number;
};

function ratio(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return (value / total) * 100;
}

export function StageDistribution({
  totalReviewWords,
  activeNow,
  frozenNow,
  mastered,
  phase0,
  phase1,
  phase2,
  reviewCoverage,
  newWords,
}: StageDistributionProps) {
  const rows = [
    { key: "active", label: "Active this round", count: activeNow, color: "bg-cyan-500" },
    { key: "frozen", label: "Frozen", count: frozenNow, color: "bg-amber-500" },
    { key: "mastered", label: "Mastered", count: mastered, color: "bg-emerald-600" },
    { key: "phase0", label: "Phase 0", count: phase0, color: "bg-slate-400" },
    { key: "phase1", label: "Phase 1", count: phase1, color: "bg-blue-500" },
    { key: "phase2", label: "Phase 2", count: phase2, color: "bg-indigo-500" },
  ] as const;

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">Round state distribution</h2>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">{row.label}</span>
              <span className="font-medium text-slate-900">{row.count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-slate-100">
              <div className={`h-full rounded ${row.color}`} style={{ width: `${ratio(row.count, totalReviewWords)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 pt-2 text-xs text-slate-500">
        Review coverage {reviewCoverage}% &nbsp;·&nbsp; {newWords} words not yet started
      </div>
    </section>
  );
}
