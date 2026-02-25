import Link from "next/link";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import { parseSessionResults } from "@/src/study-model";
import { hasStudyPrismaModels, STUDY_PRISMA_HINT } from "@/src/study-runtime";

type SessionSummaryPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SessionSummaryPage({ params }: SessionSummaryPageProps) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Session Summary</h1>
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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Session Summary</h1>
        <p className="text-sm text-rose-700">User not found.</p>
      </div>
    );
  }

  if (!hasStudyPrismaModels()) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Session Summary</h1>
        <p className="text-sm text-rose-700">{STUDY_PRISMA_HINT}</p>
      </div>
    );
  }

  const studySession = await prisma.studySession.findFirst({
    where: {
      id,
      userId: user.id,
    },
    select: {
      id: true,
      roundId: true,
      results: true,
    },
  });

  if (!studySession) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Session not found</h1>
        <Link className="text-sm text-indigo-600 hover:underline" href="/app/today">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const results = parseSessionResults(studySession.results);
  const knownCount = results.filter((item) => item.outcome === "known").length;
  const fuzzyCount = results.filter((item) => item.outcome === "fuzzy").length;
  const unknownCount = results.filter((item) => item.outcome === "unknown").length;

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-600">
        ✓
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Session Complete</h1>
      <p className="mt-2 text-sm text-slate-500">You reviewed {results.length} words.</p>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-2xl font-bold text-emerald-700">{knownCount}</p>
          <p className="text-xs uppercase font-medium text-emerald-600">Known</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-2xl font-bold text-amber-700">{fuzzyCount}</p>
          <p className="text-xs uppercase font-medium text-amber-600">Fuzzy</p>
        </div>
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
          <p className="text-2xl font-bold text-rose-700">{unknownCount}</p>
          <p className="text-xs uppercase font-medium text-rose-600">Unknown</p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <Link
          className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          href={`/app/rounds/${studySession.roundId}`}
        >
          Continue Round
        </Link>
        <Link
          className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          href="/app/today"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
