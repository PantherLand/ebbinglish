import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/prisma";

const bodySchema = z.object({
  word: z.string().trim().min(1, "word is required").max(100, "word is too long"),
  meaning: z.string().trim().min(1, "meaning is required").max(500, "meaning is too long"),
  language: z.string().trim().toLowerCase().min(2).max(10).default("en"),
});

function extractBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function POST(req: NextRequest) {
  const raw = extractBearerToken(req);
  if (!raw) {
    return NextResponse.json({ ok: false, error: "Missing Authorization header" }, { status: 401 });
  }

  const tokenHash = hashToken(raw);
  const apiToken = await prisma.apiToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true },
  });

  if (!apiToken) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }

  const { word, meaning, language } = parsed.data;

  let wordId: string;
  let created: boolean;

  try {
    const existing = await prisma.word.findUnique({
      where: { userId_language_text: { userId: apiToken.userId, language, text: word } },
      select: { id: true },
    });

    if (existing) {
      wordId = existing.id;
      created = false;
    } else {
      const newWord = await prisma.word.create({
        data: {
          userId: apiToken.userId,
          text: word,
          language,
          note: meaning,
          reviewState: {
            create: { userId: apiToken.userId },
          },
        },
        select: { id: true },
      });
      wordId = newWord.id;
      created = true;
    }

    // Update lastUsedAt without blocking the response
    prisma.apiToken
      .update({
        where: { id: apiToken.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    return NextResponse.json({ ok: true, wordId, created });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to add word" }, { status: 500 });
  }
}
