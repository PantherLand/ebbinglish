const STAGE_BAR_COLOR = [
  "bg-slate-300",   // 0 – new
  "bg-cyan-200",    // 1 – 1 d
  "bg-cyan-400",    // 2 – 2 d
  "bg-cyan-500",    // 3 – 4 d
  "bg-cyan-600",    // 4 – 7 d
  "bg-emerald-400", // 5 – 15 d
  "bg-emerald-600", // 6 – 30 d (mastered)
];

type StageDistributionProps = {
  stageCounts: number[];
  stageIntervalDays: readonly number[];
  activeReviewWords: number;
  reviewCoverage: number;
  newWords: number;
};

export function StageDistribution({
  stageCounts,
  stageIntervalDays,
  activeReviewWords,
  reviewCoverage,
  newWords,
}: StageDistributionProps) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">Ebbinghaus stages</h2>
      <div className="space-y-2">
        {stageIntervalDays.map((days, idx) => {
          const count = stageCounts[idx] ?? 0;
          const ratio = activeReviewWords === 0 ? 0 : (count / activeReviewWords) * 100;
          const barColor = STAGE_BAR_COLOR[idx] ?? "bg-slate-300";
          return (
            <div key={`stage-${idx}`} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{`Stage ${idx} (${days}d)`}</span>
                <span className="font-medium text-slate-900">{count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-slate-100">
                <div
                  className={`h-full rounded ${barColor}`}
                  style={{ width: `${ratio}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-200 pt-2 text-xs text-slate-500">
        Review coverage {reviewCoverage}% &nbsp;·&nbsp; {newWords} words not yet started
      </div>
    </section>
  );
}
