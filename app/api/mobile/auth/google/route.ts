import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  issueMobileAuthSession,
  revokeMobileApiToken,
  verifyGoogleMobileIdToken,
} from "@/src/mobile-auth";

const requestSchema = z.object({
  idToken: z.string().trim().min(1, "idToken is required"),
});

function extractBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 422 });
  }

  try {
    const payload = await verifyGoogleMobileIdToken(parsed.data.idToken);
    const session = await issueMobileAuthSession(payload, parsed.data.idToken);
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to authenticate with Google",
      },
      { status: 401 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const token = extractBearerToken(req);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing Authorization header" }, { status: 401 });
  }

  try {
    const revoked = await revokeMobileApiToken(token);
    if (!revoked) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to revoke token" }, { status: 500 });
  }
}
