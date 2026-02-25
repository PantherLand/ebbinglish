import Link from "next/link";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import { hasStudyPrismaModels, STUDY_PRISMA_HINT } from "@/src/study-runtime";

type RoundStatus = "active" | "completed" | "archived";

function asRoundStatus(value: string): RoundStatus {
  if (value === "completed" || value === "archived") {
    return value;
  }
  return "active";
}

function RoundCard({
  id,
  name,
  status,
  completedCount,
  totalCount,
}: {
  id: string;
  name: string;
  status: RoundStatus;
  completedCount: number;
  totalCount: number;
}) {
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const badgeClass =
    status === "active"
      ? "bg-emerald-100 text-emerald-700"
      : status === "completed"
        ? "bg-slate-100 text-slate-700"
        : "bg-amber-100 text-amber-700";
  const barClass = status === "completed" ? "bg-emerald-500" : "bg-indigo-500";

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="truncate pr-2 text-base font-semibold text-slate-900">{name}</h3>
        <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${badgeClass}`}>{status}</span>
      </div>
      <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${progress}%` }} />
      </div>
      <div className="mb-4 flex justify-between text-xs text-slate-500">
        <span>{completedCount} mastered</span>
        <span>{totalCount} total</span>
      </div>
      <Link
        className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
        href={`/app/rounds/${id}`}
      >
        View Details
      </Link>
    </article>
  );
}

export default async function RoundsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Your Rounds</h1>
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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Your Rounds</h1>
        <p className="text-sm text-rose-700">User not found.</p>
      </div>
    );
  }

  if (!hasStudyPrismaModels()) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Your Rounds</h1>
        <p className="text-sm text-rose-700">{STUDY_PRISMA_HINT}</p>
      </div>
    );
  }

  const rounds = await prisma.studyRound.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      wordIds: true,
      completedWordIds: true,
    },
  });

  const activeRounds = rounds.filter((item) => asRoundStatus(item.status) === "active");
  const completedRounds = rounds.filter((item) => asRoundStatus(item.status) === "completed");
  const archivedRounds = rounds.filter((item) => asRoundStatus(item.status) === "archived");

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Your Rounds</h1>
          <p className="mt-1 text-base text-slate-500">Manage your learning cycles.</p>
        </div>
        <Link
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-base font-medium text-white shadow-sm transition hover:bg-indigo-700"
          href="/app/rounds/new"
        >
          <span className="text-base leading-none">+</span>
          Create New Round
        </Link>
      </header>

      <section>
        <h2 className="mb-4 inline-flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
          <svg aria-hidden="true" className="h-5 w-5 text-indigo-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7-11-7z" />
          </svg>
          Active Rounds
        </h2>
        {activeRounds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No active rounds. Start a new one to begin learning.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeRounds.map((round) => (
              <RoundCard
                completedCount={round.completedWordIds.length}
                id={round.id}
                key={round.id}
                name={round.name}
                status="active"
                totalCount={round.wordIds.length}
              />
            ))}
          </div>
        )}
      </section>

      {completedRounds.length > 0 ? (
        <section>
          <h2 className="mb-4 inline-flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
            <svg
              aria-hidden="true"
              className="h-5 w-5 text-emerald-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Completed
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedRounds.map((round) => (
              <RoundCard
                completedCount={round.completedWordIds.length}
                id={round.id}
                key={round.id}
                name={round.name}
                status="completed"
                totalCount={round.wordIds.length}
              />
            ))}
          </div>
        </section>
      ) : null}

      {archivedRounds.length > 0 ? (
        <section>
          <h2 className="mb-4 text-xl font-bold tracking-tight text-slate-900">Archived</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {archivedRounds.map((round) => (
              <RoundCard
                completedCount={round.completedWordIds.length}
                id={round.id}
                key={round.id}
                name={round.name}
                status="archived"
                totalCount={round.wordIds.length}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
