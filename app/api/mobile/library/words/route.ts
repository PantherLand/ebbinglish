import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/prisma";
import { authenticateMobileRequest } from "../../auth";

const createWordSchema = z.object({
  text: z.string().trim().min(1).max(100),
  language: z.string().trim().toLowerCase().min(2).max(10).default("en"),
  note: z.string().trim().max(500).optional(),
  entryJson: z.unknown().optional(),
});

export async function POST(req: NextRequest) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createWordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const { text, language, note, entryJson } = parsed.data;

  try {
    const word = await prisma.word.create({
      data: {
        userId,
        text,
        language,
        note: note || null,
        entryJson: entryJson ?? undefined,
        reviewState: { create: { userId } },
      },
    });

    return NextResponse.json({ ok: true, word });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "This word already exists in your library" },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, error: "Failed to add word" }, { status: 500 });
  }
}
