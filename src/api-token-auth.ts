import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/src/prisma";

export type ApiTokenAuth = {
  tokenId: string;
  userId: string;
};

export function extractBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function authenticateApiToken(req: NextRequest): Promise<ApiTokenAuth | null> {
  const raw = extractBearerToken(req);
  if (!raw) {
    return null;
  }

  const apiToken = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    select: { id: true, userId: true },
  });

  if (!apiToken) {
    return null;
  }

  return {
    tokenId: apiToken.id,
    userId: apiToken.userId,
  };
}

export function touchApiTokenLastUsed(tokenId: string) {
  return prisma.apiToken.update({
    where: { id: tokenId },
    data: { lastUsedAt: new Date() },
  });
}
