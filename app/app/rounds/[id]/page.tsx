import Link from "next/link";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import { buildWordStatusMap } from "@/src/study-queries";
import {
  deleteRoundAndRedirectAction,
  startSessionAndRedirectAction,
} from "@/app/app/study-actions";
import { hasStudyPrismaModels, STUDY_PRISMA_HINT } from "@/src/study-runtime";
import WordEntryModalTrigger from "./word-entry-modal-trigger";
import WordStatusEditor from "./word-status-editor";

type RoundDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

function statusChipClass(status: string): string {
  if (status === "new") return "bg-blue-100 text-blue-700";
  if (status === "seen") return "bg-emerald-100 text-emerald-700";
  if (status === "fuzzy") return "bg-amber-100 text-amber-700";
  if (status === "unknown") return "bg-rose-100 text-rose-700";
  if (status === "frozen") return "bg-indigo-100 text-indigo-700";
  return "bg-slate-100 text-slate-700";
}

export default async function RoundDetailPage({ params, searchParams }: RoundDetailPageProps) {
  const { id } = await params;
  const { error } = await searchParams;

  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Round</h1>
        <p className="text-sm text-rose-700">Please sign in to continue.</p>
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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Round</h1>
        <p className="text-sm text-rose-700">User not found.</p>
      </div>
    );
  }

  if (!hasStudyPrismaModels()) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Round detail</h1>
        <p className="text-sm text-rose-700">{STUDY_PRISMA_HINT}</p>
      </div>
    );
  }

  const round = await prisma.studyRound.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!round) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Round not found</h1>
        <Link className="text-sm text-indigo-600 hover:underline" href="/app/rounds">
          Back to rounds
        </Link>
      </div>
    );
  }

  const [roundWords, settings] = await Promise.all([
    prisma.word.findMany({
      where: {
        userId: user.id,
        id: { in: round.wordIds },
      },
      select: {
        id: true,
        text: true,
        note: true,
        isPriority: true,
      },
    }),
    prisma.studySettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    }),
  ]);

  const wordById = new Map(roundWords.map((word) => [word.id, word]));
  const orderedWords = round.wordIds.map((wordId) => wordById.get(wordId)).filter(Boolean) as typeof roundWords;

  const completedSet = new Set(round.completedWordIds);
  const firstTryKnownSet = new Set(round.firstTryKnownWordIds);
  const statusMap = await buildWordStatusMap(user.id, round.wordIds, { ignoreFrozen: true });

  const totalCount = round.wordIds.length;
  const masteredCount = completedSet.size;
  const progress = totalCount === 0 ? 0 : Math.round((masteredCount / totalCount) * 100);
  const remainingIds = round.wordIds.filter((wordId) => !completedSet.has(wordId));
  const fuzzyCount = remainingIds.filter((wordId) => statusMap.get(wordId) === "fuzzy").length;
  const unknownCount = remainingIds.filter((wordId) => statusMap.get(wordId) === "unknown").length;
  const encounterTargetCount = remainingIds.length;
  const roundWordIdSet = new Set(round.wordIds);
  const attemptedSet = new Set(
    round.attemptedWordIds.filter(
      (wordId) => roundWordIdSet.has(wordId) && !completedSet.has(wordId) && statusMap.get(wordId) !== "new",
    ),
  );
  const encounterRemainingCount = round.wordIds.filter(
    (wordId) => !completedSet.has(wordId) && !attemptedSet.has(wordId),
  ).length;
  const encounterCount = Math.max(encounterTargetCount - encounterRemainingCount, 0);
  const encounterDone = encounterRemainingCount <= 0;
  const totalExtraWords = round.wordIds.filter((wordId) => {
    if (!attemptedSet.has(wordId)) {
      return false;
    }
    if (completedSet.has(wordId)) {
      return false;
    }
    const status = statusMap.get(wordId);
    return status === "fuzzy" || status === "unknown";
  }).length;
  const normalCount = Math.min(settings.sessionSize, encounterRemainingCount);
  const extraCount = Math.min(settings.sessionSize, totalExtraWords);
  const totalNormalSessions = encounterTargetCount > 0 ? Math.ceil(encounterTargetCount / settings.sessionSize) : 1;
  const startedNormalSessions =
    encounterTargetCount > 0 ? Math.ceil(encounterCount / settings.sessionSize) : 0;
  const nextNormalSession = Math.min(startedNormalSessions + 1, totalNormalSessions);
  const normalSessionLabel =
    encounterDone
      ? `Session Finished (${totalNormalSessions}/${totalNormalSessions})`
      : `Start Session (${nextNormalSession}/${totalNormalSessions})`;
  const extraSessionLabel = `Extra Practice (${extraCount}/${totalExtraWords})`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link className="text-sm text-slate-500 transition hover:text-slate-700" href="/app/rounds">
              ← Back
            </Link>
            <div className="mt-2 flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{round.name}</h1>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${
                  round.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : round.status === "completed"
                      ? "bg-slate-100 text-slate-700"
                      : "bg-amber-100 text-amber-700"
                }`}
              >
                {round.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Created on{" "}
              {round.createdAt.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <form action={deleteRoundAndRedirectAction}>
            <input name="roundId" type="hidden" value={round.id} />
            <button
              className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
              type="submit"
            >
              Delete
            </button>
          </form>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-indigo-600">{progress}% Mastered</span>
            <span className="text-slate-500">
              {masteredCount} / {totalCount} words
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-600" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Words per session from Settings: <span className="font-semibold text-slate-700">{settings.sessionSize}</span>
          </p>
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <form action={startSessionAndRedirectAction}>
            <input name="roundId" type="hidden" value={round.id} />
            <input name="type" type="hidden" value="normal" />
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={encounterDone || normalCount <= 0}
              type="submit"
            >
              {normalSessionLabel}
            </button>
          </form>

          <form action={startSessionAndRedirectAction}>
            <input name="roundId" type="hidden" value={round.id} />
            <input name="type" type="hidden" value="extra" />
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-300 bg-white px-4 py-3 text-base font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={extraCount <= 0}
              type="submit"
            >
              {extraSessionLabel}
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs uppercase tracking-wide text-emerald-700">Mastered</div>
          <div className="mt-1 text-3xl font-bold text-emerald-800">{masteredCount}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs uppercase tracking-wide text-amber-700">Fuzzy / Learning</div>
          <div className="mt-1 text-3xl font-bold text-amber-800">{fuzzyCount}</div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-xs uppercase tracking-wide text-rose-700">Unknown</div>
          <div className="mt-1 text-3xl font-bold text-rose-800">{unknownCount}</div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Words in this Round</h2>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {orderedWords.length} total
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {orderedWords.map((word) => {
            const isCompleted = completedSet.has(word.id);
            const status = statusMap.get(word.id) ?? "new";
            const activeEditableStatus = isCompleted
              ? firstTryKnownSet.has(word.id)
                ? "first_try_mastered"
                : "mastered"
              : status === "fuzzy" || status === "unknown"
                ? status
                : null;
            return (
              <article
                className="group flex items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-slate-50"
                key={word.id}
              >
                <div className="flex items-center gap-2">
                  <WordEntryModalTrigger
                    isPriority={word.isPriority}
                    manualNote={word.note}
                    wordText={word.text}
                  />
                  {word.isPriority ? (
                    <span aria-hidden="true" className="text-base font-bold text-amber-500">
                      ★
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {isCompleted ? (
                    firstTryKnownSet.has(word.id) ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                        First-Try Mastered
                      </span>
                    ) : (
                      <span className="rounded-full bg-teal-100 px-2 py-1 text-xs font-medium text-teal-700">
                        Mastered After Retry
                      </span>
                    )
                  ) : (
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusChipClass(status)}`}>
                      {status}
                    </span>
                  )}
                  <WordStatusEditor
                    activeStatus={activeEditableStatus}
                    roundId={round.id}
                    wordId={word.id}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
