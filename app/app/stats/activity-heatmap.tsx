import { type HeatmapCell } from "@/src/memory-heatmap";

const HEATMAP_COLOR: Record<number, string> = {
  0: "bg-slate-100",
  1: "bg-cyan-100",
  2: "bg-cyan-300",
  3: "bg-cyan-500",
  4: "bg-cyan-700",
};

type ActivityHeatmapProps = {
  weeks: HeatmapCell[][];
  hasActivity: boolean;
};

export function ActivityHeatmap({ weeks, hasActivity }: ActivityHeatmapProps) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">Memory activity heatmap</h2>
      {!hasActivity ? (
        <p className="text-sm text-slate-400">No activity yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="inline-grid grid-flow-col gap-1">
              {weeks.map((week, weekIdx) => {
                const firstDay = week[0]?.date;
                const prevFirst = weeks[weekIdx - 1]?.[0]?.date;
                const showMonth =
                  firstDay &&
                  (weekIdx === 0 ||
                    (prevFirst && firstDay.getMonth() !== prevFirst.getMonth()));
                const monthLabel = showMonth
                  ? firstDay.toLocaleDateString(undefined, { month: "short" })
                  : "";
                return (
                  <div key={`week-${weekIdx}`} className="flex flex-col gap-1">
                    <div className="h-3 text-[9px] leading-3 text-slate-400">{monthLabel}</div>
                    <div className="grid grid-rows-7 gap-1">
                      {week.map((cell) => (
                        <div
                          key={cell.date.toISOString()}
                          className={`h-3 w-3 rounded-sm ${HEATMAP_COLOR[cell.intensity]}`}
                          title={`${cell.date.toLocaleDateString()}: ${cell.count} review(s)`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Less</span>
            <span className="h-3 w-3 rounded-sm bg-slate-100" />
            <span className="h-3 w-3 rounded-sm bg-cyan-100" />
            <span className="h-3 w-3 rounded-sm bg-cyan-300" />
            <span className="h-3 w-3 rounded-sm bg-cyan-500" />
            <span className="h-3 w-3 rounded-sm bg-cyan-700" />
            <span>More</span>
          </div>
        </>
      )}
    </section>
  );
}
