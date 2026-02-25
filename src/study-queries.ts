import { prisma } from "@/src/prisma";
import { deriveWordStatus, type WordMasteryStatus } from "@/src/study-model";

type WordStatusShape = {
  id: string;
  text: string;
  note: string | null;
  isPriority: boolean;
  manualCategory: string | null;
  createdAt: Date;
  status: WordMasteryStatus;
};

function normalizeFrozenStatus(
  status: WordMasteryStatus,
  latestGrade: number | null,
  ignoreFrozen: boolean,
): WordMasteryStatus {
  if (!ignoreFrozen || status !== "frozen") {
    return status;
  }
  if (latestGrade === 0) {
    return "unknown";
  }
  if (latestGrade === 1) {
    return "fuzzy";
  }
  return "seen";
}

export async function buildWordStatusMap(
  userId: string,
  wordIds: string[],
  options?: { ignoreFrozen?: boolean },
) {
  const uniqueWordIds = [...new Set(wordIds)];
  if (uniqueWordIds.length === 0) {
    return new Map<string, WordMasteryStatus>();
  }

  const ignoreFrozen = Boolean(options?.ignoreFrozen);
  // Only fetch ReviewLogs when ignoreFrozen is set (used to resolve the display
  // status of frozen words). Skip the query entirely for the common path
  // (e.g. library page) to avoid a potentially large full-table scan.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [reviewStates, reviewLogs] = await Promise.all([
    prisma.reviewState.findMany({
      where: { userId, wordId: { in: uniqueWordIds } },
      select: { wordId: true, seenCount: true, isMastered: true, freezeRounds: true },
    }),
    ignoreFrozen
      ? prisma.reviewLog.findMany({
          where: {
            userId,
            wordId: { in: uniqueWordIds },
            reviewedAt: { gte: ninetyDaysAgo },
          },
          select: { wordId: true, grade: true, reviewedAt: true },
          orderBy: { reviewedAt: "desc" },
        })
      : Promise.resolve([] as { wordId: string; grade: number; reviewedAt: Date }[]),
  ]);

  const stateByWordId = new Map(reviewStates.map((item) => [item.wordId, item]));
  const latestGradeByWordId = new Map<string, number>();
  for (const log of reviewLogs) {
    if (!latestGradeByWordId.has(log.wordId)) {
      latestGradeByWordId.set(log.wordId, log.grade);
    }
  }

  const out = new Map<string, WordMasteryStatus>();
  for (const wordId of uniqueWordIds) {
    const latestGrade = latestGradeByWordId.get(wordId) ?? null;
    out.set(
      wordId,
      normalizeFrozenStatus(
        deriveWordStatus(stateByWordId.get(wordId) ?? null, latestGrade),
        latestGrade,
        ignoreFrozen,
      ),
    );
  }
  return out;
}

export async function loadWordsWithStatus(userId: string): Promise<WordStatusShape[]> {
  const words = await prisma.word.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      text: true,
      note: true,
      isPriority: true,
      manualCategory: true,
      createdAt: true,
    },
  });

  const statusMap = await buildWordStatusMap(
    userId,
    words.map((word) => word.id),
  );

  return words.map((word) => ({
    ...word,
    status: statusMap.get(word.id) ?? "new",
  }));
}
