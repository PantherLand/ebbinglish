import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function hasStudyDelegates(client: PrismaClient): boolean {
  const raw = client as unknown as Record<string, unknown>;
  return (
    typeof raw.studySettings === "object" &&
    raw.studySettings !== null &&
    typeof raw.studyRound === "object" &&
    raw.studyRound !== null &&
    typeof raw.studySession === "object" &&
    raw.studySession !== null &&
    typeof raw.apiToken === "object" &&
    raw.apiToken !== null
  );
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

const cached = globalForPrisma.prisma;

// In dev HMR, global prisma can be an old instance created before schema/client updates.
// Recreate automatically when round/session delegates are missing.
const prisma =
  cached && hasStudyDelegates(cached) ? cached : createPrismaClient();

if (cached && cached !== prisma) {
  void cached.$disconnect().catch(() => {
    // Ignore disconnect issues from stale cached clients.
  });
}

export { prisma };

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
