import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/src/prisma";
import { authenticateMobileRequest } from "../../auth";

export async function POST(req: NextRequest) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;

  await prisma.$transaction([
    prisma.reviewLog.deleteMany({ where: { userId } }),
    prisma.reviewState.deleteMany({ where: { userId } }),
    prisma.studySession.deleteMany({ where: { userId } }),
    prisma.studyRound.deleteMany({ where: { userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
