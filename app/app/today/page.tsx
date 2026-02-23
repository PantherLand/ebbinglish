import LearningDayHero from "@/app/components/learning-day-hero";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import { STAGE_INTERVAL_DAYS } from "@/src/review-scheduler";
import ReviewSetupModal from "./review-setup-modal";
import ReviewSession from "./review-session";

type DueCard = {
  id: string;
  text: string;
  language: string;
  meaning: string | null;
  stage: number;
  seenCount: number;
  isPriority: boolean;
  dueAt: Date;
};

type ReviewSource = "all" | "priority" | "new" | "review";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseSource(source?: string | null, legacyList?: string | null): ReviewSource {
  if (source === "all" || source === "priority" || source === "new" || source === "review") {
    return source;
  }
  if (legacyList === "priority") {
    return "priority";
  }
  return "all";
}

function parseRound(value?: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(Math.max(parsed, 0), 365);
}

function parseCount(value?: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return 20;
  }
  return Math.min(Math.max(parsed, 1), 100);
}

function startOfDay(input: Date): Date {
  const out = new Date(input);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * MS_PER_DAY);
}

function sortCards(cards: DueCard[]): DueCard[] {
  return [...cards].sort((a, b) => {
    if (a.isPriority !== b.isPriority) {
      return a.isPriority ? -1 : 1;
    }
    return a.dueAt.getTime() - b.dueAt.getTime();
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type TodayPageProps = {
  searchParams: Promise<{
    source?: string;
    count?: string;
    round?: string;
    list?: string;
  }>;
};

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const { source, count, round, list } = await searchParams;
  const selectedSource = parseSource(source, list);
  const selectedCount = parseCount(count);
  const selectedRound = parseRound(round);
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-sm text-red-700">Please sign in to start reviewing.</p>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, createdAt: true },
  });

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-sm text-red-700">User not found.</p>
      </div>
    );
  }

  const actualNow = new Date();
  const selectedDayStart = startOfDay(actualNow);
  const selectedDayEnd = addDays(selectedDayStart, 1);
  const start30 = addDays(selectedDayStart, -29);
  const queueNow = actualNow;
  const accountDayStart = startOfDay(user.createdAt);
  const studyDayNumber = Math.max(
    1,
    Math.floor((selectedDayStart.getTime() - accountDayStart.getTime()) / MS_PER_DAY) + 1,
  );

  const [
    dueStates,
    newWords,
    reviewedToday,
    reviewedWordIdsToday,
    masteredWordIds,
    newWordsTodayCount,
    reviewStatesForScore,
    logs30,
  ] =
    await Promise.all([
      prisma.reviewState.findMany({
        where: {
          userId: user.id,
          dueAt: { lte: queueNow },
        },
        include: {
          word: {
            select: {
              id: true,
              text: true,
              language: true,
              note: true,
              isPriority: true,
            },
          },
        },
        orderBy: { dueAt: "asc" },
        take: 120,
      }),
      prisma.word.findMany({
        where: {
          userId: user.id,
          reviewState: { is: null },
        },
        select: {
          id: true,
          text: true,
          language: true,
          note: true,
          createdAt: true,
          isPriority: true,
        },
        orderBy: { createdAt: "asc" },
        take: 120,
      }),
      prisma.reviewLog.count({
        where: {
          userId: user.id,
          reviewedAt: {
            gte: selectedDayStart,
            lt: selectedDayEnd,
          },
        },
      }),
      prisma.reviewLog.findMany({
        where: {
          userId: user.id,
          reviewedAt: {
            gte: selectedDayStart,
            lt: selectedDayEnd,
          },
        },
        distinct: ["wordId"],
        select: { wordId: true },
      }),
      prisma.reviewLog.findMany({
        where: {
          userId: user.id,
          grade: 2,
        },
        distinct: ["wordId"],
        select: { wordId: true },
      }),
      prisma.word.count({
        where: {
          userId: user.id,
          createdAt: {
            gte: selectedDayStart,
            lt: selectedDayEnd,
          },
        },
      }),
      prisma.reviewState.findMany({
        where: { userId: user.id },
        select: { stage: true },
      }),
      prisma.reviewLog.findMany({
        where: {
          userId: user.id,
          reviewedAt: {
            gte: start30,
            lt: selectedDayEnd,
          },
        },
        select: { grade: true },
      }),
    ]);

  const todayReviewedWordCount = reviewedWordIdsToday.length;
  const totalMasteredWordCount = masteredWordIds.length;
  const activeReviewWords = reviewStatesForScore.length;
  const masteredByStage = reviewStatesForScore.filter((state) => state.stage >= 5).length;
  const masteryRate =
    activeReviewWords === 0 ? 0 : Math.round((masteredByStage / activeReviewWords) * 100);
  const total30 = logs30.length;
  const know30 = logs30.filter((log) => log.grade === 2).length;
  const fuzzy30 = logs30.filter((log) => log.grade === 1).length;
  const success30 =
    total30 === 0 ? 0 : Math.round(((know30 + fuzzy30 * 0.5) / total30) * 100);
  const stageWeighted =
    activeReviewWords === 0
      ? 0
      : reviewStatesForScore.reduce((sum, state) => sum + state.stage, 0) /
        (activeReviewWords * (STAGE_INTERVAL_DAYS.length - 1));
  const healthScore = Math.round(
    clamp(masteryRate * 0.45 + success30 * 0.35 + stageWeighted * 100 * 0.2, 0, 100),
  );

  const reviewCards = dueStates.map(
    (item): DueCard => ({
      id: item.word.id,
      text: item.word.text,
      language: item.word.language,
      meaning: item.word.note,
      stage: item.stage,
      seenCount: item.seenCount,
      isPriority: item.word.isPriority,
      dueAt: item.dueAt,
    }),
  );

  const newCards = newWords.map(
    (word): DueCard => ({
      id: word.id,
      text: word.text,
      language: word.language,
      meaning: word.note,
      stage: 0,
      seenCount: 0,
      isPriority: word.isPriority,
      dueAt: word.createdAt,
    }),
  );

  const allCards = sortCards([...reviewCards, ...newCards]);
  const priorityCards = sortCards(allCards.filter((card) => card.isPriority));
  const reviewOnlyCards = sortCards(reviewCards);
  const newOnlyCards = sortCards(newCards);

  const cardsBySource: Record<ReviewSource, DueCard[]> = {
    all: allCards,
    priority: priorityCards,
    new: newOnlyCards,
    review: reviewOnlyCards,
  };

  const sourcePool = cardsBySource[selectedSource];
  const sourceTotal = sourcePool.length;
  const totalRounds = sourceTotal === 0 ? 1 : Math.ceil(sourceTotal / selectedCount);
  const maxRoundIndex = Math.max(totalRounds - 1, 0);
  const currentRound = clamp(selectedRound, 0, maxRoundIndex);
  const roundStartIndex = currentRound * selectedCount;
  const selectedCards = sourcePool.slice(roundStartIndex, roundStartIndex + selectedCount);
  const hasNextRound = currentRound < maxRoundIndex;
  const cards = selectedCards.map((card) => ({
    id: card.id,
    text: card.text,
    language: card.language,
    meaning: card.meaning,
    stage: card.stage,
    seenCount: card.seenCount,
    isPriority: card.isPriority,
  }));
  const buildRoundHref = (roundIndex: number): string => {
    const safeRound = clamp(roundIndex, 0, maxRoundIndex);
    const params = new URLSearchParams();
    params.set("source", selectedSource);
    params.set("count", String(selectedCount));
    if (safeRound !== 0) {
      params.set("round", String(safeRound));
    }
    return `/app/today?${params.toString()}`;
  };
  const currentRoundHref = buildRoundHref(currentRound);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Today</h1>
      </div>

      <LearningDayHero
        dayNumber={studyDayNumber}
        healthScore={healthScore}
        masteryRate={masteryRate}
        startedAt={startOfDay(user.createdAt)}
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-3">
          <div className="text-sm text-gray-600">Rounds Today</div>
          <div className="text-xl font-semibold">{reviewedToday}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-sm text-gray-600">Reviewed Words Today</div>
          <div className="text-xl font-semibold">{todayReviewedWordCount}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-sm text-gray-600">New Words Today</div>
          <div className="text-xl font-semibold">{newWordsTodayCount}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-sm text-gray-600">Total Mastered</div>
          <div className="text-xl font-semibold">{totalMasteredWordCount}</div>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-4">
          <ReviewSetupModal
            selectedCards={selectedCards.length}
            selectedCount={selectedCount}
            selectedRound={currentRound}
            selectedSource={selectedSource}
            totalRounds={totalRounds}
            nextSessionHref={buildRoundHref(Math.min(currentRound + 1, maxRoundIndex))}
            hasNextRound={hasNextRound}
            sourceTotal={sourceTotal}
            totalBySource={{
              all: allCards.length,
              priority: priorityCards.length,
              new: newOnlyCards.length,
              review: reviewOnlyCards.length,
            }}
          />
        </section>

        <section className="space-y-2" id="study-session">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Study session</div>
          <h2 className="text-xl font-semibold text-slate-900">
            Round {currentRound + 1} / {totalRounds}
          </h2>
          <ReviewSession
            backHref={currentRoundHref}
            cards={cards}
            roundLabel={`Round ${currentRound + 1} / ${totalRounds}`}
          />
        </section>
      </div>
    </div>
  );
}
