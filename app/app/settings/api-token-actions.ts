"use server";

import { createHash, randomBytes } from "crypto";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type GenerateTokenResult =
  | { ok: true; token: string; createdAt: string }
  | { ok: false; error: string };

export type TokenStatusResult =
  | { exists: true; createdAt: string; lastUsedAt: string | null }
  | { exists: false };

export async function getApiTokenStatusAction(): Promise<TokenStatusResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { exists: false };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return { exists: false };

  const token = await prisma.apiToken.findFirst({
    where: { userId: user.id },
    select: { createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (!token) return { exists: false };

  return {
    exists: true,
    createdAt: token.createdAt.toISOString(),
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
  };
}

export async function generateApiTokenAction(): Promise<GenerateTokenResult> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, error: "Not authenticated" };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return { ok: false, error: "User not found" };

  const rawToken = "ebl_" + randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  // Revoke any existing tokens, then create new one
  await prisma.$transaction([
    prisma.apiToken.deleteMany({ where: { userId: user.id } }),
    prisma.apiToken.create({
      data: { userId: user.id, tokenHash },
    }),
  ]);

  const created = await prisma.apiToken.findFirst({
    where: { userId: user.id },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    ok: true,
    token: rawToken,
    createdAt: created?.createdAt.toISOString() ?? new Date().toISOString(),
  };
}

export async function revokeApiTokenAction(): Promise<{ ok: boolean }> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return { ok: false };

  await prisma.apiToken.deleteMany({ where: { userId: user.id } });
  return { ok: true };
}
