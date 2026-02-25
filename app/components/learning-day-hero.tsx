type LearningDayHeroProps = {
  dayNumber: number;
  startedAt: Date;
  healthScore: number;
  masteryRate: number;
  emphasis?: boolean;
};

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

export default function LearningDayHero({
  dayNumber,
  startedAt,
  healthScore,
  masteryRate,
  emphasis = false,
}: LearningDayHeroProps) {
  const safeDay = Math.max(dayNumber, 1);
  const wrapperClass = emphasis
    ? "rounded-3xl border border-slate-200 bg-gradient-to-r from-cyan-50 via-sky-50 to-indigo-50 p-7 shadow-sm"
    : "rounded-3xl border border-slate-200 bg-gradient-to-r from-cyan-50 via-sky-50 to-indigo-50 p-6 shadow-sm";
  const dayClass = emphasis ? "mt-1 text-5xl font-bold tracking-tight text-slate-900" : "mt-1 text-4xl font-bold tracking-tight text-slate-900";
  const scoreValueClass = emphasis ? "text-5xl font-semibold" : "text-2xl font-semibold";
  const scoreCardClass = emphasis
    ? "rounded-3xl border border-slate-200 bg-white/85 px-5 py-4 shadow-sm"
    : "rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 shadow-sm";

  return (
    <section className={wrapperClass}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Learning day</div>
          <div className={dayClass}>Day {safeDay}</div>
          <div className="text-sm text-slate-600">
            Started{" "}
            {startedAt.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
        <div className="flex gap-3">
          <div className={scoreCardClass}>
            <div className="text-xs uppercase tracking-wide text-slate-500">Health score</div>
            <div className={`${scoreValueClass} ${scoreColor(healthScore)}`}>
              {healthScore}
              <span className="ml-1 text-sm font-normal text-slate-400">/ 100</span>
            </div>
          </div>
          <div className={scoreCardClass}>
            <div className="text-xs uppercase tracking-wide text-slate-500">Mastery</div>
            <div className={`${scoreValueClass} ${scoreColor(masteryRate)}`}>
              {masteryRate}
              <span className="ml-0.5 text-sm font-normal text-slate-400">%</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
