import { type HeatmapCell } from "@/src/memory-heatmap";

const HEATMAP_COLOR: Record<number, string> = {
  0: "bg-gray-100",
  1: "bg-emerald-100",
  2: "bg-emerald-300",
  3: "bg-emerald-500",
  4: "bg-emerald-700",
};

type WordHeatmapProps = {
  weeks: HeatmapCell[][];
};

export function WordHeatmap({ weeks }: WordHeatmapProps) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-base font-semibold">Memory activity heatmap</h2>
      <p className="text-sm text-gray-600">Last 24 weeks review activity</p>
      <div className="overflow-x-auto">
        <div className="inline-grid grid-flow-col gap-1">
          {weeks.map((week, weekIdx) => (
            <div key={`week-${weekIdx}`} className="grid grid-rows-7 gap-1">
              {week.map((cell) => (
                <div
                  key={cell.date.toISOString()}
                  className={`h-3 w-3 rounded-sm ${HEATMAP_COLOR[cell.intensity]}`}
                  title={`${cell.date.toLocaleDateString()}: ${cell.count} review(s)`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>Less</span>
        <span className="h-3 w-3 rounded-sm bg-gray-100" />
        <span className="h-3 w-3 rounded-sm bg-emerald-100" />
        <span className="h-3 w-3 rounded-sm bg-emerald-300" />
        <span className="h-3 w-3 rounded-sm bg-emerald-500" />
        <span className="h-3 w-3 rounded-sm bg-emerald-700" />
        <span>More</span>
      </div>
    </section>
  );
}
