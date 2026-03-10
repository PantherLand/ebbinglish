import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiToken, touchApiTokenLastUsed } from "@/src/api-token-auth";
import { ensureStudySettings } from "@/src/study-model";
import { hasStudyPrismaModels, STUDY_PRISMA_HINT } from "@/src/study-runtime";
import { prisma } from "@/src/prisma";

const updateSettingsSchema = z.object({
  sessionSize: z.number().int().min(1).max(100).optional(),
  dailyGoal: z.number().int().min(1).max(500).optional(),
  freezeRounds: z.number().int().min(1).max(20).optional(),
  autoPlayAudio: z.boolean().optional(),
  requireConsecutiveKnown: z.boolean().optional(),
});

function serializeSettings(settings: {
  sessionSize: number;
  dailyGoal: number;
  freezeRounds: number;
  autoPlayAudio: boolean;
  requireConsecutiveKnown: boolean;
}) {
  return {
    sessionSize: settings.sessionSize,
    dailyGoal: settings.dailyGoal,
    freezeRounds: settings.freezeRounds,
    autoPlayAudio: settings.autoPlayAudio,
    requireConsecutiveKnown: settings.requireConsecutiveKnown,
  };
}

export async function GET(req: NextRequest) {
  const apiAuth = await authenticateApiToken(req);
  if (!apiAuth) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (!hasStudyPrismaModels()) {
    return NextResponse.json({ error: STUDY_PRISMA_HINT }, { status: 500 });
  }

  try {
    const settings = await ensureStudySettings(apiAuth.userId);
    touchApiTokenLastUsed(apiAuth.tokenId).catch(() => {});

    return NextResponse.json({
      settings: serializeSettings(settings),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load settings" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const apiAuth = await authenticateApiToken(req);
  if (!apiAuth) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  if (!hasStudyPrismaModels()) {
    return NextResponse.json({ ok: false, error: STUDY_PRISMA_HINT }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings payload" },
      { status: 422 },
    );
  }

  const payload = parsed.data;
  try {
    const settings = await prisma.studySettings.upsert({
      where: { userId: apiAuth.userId },
      update: payload,
      create: {
        userId: apiAuth.userId,
        ...payload,
      },
    });

    touchApiTokenLastUsed(apiAuth.tokenId).catch(() => {});

    return NextResponse.json({
      ok: true,
      settings: serializeSettings(settings),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 500 },
    );
  }
}
