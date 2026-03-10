import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiToken, touchApiTokenLastUsed } from "@/src/api-token-auth";
import { prisma } from "@/src/prisma";

const requestSchema = z.object({
  wordId: z.string().trim().min(1, "wordId is required"),
  achieved: z.boolean(),
});

export async function POST(req: NextRequest) {
  const apiAuth = await authenticateApiToken(req);
  if (!apiAuth) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const { wordId, achieved } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const word = await tx.word.findFirst({
        where: {
          id: wordId,
          userId: apiAuth.userId,
        },
        select: {
          id: true,
          isAchieved: true,
        },
      });

      if (!word) {
        throw new Error("Word not found");
      }

      if (word.isAchieved !== achieved) {
        await tx.word.update({
          where: { id: word.id },
          data: { isAchieved: achieved },
        });
      }

      const rounds = await tx.studyRound.findMany({
        where: {
          userId: apiAuth.userId,
          status: { not: "archived" },
          wordIds: { has: word.id },
        },
        select: {
          id: true,
          wordIds: true,
          attemptedWordIds: true,
          completedWordIds: true,
          firstTryKnownWordIds: true,
        },
      });

      for (const round of rounds) {
        const roundWordIdSet = new Set(round.wordIds);
        const attempted = new Set(round.attemptedWordIds.filter((id) => roundWordIdSet.has(id)));
        const completed = new Set(round.completedWordIds.filter((id) => roundWordIdSet.has(id)));
        const firstTryKnown = new Set(round.firstTryKnownWordIds.filter((id) => roundWordIdSet.has(id)));

        if (achieved) {
          attempted.add(word.id);
          completed.add(word.id);
        } else {
          attempted.delete(word.id);
          completed.delete(word.id);
          firstTryKnown.delete(word.id);
        }

        const isRoundComplete = round.wordIds.every((id) => completed.has(id));

        await tx.studyRound.update({
          where: { id: round.id },
          data: {
            attemptedWordIds: [...attempted],
            completedWordIds: [...completed],
            firstTryKnownWordIds: [...firstTryKnown],
            status: isRoundComplete ? "completed" : "active",
          },
        });
      }
    });

    touchApiTokenLastUsed(apiAuth.tokenId).catch(() => {});

    revalidatePath("/app/library");
    revalidatePath("/app/rounds");
    revalidatePath("/app/today");
    revalidatePath("/app/stats");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to update achieved state",
      },
      { status: 500 },
    );
  }
}
