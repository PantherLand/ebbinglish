type EbbinghausProgressProps = {
  currentStage: number;
  maxStage: number;
  stageProgress: number;
  currentIntervalDays: number;
  nextIntervalDays: number;
  dueAt: Date | null;
  dueRelative: string;
  stageIntervalDays: readonly number[];
};

export function EbbinghausProgress({
  currentStage,
  maxStage,
  stageProgress,
  currentIntervalDays,
  nextIntervalDays,
  dueAt,
  dueRelative,
  stageIntervalDays,
}: EbbinghausProgressProps) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-base font-semibold">Ebbinghaus progress</h2>
      <div className="space-y-2 text-sm text-gray-700">
        <div className="flex items-center justify-between">
          <span>Current stage</span>
          <span className="font-medium">
            {currentStage}/{maxStage}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-gray-100">
          <div className="h-full bg-emerald-500" style={{ width: `${stageProgress}%` }} />
        </div>
        <div className="text-xs text-gray-600">
          Stage interval {currentIntervalDays}d, next stage interval {nextIntervalDays}d
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Next due</span>
          <span className="font-medium">{dueRelative}</span>
        </div>
        <div className="mt-1 text-xs text-gray-600">
          {dueAt ? dueAt.toLocaleString() : "No due time"}
        </div>
      </div>

      <ol className="space-y-2 text-xs">
        {stageIntervalDays.map((days, idx) => {
          const isDone = idx < currentStage;
          const isCurrent = idx === currentStage;
          return (
            <li
              key={`stage-${idx}`}
              className={`flex items-center justify-between rounded border px-2 py-1.5 ${
                isCurrent
                  ? "border-emerald-300 bg-emerald-50"
                  : isDone
                    ? "border-gray-200 bg-white"
                    : "border-gray-200 bg-gray-50 text-gray-500"
              }`}
            >
              <span>Stage {idx}</span>
              <span className="font-medium">{days}d</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
