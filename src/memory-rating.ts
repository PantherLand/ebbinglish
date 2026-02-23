export type MemoryRatingLevel = "S" | "A" | "B" | "C" | "D";

export type MemoryRatingInput = {
  stage: number;
  dueAt: Date | null;
  lapseCount: number;
  seenCount: number;
  logs: Array<{
    grade: number;
    reviewedAt: Date;
  }>;
  now?: Date;
};

export type MemoryRatingResult = {
  level: MemoryRatingLevel;
  score: number;
  summary: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getLevel(score: number): MemoryRatingLevel {
  if (score >= 85) return "S";
  if (score >= 70) return "A";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  return "D";
}

export function getMemoryRating(input: MemoryRatingInput): MemoryRatingResult {
  const now = input.now ?? new Date();
  const total = input.logs.length;

  if (total === 0) {
    return {
      level: "D",
      score: 20,
      summary: "No review history yet",
    };
  }

  const know = input.logs.filter((log) => log.grade === 2).length;
  const fuzzy = input.logs.filter((log) => log.grade === 1).length;
  const successRate = (know + fuzzy * 0.5) / total;

  const recentWindowStart = new Date(now.getTime() - 30 * MS_PER_DAY);
  const recentLogs = input.logs.filter((log) => log.reviewedAt >= recentWindowStart);
  const activeDays = new Set(
    recentLogs.map((log) => log.reviewedAt.toISOString().slice(0, 10)),
  ).size;
  const consistency = clamp(activeDays / 14, 0, 1);

  const stageNorm = clamp(input.stage / 6, 0, 1);
  const seenNorm = clamp(input.seenCount / 25, 0, 1);

  const overdueDays = input.dueAt
    ? Math.max((now.getTime() - input.dueAt.getTime()) / MS_PER_DAY, 0)
    : 0;
  const overduePenalty = clamp(overdueDays / 7, 0, 1) * 0.16;
  const lapsePenalty = clamp(input.lapseCount / 12, 0, 1) * 0.14;

  const base =
    successRate * 0.48 + stageNorm * 0.28 + consistency * 0.14 + seenNorm * 0.1;
  const score = Math.round(clamp((base - overduePenalty - lapsePenalty) * 100, 0, 100));

  return {
    level: getLevel(score),
    score,
    summary: `Success ${Math.round(successRate * 100)}%, stage ${input.stage}, overdue ${Math.floor(overdueDays)}d`,
  };
}
