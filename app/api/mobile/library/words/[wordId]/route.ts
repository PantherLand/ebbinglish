import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/src/prisma";
import { authenticateMobileRequest } from "../../../auth";
import { buildWordStatusMap } from "@/src/study-queries";

type Params = { params: Promise<{ wordId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;
  const { wordId } = await params;

  const word = await prisma.word.findFirst({
    where: { id: wordId, userId },
  });

  if (!word) {
    return NextResponse.json({ ok: false, error: "Word not found" }, { status: 404 });
  }

  const statusMap = await buildWordStatusMap(userId, [wordId]);
  const reviewState = await prisma.reviewState.findUnique({
    where: { wordId },
  });

  return NextResponse.json({
    ...word,
    status: (statusMap.get(wordId) ?? "new").toUpperCase(),
    reviewState,
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;
  const { wordId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const word = await prisma.word.findFirst({
    where: { id: wordId, userId },
    select: { id: true },
  });

  if (!word) {
    return NextResponse.json({ ok: false, error: "Word not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.isPriority === "boolean") data.isPriority = body.isPriority;
  if (typeof body.isAchieved === "boolean") data.isAchieved = body.isAchieved;
  if (typeof body.note === "string") data.note = body.note || null;

  await prisma.word.update({ where: { id: word.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;
  const { wordId } = await params;

  const word = await prisma.word.findFirst({
    where: { id: wordId, userId },
    select: { id: true },
  });

  if (!word) {
    return NextResponse.json({ ok: false, error: "Word not found" }, { status: 404 });
  }

  await prisma.word.delete({ where: { id: word.id } });
  return NextResponse.json({ ok: true });
}
