import Link from "next/link";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import { hasStudyPrismaModels, STUDY_PRISMA_HINT } from "@/src/study-runtime";

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export default async function TodayPage() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Today</h1>
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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Today</h1>
        <p className="text-sm text-rose-700">User not found.</p>
      </div>
    );
  }

  if (!hasStudyPrismaModels()) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Today&apos;s Focus</h1>
        <p className="text-sm text-rose-700">{STUDY_PRISMA_HINT}</p>
      </div>
    );
  }

  const { start, end } = getTodayRange();

  const [rounds, reviewedTodayLogs] = await Promise.all([
    prisma.studyRound.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.reviewLog.findMany({
      where: {
        userId: user.id,
        reviewedAt: {
          gte: start,
          lt: end,
        },
      },
      select: {
        wordId: true,
      },
    }),
  ]);
  const uniqueWordsReviewedToday = new Set(reviewedTodayLogs.map((item) => item.wordId)).size;

  const activeRounds = rounds.filter((item) => item.status === "active");
  const completedRounds = rounds.filter((item) => item.status === "completed");
  const activeRound = activeRounds[0] ?? null;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Today&apos;s Focus</h1>
          <p className="mt-1 text-base text-slate-500">Ready to expand your vocabulary?</p>
        </div>
        <Link
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-base font-medium text-white shadow-sm transition hover:bg-indigo-700"
          href="/app/rounds/new"
        >
          <span className="text-base leading-none">+</span>
          New Round
        </Link>
      </header>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white shadow-lg">
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
              <svg
                aria-hidden="true"
                className="h-7 w-7 text-white"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="9" opacity="0.9" />
                <path d="m8.7 12.3 2.2 2.2 4.5-4.7" />
              </svg>
            </div>
            <div>
              <div className="text-sm text-indigo-100">Daily Progress</div>
              <h2 className="text-2xl font-bold tracking-tight">{uniqueWordsReviewedToday} Unique Words Reviewed</h2>
            </div>
          </div>

          {activeRound ? (
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base text-indigo-100">Continue your active round</div>
                  <div className="text-lg font-bold">{activeRound.name}</div>
                  <div className="text-xs text-indigo-100">
                    {activeRound.completedWordIds.length} / {activeRound.wordIds.length} mastered
                  </div>
                </div>
                <Link
                  className="inline-flex items-center gap-2.5 rounded-2xl bg-white px-6 py-2.5 font-bold tracking-tight text-indigo-600 shadow-sm transition hover:bg-indigo-50"
                  href={`/app/rounds/${activeRound.id}`}
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7-11-7z" />
                  </svg>
                  <span>Resume</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-center backdrop-blur">
              <p className="text-base text-indigo-100">No active rounds. Start a new one.</p>
              <Link
                className="mt-3 inline-flex rounded-lg bg-white px-4 py-2 text-base font-semibold text-indigo-600 transition hover:bg-indigo-50"
                href="/app/rounds/new"
              >
                Create Round
              </Link>
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-purple-400/30 blur-3xl" />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Your Rounds</h2>
          <Link className="text-base font-medium text-indigo-600 hover:underline" href="/app/rounds">
            View all
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeRounds.slice(0, 3).map((round) => {
            const progress =
              round.wordIds.length === 0
                ? 0
                : Math.round((round.completedWordIds.length / round.wordIds.length) * 100);
            return (
              <article
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                key={round.id}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="truncate pr-2 text-base font-semibold text-slate-900">{round.name}</h3>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                    Active
                  </span>
                </div>
                <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                </div>
                <div className="mb-4 flex justify-between text-xs text-slate-500">
                  <span>{round.completedWordIds.length} mastered</span>
                  <span>{round.wordIds.length} total</span>
                </div>
                <Link
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  href={`/app/rounds/${round.id}`}
                >
                  View details
                </Link>
              </article>
            );
          })}

          <Link
            className="flex min-h-[166px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white p-5 text-slate-400 transition hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600"
            href="/app/rounds/new"
          >
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl">
              +
            </div>
            <span className="font-medium">Create New Round</span>
          </Link>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Active rounds</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{activeRounds.length}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Completed rounds</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{completedRounds.length}</div>
        </div>
      </section>
    </div>
  );
}
