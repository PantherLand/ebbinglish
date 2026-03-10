import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiToken, touchApiTokenLastUsed } from "@/src/api-token-auth";
import { saveMobileSessionProgress } from "@/src/mobile-session";
import { hasStudyPrismaModels, STUDY_PRISMA_HINT } from "@/src/study-runtime";

const sessionResultSchema = z.object({
  wordId: z.string().min(1),
  outcome: z.enum(["unknown", "fuzzy", "known"]),
  timestamp: z.string().datetime().optional(),
});

const saveSessionProgressSchema = z.object({
  sessionId: z.string().min(1),
  results: z.array(sessionResultSchema),
});

export async function POST(req: NextRequest) {
  const apiAuth = await authenticateApiToken(req);
  if (!apiAuth) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (!hasStudyPrismaModels()) {
    return NextResponse.json({ error: STUDY_PRISMA_HINT }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = saveSessionProgressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid session progress payload" },
      { status: 422 },
    );
  }

  try {
    const result = await saveMobileSessionProgress(
      apiAuth.userId,
      parsed.data.sessionId,
      parsed.data.results,
    );
    touchApiTokenLastUsed(apiAuth.tokenId).catch(() => {});
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save session progress";
    const status =
      message === "Session not found"
        ? 404
        : message.includes("out of order") || message.includes("exceeds")
          ? 422
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
