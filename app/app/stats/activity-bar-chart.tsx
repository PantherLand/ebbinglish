export type DaySeries = {
  date: Date;
  count: number;
  key: string;
};

type ActivityBarChartProps = {
  series: DaySeries[];
  max: number;
};

export function ActivityBarChart({ series, max }: ActivityBarChartProps) {
  const total = series.reduce((s, d) => s + d.count, 0);

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Last 14 days activity</h2>
        <div className="text-xs text-slate-500">Total {total}</div>
      </div>
      {series.every((d) => d.count === 0) ? (
        <div className="flex h-36 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-400">No reviews recorded yet</p>
        </div>
      ) : (
        <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <div className="flex h-28 gap-1">
            {series.map((day) => {
              const height = Math.max((day.count / max) * 100, day.count > 0 ? 8 : 4);
              return (
                <div
                  key={day.key}
                  className={`group relative flex-1 self-end rounded-t-sm ${
                    day.count > 0 ? "cursor-default bg-cyan-500 hover:bg-cyan-400" : "bg-slate-200"
                  }`}
                  style={{ height: `${height}%` }}
                >
                  {day.count > 0 && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white">
                        {day.count}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-1">
            {series.map((day) => {
              const isNewMonth = day.date.getDate() === 1;
              return (
                <div
                  key={day.key}
                  className={`flex-1 text-center text-[10px] leading-tight ${
                    isNewMonth ? "font-medium text-slate-700" : "text-slate-500"
                  }`}
                >
                  {isNewMonth
                    ? day.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    : day.date.getDate()}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
