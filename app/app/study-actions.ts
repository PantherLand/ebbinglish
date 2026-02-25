"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import { hasStudyPrismaModels, STUDY_PRISMA_HINT } from "@/src/study-runtime";
import {
  deriveWordStatus,
  ensureStudySettingsTx,
  type SessionOutcome,
  type SessionResultRecord,
} from "@/src/study-model";

const createRoundSchema = z.object({
  name: z.string().trim().min(1).max(120),
  wordIds: z.array(z.string().min(1)).min(1).max(500),
});

const updateRoundSchema = z.object({
  roundId: z.string().min(1),
  status: z.enum(["active", "completed", "archived"]),
});

const startSessionSchema = z.object({
  roundId: z.string().min(1),
  type: z.enum(["normal", "extra"]),
  count: z.number().int().min(1).max(100).optional(), // legacy input, ignored in size calculation
});

const finishSessionSchema = z.object({
  sessionId: z.string().min(1),
  results: z
    .array(
      z.object({
        wordId: z.string().min(1),
        outcome: z.enum(["known", "fuzzy", "unknown"]),
        timestamp: z.string().optional(),
      }),
    )
    .min(1)
    .max(500),
});

const saveSessionProgressSchema = z.object({
  sessionId: z.string().min(1),
  results: z
    .array(
      z.object({
        wordId: z.string().min(1),
        outcome: z.enum(["known", "fuzzy", "unknown"]),
        timestamp: z.string().optional(),
      }),
    )
    .min(1)
    .max(500),
});

const updateSettingsSchema = z.object({
  sessionSize: z.number().int().min(1).max(60).optional(),
  freezeRounds: z.number().int().min(1).max(20).optional(),
  autoPlayAudio: z.boolean().optional(),
  requireConsecutiveKnown: z.boolean().optional(),
});

const editRoundWordStatusSchema = z.object({
  roundId: z.string().min(1),
  wordId: z.string().min(1),
  targetStatus: z.enum(["first_try_mastered", "mastered", "fuzzy", "unknown"]),
});

type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function getAuthedUserId(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return user?.id ?? null;
}

function outcomeToGrade(outcome: SessionOutcome): number {
  if (outcome === "known") return 2;
  if (outcome === "fuzzy") return 1;
  return 0;
}

function normalizeFrozenStatusForRound(
  status: ReturnType<typeof deriveWordStatus>,
  latestGrade: number | null,
): ReturnType<typeof deriveWordStatus> {
  if (status !== "frozen") {
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

export async function createRoundAction(input: z.infer<typeof createRoundSchema>): Promise<ActionResult<{ roundId: string }>> {
  if (!hasStudyPrismaModels()) {
    return { ok: false, message: STUDY_PRISMA_HINT };
  }

  const parsed = createRoundSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid round payload" };
  }

  const userId = await getAuthedUserId();
  if (!userId) {
    return { ok: false, message: "Please sign in first" };
  }

  const uniqueWordIds = [...new Set(parsed.data.wordIds)];
  const ownedWords = await prisma.word.findMany({
    where: {
      userId,
      id: { in: uniqueWordIds },
    },
    select: { id: true },
  });
  if (ownedWords.length !== uniqueWordIds.length) {
    return { ok: false, message: "Some words are invalid" };
  }

  const round = await prisma.studyRound.create({
    data: {
      userId,
      name: parsed.data.name,
      wordIds: uniqueWordIds,
      completedWordIds: [],
      attemptedWordIds: [],
      firstTryKnownWordIds: [],
      status: "active",
    },
    select: { id: true },
  });

  revalidatePath("/app/today");
  revalidatePath("/app/rounds");
  return { ok: true, data: { roundId: round.id } };
}

export async function deleteRoundAction(roundId: string): Promise<ActionResult<null>> {
  if (!hasStudyPrismaModels()) {
    return { ok: false, message: STUDY_PRISMA_HINT };
  }

  if (!roundId) {
    return { ok: false, message: "Round id is required" };
  }
  const userId = await getAuthedUserId();
  if (!userId) {
    return { ok: false, message: "Please sign in first" };
  }
  await prisma.studyRound.deleteMany({
    where: {
      id: roundId,
      userId,
    },
  });
  revalidatePath("/app/today");
  revalidatePath("/app/rounds");
  return { ok: true, data: null };
}

export async function deleteRoundAndRedirectAction(formData: FormData) {
  const roundId = String(formData.get("roundId") ?? "");
  await deleteRoundAction(roundId);
  redirect("/app/rounds");
}

export async function updateRoundStatusAction(input: z.infer<typeof updateRoundSchema>): Promise<ActionResult<null>> {
  if (!hasStudyPrismaModels()) {
    return { ok: false, message: STUDY_PRISMA_HINT };
  }

  const parsed = updateRoundSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid round update payload" };
  }
  const userId = await getAuthedUserId();
  if (!userId) {
    return { ok: false, message: "Please sign in first" };
  }
  await prisma.studyRound.updateMany({
    where: {
      id: parsed.data.roundId,
      userId,
    },
    data: {
      status: parsed.data.status,
    },
  });
  revalidatePath("/app/today");
  revalidatePath("/app/rounds");
  return { ok: true, data: null };
}

export async function editRoundWordStatusAction(formData: FormData) {
  if (!hasStudyPrismaModels()) {
    redirect(`/app/rounds?error=${encodeURIComponent(STUDY_PRISMA_HINT)}`);
  }

  const parsed = editRoundWordStatusSchema.safeParse({
    roundId: String(formData.get("roundId") ?? ""),
    wordId: String(formData.get("wordId") ?? ""),
    targetStatus: String(formData.get("targetStatus") ?? ""),
  });
  if (!parsed.success) {
    redirect("/app/rounds?error=Invalid+word+status+update");
  }

  const { roundId, wordId, targetStatus } = parsed.data;
  const userId = await getAuthedUserId();
  if (!userId) {
    redirect("/");
  }

  const now = new Date();
  const grade = targetStatus === "unknown" ? 0 : targetStatus === "fuzzy" ? 1 : 2;
  const isMasteredTarget = targetStatus === "mastered" || targetStatus === "first_try_mastered";

  try {
    await prisma.$transaction(async (tx) => {
      const round = await tx.studyRound.findFirst({
        where: {
          id: roundId,
          userId,
        },
      });
      if (!round) {
        throw new Error("Round not found");
      }
      if (!round.wordIds.includes(wordId)) {
        throw new Error("Word is not in this round");
      }

      const attempted = new Set(round.attemptedWordIds);
      attempted.add(wordId);
      const completed = new Set(round.completedWordIds);
      const firstTryKnown = new Set(round.firstTryKnownWordIds);

      if (targetStatus === "unknown" || targetStatus === "fuzzy") {
        completed.delete(wordId);
        firstTryKnown.delete(wordId);
      } else if (targetStatus === "mastered") {
        completed.add(wordId);
        firstTryKnown.delete(wordId);
      } else {
        completed.add(wordId);
        firstTryKnown.add(wordId);
      }

      const isRoundComplete = round.wordIds.every((id) => completed.has(id));
      const nextStatus =
        round.status === "archived" ? "archived" : isRoundComplete ? "completed" : "active";

      await tx.reviewLog.create({
        data: {
          userId,
          wordId,
          grade,
          revealedAnswer: true,
          reviewedAt: now,
        },
      });

      await tx.reviewState.upsert({
        where: { wordId },
        create: {
          userId,
          wordId,
          lastReviewedAt: now,
          seenCount: 1,
          lapseCount: grade === 0 ? 1 : 0,
          consecutivePerfect: targetStatus === "first_try_mastered" ? 1 : 0,
          freezeRounds: 0,
          isMastered: isMasteredTarget,
          masteryPhase: isMasteredTarget ? 3 : 0,
        },
        update: {
          lastReviewedAt: now,
          seenCount: { increment: 1 },
          lapseCount: grade === 0 ? { increment: 1 } : undefined,
          consecutivePerfect: targetStatus === "first_try_mastered" ? 1 : 0,
          freezeRounds: 0,
          isMastered: isMasteredTarget,
          masteryPhase: isMasteredTarget ? 3 : 0,
        },
      });

      await tx.studyRound.update({
        where: { id: round.id },
        data: {
          attemptedWordIds: [...attempted],
          completedWordIds: [...completed],
          firstTryKnownWordIds: [...firstTryKnown],
          status: nextStatus,
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update word status";
    redirect(`/app/rounds/${roundId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/app/today");
  revalidatePath("/app/rounds");
  revalidatePath(`/app/rounds/${roundId}`);
  revalidatePath("/app/stats");
  revalidatePath("/app/library");
  redirect(`/app/rounds/${roundId}`);
}

export async function startSessionAction(
  input: z.infer<typeof startSessionSchema>,
): Promise<ActionResult<{ sessionId: string }>> {
  if (!hasStudyPrismaModels()) {
    return { ok: false, message: STUDY_PRISMA_HINT };
  }

  const parsed = startSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid session request" };
  }

  const userId = await getAuthedUserId();
  if (!userId) {
    return { ok: false, message: "Please sign in first" };
  }

  const round = await prisma.studyRound.findFirst({
    where: {
      id: parsed.data.roundId,
      userId,
    },
  });

  if (!round) {
    return { ok: false, message: "Round not found" };
  }

  const ongoingSession = await prisma.studySession.findFirst({
    where: {
      userId,
      roundId: round.id,
      type: parsed.data.type,
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
    return { ok: true, data: { sessionId: ongoingSession.id } };
  }

  const settings = await prisma.studySettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  // Source of truth: settings.sessionSize.
  // Ignore incoming count to prevent stale client values creating wrong-sized sessions.
  const sessionSize = Math.min(Math.max(settings.sessionSize, 1), 100);
  const roundWords = await prisma.word.findMany({
    where: {
      userId,
      id: { in: round.wordIds },
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
  const nonCompletedIds = new Set(
    round.wordIds.filter((wordId) => !round.completedWordIds.includes(wordId)),
  );

  const roundWordIdSet = new Set(round.wordIds);
  const attemptedSet = new Set(
    round.attemptedWordIds.filter(
      (wordId) => roundWordIdSet.has(wordId) && statuses.get(wordId) !== "new",
    ),
  );
  const availableWords = roundWords.filter((word) => nonCompletedIds.has(word.id));
  availableWords.sort((a, b) => {
    if (a.isPriority !== b.isPriority) {
      return a.isPriority ? -1 : 1;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  let selectedWordIds: string[] = [];

  if (parsed.data.type === "normal") {
    // Encounter phase: strictly consume only not-yet-encountered words in this round.
    // Do not backfill with attempted words when the remainder is smaller than sessionSize.
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
    // Queue extra words in stable batches:
    // 1) unknown before fuzzy
    // 2) more recently failed/reviewed first (so last session unknown enters next session first)
    // 3) priority then created order as deterministic fallback
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
    if (parsed.data.type === "normal") {
      return { ok: false, message: "Encounter phase already finished. Use Extra Practice." };
    }
    return { ok: false, message: "No words available for this session type" };
  }

  const session = await prisma.studySession.create({
    data: {
      userId,
      roundId: round.id,
      type: parsed.data.type,
      wordIds: selectedWordIds,
      results: [],
    },
    select: {
      id: true,
    },
  });

  revalidatePath("/app/today");
  revalidatePath("/app/rounds");
  return { ok: true, data: { sessionId: session.id } };
}

export async function startSessionAndRedirectAction(formData: FormData) {
  const roundId = String(formData.get("roundId") ?? "");
  const typeRaw = String(formData.get("type") ?? "");
  const countRaw = Number.parseInt(String(formData.get("count") ?? ""), 10);
  const type = typeRaw === "extra" ? "extra" : "normal";
  const count = Number.isFinite(countRaw) ? countRaw : undefined;
  const result = await startSessionAction({ roundId, type, count });
  if (!result.ok) {
    redirect(`/app/rounds/${roundId}?error=${encodeURIComponent(result.message)}`);
  }
  redirect(`/app/session/${result.data.sessionId}`);
}

export async function saveSessionProgressAction(
  input: z.infer<typeof saveSessionProgressSchema>,
): Promise<ActionResult<{ saved: number }>> {
  if (!hasStudyPrismaModels()) {
    return { ok: false, message: STUDY_PRISMA_HINT };
  }

  const parsed = saveSessionProgressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid session progress payload" };
  }

  const userId = await getAuthedUserId();
  if (!userId) {
    return { ok: false, message: "Please sign in first" };
  }

  const now = new Date();
  const results = parsed.data.results.map((item) => ({
    wordId: item.wordId,
    outcome: item.outcome,
    timestamp: item.timestamp ?? now.toISOString(),
  })) satisfies SessionResultRecord[];

  const session = await prisma.studySession.findFirst({
    where: {
      id: parsed.data.sessionId,
      userId,
    },
    select: {
      id: true,
      completedAt: true,
      wordIds: true,
    },
  });
  if (!session) {
    return { ok: false, message: "Session not found" };
  }

  if (session.completedAt) {
    return { ok: true, data: { saved: 0 } };
  }

  if (results.length > session.wordIds.length) {
    return { ok: false, message: "Session progress exceeds session size" };
  }

  for (let index = 0; index < results.length; index += 1) {
    const item = results[index];
    const expectedWordId = session.wordIds[index];
    if (item.wordId !== expectedWordId) {
      return { ok: false, message: "Session progress is out of order" };
    }
  }

  await prisma.studySession.update({
    where: { id: session.id },
    data: {
      results: results as unknown as z.infer<typeof saveSessionProgressSchema>["results"],
    },
  });

  revalidatePath(`/app/session/${session.id}`);
  return { ok: true, data: { saved: results.length } };
}

export async function finishSessionAction(
  input: z.infer<typeof finishSessionSchema>,
): Promise<ActionResult<{ roundId: string }>> {
  if (!hasStudyPrismaModels()) {
    return { ok: false, message: STUDY_PRISMA_HINT };
  }

  const parsed = finishSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid session result payload" };
  }

  const userId = await getAuthedUserId();
  if (!userId) {
    return { ok: false, message: "Please sign in first" };
  }

  const now = new Date();
  const results = parsed.data.results.map((item) => ({
    wordId: item.wordId,
    outcome: item.outcome,
    timestamp: item.timestamp ?? now.toISOString(),
  })) satisfies SessionResultRecord[];

  const resultByWordId = new Map<string, SessionResultRecord>();
  for (const item of results) {
    if (!resultByWordId.has(item.wordId)) {
      resultByWordId.set(item.wordId, item);
    }
  }

  try {
    const done = await prisma.$transaction(async (tx) => {
      const session = await tx.studySession.findFirst({
        where: {
          id: parsed.data.sessionId,
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
      const [reviewStates, roundReviewStates] = await Promise.all([
        tx.reviewState.findMany({
          where: {
            userId,
            wordId: { in: session.wordIds },
          },
        }),
        tx.reviewState.findMany({
          where: {
            userId,
            wordId: { in: round.wordIds },
          },
          select: {
            wordId: true,
            seenCount: true,
          },
        }),
      ]);
      const stateMap = new Map(reviewStates.map((item) => [item.wordId, item]));
      const roundWordIdSet = new Set(round.wordIds);
      const reviewedRoundWordSet = new Set(
        roundReviewStates.filter((item) => item.seenCount > 0).map((item) => item.wordId),
      );
      const attempted = new Set(
        round.attemptedWordIds.filter(
          (wordId) => roundWordIdSet.has(wordId) && reviewedRoundWordSet.has(wordId),
        ),
      );
      const completed = new Set(round.completedWordIds);
      const firstTryKnown = new Set(round.firstTryKnownWordIds);

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

        await tx.reviewLog.create({
          data: {
            userId,
            wordId,
            grade,
            revealedAnswer: true,
            reviewedAt: now,
          },
        });

        const state = stateMap.get(wordId);
        if (!state) {
          const created = await tx.reviewState.create({
            data: {
              userId,
              wordId,
              lastReviewedAt: now,
              seenCount: 1,
              lapseCount: grade === 0 ? 1 : 0,
              consecutivePerfect: 0,
              freezeRounds: 0,
              isMastered: false,
              masteryPhase: 0,
            },
          });
          stateMap.set(wordId, created);
        } else {
          const updated = await tx.reviewState.update({
            where: {
              wordId,
            },
            data: {
              lastReviewedAt: now,
              seenCount: { increment: 1 },
              lapseCount: grade === 0 ? { increment: 1 } : undefined,
            },
          });
          stateMap.set(wordId, updated);
        }
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

        const roundStates = await tx.reviewState.findMany({
          where: {
            userId,
            wordId: { in: round.wordIds },
          },
          select: {
            wordId: true,
            consecutivePerfect: true,
          },
        });
        const roundStateMap = new Map(roundStates.map((item) => [item.wordId, item]));

        for (const wordId of round.wordIds) {
          const current = roundStateMap.get(wordId);
          const prevConsecutive = current?.consecutivePerfect ?? 0;
          const firstTry = firstTryKnown.has(wordId);

          if (firstTry) {
            const nextConsecutive = prevConsecutive + 1;
            const shouldMaster = settings.requireConsecutiveKnown ? nextConsecutive >= 2 : true;
            await tx.reviewState.update({
              where: { wordId },
              data: {
                consecutivePerfect: nextConsecutive,
                isMastered: shouldMaster,
                freezeRounds: shouldMaster ? settings.freezeRounds : 0,
              },
            });
          } else {
            await tx.reviewState.update({
              where: { wordId },
              data: {
                consecutivePerfect: 0,
                isMastered: false,
                freezeRounds: 0,
              },
            });
          }
        }
      }

      await tx.studySession.update({
        where: { id: session.id },
        data: {
          completedAt: now,
          results: results as unknown as z.infer<typeof finishSessionSchema>["results"],
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
    });

    revalidatePath("/app/today");
    revalidatePath("/app/rounds");
    revalidatePath(`/app/rounds/${done.roundId}`);
    revalidatePath(`/app/session/${parsed.data.sessionId}`);
    revalidatePath(`/app/session/${parsed.data.sessionId}/summary`);
    revalidatePath("/app/stats");

    return { ok: true, data: { roundId: done.roundId } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to finish session";
    return { ok: false, message };
  }
}

export async function updateStudySettingsAction(
  input: z.infer<typeof updateSettingsSchema>,
): Promise<ActionResult<null>> {
  if (!hasStudyPrismaModels()) {
    return { ok: false, message: STUDY_PRISMA_HINT };
  }

  const parsed = updateSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid settings payload" };
  }
  const userId = await getAuthedUserId();
  if (!userId) {
    return { ok: false, message: "Please sign in first" };
  }

  const payload: Record<string, unknown> = {};
  if (typeof parsed.data.sessionSize === "number") payload.sessionSize = parsed.data.sessionSize;
  if (typeof parsed.data.freezeRounds === "number") payload.freezeRounds = parsed.data.freezeRounds;
  if (typeof parsed.data.autoPlayAudio === "boolean") payload.autoPlayAudio = parsed.data.autoPlayAudio;
  if (typeof parsed.data.requireConsecutiveKnown === "boolean") {
    payload.requireConsecutiveKnown = parsed.data.requireConsecutiveKnown;
  }

  await prisma.studySettings.upsert({
    where: { userId },
    update: payload,
    create: {
      userId,
      ...payload,
    },
  });

  revalidatePath("/app/settings");
  revalidatePath("/app/rounds");
  revalidatePath("/app/rounds", "layout");
  revalidatePath("/app/today");
  return { ok: true, data: null };
}
