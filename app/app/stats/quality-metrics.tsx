function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

type QualityMetricsProps = {
  know: number;
  fuzzy: number;
  again: number;
  success: number;
  activeDays: number;
  avgPerActiveDay: string | number;
};

export function QualityMetrics({
  know,
  fuzzy,
  again,
  success,
  activeDays,
  avgPerActiveDay,
}: QualityMetricsProps) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">30-day quality</h2>
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Know</div>
          <div className="text-xl font-semibold text-emerald-600">{know}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Fuzzy</div>
          <div className="text-xl font-semibold text-amber-600">{fuzzy}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Again</div>
          <div className="text-xl font-semibold text-red-500">{again}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Success</div>
          <div className={`text-xl font-semibold ${scoreColor(success)}`}>{success}%</div>
        </div>
      </div>
      <div className="text-xs text-slate-400">
        Success = Known + Fuzzy×50% &nbsp;·&nbsp; Active days {activeDays} &nbsp;·&nbsp; avg{" "}
        {avgPerActiveDay} reviews/day
      </div>
    </section>
  );
}
