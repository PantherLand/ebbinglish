import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiToken, touchApiTokenLastUsed } from "@/src/api-token-auth";
import { startMobileRoundSession } from "@/src/mobile-round";
import { hasStudyPrismaModels, STUDY_PRISMA_HINT } from "@/src/study-runtime";

const startRoundSessionSchema = z.object({
  roundId: z.string().min(1),
  type: z.enum(["normal", "extra"]),
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

  const parsed = startRoundSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid round session payload" },
      { status: 422 },
    );
  }

  try {
    const result = await startMobileRoundSession(apiAuth.userId, parsed.data.roundId, parsed.data.type);
    touchApiTokenLastUsed(apiAuth.tokenId).catch(() => {});
    revalidatePath("/app/today");
    revalidatePath("/app/rounds");
    revalidatePath(`/app/rounds/${parsed.data.roundId}`);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start round session";
    const status =
      message === "Round not found"
        ? 404
        : message.includes("finished") || message.includes("No words")
          ? 422
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
