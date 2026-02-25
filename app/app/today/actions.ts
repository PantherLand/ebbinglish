"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";

const MAX_PRACTICE_WORDS = 20;

const submitReviewBatchItemSchema = z.object({
  wordId: z.string().min(1),
  isFirstTimePerfect: z.boolean(),
  firstImpressionGrade: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  revealed: z.boolean().optional(),
});

const submitReviewBatchSchema = z.object({
  items: z.array(submitReviewBatchItemSchema).min(1).max(400),
});
const generatePracticeStorySchema = z.object({
  words: z.array(z.string().trim().min(1).max(64)).min(1).max(MAX_PRACTICE_WORDS),
});
const generatedStorySchema = z.object({
  title: z.string().trim().min(1).max(120),
  story: z.string().trim().min(80).max(2800),
  prompts: z.array(z.string().trim().min(1).max(300)).min(3).max(6),
  usedWords: z
    .array(z.string().trim().min(1).max(64))
    .min(1)
    .max(MAX_PRACTICE_WORDS)
    .optional(),
});

export type SubmitReviewBatchInput = z.infer<typeof submitReviewBatchSchema>;
export type SubmitReviewBatchResult =
  | {
      ok: true;
      saved: number;
      nextGlobalRound: number;
    }
  | {
      ok: false;
      message: string;
    };
export type AdvanceToNextSessionResult =
  | {
      ok: true;
      nextGlobalRound: number;
    }
  | {
      ok: false;
      message: string;
    };
export type GeneratePracticeStoryInput = z.infer<typeof generatePracticeStorySchema>;
export type GeneratePracticeStoryResult =
  | {
      ok: true;
      title: string;
      story: string;
      prompts: string[];
      usedWords: string[];
    }
  | {
      ok: false;
      message: string;
    };

function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      return null;
    }
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
}

type FirstImpressionState = {
  consecutivePerfect: number;
  freezeRounds: number;
  isMastered: boolean;
  masteryPhase: number;
};

function computeNextFirstImpressionState(
  current: FirstImpressionState,
  isFirstTimePerfect: boolean,
): FirstImpressionState {
  if (current.isMastered || current.masteryPhase >= 3) {
    return {
      consecutivePerfect: 0,
      freezeRounds: 0,
      isMastered: true,
      masteryPhase: 3,
    };
  }

  if (current.freezeRounds > 0) {
    return current;
  }

  // Phase 0: base mastery phase, need 2 consecutive "first-seen known" to enter freeze-3.
  if (current.masteryPhase <= 0) {
    const consecutivePerfect = isFirstTimePerfect ? current.consecutivePerfect + 1 : 0;
    if (consecutivePerfect >= 2) {
      return {
        consecutivePerfect: 0,
        freezeRounds: 3,
        isMastered: false,
        masteryPhase: 1,
      };
    }
    return {
      consecutivePerfect,
      freezeRounds: 0,
      isMastered: false,
      masteryPhase: 0,
    };
  }

  // Phase 1: after 3-round freeze, first-seen known => freeze-6, else reset as new.
  if (current.masteryPhase === 1) {
    if (isFirstTimePerfect) {
      return {
        consecutivePerfect: 0,
        freezeRounds: 6,
        isMastered: false,
        masteryPhase: 2,
      };
    }
    return {
      consecutivePerfect: 0,
      freezeRounds: 0,
      isMastered: false,
      masteryPhase: 0,
    };
  }

  // Phase 2: after 6-round freeze, first-seen known => mastered, else reset as new.
  if (isFirstTimePerfect) {
    return {
      consecutivePerfect: 0,
      freezeRounds: 0,
      isMastered: true,
      masteryPhase: 3,
    };
  }

  return {
    consecutivePerfect: 0,
    freezeRounds: 0,
    isMastered: false,
    masteryPhase: 0,
  };
}

async function decrementFreezeRounds(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.reviewState.updateMany({
    where: { userId, freezeRounds: { gt: 0 } },
    data: { freezeRounds: { decrement: 1 } },
  });
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

  const dedupedItems = [...new Map(parsed.data.items.map((item) => [item.wordId, item])).values()];
  const wordIds = dedupedItems.map((item) => item.wordId);
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

  const now = new Date();

  try {
    const nextGlobalRound = await prisma.$transaction(async (tx) => {
      // Round settlement: consume one freeze turn for every currently frozen word.
      await decrementFreezeRounds(tx, user.id);

      const existingStates = await tx.reviewState.findMany({
        where: {
          userId: user.id,
          wordId: { in: wordIds },
        },
        select: {
          wordId: true,
          seenCount: true,
          lapseCount: true,
          consecutivePerfect: true,
          freezeRounds: true,
          isMastered: true,
          masteryPhase: true,
        },
      });
      const stateByWordId = new Map(existingStates.map((state) => [state.wordId, state]));

      for (const item of dedupedItems) {
        const current = stateByWordId.get(item.wordId);
        const baseState: FirstImpressionState = {
          consecutivePerfect: current?.consecutivePerfect ?? 0,
          freezeRounds: current?.freezeRounds ?? 0,
          isMastered: current?.isMastered ?? false,
          masteryPhase: current?.masteryPhase ?? 0,
        };
        const nextState = computeNextFirstImpressionState(baseState, item.isFirstTimePerfect);
        const grade = item.firstImpressionGrade ?? (item.isFirstTimePerfect ? 2 : 0);

        await tx.reviewLog.create({
          data: {
            userId: user.id,
            wordId: item.wordId,
            grade,
            revealedAnswer: item.revealed ?? true,
          },
        });

        await tx.reviewState.upsert({
          where: { wordId: item.wordId },
          create: {
            userId: user.id,
            wordId: item.wordId,
            lastReviewedAt: now,
            lapseCount: grade === 0 ? 1 : 0,
            seenCount: 1,
            consecutivePerfect: nextState.consecutivePerfect,
            freezeRounds: nextState.freezeRounds,
            isMastered: nextState.isMastered,
            masteryPhase: nextState.masteryPhase,
          },
          update: {
            lastReviewedAt: now,
            seenCount: { increment: 1 },
            lapseCount: grade === 0 ? { increment: 1 } : undefined,
            consecutivePerfect: nextState.consecutivePerfect,
            freezeRounds: nextState.freezeRounds,
            isMastered: nextState.isMastered,
            masteryPhase: nextState.masteryPhase,
          },
        });
      }

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { currentGlobalRound: { increment: 1 } },
        select: { currentGlobalRound: true },
      });

      return updatedUser.currentGlobalRound;
    });

    revalidatePath("/app/today");
    revalidatePath("/app/library");
    revalidatePath("/app/stats");

    return { ok: true, saved: dedupedItems.length, nextGlobalRound };
  } catch {
    return { ok: false, message: "Failed to save review batch" };
  }
}

export async function advanceToNextSessionAction(): Promise<AdvanceToNextSessionResult> {
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

  try {
    const nextGlobalRound = await prisma.$transaction(async (tx) => {
      await decrementFreezeRounds(tx, user.id);

      const updated = await tx.user.update({
        where: { id: user.id },
        data: { currentGlobalRound: { increment: 1 } },
        select: { currentGlobalRound: true },
      });
      return updated.currentGlobalRound;
    });

    revalidatePath("/app/today");
    revalidatePath("/app/library");
    revalidatePath("/app/stats");

    return { ok: true, nextGlobalRound };
  } catch {
    return { ok: false, message: "Failed to advance session" };
  }
}

export async function generatePracticeStoryAction(
  input: GeneratePracticeStoryInput,
): Promise<GeneratePracticeStoryResult> {
  const parsed = generatePracticeStorySchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Invalid practice request" };
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

  const uniqueWords = [...new Set(parsed.data.words.map((word) => word.trim()))].filter(
    (word) => word.length > 0,
  );
  if (uniqueWords.length === 0) {
    return { ok: false, message: "No words to practice" };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, message: "OPENAI_API_KEY is not configured" };
  }

  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com").replace(
    /\/+$/,
    "",
  );
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const systemPrompt =
    "You are an English tutor. Create a concise CEFR-B1 short reading passage that naturally uses target vocabulary for spaced repetition. Return strict JSON only with keys: title, story, prompts, usedWords.";
  const userPrompt = [
    `Target words: ${uniqueWords.join(", ")}`,
    "Requirements:",
    "- story: 120-180 English words, coherent and practical, no markdown",
    "- prompts: 3 short reading-comprehension prompts in English",
    "- usedWords: only include target words that are actually used in story",
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userPrompt }],
          },
        ],
        max_output_tokens: 700,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, message: "OpenAI generation timed out" };
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown network error";
    return { ok: false, message: `Failed to contact OpenAI: ${errorMessage}` };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    const suffix = details ? `: ${details.slice(0, 120)}` : "";
    return { ok: false, message: `OpenAI request failed (${response.status})${suffix}` };
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  const primaryText = payload.output_text?.trim() ?? "";
  const fallbackText = (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text?.trim() ?? "")
    .join("\n")
    .trim();
  const rawText = primaryText || fallbackText;
  if (!rawText) {
    return { ok: false, message: "OpenAI returned empty content" };
  }

  const jsonObject = extractJsonObject(rawText);
  if (!jsonObject) {
    return { ok: false, message: "OpenAI output is not valid JSON" };
  }

  const generated = generatedStorySchema.safeParse(jsonObject);
  if (!generated.success) {
    return { ok: false, message: "OpenAI output schema mismatch" };
  }

  const normalizedUsedWords = [...new Set((generated.data.usedWords ?? uniqueWords).map((word) => word.trim()))]
    .filter((word) => word.length > 0)
    .slice(0, MAX_PRACTICE_WORDS);

  return {
    ok: true,
    title: generated.data.title.trim(),
    story: generated.data.story.trim(),
    prompts: generated.data.prompts.map((prompt) => prompt.trim()).filter((prompt) => prompt.length > 0),
    usedWords: normalizedUsedWords,
  };
}
