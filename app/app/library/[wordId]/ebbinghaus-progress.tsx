type EbbinghausProgressProps = {
  masteryPhase: number;
  consecutivePerfect: number;
  freezeRounds: number;
  isMastered: boolean;
  currentGlobalRound: number;
};

const PHASE_LABEL: Record<number, string> = {
  0: "Build first-seen stability",
  1: "Post-freeze verification (3 rounds)",
  2: "Long-freeze verification (6 rounds)",
  3: "System mastered",
};

export function EbbinghausProgress({
  masteryPhase,
  consecutivePerfect,
  freezeRounds,
  isMastered,
  currentGlobalRound,
}: EbbinghausProgressProps) {
  const safePhase = Math.max(0, Math.min(masteryPhase, 3));
  const progress = isMastered ? 100 : Math.round((safePhase / 3) * 100);

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-base font-semibold">Round mastery progress</h2>
      <div className="space-y-2 text-sm text-gray-700">
        <div className="flex items-center justify-between">
          <span>Current phase</span>
          <span className="font-medium">{safePhase}/3</span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-gray-100">
          <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-xs text-gray-600">{PHASE_LABEL[safePhase]}</div>
      </div>

      <div className="grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span>Global round</span>
          <span className="font-medium">{currentGlobalRound}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Consecutive first-known</span>
          <span className="font-medium">{consecutivePerfect}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Freeze rounds left</span>
          <span className="font-medium">{freezeRounds}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Mastered</span>
          <span className="font-medium">{isMastered ? "Yes" : "No"}</span>
        </div>
      </div>

      <ol className="space-y-2 text-xs">
        {[
          "Phase 0: get 2 rounds of first-seen Known",
          "Phase 1: after unfreeze, first-seen Known => freeze 6",
          "Phase 2: after unfreeze, first-seen Known => mastered",
          "Phase 3: system mastered",
        ].map((line, idx) => {
          const isDone = safePhase > idx || (idx === 3 && isMastered);
          const isCurrent = safePhase === idx && !isMastered;
          return (
            <li
              key={`phase-${idx}`}
              className={`rounded border px-2 py-1.5 ${
                isCurrent
                  ? "border-emerald-300 bg-emerald-50"
                  : isDone
                    ? "border-gray-200 bg-white"
                    : "border-gray-200 bg-gray-50 text-gray-500"
              }`}
            >
              {line}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
