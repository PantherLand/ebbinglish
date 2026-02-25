import Link from "next/link";
import { notFound } from "next/navigation";
import DictionaryEntryPanel, {
  type DictionaryEntryData,
} from "@/app/components/dictionary-entry-panel";
import { auth } from "@/src/auth";
import { lookupEntryDetail } from "@/src/dict-back-api";
import { buildHeatmap } from "@/src/memory-heatmap";
import { getMemoryRating } from "@/src/memory-rating";
import { prisma } from "@/src/prisma";
import StudyConfigForm from "./study-config-form";
import { EbbinghausProgress } from "./ebbinghaus-progress";
import { MemoryRatingCard } from "./memory-rating-card";
import { RetentionCurveChart } from "./retention-curve-chart";
import { ReviewLogList } from "./review-log-list";
import { WordHeatmap } from "./word-heatmap";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type WordDetailPageProps = {
  params: Promise<{ wordId: string }>;
};

export default async function WordDetailPage({ params }: WordDetailPageProps) {
  const { wordId } = await params;
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Word detail</h1>
        <p className="text-sm text-red-700">Please sign in first.</p>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, currentGlobalRound: true },
  });

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Word detail</h1>
        <p className="text-sm text-red-700">User not found.</p>
      </div>
    );
  }

  const word = await prisma.word.findFirst({
    where: { id: wordId, userId: user.id },
    include: {
      reviewState: {
        select: {
          id: true,
          userId: true,
          wordId: true,
          lastReviewedAt: true,
          lapseCount: true,
          seenCount: true,
          consecutivePerfect: true,
          freezeRounds: true,
          isMastered: true,
          masteryPhase: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      reviewLog: {
        orderBy: { reviewedAt: "desc" },
        take: 365,
      },
    },
  });

  if (!word) {
    notFound();
  }

  const rating = getMemoryRating({
    consecutivePerfect: word.reviewState?.consecutivePerfect ?? 0,
    freezeRounds: word.reviewState?.freezeRounds ?? 0,
    isMastered: word.reviewState?.isMastered ?? false,
    masteryPhase: word.reviewState?.masteryPhase ?? 0,
    lapseCount: word.reviewState?.lapseCount ?? 0,
    seenCount: word.reviewState?.seenCount ?? 0,
    logs: word.reviewLog.map((log) => ({ grade: log.grade, reviewedAt: log.reviewedAt })),
  });

  const heatmapWeeks = buildHeatmap(word.reviewLog.map((log) => log.reviewedAt), 168);

  const totalReviews = word.reviewLog.length;
  const revealTimes = word.reviewLog.filter((log) => log.revealedAnswer).length;
  const knowTimes = word.reviewLog.filter((log) => log.grade === 2).length;
  const successRate = totalReviews === 0 ? 0 : Math.round((knowTimes / totalReviews) * 100);

  const now = new Date();
  const lastReviewedAt = word.reviewLog[0]?.reviewedAt ?? word.createdAt;
  const daysSinceReview = Math.max(0, (now.getTime() - lastReviewedAt.getTime()) / MS_PER_DAY);
  const lapseCount = word.reviewState?.lapseCount ?? 0;
  const consecutivePerfect = word.reviewState?.consecutivePerfect ?? 0;
  const freezeRounds = word.reviewState?.freezeRounds ?? 0;
  const masteryPhase = word.reviewState?.masteryPhase ?? 0;
  const isMastered = word.reviewState?.isMastered ?? false;

  const manualNote = word.note?.trim() || null;
  let hasDictMeaning = false;
  let dictPrimaryMeaning: string | null = null;

  let dictionaryEntry: DictionaryEntryData = {
    headword: word.text,
    meaning: manualNote,
    pos: null,
    pronunciations: [],
    audioUrls: [],
    posBlocks: [],
    senses: [],
    idioms: [],
    fallbackText: manualNote,
  };

  try {
    const detail = await lookupEntryDetail(word.text);
    hasDictMeaning =
      Boolean(detail.meaning?.trim()) ||
      Boolean(detail.fallbackText?.trim()) ||
      detail.posBlocks.length > 0 ||
      detail.senses.length > 0 ||
      detail.idioms.length > 0;

    if (hasDictMeaning) {
      dictPrimaryMeaning = detail.meaning?.trim() || detail.fallbackText?.trim() || null;
      dictionaryEntry = {
        headword: detail.headword || word.text,
        meaning: detail.meaning,
        pos: detail.pos,
        pronunciations: detail.pronunciations,
        audioUrls: detail.audioUrls,
        posBlocks: detail.posBlocks,
        senses: detail.senses,
        idioms: detail.idioms,
        fallbackText: detail.fallbackText,
      };
    }
  } catch {
    // Keep detail page usable when dictionary service is unavailable.
  }

  const showManualMeaning =
    Boolean(manualNote) && (!dictPrimaryMeaning || dictPrimaryMeaning !== manualNote);
  const showManualOnlyMeaning = Boolean(manualNote) && !hasDictMeaning;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link className="text-sm text-gray-600 underline" href="/app/library">
          Back to Library
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold">{word.text}</h1>
          {word.isPriority ? (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Priority
            </span>
          ) : null}
          {word.manualCategory ? (
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {word.manualCategory}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">

          <section className="space-y-3 rounded-lg border p-4">
            <h2 className="text-base font-semibold">Meanings</h2>
            {showManualOnlyMeaning ? (
              <div className="rounded-lg border border-slate-300 bg-white p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Your meaning
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{manualNote}</p>
              </div>
            ) : (
              <>
                <DictionaryEntryPanel
                  emptyText="No meaning yet. You can pick meaning from dictionary in Library add flow."
                  entry={dictionaryEntry}
                  title="Dictionary entry"
                />
                {showManualMeaning && hasDictMeaning ? (
                  <div className="rounded-lg border border-slate-300 bg-white p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Your manual meaning
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{manualNote}</p>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <WordHeatmap weeks={heatmapWeeks} />

          <ReviewLogList logs={word.reviewLog} />
        </div>

        <div className="space-y-4">
          <StudyConfigForm
            isPriority={word.isPriority}
            manualCategory={word.manualCategory}
            wordId={word.id}
          />
          <EbbinghausProgress
            consecutivePerfect={consecutivePerfect}
            currentGlobalRound={user.currentGlobalRound}
            freezeRounds={freezeRounds}
            isMastered={isMastered}
            masteryPhase={masteryPhase}
          />
          <RetentionCurveChart
            consecutivePerfect={consecutivePerfect}
            daysSinceReview={daysSinceReview}
            freezeRounds={freezeRounds}
            isMastered={isMastered}
            lapseCount={lapseCount}
            masteryPhase={masteryPhase}
            successRate={successRate}
          />
          <MemoryRatingCard
            consecutivePerfect={consecutivePerfect}
            freezeRounds={freezeRounds}
            isMastered={isMastered}
            level={rating.level}
            masteryPhase={masteryPhase}
            revealTimes={revealTimes}
            score={rating.score}
            seenCount={word.reviewState?.seenCount ?? 0}
            summary={rating.summary}
            successRate={successRate}
            totalReviews={totalReviews}
          />
        </div>
      </div>
    </div>
  );
}
