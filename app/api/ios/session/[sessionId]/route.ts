import { NextRequest, NextResponse } from "next/server";
import { authenticateApiToken, touchApiTokenLastUsed } from "@/src/api-token-auth";
import { loadMobileSession } from "@/src/mobile-session";
import { hasStudyPrismaModels, STUDY_PRISMA_HINT } from "@/src/study-runtime";

type RouteContext = {
  params: Promise<{ sessionId: string }> | { sessionId: string };
};

export async function GET(req: NextRequest, context: RouteContext) {
  const apiAuth = await authenticateApiToken(req);
  if (!apiAuth) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (!hasStudyPrismaModels()) {
    return NextResponse.json({ error: STUDY_PRISMA_HINT }, { status: 500 });
  }

  const { sessionId } = await Promise.resolve(context.params);

  try {
    const payload = await loadMobileSession(apiAuth.userId, sessionId);
    touchApiTokenLastUsed(apiAuth.tokenId).catch(() => {});
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load session";
    const status = message === "Session not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
