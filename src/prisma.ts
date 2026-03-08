import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { PrismaClient as PrismaClientType } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined;
};

type PrismaModule = typeof import("@prisma/client");
type PrismaClientWithRuntimeShape = PrismaClientType & {
  _runtimeDataModel?: {
    models?: Record<string, { fields?: Array<{ name: string }> }>;
  };
};

const requireFromProject = createRequire(path.join(process.cwd(), "src/prisma.ts"));
const expectedDelegates = ["studySettings", "studyRound", "studySession", "apiToken"] as const;
const expectedWordFields = ["isAchieved"] as const;

function hasExpectedDelegates(client: PrismaClientType): boolean {
  const raw = client as unknown as Record<string, unknown>;
  return expectedDelegates.every((delegate) => typeof raw[delegate] === "object" && raw[delegate] !== null);
}

function hasExpectedWordFields(client: PrismaClientType): boolean {
  const runtimeModel = (client as PrismaClientWithRuntimeShape)._runtimeDataModel?.models?.Word;
  if (!runtimeModel?.fields) {
    return false;
  }

  const fieldNames = new Set(runtimeModel.fields.map((field) => field.name));
  return expectedWordFields.every((field) => fieldNames.has(field));
}

function hasExpectedClientShape(client: PrismaClientType): boolean {
  return hasExpectedDelegates(client) && hasExpectedWordFields(client);
}

function clearPrismaModuleCache() {
  const candidatePaths = [
    requireFromProject.resolve("@prisma/client"),
    path.join(process.cwd(), "node_modules", "@prisma", "client", "default.js"),
    path.join(process.cwd(), "node_modules", "@prisma", "client", "index.js"),
    path.join(process.cwd(), "node_modules", ".prisma", "client", "default.js"),
    path.join(process.cwd(), "node_modules", ".prisma", "client", "index.js"),
    path.join(process.cwd(), "node_modules", ".prisma", "client", "client.js"),
  ];

  for (const modulePath of candidatePaths) {
    if (existsSync(modulePath)) {
      delete requireFromProject.cache[modulePath];
    }
  }
}

function loadPrismaModule(): PrismaModule {
  if (process.env.NODE_ENV !== "production") {
    clearPrismaModuleCache();
  }
  return requireFromProject("@prisma/client") as PrismaModule;
}

function createPrismaClient(): PrismaClientType {
  const { PrismaClient } = loadPrismaModule();
  return new PrismaClient();
}

const cached = globalForPrisma.prisma;

// In dev HMR, global prisma can be an old instance created before schema/client updates.
// Recreate automatically when model delegates or fields are missing.
const prisma =
  cached && hasExpectedClientShape(cached) ? cached : createPrismaClient();

if (cached && cached !== prisma) {
  void cached.$disconnect().catch(() => {
    // Ignore disconnect issues from stale cached clients.
  });
}

if (!hasExpectedClientShape(prisma)) {
  throw new Error(
    "Prisma Client is out of sync with prisma/schema.prisma. Run `npm run prisma:generate` and restart the Next.js dev server.",
  );
}

export { prisma };

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
