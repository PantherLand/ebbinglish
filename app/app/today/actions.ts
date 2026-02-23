"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import { planNextReview } from "@/src/review-scheduler";

const submitReviewSchema = z.object({
  wordId: z.string().min(1),
  grade: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  revealed: z.boolean(),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
const submitReviewBatchSchema = z.object({
  items: z.array(submitReviewSchema).min(1).max(200),
});

export type SubmitReviewResult =
  | {
      ok: true;
      nextStage: number;
      nextDueAt: string;
    }
  | {
      ok: false;
      message: string;
    };

export type SubmitReviewBatchInput = z.infer<typeof submitReviewBatchSchema>;
export type SubmitReviewBatchResult =
  | {
      ok: true;
      saved: number;
    }
  | {
      ok: false;
      message: string;
    };

export async function submitReviewAction(
  input: SubmitReviewInput,
): Promise<SubmitReviewResult> {
  const parsed = submitReviewSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid review payload" };
  }

  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return { ok: false, message: "Please sign in first" };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return { ok: false, message: "User not found" };
  }

  const { wordId, grade, revealed } = parsed.data;

  const word = await prisma.word.findFirst({
    where: {
      id: wordId,
      userId: user.id,
    },
    select: { id: true },
  });

  if (!word) {
    return { ok: false, message: "Word not found" };
  }

  const existing = await prisma.reviewState.findUnique({
    where: { wordId: word.id },
    select: { stage: true },
  });

  const now = new Date();
  const plan = planNextReview(existing?.stage ?? 0, grade, now);

  const updateData: Prisma.ReviewStateUpdateInput = {
    stage: plan.nextStage,
    dueAt: plan.dueAt,
    lastReviewedAt: now,
    seenCount: { increment: 1 },
  };

  if (plan.lapseIncrement > 0) {
    updateData.lapseCount = { increment: plan.lapseIncrement };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.reviewLog.create({
        data: {
          userId: user.id,
          wordId: word.id,
          grade,
          revealedAnswer: revealed,
        },
      });

      await tx.reviewState.upsert({
        where: { wordId: word.id },
        create: {
          userId: user.id,
          wordId: word.id,
          stage: plan.nextStage,
          dueAt: plan.dueAt,
          lastReviewedAt: now,
          lapseCount: plan.lapseIncrement,
          seenCount: 1,
        },
        update: updateData,
      });
    });
  } catch {
    return { ok: false, message: "Failed to save review" };
  }

  return {
    ok: true,
    nextStage: plan.nextStage,
    nextDueAt: plan.dueAt.toISOString(),
  };
}

export async function submitReviewBatchAction(
  input: SubmitReviewBatchInput,
): Promise<SubmitReviewBatchResult> {
  const parsed = submitReviewBatchSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid batch payload" };
  }

  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return { ok: false, message: "Please sign in first" };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return { ok: false, message: "User not found" };
  }

  const wordIds = [...new Set(parsed.data.items.map((item) => item.wordId))];
  const ownedWords = await prisma.word.findMany({
    where: {
      userId: user.id,
      id: { in: wordIds },
    },
    select: { id: true },
  });

  if (ownedWords.length !== wordIds.length) {
    return { ok: false, message: "Some words are invalid for this user" };
  }

  const stateRows = await prisma.reviewState.findMany({
    where: {
      wordId: { in: wordIds },
    },
    select: { wordId: true, stage: true },
  });
  const stageByWordId = new Map(stateRows.map((item) => [item.wordId, item.stage]));

  const now = new Date();
  const writeOps = parsed.data.items.map((item) => {
    const plan = planNextReview(stageByWordId.get(item.wordId) ?? 0, item.grade, now);
    stageByWordId.set(item.wordId, plan.nextStage);

    const updateData: Prisma.ReviewStateUpdateInput = {
      stage: plan.nextStage,
      dueAt: plan.dueAt,
      lastReviewedAt: now,
      seenCount: { increment: 1 },
    };

    if (plan.lapseIncrement > 0) {
      updateData.lapseCount = { increment: plan.lapseIncrement };
    }

    return {
      wordId: item.wordId,
      grade: item.grade,
      revealed: item.revealed,
      plan,
      updateData,
    };
  });

  try {
    await prisma.$transaction(async (tx) => {
      for (const op of writeOps) {
        await tx.reviewLog.create({
          data: {
            userId: user.id,
            wordId: op.wordId,
            grade: op.grade,
            revealedAnswer: op.revealed,
          },
        });

        await tx.reviewState.upsert({
          where: { wordId: op.wordId },
          create: {
            userId: user.id,
            wordId: op.wordId,
            stage: op.plan.nextStage,
            dueAt: op.plan.dueAt,
            lastReviewedAt: now,
            lapseCount: op.plan.lapseIncrement,
            seenCount: 1,
          },
          update: op.updateData,
        });
      }
    });
  } catch {
    return { ok: false, message: "Failed to save review batch" };
  }

  return { ok: true, saved: writeOps.length };
}
