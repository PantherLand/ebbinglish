import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/prisma";
import { authenticateMobileRequest } from "../../../auth";

const finishSchema = z.object({
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

function outcomeToGrade(outcome: string): number {
  if (outcome === "known") return 2;
  if (outcome === "fuzzy") return 1;
  return 0;
}

type Params = { params: Promise<{ sessionId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;
  const { sessionId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = finishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const now = new Date();
  const results = parsed.data.results.map((item) => ({
    wordId: item.wordId,
    outcome: item.outcome,
    timestamp: item.timestamp ?? now.toISOString(),
  }));

  const resultByWordId = new Map(results.map((r) => [r.wordId, r]));

  try {
    const done = await prisma.$transaction(async (tx) => {
      const session = await tx.studySession.findFirst({
        where: { id: sessionId, userId },
      });
      if (!session) throw new Error("Session not found");

      const round = await tx.studyRound.findFirst({
        where: { id: session.roundId, userId },
      });
      if (!round) throw new Error("Round not found");

      if (session.completedAt) {
        return { session, round, masteryUpdates: [] };
      }

      const settings = await tx.studySettings.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });

      const [reviewStates, roundReviewStates] = await Promise.all([
        tx.reviewState.findMany({
          where: { userId, wordId: { in: session.wordIds } },
        }),
        tx.reviewState.findMany({
          where: { userId, wordId: { in: round.wordIds } },
          select: { wordId: true, seenCount: true },
        }),
      ]);

      const stateMap = new Map(reviewStates.map((s) => [s.wordId, s]));
      const reviewedRoundWordSet = new Set(
        roundReviewStates.filter((s) => s.seenCount > 0).map((s) => s.wordId),
      );
      const roundWordIdSet = new Set(round.wordIds);
      const attempted = new Set(
        round.attemptedWordIds.filter(
          (id) => roundWordIdSet.has(id) && reviewedRoundWordSet.has(id),
        ),
      );
      const completed = new Set(round.completedWordIds);
      const firstTryKnown = new Set(round.firstTryKnownWordIds);
      const masteryUpdates: { wordId: string; newStatus: string }[] = [];

      for (const wordId of session.wordIds) {
        const r = resultByWordId.get(wordId);
        if (!r) continue;

        let isFirstAttempt = false;
        if (session.type === "normal") {
          isFirstAttempt = !attempted.has(wordId);
          attempted.add(wordId);
        }

        const grade = outcomeToGrade(r.outcome);
        if (r.outcome === "known") {
          completed.add(wordId);
          if (isFirstAttempt) firstTryKnown.add(wordId);
        }

        await tx.reviewLog.create({
          data: { userId, wordId, grade, revealedAnswer: true, reviewedAt: now },
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
              latestFirstTryGrade: isFirstAttempt ? grade : null,
              consecutivePerfect: 0,
              freezeRounds: 0,
              isMastered: false,
              masteryPhase: 0,
            },
          });
          stateMap.set(wordId, created);
        } else {
          const updated = await tx.reviewState.update({
            where: { wordId },
            data: {
              lastReviewedAt: now,
              seenCount: { increment: 1 },
              lapseCount: grade === 0 ? { increment: 1 } : undefined,
              latestFirstTryGrade: isFirstAttempt ? grade : undefined,
            },
          });
          stateMap.set(wordId, updated);
        }
      }

      const isRoundComplete = round.wordIds.every((id) => completed.has(id));

      if (isRoundComplete) {
        await tx.reviewState.updateMany({
          where: { userId, freezeRounds: { gt: 0 } },
          data: { freezeRounds: { decrement: 1 } },
        });

        const roundStates = await tx.reviewState.findMany({
          where: { userId, wordId: { in: round.wordIds } },
          select: { wordId: true, consecutivePerfect: true },
        });
        const roundStateMap = new Map(roundStates.map((s) => [s.wordId, s]));

        for (const wordId of round.wordIds) {
          const prevConsecutive = roundStateMap.get(wordId)?.consecutivePerfect ?? 0;
          const isFirstTry = firstTryKnown.has(wordId);

          if (isFirstTry) {
            const nextConsecutive = prevConsecutive + 1;
            const shouldMaster = settings.requireConsecutiveKnown
              ? nextConsecutive >= 2
              : true;
            await tx.reviewState.update({
              where: { wordId },
              data: {
                consecutivePerfect: nextConsecutive,
                isMastered: shouldMaster,
                freezeRounds: shouldMaster ? settings.freezeRounds : 0,
              },
            });
            if (shouldMaster) {
              masteryUpdates.push({ wordId, newStatus: "mastered" });
            }
          } else {
            await tx.reviewState.update({
              where: { wordId },
              data: { consecutivePerfect: 0, isMastered: false, freezeRounds: 0 },
            });
          }
        }
      }

      const updatedSession = await tx.studySession.update({
        where: { id: session.id },
        data: { completedAt: now, results: results as unknown[] },
      });

      await tx.studyRound.update({
        where: { id: round.id },
        data: {
          attemptedWordIds: [...attempted],
          completedWordIds: [...completed],
          firstTryKnownWordIds: [...firstTryKnown],
          status: isRoundComplete ? "completed" : round.status,
        },
      });

      return { session: updatedSession, round, masteryUpdates };
    });

    return NextResponse.json({
      ok: true,
      session: done.session,
      masteryUpdates: done.masteryUpdates,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to finish session";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
