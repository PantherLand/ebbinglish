import type { Prisma } from "@prisma/client";
import { prisma } from "@/src/prisma";
import { deriveWordStatus, type WordMasteryStatus } from "@/src/study-model";

type WordStatusShape = {
  id: string;
  text: string;
  note: string | null;
  isPriority: boolean;
  manualCategory: string | null;
  createdAt: Date;
  status: WordMasteryStatus;
};

type LibraryStatusFilter = WordMasteryStatus | "all" | "priority" | "normal";

type LoadLibraryWordPageOptions = {
  userId: string;
  keyword: string;
  selectedTag: string;
  selectedStatus: LibraryStatusFilter;
  currentPage: number;
  pageSize: number;
};

type LoadLibraryWordPageResult = {
  pageWords: WordStatusShape[];
  filteredCount: number;
  totalPages: number;
  safePage: number;
};

function normalizeFrozenStatus(
  status: WordMasteryStatus,
  latestGrade: number | null,
  ignoreFrozen: boolean,
): WordMasteryStatus {
  if (!ignoreFrozen || status !== "frozen") {
    return status;
  }
  if (latestGrade === 0) {
    return "unknown";
  }
  if (latestGrade === 1) {
    return "fuzzy";
  }
  return "seen";
}

export async function buildWordStatusMap(
  userId: string,
  wordIds: string[],
  options?: { ignoreFrozen?: boolean },
) {
  const uniqueWordIds = [...new Set(wordIds)];
  if (uniqueWordIds.length === 0) {
    return new Map<string, WordMasteryStatus>();
  }

  const ignoreFrozen = Boolean(options?.ignoreFrozen);
  // Only fetch ReviewLogs when ignoreFrozen is set (used to resolve the display
  // status of frozen words). Skip the query entirely for the common path
  // (e.g. library page) to avoid a potentially large full-table scan.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [reviewStates, reviewLogs] = await Promise.all([
    prisma.reviewState.findMany({
      where: { userId, wordId: { in: uniqueWordIds } },
      select: { wordId: true, seenCount: true, isMastered: true, freezeRounds: true },
    }),
    ignoreFrozen
      ? prisma.reviewLog.findMany({
          where: {
            userId,
            wordId: { in: uniqueWordIds },
            reviewedAt: { gte: ninetyDaysAgo },
          },
          select: { wordId: true, grade: true, reviewedAt: true },
          orderBy: { reviewedAt: "desc" },
        })
      : Promise.resolve([] as { wordId: string; grade: number; reviewedAt: Date }[]),
  ]);

  const stateByWordId = new Map(reviewStates.map((item) => [item.wordId, item]));
  const latestGradeByWordId = new Map<string, number>();
  for (const log of reviewLogs) {
    if (!latestGradeByWordId.has(log.wordId)) {
      latestGradeByWordId.set(log.wordId, log.grade);
    }
  }

  const out = new Map<string, WordMasteryStatus>();
  for (const wordId of uniqueWordIds) {
    const latestGrade = latestGradeByWordId.get(wordId) ?? null;
    out.set(
      wordId,
      normalizeFrozenStatus(
        deriveWordStatus(stateByWordId.get(wordId) ?? null, latestGrade),
        latestGrade,
        ignoreFrozen,
      ),
    );
  }
  return out;
}

export async function loadWordsWithStatus(userId: string): Promise<WordStatusShape[]> {
  const words = await prisma.word.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      text: true,
      note: true,
      isPriority: true,
      manualCategory: true,
      createdAt: true,
    },
  });

  const statusMap = await buildWordStatusMap(
    userId,
    words.map((word) => word.id),
  );

  return words.map((word) => ({
    ...word,
    status: statusMap.get(word.id) ?? "new",
  }));
}

function buildLibraryBaseWhere(
  userId: string,
  keyword: string,
  selectedTag: string,
  selectedStatus: LibraryStatusFilter,
): Prisma.WordWhereInput {
  const trimmedKeyword = keyword.trim();
  const where: Prisma.WordWhereInput = {
    userId,
  };

  if (trimmedKeyword) {
    where.OR = [
      { text: { contains: trimmedKeyword, mode: "insensitive" } },
      { note: { contains: trimmedKeyword, mode: "insensitive" } },
    ];
  }

  if (selectedTag) {
    where.manualCategory = selectedTag;
  }

  if (selectedStatus === "priority") {
    where.isPriority = true;
  } else if (selectedStatus === "normal") {
    where.isPriority = false;
  }

  return where;
}

function buildDerivedStatusCandidateWhere(
  baseWhere: Prisma.WordWhereInput,
  selectedStatus: WordMasteryStatus,
): Prisma.WordWhereInput {
  const andFilters: Prisma.WordWhereInput[] = [baseWhere];

  if (selectedStatus === "new") {
    andFilters.push({
      OR: [
        { reviewState: { is: null } },
        { reviewState: { is: { seenCount: { lte: 0 } } } },
      ],
    });
  } else if (selectedStatus === "frozen") {
    andFilters.push({
      reviewState: {
        is: {
          seenCount: { gt: 0 },
          freezeRounds: { gt: 0 },
        },
      },
    });
  } else if (selectedStatus === "mastered") {
    andFilters.push({
      reviewState: {
        is: {
          seenCount: { gt: 0 },
          freezeRounds: 0,
          isMastered: true,
        },
      },
    });
  } else {
    andFilters.push({
      reviewState: {
        is: {
          seenCount: { gt: 0 },
          freezeRounds: 0,
          isMastered: false,
        },
      },
    });
  }

  return { AND: andFilters };
}

export async function loadLibraryWordPage({
  userId,
  keyword,
  selectedTag,
  selectedStatus,
  currentPage,
  pageSize,
}: LoadLibraryWordPageOptions): Promise<LoadLibraryWordPageResult> {
  const baseWhere = buildLibraryBaseWhere(userId, keyword, selectedTag, selectedStatus);
  const select = {
    id: true,
    text: true,
    note: true,
    isPriority: true,
    manualCategory: true,
    createdAt: true,
  } satisfies Prisma.WordSelect;

  if (selectedStatus === "all" || selectedStatus === "priority" || selectedStatus === "normal") {
    const filteredCount = await prisma.word.count({ where: baseWhere });
    const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pageStart = (safePage - 1) * pageSize;
    const words = await prisma.word.findMany({
      where: baseWhere,
      orderBy: { updatedAt: "desc" },
      skip: pageStart,
      take: pageSize,
      select,
    });

    const statusMap = await buildWordStatusMap(
      userId,
      words.map((word) => word.id),
    );

    return {
      pageWords: words.map((word) => ({
        ...word,
        status: statusMap.get(word.id) ?? "new",
      })),
      filteredCount,
      totalPages,
      safePage,
    };
  }

  const candidateWords = await prisma.word.findMany({
    where: buildDerivedStatusCandidateWhere(baseWhere, selectedStatus),
    orderBy: { updatedAt: "desc" },
    select,
  });

  const statusMap = await buildWordStatusMap(
    userId,
    candidateWords.map((word) => word.id),
  );
  const filteredWords = candidateWords
    .map((word) => ({
      ...word,
      status: statusMap.get(word.id) ?? "new",
    }))
    .filter((word) => word.status === selectedStatus);

  const filteredCount = filteredWords.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;

  return {
    pageWords: filteredWords.slice(pageStart, pageStart + pageSize),
    filteredCount,
    totalPages,
    safePage,
  };
}
