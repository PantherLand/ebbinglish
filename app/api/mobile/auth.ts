import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/src/prisma";

/**
 * Shared helper: extract Bearer token, hash it, look up the user.
 * Returns the userId on success, or a 401 NextResponse on failure.
 */
export async function authenticateMobileRequest(
  req: NextRequest,
): Promise<string | NextResponse> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return NextResponse.json(
      { ok: false, error: "Missing Authorization header" },
      { status: 401 },
    );
  }

  const raw = auth.slice(7).trim();
  if (!raw) {
    return NextResponse.json(
      { ok: false, error: "Empty token" },
      { status: 401 },
    );
  }

  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const apiToken = await prisma.apiToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true },
  });

  if (!apiToken) {
    return NextResponse.json(
      { ok: false, error: "Invalid token" },
      { status: 401 },
    );
  }

  // Update lastUsedAt in the background
  prisma.apiToken
    .update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return apiToken.userId;
}
