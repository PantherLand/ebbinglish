import { NextRequest, NextResponse } from "next/server";
import { authenticateApiToken, touchApiTokenLastUsed } from "@/src/api-token-auth";
import { loadMobileRoundDetail } from "@/src/mobile-round";
import { hasStudyPrismaModels, STUDY_PRISMA_HINT } from "@/src/study-runtime";

type RouteContext = {
  params: Promise<{ roundId: string }> | { roundId: string };
};

export async function GET(req: NextRequest, context: RouteContext) {
  const apiAuth = await authenticateApiToken(req);
  if (!apiAuth) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (!hasStudyPrismaModels()) {
    return NextResponse.json({ error: STUDY_PRISMA_HINT }, { status: 500 });
  }

  const { roundId } = await Promise.resolve(context.params);

  try {
    const payload = await loadMobileRoundDetail(apiAuth.userId, roundId);
    touchApiTokenLastUsed(apiAuth.tokenId).catch(() => {});
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load round";
    const status = message === "Round not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
