import { NextRequest, NextResponse } from "next/server";
import { isDictApiConfigured, lookupEntryDetail } from "@/src/dict-back-api";

export async function GET(request: NextRequest) {
  const headword = request.nextUrl.searchParams.get("headword")?.trim() || "";

  if (!headword) {
    return NextResponse.json(
      { error: "headword is required" },
      { status: 400 },
    );
  }

  if (!isDictApiConfigured()) {
    return NextResponse.json({ headword, meaning: null, disabled: true });
  }

  try {
    const result = await lookupEntryDetail(headword);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch meaning",
      },
      { status: 502 },
    );
  }
}
