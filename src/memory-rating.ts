export type MemoryRatingLevel = "S" | "A" | "B" | "C" | "D";

export type MemoryRatingInput = {
  consecutivePerfect: number;
  freezeRounds: number;
  isMastered: boolean;
  masteryPhase: number;
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
  if (score >= 88) return "S";
  if (score >= 74) return "A";
  if (score >= 60) return "B";
  if (score >= 42) return "C";
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
  const activeDays = new Set(recentLogs.map((log) => log.reviewedAt.toISOString().slice(0, 10))).size;
  const consistency = clamp(activeDays / 14, 0, 1);

  const phaseNorm = clamp(input.masteryPhase / 3, 0, 1);
  const seenNorm = clamp(input.seenCount / 30, 0, 1);
  const consecutiveNorm = clamp(input.consecutivePerfect / 2, 0, 1);
  const freezeBonus = input.freezeRounds > 0 ? clamp(input.freezeRounds / 6, 0, 1) : 0;
  const masteredBonus = input.isMastered ? 1 : 0;

  const lapsePenalty = clamp(input.lapseCount / 16, 0, 1) * 0.18;

  const base =
    successRate * 0.42 +
    consistency * 0.16 +
    phaseNorm * 0.16 +
    seenNorm * 0.1 +
    consecutiveNorm * 0.08 +
    freezeBonus * 0.04 +
    masteredBonus * 0.04;

  const score = Math.round(clamp((base - lapsePenalty) * 100, 0, 100));

  return {
    level: getLevel(score),
    score,
    summary: `Success ${Math.round(successRate * 100)}%, phase ${input.masteryPhase}, freeze ${input.freezeRounds}`,
  };
}
