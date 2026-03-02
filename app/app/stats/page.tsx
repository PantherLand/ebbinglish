import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import { loadWordsWithStatus } from "@/src/study-queries";
import { hasStudyPrismaModels } from "@/src/study-runtime";
import { parseSessionResults } from "@/src/study-model";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type PieRow = {
  name: string;
  value: number;
  color: string;
};

function startOfDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildDailySeries(start: Date, end: Date, counts: Map<string, number>) {
  const out: Array<{ date: Date; key: string; words: number }> = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor <= last) {
    const key = dayKey(cursor);
    out.push({ date: new Date(cursor), key, words: counts.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export default async function StatsPage() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Stats</h1>
        <p className="text-sm text-red-700">Please sign in to view your stats.</p>
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
        <h1 className="text-2xl font-semibold">Stats</h1>
        <p className="text-sm text-red-700">User not found.</p>
      </div>
    );
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const start7 = addDays(todayStart, -6);

  const wordsWithStatus = await loadWordsWithStatus(user.id);
  const totalWords = wordsWithStatus.length;
  const mastered = wordsWithStatus.filter(
    (item) => item.status === "mastered" || item.status === "frozen",
  ).length;
  const learning = wordsWithStatus.filter(
    (item) => item.status === "seen" || item.status === "fuzzy" || item.status === "unknown",
  ).length;
  const brandNew = wordsWithStatus.filter((item) => item.status === "new").length;

  const pieData: PieRow[] = [
    { name: "Mastered", value: mastered, color: "#10B981" },
    { name: "Learning", value: learning, color: "#F59E0B" },
    { name: "New", value: brandNew, color: "#3B82F6" },
  ].filter((item) => item.value > 0);

  const dayWordCountMap = new Map<string, number>();
  let totalSessions = 0;

  if (hasStudyPrismaModels()) {
    const [sessionsCount, sessions7] = await Promise.all([
      prisma.studySession.count({ where: { userId: user.id } }),
      prisma.studySession.findMany({
        where: {
          userId: user.id,
          startedAt: { gte: start7 },
        },
        select: {
          startedAt: true,
          results: true,
        },
        orderBy: { startedAt: "asc" },
      }),
    ]);

    totalSessions = sessionsCount;
    for (const item of sessions7) {
      const key = dayKey(item.startedAt);
      const count = parseSessionResults(item.results).length;
      dayWordCountMap.set(key, (dayWordCountMap.get(key) ?? 0) + count);
    }
  } else {
    const logs7 = await prisma.reviewLog.findMany({
      where: {
        userId: user.id,
        reviewedAt: { gte: start7 },
      },
      select: { reviewedAt: true },
    });

    for (const item of logs7) {
      const key = dayKey(item.reviewedAt);
      dayWordCountMap.set(key, (dayWordCountMap.get(key) ?? 0) + 1);
    }
  }

  const sessionData = buildDailySeries(start7, todayStart, dayWordCountMap);
  const maxWords = Math.max(...sessionData.map((item) => item.words), 1);

  const donutStops =
    pieData.length === 0
      ? "#E5E7EB 0deg 360deg"
      : (() => {
          let offset = 0;
          return pieData
            .map((item) => {
              const span = totalWords > 0 ? (item.value / totalWords) * 360 : 0;
              const from = offset;
              offset += span;
              return `${item.color} ${from}deg ${offset}deg`;
            })
            .join(", ");
        })();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Statistics</h1>
        <p className="mt-1 text-gray-500">Track your learning progress over time.</p>
      </header>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-base font-bold text-gray-900">Word Mastery Distribution</h2>
          {pieData.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">
              No words yet
            </div>
          ) : (
            <>
              <div className="flex h-64 items-center justify-center">
                <div
                  aria-label="Word status distribution"
                  className="relative h-44 w-44 rounded-full"
                  style={{ background: `conic-gradient(${donutStops})` }}
                >
                  <div className="absolute inset-8 rounded-full bg-white" />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
                {pieData.map((item) => (
                  <div className="flex items-center gap-1" key={item.name}>
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>
                      {item.name} ({item.value})
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-base font-bold text-gray-900">Words Reviewed (Last 7 Days)</h2>
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="grid grid-cols-7 gap-3">
              {sessionData.map((item) => {
                const height = item.words > 0 ? Math.max((item.words / maxWords) * 100, 10) : 6;
                return (
                  <div className="flex flex-col items-center gap-2" key={item.key}>
                    <div className="text-[11px] text-slate-500">{item.words}</div>
                    <div className="flex h-40 w-full items-end justify-center">
                      <div
                        className={`w-full max-w-10 rounded-t-md transition-all ${
                          item.words > 0 ? "bg-indigo-600" : "bg-slate-200"
                        }`}
                        style={{ height: `${height}%` }}
                        title={`${item.date.toLocaleDateString()}: ${item.words} words`}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {item.date.toLocaleDateString(undefined, { weekday: "short" })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6">
          <p className="text-sm font-medium uppercase text-indigo-600">Total Words</p>
          <h2 className="mt-2 text-4xl font-bold text-indigo-900">{totalWords}</h2>
        </article>
        <article className="rounded-2xl border border-green-100 bg-green-50 p-6">
          <p className="text-sm font-medium uppercase text-green-600">Mastered</p>
          <h2 className="mt-2 text-4xl font-bold text-green-900">{mastered}</h2>
          <p className="mt-1 text-xs text-green-700">Includes frozen words</p>
        </article>
        <article className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
          <p className="text-sm font-medium uppercase text-blue-600">Total Sessions</p>
          <h2 className="mt-2 text-4xl font-bold text-blue-900">{totalSessions}</h2>
        </article>
      </section>
    </div>
  );
}
