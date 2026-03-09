import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/src/prisma";
import { authenticateMobileRequest } from "../auth";

export async function GET(req: NextRequest) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [wordsReviewedToday, activeRounds, recentRounds] = await Promise.all([
    prisma.reviewLog.count({
      where: {
        userId,
        reviewedAt: { gte: todayStart },
      },
    }),
    prisma.studyRound.findMany({
      where: { userId, status: "active" },
      orderBy: { createdAt: "desc" },
      take: 1,
    }),
    prisma.studyRound.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return NextResponse.json({
    wordsReviewedToday,
    activeRound: activeRounds[0] ?? null,
    recentRounds,
  });
}
