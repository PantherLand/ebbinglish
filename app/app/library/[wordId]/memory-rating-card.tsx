type MemoryRatingCardProps = {
  level: string;
  score: number;
  summary: string;
  totalReviews: number;
  successRate: number;
  revealTimes: number;
  seenCount: number;
  currentStage: number;
};

export function MemoryRatingCard({
  level,
  score,
  summary,
  totalReviews,
  successRate,
  revealTimes,
  seenCount,
  currentStage,
}: MemoryRatingCardProps) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-base font-semibold">Memory rating</h2>
      <div className="flex items-end gap-2">
        <div className="text-4xl font-bold">{level}</div>
        <div className="text-sm text-gray-600">Score {score}/100</div>
      </div>
      <p className="text-sm text-gray-700">{summary}</p>
      <div className="space-y-2 text-sm text-gray-700">
        <div className="flex items-center justify-between">
          <span>Total reviews</span>
          <span className="font-medium">{totalReviews}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Know rate</span>
          <span className="font-medium">{successRate}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Reveal count</span>
          <span className="font-medium">{revealTimes}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Seen count</span>
          <span className="font-medium">{seenCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Current stage</span>
          <span className="font-medium">{currentStage}</span>
        </div>
      </div>
    </section>
  );
}
