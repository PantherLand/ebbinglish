import { NextRequest, NextResponse } from "next/server";
import { isDictApiConfigured, suggestHeadwords } from "@/src/dict-back-api";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") || 8);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 8;

  if (!q) {
    return NextResponse.json({ items: [] });
  }

  if (!isDictApiConfigured()) {
    return NextResponse.json({ items: [], disabled: true });
  }

  try {
    const items = await suggestHeadwords(q, limit);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      {
        items: [],
        error:
          error instanceof Error ? error.message : "Failed to fetch suggestions",
      },
      { status: 502 },
    );
  }
}
