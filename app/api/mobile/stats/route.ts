import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/src/prisma";
import { authenticateMobileRequest } from "../auth";
import { buildHeatmap } from "@/src/memory-heatmap";

export async function GET(req: NextRequest) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;

  const [totalWords, masteredCount, totalSessions, reviewLogs, allWords] =
    await Promise.all([
      prisma.word.count({ where: { userId } }),
      prisma.reviewState.count({ where: { userId, isMastered: true } }),
      prisma.studySession.count({ where: { userId, completedAt: { not: null } } }),
      prisma.reviewLog.findMany({
        where: { userId },
        select: { reviewedAt: true },
        orderBy: { reviewedAt: "desc" },
      }),
      prisma.reviewState.findMany({
        where: { userId },
        select: { isMastered: true, seenCount: true },
      }),
    ]);

  // Mastery distribution
  let newCount = 0;
  let learningCount = 0;
  let masteredDistCount = 0;
  for (const w of allWords) {
    if (w.isMastered) masteredDistCount++;
    else if (w.seenCount > 0) learningCount++;
    else newCount++;
  }

  // Heatmap
  const logDates = reviewLogs.map((l) => l.reviewedAt);
  const heatmap = buildHeatmap(logDates, 140);

  // Review activity (last 7 days)
  const reviewActivity: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayStart = new Date(dateStr + "T00:00:00Z");
    const dayEnd = new Date(dateStr + "T23:59:59.999Z");
    const count = reviewLogs.filter(
      (l) => l.reviewedAt >= dayStart && l.reviewedAt <= dayEnd,
    ).length;
    reviewActivity.push({ date: dateStr, count });
  }

  return NextResponse.json({
    totalWords,
    masteredWords: masteredCount,
    totalSessions,
    masteryDistribution: {
      new: newCount,
      learning: learningCount,
      mastered: masteredDistCount,
    },
    reviewActivity,
    heatmap,
  });
}
