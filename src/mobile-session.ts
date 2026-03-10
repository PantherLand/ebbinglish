import { prisma } from "@/src/prisma";
import {
  ensureStudySettingsTx,
  parseSessionResults,
  type SessionOutcome,
  type SessionResultRecord,
} from "@/src/study-model";

export type MobileSessionInputResult = {
  wordId: string;
  outcome: SessionOutcome;
  timestamp?: string;
};

function outcomeToGrade(outcome: SessionOutcome): number {
  if (outcome === "known") return 2;
  if (outcome === "fuzzy") return 1;
  return 0;
}

function normalizeInputResults(results: MobileSessionInputResult[]): SessionResultRecord[] {
  const now = new Date();
  return results.map((item) => ({
    wordId: item.wordId,
    outcome: item.outcome,
    timestamp: item.timestamp ?? now.toISOString(),
  }));
}

export async function loadMobileSession(userId: string, sessionId: string) {
  const studySession = await prisma.studySession.findFirst({
    where: {
      id: sessionId,
      userId,
    },
    select: {
      id: true,
      roundId: true,
      type: true,
      wordIds: true,
      results: true,
      completedAt: true,
      round: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!studySession) {
    throw new Error("Session not found");
  }

  const [words, settings] = await Promise.all([
    prisma.word.findMany({
      where: {
        userId,
        id: { in: studySession.wordIds },
      },
      select: {
        id: true,
        text: true,
        note: true,
      },
    }),
    prisma.studySettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    }),
  ]);

  const wordById = new Map(words.map((word) => [word.id, word]));
  const orderedWords = studySession.wordIds
    .map((wordId) => wordById.get(wordId))
    .filter(Boolean)
    .map((word) => ({
      id: word!.id,
      text: word!.text,
      translation: word!.note ?? "",
    }));

  return {
    sessionId: studySession.id,
    roundId: studySession.roundId,
    roundName: studySession.round?.name ?? "Round",
    type: studySession.type,
    autoPlayAudio: settings.autoPlayAudio,
    completedAt: studySession.completedAt?.toISOString() ?? null,
    initialResults: parseSessionResults(studySession.results).map((item) => ({
      wordId: item.wordId,
      outcome: item.outcome,
      timestamp: item.timestamp,
    })),
    words: orderedWords,
  };
}

export async function saveMobileSessionProgress(
  userId: string,
  sessionId: string,
  inputResults: MobileSessionInputResult[],
) {
  const results = normalizeInputResults(inputResults);

  const session = await prisma.studySession.findFirst({
    where: {
      id: sessionId,
      userId,
    },
    select: {
      id: true,
      completedAt: true,
      wordIds: true,
    },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  if (session.completedAt) {
    return { saved: 0 };
  }

  if (results.length > session.wordIds.length) {
    throw new Error("Session progress exceeds session size");
  }

  for (let index = 0; index < results.length; index += 1) {
    const item = results[index];
    const expectedWordId = session.wordIds[index];
    if (item.wordId !== expectedWordId) {
      throw new Error("Session progress is out of order");
    }
  }

  await prisma.studySession.update({
    where: { id: session.id },
    data: {
      results: results as unknown as MobileSessionInputResult[],
    },
  });

  return { saved: results.length };
}

export async function finishMobileSession(
  userId: string,
  sessionId: string,
  inputResults: MobileSessionInputResult[],
) {
  const now = new Date();
  const results = normalizeInputResults(inputResults);
  const resultByWordId = new Map<string, SessionResultRecord>();
  for (const item of results) {
    if (!resultByWordId.has(item.wordId)) {
      resultByWordId.set(item.wordId, item);
    }
  }

  return prisma.$transaction(async (tx) => {
    const session = await tx.studySession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });
    if (!session) {
      throw new Error("Session not found");
    }

    const round = await tx.studyRound.findFirst({
      where: {
        id: session.roundId,
        userId,
      },
    });
    if (!round) {
      throw new Error("Round not found");
    }

    const sessionWordIdSet = new Set(session.wordIds);
    for (const wordId of resultByWordId.keys()) {
      if (!sessionWordIdSet.has(wordId)) {
        throw new Error("Session result contains invalid word");
      }
    }

    if (session.completedAt) {
      return {
        roundId: round.id,
      };
    }

    const settings = await ensureStudySettingsTx(tx, userId);
    const roundStates = await tx.reviewState.findMany({
      where: {
        userId,
        wordId: { in: round.wordIds },
      },
      select: {
        wordId: true,
        seenCount: true,
        consecutivePerfect: true,
      },
    });

    const roundStateMap = new Map(roundStates.map((item) => [item.wordId, item]));
    const roundWordIdSet = new Set(round.wordIds);
    const reviewedRoundWordSet = new Set(
      roundStates.filter((item) => item.seenCount > 0).map((item) => item.wordId),
    );
    const attempted = new Set(
      round.attemptedWordIds.filter(
        (wordId) => roundWordIdSet.has(wordId) && reviewedRoundWordSet.has(wordId),
      ),
    );
    const completed = new Set(round.completedWordIds);
    const firstTryKnown = new Set(round.firstTryKnownWordIds);
    const reviewLogRows = [] as Array<{
      userId: string;
      wordId: string;
      grade: number;
      revealedAnswer: boolean;
      reviewedAt: Date;
    }>;
    const newReviewStateRows = [] as Array<{
      userId: string;
      wordId: string;
      lastReviewedAt: Date;
      seenCount: number;
      lapseCount: number;
      latestFirstTryGrade: number | null;
      consecutivePerfect: number;
      freezeRounds: number;
      isMastered: boolean;
      masteryPhase: number;
    }>;
    const existingStateWordIds: string[] = [];
    const existingUnknownWordIds: string[] = [];
    const existingFirstTryGradeWordIds = {
      0: [] as string[],
      1: [] as string[],
      2: [] as string[],
    };

    for (const wordId of session.wordIds) {
      const outcome = resultByWordId.get(wordId)?.outcome;
      if (!outcome) {
        continue;
      }

      let isFirstAttempt = false;
      if (session.type === "normal") {
        isFirstAttempt = !attempted.has(wordId);
        attempted.add(wordId);
      }

      const grade = outcomeToGrade(outcome);
      if (outcome === "known") {
        completed.add(wordId);
        if (isFirstAttempt) {
          firstTryKnown.add(wordId);
        }
      }

      reviewLogRows.push({
        userId,
        wordId,
        grade,
        revealedAnswer: true,
        reviewedAt: now,
      });

      const state = roundStateMap.get(wordId);
      if (!state) {
        newReviewStateRows.push({
          userId,
          wordId,
          lastReviewedAt: now,
          seenCount: 1,
          lapseCount: grade === 0 ? 1 : 0,
          latestFirstTryGrade: isFirstAttempt ? grade : null,
          consecutivePerfect: 0,
          freezeRounds: 0,
          isMastered: false,
          masteryPhase: 0,
        });
      } else {
        existingStateWordIds.push(wordId);
        if (grade === 0) {
          existingUnknownWordIds.push(wordId);
        }
        if (isFirstAttempt) {
          existingFirstTryGradeWordIds[grade as 0 | 1 | 2].push(wordId);
        }
      }
    }

    if (reviewLogRows.length > 0) {
      await tx.reviewLog.createMany({
        data: reviewLogRows,
      });
    }

    if (existingStateWordIds.length > 0) {
      await tx.reviewState.updateMany({
        where: {
          userId,
          wordId: { in: existingStateWordIds },
        },
        data: {
          lastReviewedAt: now,
          seenCount: { increment: 1 },
        },
      });
    }

    if (existingUnknownWordIds.length > 0) {
      await tx.reviewState.updateMany({
        where: {
          userId,
          wordId: { in: existingUnknownWordIds },
        },
        data: {
          lapseCount: { increment: 1 },
        },
      });
    }

    for (const [gradeKey, wordIds] of Object.entries(existingFirstTryGradeWordIds)) {
      if (wordIds.length === 0) {
        continue;
      }
      await tx.reviewState.updateMany({
        where: {
          userId,
          wordId: { in: wordIds },
        },
        data: {
          latestFirstTryGrade: Number(gradeKey),
        },
      });
    }

    if (newReviewStateRows.length > 0) {
      await tx.reviewState.createMany({
        data: newReviewStateRows,
      });
    }

    const nextRoundPatch = {
      attemptedWordIds: [...attempted],
      completedWordIds: [...completed],
      firstTryKnownWordIds: [...firstTryKnown],
    };

    const isRoundComplete = round.wordIds.every((wordId) => completed.has(wordId));

    if (isRoundComplete) {
      await tx.reviewState.updateMany({
        where: {
          userId,
          freezeRounds: { gt: 0 },
        },
        data: {
          freezeRounds: { decrement: 1 },
        },
      });

      const notFirstTryWordIds = round.wordIds.filter((wordId) => !firstTryKnown.has(wordId));
      if (notFirstTryWordIds.length > 0) {
        await tx.reviewState.updateMany({
          where: {
            userId,
            wordId: { in: notFirstTryWordIds },
          },
          data: {
            consecutivePerfect: 0,
            isMastered: false,
            freezeRounds: 0,
          },
        });
      }

      const firstTryBuckets = new Map<
        string,
        { wordIds: string[]; nextConsecutive: number; shouldMaster: boolean }
      >();
      for (const wordId of round.wordIds) {
        if (!firstTryKnown.has(wordId)) {
          continue;
        }

        const prevConsecutive = roundStateMap.get(wordId)?.consecutivePerfect ?? 0;
        const nextConsecutive = prevConsecutive + 1;
        const shouldMaster = settings.requireConsecutiveKnown ? nextConsecutive >= 2 : true;
        const bucketKey = `${nextConsecutive}:${shouldMaster ? "master" : "keep"}`;
        const existingBucket = firstTryBuckets.get(bucketKey);
        if (existingBucket) {
          existingBucket.wordIds.push(wordId);
          continue;
        }

        firstTryBuckets.set(bucketKey, {
          wordIds: [wordId],
          nextConsecutive,
          shouldMaster,
        });
      }

      for (const bucket of firstTryBuckets.values()) {
        await tx.reviewState.updateMany({
          where: {
            userId,
            wordId: { in: bucket.wordIds },
          },
          data: {
            consecutivePerfect: bucket.nextConsecutive,
            isMastered: bucket.shouldMaster,
            freezeRounds: bucket.shouldMaster ? settings.freezeRounds : 0,
          },
        });
      }
    }

    await tx.studySession.update({
      where: { id: session.id },
      data: {
        completedAt: now,
        results: results as unknown as MobileSessionInputResult[],
      },
    });

    await tx.studyRound.update({
      where: { id: round.id },
      data: {
        ...nextRoundPatch,
        status: isRoundComplete ? "completed" : round.status,
      },
    });

    return {
      roundId: round.id,
    };
  }, {
    maxWait: 10_000,
    timeout: 20_000,
  });
}
