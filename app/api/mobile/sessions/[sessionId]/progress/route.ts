import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/prisma";
import { authenticateMobileRequest } from "../../../auth";

const progressSchema = z.object({
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

type Params = { params: Promise<{ sessionId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
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

  const parsed = progressSchema.safeParse(body);
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

  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, completedAt: true, wordIds: true },
  });

  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
  }

  if (session.completedAt) {
    return NextResponse.json({ ok: true, saved: 0 });
  }

  if (results.length > session.wordIds.length) {
    return NextResponse.json({ ok: false, error: "Results exceed session size" }, { status: 422 });
  }

  for (let i = 0; i < results.length; i++) {
    if (results[i].wordId !== session.wordIds[i]) {
      return NextResponse.json({ ok: false, error: "Results out of order" }, { status: 422 });
    }
  }

  await prisma.studySession.update({
    where: { id: session.id },
    data: { results: results as unknown[] },
  });

  return NextResponse.json({ ok: true, saved: results.length });
}
