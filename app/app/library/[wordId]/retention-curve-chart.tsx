function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function estimateRetention(daysFromReview: number, strengthDays: number): number {
  const safeDays = Math.max(0, daysFromReview);
  const safeStrength = Math.max(0.2, strengthDays);
  return Math.exp(-safeDays / safeStrength);
}

function estimateRetentionWithFloor(
  daysFromReview: number,
  strengthDays: number,
  floor: number,
): number {
  const base = estimateRetention(daysFromReview, strengthDays);
  const safeFloor = clamp(floor, 0, 0.95);
  return safeFloor + (1 - safeFloor) * base;
}

function estimateStandardEbbinghaus(daysFromReview: number): number {
  const anchors = [
    { day: 0, retention: 1.0 },
    { day: 1, retention: 0.36 },
    { day: 2, retention: 0.25 },
    { day: 3, retention: 0.2 },
    { day: 4, retention: 0.17 },
    { day: 5, retention: 0.155 },
    { day: 6, retention: 0.145 },
    { day: 7, retention: 0.14 },
    { day: 8, retention: 0.136 },
    { day: 9, retention: 0.133 },
    { day: 10, retention: 0.13 },
  ] as const;

  const safeDay = Math.max(0, daysFromReview);
  if (safeDay >= 10) {
    return 0.12 + (0.13 - 0.12) * Math.exp(-(safeDay - 10) / 8);
  }
  const lowerDay = Math.floor(safeDay);
  const upperDay = Math.ceil(safeDay);
  if (lowerDay === upperDay) return anchors[lowerDay].retention;
  const lower = anchors[lowerDay].retention;
  const upper = anchors[upperDay].retention;
  return lower + (upper - lower) * (safeDay - lowerDay);
}

export type RetentionCurveChartProps = {
  daysSinceReview: number;
  successRate: number;
  lapseCount: number;
  masteryPhase: number;
  freezeRounds: number;
  consecutivePerfect: number;
  isMastered: boolean;
};

const CHART_W = 640;
const CHART_H = 240;
const PAD_L = 42;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 34;
const INNER_W = CHART_W - PAD_L - PAD_R;
const INNER_H = CHART_H - PAD_T - PAD_B;

export function RetentionCurveChart({
  daysSinceReview,
  successRate,
  lapseCount,
  masteryPhase,
  freezeRounds,
  consecutivePerfect,
  isMastered,
}: RetentionCurveChartProps) {
  const phaseBoost = masteryPhase * 0.9 + (isMastered ? 1.2 : 0);
  const freezeBoost = freezeRounds > 0 ? 0.8 : 0;
  const consecutiveBoost = consecutivePerfect * 0.55;

  const personalFloor = clamp(
    0.2 + successRate / 210 + phaseBoost * 0.05 + freezeBoost * 0.04 + consecutiveBoost * 0.02 - lapseCount * 0.03,
    0.18,
    0.88,
  );
  const personalStrengthDays = clamp(
    1.2 + successRate / 24 + phaseBoost * 1.1 + freezeBoost + consecutiveBoost - lapseCount * 0.35,
    0.8,
    38,
  );

  const horizonDays = clamp(Math.ceil(Math.max(10, daysSinceReview + 10)), 10, 30);

  const retentionNow = estimateRetentionWithFloor(daysSinceReview, personalStrengthDays, personalFloor);
  const baselineNow = estimateStandardEbbinghaus(daysSinceReview);

  const toX = (day: number) => PAD_L + (day / horizonDays) * INNER_W;
  const toY = (r: number) => PAD_T + (1 - r) * INNER_H;

  const personalLinePoints = Array.from({ length: horizonDays + 1 }, (_, day) => ({
    day,
    retention: estimateRetentionWithFloor(day, personalStrengthDays, personalFloor),
  }))
    .map((p) => `${toX(p.day)},${toY(p.retention)}`)
    .join(" ");

  const baselineLinePoints = Array.from({ length: horizonDays + 1 }, (_, day) => ({
    day,
    retention: estimateStandardEbbinghaus(day),
  }))
    .map((p) => `${toX(p.day)},${toY(p.retention)}`)
    .join(" ");

  const currentX = toX(clamp(daysSinceReview, 0, horizonDays));
  const currentY = toY(retentionNow);

  const yTicks = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0];
  const xTickDays = Array.from(new Set([0, 1, 2, 3, 5, 7, 10, horizonDays]))
    .filter((d) => d <= horizonDays)
    .sort((a, b) => a - b);

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-base font-semibold">Forgetting curve (round model)</h2>
      <p className="text-sm text-gray-600">
        Personal curve is adjusted by your first-impression quality, freeze state, and lapses.
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
        <svg
          aria-label="Forgetting curve"
          className="h-[240px] w-full min-w-[520px]"
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        >
          {yTicks.map((tick) => {
            const y = toY(tick);
            return (
              <g key={`ytick-${tick}`}>
                <line stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="1" x1={PAD_L} x2={CHART_W - PAD_R} y1={y} y2={y} />
                <text fill="#64748b" fontSize="11" textAnchor="end" x={PAD_L - 6} y={y + 4}>
                  {Math.round(tick * 100)}%
                </text>
              </g>
            );
          })}

          {xTickDays.map((tickDay) => {
            const x = toX(tickDay);
            return (
              <g key={`xtick-${tickDay}`}>
                <line stroke="#e2e8f0" strokeWidth="1" x1={x} x2={x} y1={PAD_T} y2={CHART_H - PAD_B} />
                <text fill="#64748b" fontSize="11" textAnchor="middle" x={x} y={CHART_H - 10}>
                  Day {tickDay}
                </text>
              </g>
            );
          })}

          <polyline fill="none" points={baselineLinePoints} stroke="#fb923c" strokeWidth="2.2" strokeLinejoin="round" />
          <polyline fill="none" points={personalLinePoints} stroke="#10b981" strokeWidth="2.4" strokeLinejoin="round" />

          <line stroke="#2563eb" strokeDasharray="4 3" strokeWidth="1.5" x1={currentX} x2={currentX} y1={PAD_T} y2={CHART_H - PAD_B} />
          <circle cx={currentX} cy={currentY} fill="#2563eb" r="4.5" />
        </svg>
      </div>

      <div className="grid gap-2 text-sm text-gray-700">
        {[
          ["Estimated retention now", `${Math.round(retentionNow * 100)}%`],
          ["Baseline retention now", `${Math.round(baselineNow * 100)}%`],
          ["Strength (days)", `${personalStrengthDays.toFixed(1)}d`],
          ["Since last review", `${daysSinceReview.toFixed(1)}d`],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2">
            <span>{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
          Current point
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-6 rounded bg-emerald-500" />
          Your curve
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-6 rounded bg-orange-400" />
          Standard curve
        </span>
      </div>
    </section>
  );
}
