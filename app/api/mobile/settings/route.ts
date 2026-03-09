import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/prisma";
import { authenticateMobileRequest } from "../auth";

const updateSettingsSchema = z.object({
  sessionSize: z.number().int().min(1).max(60).optional(),
  freezeRounds: z.number().int().min(1).max(20).optional(),
  autoPlayAudio: z.boolean().optional(),
  requireConsecutiveKnown: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;

  const settings = await prisma.studySettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const payload: Record<string, unknown> = {};
  if (typeof parsed.data.sessionSize === "number") payload.sessionSize = parsed.data.sessionSize;
  if (typeof parsed.data.freezeRounds === "number") payload.freezeRounds = parsed.data.freezeRounds;
  if (typeof parsed.data.autoPlayAudio === "boolean") payload.autoPlayAudio = parsed.data.autoPlayAudio;
  if (typeof parsed.data.requireConsecutiveKnown === "boolean") payload.requireConsecutiveKnown = parsed.data.requireConsecutiveKnown;

  const settings = await prisma.studySettings.upsert({
    where: { userId },
    update: payload,
    create: { userId, ...payload },
  });

  return NextResponse.json(settings);
}
