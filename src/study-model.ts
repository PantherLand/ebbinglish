import type { Prisma, ReviewState } from "@prisma/client";
import { prisma } from "@/src/prisma";
import { hasStudyPrismaModels, STUDY_PRISMA_HINT } from "@/src/study-runtime";

export type WordMasteryStatus = "new" | "seen" | "fuzzy" | "unknown" | "mastered" | "frozen";
export type SessionOutcome = "known" | "fuzzy" | "unknown";

export type SessionResultRecord = {
  wordId: string;
  outcome: SessionOutcome;
  timestamp: string;
};

export function deriveWordStatus(
  state: Pick<ReviewState, "seenCount" | "isMastered" | "freezeRounds"> | null,
  latestGrade: number | null,
): WordMasteryStatus {
  if (!state || state.seenCount <= 0) {
    return "new";
  }
  if (state.freezeRounds > 0) {
    return "frozen";
  }
  if (state.isMastered) {
    return "mastered";
  }
  if (latestGrade === 0) {
    return "unknown";
  }
  if (latestGrade === 1) {
    return "fuzzy";
  }
  return "seen";
}

export function parseSessionResults(value: Prisma.JsonValue | null | undefined): SessionResultRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const out: SessionResultRecord[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const raw = item as Record<string, unknown>;
    const wordId = typeof raw.wordId === "string" ? raw.wordId : "";
    const outcome = raw.outcome;
    const timestamp = typeof raw.timestamp === "string" ? raw.timestamp : new Date().toISOString();
    if (
      !wordId ||
      (outcome !== "known" && outcome !== "fuzzy" && outcome !== "unknown")
    ) {
      continue;
    }
    out.push({
      wordId,
      outcome,
      timestamp,
    });
  }

  return out;
}

export async function ensureStudySettings(userId: string) {
  if (!hasStudyPrismaModels()) {
    throw new Error(STUDY_PRISMA_HINT);
  }
  const existing = await prisma.studySettings.findUnique({
    where: { userId },
  });
  if (existing) {
    return existing;
  }
  return prisma.studySettings.create({
    data: {
      userId,
    },
  });
}

export async function ensureStudySettingsTx(tx: Prisma.TransactionClient, userId: string) {
  const raw = tx as unknown as Record<string, unknown>;
  if (!("studySettings" in raw) || typeof raw.studySettings !== "object" || raw.studySettings === null) {
    throw new Error(STUDY_PRISMA_HINT);
  }
  const existing = await tx.studySettings.findUnique({
    where: { userId },
  });
  if (existing) {
    return existing;
  }
  return tx.studySettings.create({
    data: {
      userId,
    },
  });
}
