import { NextRequest, NextResponse } from "next/server";
import { isAiDictConfigured, lookupWordByAI } from "@/src/ai-dict";

export async function GET(request: NextRequest) {
  const headword = request.nextUrl.searchParams.get("headword")?.trim() || "";

  if (!headword) {
    return NextResponse.json({ error: "headword is required" }, { status: 400 });
  }

  if (!isAiDictConfigured()) {
    return NextResponse.json({ headword, meaning: null, disabled: true });
  }

  try {
    const result = await lookupWordByAI(headword);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch meaning" },
      { status: 502 },
    );
  }
}
