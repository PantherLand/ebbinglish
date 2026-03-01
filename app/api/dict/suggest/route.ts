import { NextResponse } from "next/server";

// Autocomplete suggestions are no longer provided — meanings are fetched via AI.
// Return an empty list so the form falls through to the direct Enter-to-lookup flow.
export function GET() {
  return NextResponse.json({ items: [] });
}
