import { prisma } from "@/src/prisma";
import { deriveWordStatus } from "@/src/study-model";

function normalizeFrozenStatusForRound(status: ReturnType<typeof deriveWordStatus>, latestGrade: number | null) {
  if (status !== "frozen") {
    return status;
  }
  if (latestGrade === 0) {
    return "unknown";
  }
  if (latestGrade === 1) {
    return "fuzzy";
  }
  return "known";
}

export async function loadMobileRoundDetail(userId: string, roundId: string) {
  const round = await prisma.studyRound.findFirst({
    where: {
      id: roundId,
      userId,
    },
  });

  if (!round) {
    throw new Error("Round not found");
  }

  const [roundWords, settings, reviewStates, latestLogs] = await Promise.all([
    prisma.word.findMany({
      where: {
        userId,
        id: { in: round.wordIds },
      },
      select: {
        id: true,
        text: true,
        note: true,
        isPriority: true,
      },
    }),
    prisma.studySettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    }),
    prisma.reviewState.findMany({
      where: {
        userId,
        wordId: { in: round.wordIds },
      },
      select: {
        wordId: true,
        seenCount: true,
        isMastered: true,
        freezeRounds: true,
        latestFirstTryGrade: true,
      },
    }),
    prisma.reviewLog.findMany({
      where: {
        userId,
        wordId: { in: round.wordIds },
      },
      select: {
        wordId: true,
        grade: true,
        reviewedAt: true,
      },
      orderBy: { reviewedAt: "desc" },
    }),
  ]);

  const wordById = new Map(roundWords.map((word) => [word.id, word]));
  const orderedWords = round.wordIds.map((wordId) => wordById.get(wordId)).filter(Boolean);
  const completedSet = new Set(round.completedWordIds);
  const firstTryKnownSet = new Set(round.firstTryKnownWordIds);
  const stateMap = new Map(reviewStates.map((item) => [item.wordId, item]));
  const latestGradeMap = new Map<string, number>();
  const latestReviewedAtMap = new Map<string, Date>();

  for (const log of latestLogs) {
    if (!latestGradeMap.has(log.wordId)) {
      latestGradeMap.set(log.wordId, log.grade);
      latestReviewedAtMap.set(log.wordId, log.reviewedAt);
    }
  }

  const statuses = new Map<string, ReturnType<typeof deriveWordStatus>>();
  for (const word of roundWords) {
    const latestGrade = latestGradeMap.get(word.id) ?? null;
    statuses.set(
      word.id,
      normalizeFrozenStatusForRound(
        deriveWordStatus(stateMap.get(word.id) ?? null, latestGrade),
        latestGrade,
      ),
    );
  }

  const totalCount = round.wordIds.length;
  const masteredCount = completedSet.size;
  const progress = totalCount === 0 ? 0 : Math.round((masteredCount / totalCount) * 100);
  const remainingIds = round.wordIds.filter((wordId) => !completedSet.has(wordId));
  const fuzzyCount = remainingIds.filter((wordId) => statuses.get(wordId) === "fuzzy").length;
  const unknownCount = remainingIds.filter((wordId) => statuses.get(wordId) === "unknown").length;
  const encounterTargetCount = remainingIds.length;
  const roundWordIdSet = new Set(round.wordIds);
  const attemptedSet = new Set(
    round.attemptedWordIds.filter(
      (wordId) => roundWordIdSet.has(wordId) && !completedSet.has(wordId) && statuses.get(wordId) !== "new",
    ),
  );
  const encounterRemainingCount = round.wordIds.filter(
    (wordId) => !completedSet.has(wordId) && !attemptedSet.has(wordId),
  ).length;
  const encounterCount = Math.max(encounterTargetCount - encounterRemainingCount, 0);
  const encounterDone = encounterRemainingCount <= 0;
  const totalExtraWords = round.wordIds.filter((wordId) => {
    if (!attemptedSet.has(wordId)) {
      return false;
    }
    if (completedSet.has(wordId)) {
      return false;
    }
    const status = statuses.get(wordId);
    return status === "fuzzy" || status === "unknown";
  }).length;
  const normalCount = Math.min(settings.sessionSize, encounterRemainingCount);
  const extraCount = Math.min(settings.sessionSize, totalExtraWords);
  const totalNormalSessions = encounterTargetCount > 0 ? Math.ceil(encounterTargetCount / settings.sessionSize) : 1;
  const startedNormalSessions = encounterTargetCount > 0 ? Math.ceil(encounterCount / settings.sessionSize) : 0;
  const nextNormalSession = Math.min(startedNormalSessions + 1, totalNormalSessions);
  const normalSessionLabel =
    encounterDone
      ? `Session Finished (${totalNormalSessions}/${totalNormalSessions})`
      : `Start Session (${nextNormalSession}/${totalNormalSessions})`;

  return {
    round: {
      id: round.id,
      name: round.name,
      status: round.status,
      createdAt: round.createdAt.toISOString(),
      totalCount,
      masteredCount,
      progress,
      fuzzyCount,
      unknownCount,
      settingsSessionSize: settings.sessionSize,
      normalSessionLabel,
      extraSessionLabel: `Extra Practice (${extraCount}/${totalExtraWords})`,
      canStartNormal: !encounterDone && normalCount > 0,
      canStartExtra: extraCount > 0,
    },
    words: orderedWords.map((word) => ({
      id: word!.id,
      text: word!.text,
      note: word!.note,
      isPriority: word!.isPriority,
      isCompleted: completedSet.has(word!.id),
      isFirstTryKnown: firstTryKnownSet.has(word!.id),
      status: statuses.get(word!.id) ?? "new",
    })),
  };
}

export async function startMobileRoundSession(userId: string, roundId: string, type: "normal" | "extra") {
  const round = await prisma.studyRound.findFirst({
    where: {
      id: roundId,
      userId,
    },
  });

  if (!round) {
    throw new Error("Round not found");
  }

  const ongoingSession = await prisma.studySession.findFirst({
    where: {
      userId,
      roundId: round.id,
      type,
      completedAt: null,
    },
    orderBy: {
      startedAt: "desc",
    },
    select: {
      id: true,
    },
  });

  if (ongoingSession) {
    return { sessionId: ongoingSession.id };
  }

  const settings = await prisma.studySettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const sessionSize = Math.min(Math.max(settings.sessionSize, 1), 100);
  const roundWords = await prisma.word.findMany({
    where: {
      userId,
      id: { in: round.wordIds },
      isAchieved: false,
    },
    select: {
      id: true,
      isPriority: true,
      createdAt: true,
    },
  });

  const [reviewStates, latestLogs] = await Promise.all([
    prisma.reviewState.findMany({
      where: {
        userId,
        wordId: { in: round.wordIds },
      },
      select: {
        wordId: true,
        seenCount: true,
        isMastered: true,
        freezeRounds: true,
        latestFirstTryGrade: true,
      },
    }),
    prisma.reviewLog.findMany({
      where: {
        userId,
        wordId: { in: round.wordIds },
      },
      select: {
        wordId: true,
        grade: true,
        reviewedAt: true,
      },
      orderBy: { reviewedAt: "desc" },
    }),
  ]);

  const stateMap = new Map(reviewStates.map((item) => [item.wordId, item]));
  const latestGradeMap = new Map<string, number>();
  const latestReviewedAtMap = new Map<string, Date>();
  for (const log of latestLogs) {
    if (!latestGradeMap.has(log.wordId)) {
      latestGradeMap.set(log.wordId, log.grade);
      latestReviewedAtMap.set(log.wordId, log.reviewedAt);
    }
  }

  const statuses = new Map<string, ReturnType<typeof deriveWordStatus>>();
  for (const word of roundWords) {
    const latestGrade = latestGradeMap.get(word.id) ?? null;
    statuses.set(
      word.id,
      normalizeFrozenStatusForRound(
        deriveWordStatus(stateMap.get(word.id) ?? null, latestGrade),
        latestGrade,
      ),
    );
  }

  const nonCompletedIds = new Set(round.wordIds.filter((wordId) => !round.completedWordIds.includes(wordId)));
  const roundWordIdSet = new Set(round.wordIds);
  const attemptedSet = new Set(
    round.attemptedWordIds.filter((wordId) => roundWordIdSet.has(wordId) && statuses.get(wordId) !== "new"),
  );
  const availableWords = roundWords.filter((word) => nonCompletedIds.has(word.id));
  availableWords.sort((a, b) => {
    if (a.isPriority !== b.isPriority) {
      return a.isPriority ? -1 : 1;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  let selectedWordIds: string[] = [];

  if (type === "normal") {
    const encounterPool = availableWords.filter((word) => !attemptedSet.has(word.id));
    selectedWordIds = encounterPool.slice(0, sessionSize).map((word) => word.id);
  } else {
    const extraPool = availableWords.filter((word) => {
      if (!attemptedSet.has(word.id)) {
        return false;
      }
      const status = statuses.get(word.id);
      return status === "unknown" || status === "fuzzy";
    });

    extraPool.sort((a, b) => {
      const statusA = statuses.get(a.id) === "unknown" ? 0 : 1;
      const statusB = statuses.get(b.id) === "unknown" ? 0 : 1;
      if (statusA !== statusB) {
        return statusA - statusB;
      }
      const reviewedA = latestReviewedAtMap.get(a.id)?.getTime() ?? 0;
      const reviewedB = latestReviewedAtMap.get(b.id)?.getTime() ?? 0;
      if (reviewedA !== reviewedB) {
        return reviewedB - reviewedA;
      }
      if (a.isPriority !== b.isPriority) {
        return a.isPriority ? -1 : 1;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    selectedWordIds = extraPool.slice(0, sessionSize).map((word) => word.id);
  }

  if (selectedWordIds.length === 0) {
    if (type === "normal") {
      throw new Error("Encounter phase already finished. Use Extra Practice.");
    }
    throw new Error("No words available for this session type");
  }

  const session = await prisma.studySession.create({
    data: {
      userId,
      roundId: round.id,
      type,
      wordIds: selectedWordIds,
      results: [],
    },
    select: {
      id: true,
    },
  });

  return { sessionId: session.id };
}
