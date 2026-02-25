import { prisma } from "@/src/prisma";

export const STUDY_PRISMA_HINT =
  "Study models are unavailable in Prisma Client. Run `npm run prisma:generate` and restart Next.js.";

export function hasStudyPrismaModels(): boolean {
  const raw = prisma as unknown as Record<string, unknown>;
  return (
    typeof raw.studyRound === "object" &&
    raw.studyRound !== null &&
    typeof raw.studySession === "object" &&
    raw.studySession !== null &&
    typeof raw.studySettings === "object" &&
    raw.studySettings !== null
  );
}
