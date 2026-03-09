import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/prisma";
import { authenticateMobileRequest } from "../auth";

const createRoundSchema = z.object({
  name: z.string().trim().min(1).max(120),
  wordIds: z.array(z.string().min(1)).min(1).max(500),
});

export async function GET(req: NextRequest) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;

  const rounds = await prisma.studyRound.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ rounds });
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

  const parsed = createRoundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const uniqueWordIds = [...new Set(parsed.data.wordIds)];
  const ownedWords = await prisma.word.findMany({
    where: { userId, id: { in: uniqueWordIds }, isAchieved: false },
    select: { id: true },
  });

  if (ownedWords.length !== uniqueWordIds.length) {
    return NextResponse.json({ ok: false, error: "Some words are invalid" }, { status: 422 });
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
  });

  return NextResponse.json({ ok: true, round });
}
