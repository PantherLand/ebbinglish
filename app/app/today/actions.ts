"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import { planNextReview } from "@/src/review-scheduler";

const MAX_PRACTICE_WORDS = 20;

const submitReviewSchema = z.object({
  wordId: z.string().min(1),
  grade: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  revealed: z.boolean(),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
const submitReviewBatchSchema = z.object({
  items: z.array(submitReviewSchema).min(1).max(200),
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
    if (
      errorMessage.includes("127.0.0.1:7890") ||
      errorMessage.includes("127.0.0.1:7891")
    ) {
      return {
        ok: false,
        message:
          "Local proxy 127.0.0.1:7890/7891 is unreachable. Start proxy client or unset http_proxy/https_proxy/all_proxy.",
      };
    }
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
