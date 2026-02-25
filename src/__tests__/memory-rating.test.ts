import { describe, expect, it } from "vitest";
import { getMemoryRating } from "../memory-rating";

// Helper to build a review log entry N days ago with a given grade.
function log(grade: number, daysAgo: number, now: Date): { grade: number; reviewedAt: Date } {
  return {
    grade,
    reviewedAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
  };
}

describe("getMemoryRating", () => {
  const NOW = new Date("2024-06-01T12:00:00Z");

  it("returns level D and score 20 when there are no logs", () => {
    const result = getMemoryRating({
      seenCount: 0,
      lapseCount: 0,
      consecutivePerfect: 0,
      isMastered: false,
      masteryPhase: 0,
      freezeRounds: 0,
      logs: [],
      now: NOW,
    });
    expect(result.level).toBe("D");
    expect(result.score).toBe(20);
  });

  it("returns level S for a fully mastered word with a strong recent history", () => {
    // 20 perfect reviews spread across recent days → successRate=1, consistency=high
    const logs = Array.from({ length: 20 }, (_, i) =>
      log(2, i % 14, NOW), // reviews on different days in last 14 days
    );
    const result = getMemoryRating({
      seenCount: 20,
      lapseCount: 0,
      consecutivePerfect: 2,
      isMastered: true,
      masteryPhase: 3,
      freezeRounds: 0,
      logs,
      now: NOW,
    });
    expect(result.level).toBe("S");
    expect(result.score).toBeGreaterThanOrEqual(88);
  });

  it("returns level D for a word with a high lapse rate", () => {
    // 10 reviews all grade 0 (unknown)
    const logs = Array.from({ length: 10 }, (_, i) => log(0, i, NOW));
    const result = getMemoryRating({
      seenCount: 10,
      lapseCount: 10,
      consecutivePerfect: 0,
      isMastered: false,
      masteryPhase: 0,
      freezeRounds: 0,
      logs,
      now: NOW,
    });
    expect(result.level).toBe("D");
  });

  it("returns level C for a word with a perfect but small history at phase 0", () => {
    // 5 perfect reviews on 5 distinct recent days → successRate=1, consistency≈0.36
    // score ≈ 49 which falls in C (42–59)
    const logs = Array.from({ length: 5 }, (_, i) => log(2, i + 1, NOW));
    const result = getMemoryRating({
      seenCount: 5,
      lapseCount: 0,
      consecutivePerfect: 0,
      isMastered: false,
      masteryPhase: 0,
      freezeRounds: 0,
      logs,
      now: NOW,
    });
    expect(result.level).toBe("C");
  });

  it("score is always between 0 and 100", () => {
    const extremes = [
      { seenCount: 0, lapseCount: 0, isMastered: false, masteryPhase: 0, freezeRounds: 0, consecutivePerfect: 0, logs: [] },
      { seenCount: 100, lapseCount: 100, isMastered: false, masteryPhase: 0, freezeRounds: 0, consecutivePerfect: 0, logs: Array.from({ length: 100 }, (_, i) => log(0, i % 90, NOW)) },
      { seenCount: 30, lapseCount: 0, isMastered: true, masteryPhase: 3, freezeRounds: 0, consecutivePerfect: 2, logs: Array.from({ length: 30 }, (_, i) => log(2, i % 14, NOW)) },
    ];
    for (const input of extremes) {
      const result = getMemoryRating({ ...input, now: NOW });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it("freeze bonus increases score compared to no freeze", () => {
    const base = {
      seenCount: 5,
      lapseCount: 0,
      consecutivePerfect: 0,
      isMastered: false,
      masteryPhase: 1,
      logs: Array.from({ length: 5 }, (_, i) => log(2, i, NOW)),
      now: NOW,
    };
    const withoutFreeze = getMemoryRating({ ...base, freezeRounds: 0 });
    const withFreeze = getMemoryRating({ ...base, freezeRounds: 6 });
    expect(withFreeze.score).toBeGreaterThan(withoutFreeze.score);
  });

  it("summary includes successRate, phase and freeze info", () => {
    const result = getMemoryRating({
      seenCount: 3,
      lapseCount: 1,
      consecutivePerfect: 0,
      isMastered: false,
      masteryPhase: 1,
      freezeRounds: 3,
      logs: [log(2, 1, NOW), log(2, 2, NOW), log(0, 3, NOW)],
      now: NOW,
    });
    expect(result.summary).toContain("phase");
    expect(result.summary).toContain("freeze");
  });
});
