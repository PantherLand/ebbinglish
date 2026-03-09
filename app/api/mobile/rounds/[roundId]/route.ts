import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/src/prisma";
import { authenticateMobileRequest } from "../../auth";

type Params = { params: Promise<{ roundId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;
  const { roundId } = await params;

  const round = await prisma.studyRound.findFirst({
    where: { id: roundId, userId },
  });

  if (!round) {
    return NextResponse.json({ ok: false, error: "Round not found" }, { status: 404 });
  }

  return NextResponse.json(round);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;
  const { roundId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status;
  if (status !== "active" && status !== "completed" && status !== "archived") {
    return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 422 });
  }

  await prisma.studyRound.updateMany({
    where: { id: roundId, userId },
    data: { status },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;
  const { roundId } = await params;

  await prisma.studyRound.deleteMany({
    where: { id: roundId, userId },
  });

  return NextResponse.json({ ok: true });
}
