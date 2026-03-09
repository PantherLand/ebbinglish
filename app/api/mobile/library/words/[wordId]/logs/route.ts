import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/src/prisma";
import { authenticateMobileRequest } from "../../../../auth";

type Params = { params: Promise<{ wordId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
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

  const logs = await prisma.reviewLog.findMany({
    where: { wordId, userId },
    orderBy: { reviewedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(logs);
}
