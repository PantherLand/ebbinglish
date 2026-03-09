import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/src/prisma";
import { authenticateMobileRequest } from "../../auth";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;
  const { sessionId } = await params;

  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}
