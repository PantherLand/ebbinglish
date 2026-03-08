import { NextRequest, NextResponse } from "next/server";
import { isAiDictConfigured, lookupWordByAI } from "@/src/ai-dict";
import { lookupWordByGoogle } from "@/src/google-dict";
import { buildTrancyCompatibleAudioUrls } from "@/src/pronunciation-sources";

export async function GET(request: NextRequest) {
  const headword = request.nextUrl.searchParams.get("headword")?.trim() || "";

  if (!headword) {
    return NextResponse.json({ error: "headword is required" }, { status: 400 });
  }

  try {
    const googleResult = await lookupWordByGoogle(headword);
    if (googleResult) {
      return NextResponse.json({
        ...googleResult.entry,
        audioUrls: buildTrancyCompatibleAudioUrls(
          googleResult.entry.headword || headword,
          googleResult.entry.audioUrls,
        ),
        source: googleResult.source,
      });
    }
  } catch {
    // fallback to AI
  }

  if (!isAiDictConfigured()) {
    return NextResponse.json(
      {
        headword,
        meaning: null,
        pronunciations: [],
        audioUrls: buildTrancyCompatibleAudioUrls(headword),
        disabled: true,
        source: "none",
      },
    );
  }

  try {
    const result = await lookupWordByAI(headword);
    return NextResponse.json({
      ...result,
      audioUrls: buildTrancyCompatibleAudioUrls(result.headword || headword, result.audioUrls),
      source: "ai",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch meaning",
        headword,
        pronunciations: [],
        audioUrls: buildTrancyCompatibleAudioUrls(headword),
      },
      { status: 502 },
    );
  }
}
