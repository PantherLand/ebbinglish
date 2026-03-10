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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Today</h1>
        <p className="text-sm text-rose-700">{STUDY_PRISMA_HINT}</p>
      </div>
    );
  }

  const { start, end } = getTodayRange();
  const [rounds, reviewedTodayLogs] = await Promise.all([
    prisma.studyRound.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.reviewLog.findMany({
      where: {
        userId: user.id,
        reviewedAt: {
          gte: start,
          lt: end,
        },
      },
      select: { wordId: true },
    }),
  ]);

  const activeRounds = rounds.filter((item) => item.status === "active");
  const completedRounds = rounds.filter((item) => item.status === "completed");
  const activeRound = activeRounds[0] ?? null;
  const reviewedToday = new Set(reviewedTodayLogs.map((item) => item.wordId)).size;
  const visibleRounds = rounds.slice(0, 3);

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4 md:hidden">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Today</h1>
        </div>
        <Link
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-lg font-medium text-white shadow-[0_8px_18px_rgba(79,70,229,0.28)] transition hover:bg-indigo-700"
          href="/app/rounds/new"
        >
          <span className="text-2xl leading-none">+</span>
          <span>New Round</span>
        </Link>
      </header>

      <header className="hidden items-center justify-between gap-3 md:flex">
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

      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#5B5CE9] via-[#7B61F1] to-[#B14FE2] px-5 py-6 text-white shadow-[0_12px_30px_rgba(124,58,237,0.24)] md:hidden">
        <div className="relative z-10 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/16 shadow-inner shadow-white/10">
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
              <div className="text-[16px] font-medium leading-[1.25] text-white/80">Daily Progress</div>
              <h2 className="text-[24px] font-bold leading-[1.2] tracking-tight">
                {reviewedToday} Words Reviewed
              </h2>
            </div>
          </div>

          {activeRound ? (
            <div className="rounded-[1.7rem] border border-white/20 bg-white/10 px-6 py-4 backdrop-blur">
              <div className="space-y-3">
                <div className="text-[16px] font-semibold leading-[1.35] text-white/90">
                  Continue your active round
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[17px] font-bold leading-[1.4] tracking-tight">
                      {activeRound.name}
                    </div>
                    <div className="mt-1.5 text-[13px] leading-[1.35] text-white/80">
                      {activeRound.completedWordIds.length} / {activeRound.wordIds.length} mastered
                    </div>
                  </div>
                  <Link
                    className="inline-flex min-h-[46px] shrink-0 items-center justify-center gap-2.5 self-start rounded-full bg-white px-7 py-2.5 text-[15px] font-semibold leading-none tracking-tight text-indigo-600 shadow-sm transition hover:bg-indigo-50"
                    href={`/app/rounds/${activeRound.id}`}
                  >
                    <svg
                      aria-hidden="true"
                      className="h-[18px] w-[18px] shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7-11-7z" />
                    </svg>
                    <span>Resume</span>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.7rem] border border-white/20 bg-white/10 p-5 text-center backdrop-blur">
              <p className="text-lg text-white/85">No active rounds. Start a new one.</p>
              <Link
                className="mt-4 inline-flex rounded-full bg-white px-6 py-3 text-lg font-semibold text-indigo-600 transition hover:bg-indigo-50"
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

      <section className="relative hidden overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white shadow-lg md:block">
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
              <h2 className="text-2xl font-bold tracking-tight">{activeRounds.length} Active Rounds</h2>
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

      <section className="space-y-4 md:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Your Rounds</h2>
          <Link className="text-base font-medium text-blue-600 hover:underline" href="/app/rounds">
            View All
          </Link>
        </div>

        <div className="space-y-4">
          {visibleRounds.map((round) => {
            const progress =
              round.wordIds.length === 0
                ? 0
                : Math.round((round.completedWordIds.length / round.wordIds.length) * 100);
            const isActive = round.status === "active";
            return (
              <Link
                className="block rounded-[1.75rem] border border-slate-200 bg-white px-5 py-5 shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
                href={`/app/rounds/${round.id}`}
                key={round.id}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h3 className="pr-2 text-[1.05rem] font-semibold text-slate-900">{round.name}</h3>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold uppercase tracking-wide ${
                      isActive
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {isActive ? "Active" : "Completed"}
                  </span>
                </div>
                <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${isActive ? "bg-emerald-500" : "bg-emerald-400"}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>{round.completedWordIds.length} mastered</span>
                  <span>{round.wordIds.length} total</span>
                </div>
              </Link>
            );
          })}

          <Link
            className="flex min-h-[112px] items-center rounded-[1.75rem] border-2 border-dashed border-slate-300/80 bg-transparent px-6 py-4 text-slate-400 transition hover:border-blue-300 hover:bg-white/60 hover:text-blue-600"
            href="/app/rounds/new"
          >
            <div className="mr-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200 text-3xl leading-none text-slate-500">
              <span className="-mt-0.5">+</span>
            </div>
            <span className="text-[22px] font-medium leading-[1.25] tracking-tight">Create New Round</span>
          </Link>
        </div>
      </section>

      <section className="hidden space-y-4 md:block">
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

      <section className="hidden grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 sm:grid md:grid">
        <article>
          <div className="text-xs uppercase tracking-wide text-slate-500">Active rounds</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{activeRounds.length}</div>
        </article>
        <article>
          <div className="text-xs uppercase tracking-wide text-slate-500">Completed rounds</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{completedRounds.length}</div>
        </article>
      </section>
    </div>
  );
}
