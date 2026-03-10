import { NextRequest, NextResponse } from "next/server";
import { authenticateApiToken, touchApiTokenLastUsed } from "@/src/api-token-auth";
import { prisma } from "@/src/prisma";
import { buildWordStatusMap } from "@/src/study-queries";

function toIOSStatus(status: string) {
  if (status === "known") return "seen";
  return status;
}

type RouteContext = {
  params: Promise<{ wordId: string }> | { wordId: string };
};

export async function GET(req: NextRequest, context: RouteContext) {
  const apiAuth = await authenticateApiToken(req);
  if (!apiAuth) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { wordId } = await Promise.resolve(context.params);

  try {
    const word = await prisma.word.findFirst({
      where: {
        id: wordId,
        userId: apiAuth.userId,
      },
      include: {
        reviewLog: {
          orderBy: { reviewedAt: "desc" },
          take: 365,
        },
      },
    });

    if (!word) {
      return NextResponse.json({ error: "Word not found" }, { status: 404 });
    }

    const statusMap = await buildWordStatusMap(apiAuth.userId, [word.id]);
    const status = toIOSStatus(statusMap.get(word.id) ?? "new");

    touchApiTokenLastUsed(apiAuth.tokenId).catch(() => {});

    return NextResponse.json({
      word: {
        id: word.id,
        text: word.text,
        note: word.note,
        isPriority: word.isPriority,
        isAchieved: word.isAchieved,
        manualCategory: word.manualCategory,
        status,
      },
      reviewHistory: word.reviewLog.map((log) => ({
        id: log.id,
        reviewedAt: log.reviewedAt,
        grade: log.grade,
        revealedAnswer: log.revealedAnswer,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load word detail",
      },
      { status: 500 },
    );
  }
}
