import Link from "next/link";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import ReviewSession from "../review-session";

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

type SessionPageProps = {
  searchParams: Promise<{
    source?: string;
    count?: string;
    round?: string;
    list?: string;
  }>;
};

export default async function SessionPage({ searchParams }: SessionPageProps) {
  const { source, count, round, list } = await searchParams;
  const selectedSource = parseSource(source, list);
  const selectedCount = parseCount(count);
  const selectedRound = parseRound(round);
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Session</h1>
        <p className="text-sm text-red-700">Please sign in to start reviewing.</p>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Session</h1>
        <p className="text-sm text-red-700">User not found.</p>
      </div>
    );
  }

  const now = new Date();
  const [dueStates, newWords] = await Promise.all([
    prisma.reviewState.findMany({
      where: {
        userId: user.id,
        dueAt: { lte: now },
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
  ]);

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

  const cards = selectedCards.map((card) => ({
    id: card.id,
    text: card.text,
    language: card.language,
    meaning: card.meaning,
    stage: card.stage,
    seenCount: card.seenCount,
    isPriority: card.isPriority,
  }));

  const params = new URLSearchParams();
  params.set("source", selectedSource);
  params.set("count", String(selectedCount));
  if (currentRound !== 0) {
    params.set("round", String(currentRound));
  }
  const backHref = `/app/today?${params.toString()}`;
  const progressStorageKey = `ebbinglish:today-session:${user.id}:${selectedSource}:${selectedCount}:${currentRound}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Study session</div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Round {currentRound + 1} / {totalRounds}
          </h1>
        </div>
        <Link
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href={backHref}
        >
          Exit session
        </Link>
      </div>

      <ReviewSession
        backHref={backHref}
        cards={cards}
        roundLabel={`Round ${currentRound + 1} / ${totalRounds}`}
        persistProgress
        progressStorageKey={progressStorageKey}
        startImmediately
      />
    </div>
  );
}
