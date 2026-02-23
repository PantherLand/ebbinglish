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
import { STAGE_INTERVAL_DAYS } from "@/src/review-scheduler";
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

function formatRelativeDue(dueAt: Date, now: Date): string {
  const diffMs = dueAt.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const absMinutes = Math.floor(absMs / (60 * 1000));
  const absHours = Math.floor(absMs / (60 * 60 * 1000));
  const absDays = Math.floor(absMs / (24 * 60 * 60 * 1000));

  if (absMinutes < 60) {
    return diffMs >= 0 ? `in ${absMinutes}m` : `${absMinutes}m overdue`;
  }
  if (absHours < 24) {
    return diffMs >= 0 ? `in ${absHours}h` : `${absHours}h overdue`;
  }
  return diffMs >= 0 ? `in ${absDays}d` : `${absDays}d overdue`;
}

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
    select: { id: true },
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
      reviewState: true,
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
    stage: word.reviewState?.stage ?? 0,
    dueAt: word.reviewState?.dueAt ?? null,
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
  const maxStage = STAGE_INTERVAL_DAYS.length - 1;
  const currentStageRaw = word.reviewState?.stage ?? 0;
  const currentStage = Math.max(0, Math.min(currentStageRaw, maxStage));
  const nextStage = Math.min(currentStage + 1, maxStage);
  const stageProgress = Math.round((currentStage / maxStage) * 100);
  const currentIntervalDays = STAGE_INTERVAL_DAYS[currentStage];
  const nextIntervalDays = STAGE_INTERVAL_DAYS[nextStage];
  const dueAt = word.reviewState?.dueAt ?? null;
  const dueRelative = dueAt ? formatRelativeDue(dueAt, now) : "Not scheduled";
  const lastReviewedAt = word.reviewLog[0]?.reviewedAt ?? word.createdAt;
  const daysSinceReview = Math.max(0, (now.getTime() - lastReviewedAt.getTime()) / MS_PER_DAY);
  const lapseCount = word.reviewState?.lapseCount ?? 0;

  const manualNote = word.note?.trim() || null;
  let hasDictMeaning = false;
  let dictPrimaryMeaning: string | null = null;

  let dictionaryEntry: DictionaryEntryData = {
    headword: word.text,
    meaning: manualNote,
    pos: null,
    pronunciations: [],
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
          <WordHeatmap weeks={heatmapWeeks} />

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

          <ReviewLogList logs={word.reviewLog} />
        </div>

        <div className="space-y-4">
          <StudyConfigForm
            isPriority={word.isPriority}
            manualCategory={word.manualCategory}
            wordId={word.id}
          />
          <EbbinghausProgress
            currentStage={currentStage}
            maxStage={maxStage}
            stageProgress={stageProgress}
            currentIntervalDays={currentIntervalDays}
            nextIntervalDays={nextIntervalDays}
            dueAt={dueAt}
            dueRelative={dueRelative}
            stageIntervalDays={STAGE_INTERVAL_DAYS}
          />
          <RetentionCurveChart
            daysSinceReview={daysSinceReview}
            currentIntervalDays={currentIntervalDays}
            nextIntervalDays={nextIntervalDays}
            successRate={successRate}
            lapseCount={lapseCount}
            dueAt={dueAt}
            lastReviewedAt={lastReviewedAt}
          />
          <MemoryRatingCard
            level={rating.level}
            score={rating.score}
            summary={rating.summary}
            totalReviews={totalReviews}
            successRate={successRate}
            revealTimes={revealTimes}
            seenCount={word.reviewState?.seenCount ?? 0}
            currentStage={currentStage}
          />
        </div>
      </div>
    </div>
  );
}
