import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/prisma";
import { authenticateMobileRequest } from "../auth";
import { deriveWordStatus } from "@/src/study-model";

const startSessionSchema = z.object({
  roundId: z.string().min(1),
  type: z.enum(["normal", "extra"]),
  count: z.number().int().min(1).max(100).optional(),
});

function normalizeFrozenStatusForRound(
  status: ReturnType<typeof deriveWordStatus>,
  latestGrade: number | null,
): ReturnType<typeof deriveWordStatus> {
  if (status !== "frozen") return status;
  if (latestGrade === 0) return "unknown";
  if (latestGrade === 1) return "fuzzy";
  return "known";
}

export async function POST(req: NextRequest) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = startSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const round = await prisma.studyRound.findFirst({
    where: { id: parsed.data.roundId, userId },
  });

  if (!round) {
    return NextResponse.json({ ok: false, error: "Round not found" }, { status: 404 });
  }

  // Check for ongoing session
  const ongoingSession = await prisma.studySession.findFirst({
    where: { userId, roundId: round.id, type: parsed.data.type, completedAt: null },
    orderBy: { startedAt: "desc" },
  });

  if (ongoingSession) {
    return NextResponse.json({ ok: true, session: ongoingSession });
  }

  const settings = await prisma.studySettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const sessionSize = Math.min(Math.max(settings.sessionSize, 1), 100);
  const roundWords = await prisma.word.findMany({
    where: { userId, id: { in: round.wordIds }, isAchieved: false },
    select: { id: true, isPriority: true, createdAt: true },
  });

  const [reviewStates, latestLogs] = await Promise.all([
    prisma.reviewState.findMany({
      where: { userId, wordId: { in: round.wordIds } },
      select: { wordId: true, seenCount: true, isMastered: true, freezeRounds: true, latestFirstTryGrade: true },
    }),
    prisma.reviewLog.findMany({
      where: { userId, wordId: { in: round.wordIds } },
      select: { wordId: true, grade: true, reviewedAt: true },
      orderBy: { reviewedAt: "desc" },
    }),
  ]);

  const stateMap = new Map(reviewStates.map((s) => [s.wordId, s]));
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
    round.wordIds.filter((id) => !round.completedWordIds.includes(id)),
  );
  const roundWordIdSet = new Set(round.wordIds);
  const attemptedSet = new Set(
    round.attemptedWordIds.filter(
      (id) => roundWordIdSet.has(id) && statuses.get(id) !== "new",
    ),
  );

  const availableWords = roundWords.filter((w) => nonCompletedIds.has(w.id));
  availableWords.sort((a, b) => {
    if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  let selectedWordIds: string[];

  if (parsed.data.type === "normal") {
    const encounterPool = availableWords.filter((w) => !attemptedSet.has(w.id));
    selectedWordIds = encounterPool.slice(0, sessionSize).map((w) => w.id);
  } else {
    const extraPool = availableWords.filter((w) => {
      if (!attemptedSet.has(w.id)) return false;
      const status = statuses.get(w.id);
      return status === "unknown" || status === "fuzzy";
    });
    extraPool.sort((a, b) => {
      const sA = statuses.get(a.id) === "unknown" ? 0 : 1;
      const sB = statuses.get(b.id) === "unknown" ? 0 : 1;
      if (sA !== sB) return sA - sB;
      const rA = latestReviewedAtMap.get(a.id)?.getTime() ?? 0;
      const rB = latestReviewedAtMap.get(b.id)?.getTime() ?? 0;
      if (rA !== rB) return rB - rA;
      if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    selectedWordIds = extraPool.slice(0, sessionSize).map((w) => w.id);
  }

  if (selectedWordIds.length === 0) {
    const msg =
      parsed.data.type === "normal"
        ? "Encounter phase already finished. Use Extra Practice."
        : "No words available for this session type";
    return NextResponse.json({ ok: false, error: msg }, { status: 422 });
  }

  const session = await prisma.studySession.create({
    data: {
      userId,
      roundId: round.id,
      type: parsed.data.type,
      wordIds: selectedWordIds,
      results: [],
    },
  });

  return NextResponse.json({ ok: true, session });
}
