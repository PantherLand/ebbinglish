import { auth } from "@/src/auth";
import LearningDayHero from "@/app/components/learning-day-hero";
import { buildHeatmap } from "@/src/memory-heatmap";
import { prisma } from "@/src/prisma";
import { STAGE_INTERVAL_DAYS } from "@/src/review-scheduler";
import { ActivityBarChart } from "./activity-bar-chart";
import { ActivityHeatmap } from "./activity-heatmap";
import { FocusWordsList } from "./focus-words-list";
import { QualityMetrics } from "./quality-metrics";
import { StageDistribution } from "./stage-distribution";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

function dayFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function buildDailySeries(start: Date, end: Date, counts: Map<string, number>) {
  const out: Array<{ date: Date; count: number; key: string }> = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor <= last) {
    const key = dayKey(cursor);
    out.push({ date: new Date(cursor), count: counts.get(key) ?? 0, key });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function calcCurrentStreak(days: Set<string>, today: Date): number {
  let streak = 0;
  const cursor = startOfDay(today);
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function calcLongestStreak(dayKeys: string[]): number {
  if (dayKeys.length === 0) return 0;
  const sorted = [...dayKeys].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = dayFromKey(sorted[i - 1]);
    const curr = dayFromKey(sorted[i]);
    const diff = Math.round((curr.getTime() - prev.getTime()) / MS_PER_DAY);
    if (diff === 1) {
      run += 1;
      if (run > best) best = run;
    } else if (diff > 1) {
      run = 1;
    }
  }
  return best;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
    select: { id: true, createdAt: true },
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
  const start14 = addDays(todayStart, -13);
  const start30 = addDays(todayStart, -29);
  const dayNumber =
    Math.floor((todayStart.getTime() - startOfDay(user.createdAt).getTime()) / MS_PER_DAY) + 1;

  const [totalWords, priorityWords, manualMeanings, newWords, reviewStates, logs30, allLogs] =
    await Promise.all([
      prisma.word.count({ where: { userId: user.id } }),
      prisma.word.count({ where: { userId: user.id, isPriority: true } }),
      prisma.word.count({ where: { userId: user.id, note: { not: null } } }),
      prisma.word.count({ where: { userId: user.id, reviewState: { is: null } } }),
      prisma.reviewState.findMany({
        where: { userId: user.id },
        select: {
          stage: true,
          dueAt: true,
          lapseCount: true,
          seenCount: true,
          word: { select: { text: true, isPriority: true } },
        },
      }),
      prisma.reviewLog.findMany({
        where: { userId: user.id, reviewedAt: { gte: start30 } },
        select: { grade: true, reviewedAt: true },
        orderBy: { reviewedAt: "asc" },
      }),
      prisma.reviewLog.findMany({
        where: { userId: user.id },
        select: { reviewedAt: true },
        orderBy: { reviewedAt: "asc" },
      }),
    ]);

  const activeReviewWords = reviewStates.length;
  const dueNow = reviewStates.filter((state) => state.dueAt <= now).length;
  const overdue = reviewStates.filter((state) => state.dueAt < todayStart).length;
  const mastered = reviewStates.filter((state) => state.stage >= 5).length;
  const stageCounts = Array.from({ length: STAGE_INTERVAL_DAYS.length }, () => 0);
  for (const state of reviewStates) {
    const idx = clamp(state.stage, 0, STAGE_INTERVAL_DAYS.length - 1);
    stageCounts[idx] += 1;
  }

  const dayCountMap = new Map<string, number>();
  const grade30 = { know: 0, fuzzy: 0, again: 0 };
  for (const log of logs30) {
    const key = dayKey(log.reviewedAt);
    dayCountMap.set(key, (dayCountMap.get(key) ?? 0) + 1);
    if (log.grade === 2) grade30.know += 1;
    else if (log.grade === 1) grade30.fuzzy += 1;
    else grade30.again += 1;
  }

  const logsToday = dayCountMap.get(dayKey(now)) ?? 0;
  const logs7d = buildDailySeries(addDays(todayStart, -6), todayStart, dayCountMap).reduce(
    (sum, day) => sum + day.count,
    0,
  );
  const logs14Series = buildDailySeries(start14, todayStart, dayCountMap);
  const max14 = Math.max(...logs14Series.map((day) => day.count), 1);
  const total30 = logs30.length;
  const success30 =
    total30 === 0 ? 0 : Math.round(((grade30.know + grade30.fuzzy * 0.5) / total30) * 100);

  const uniqueDays = Array.from(new Set(allLogs.map((log) => dayKey(log.reviewedAt))));
  const currentStreak = calcCurrentStreak(new Set(uniqueDays), now);
  const longestStreak = calcLongestStreak(uniqueDays);
  const activeDays30 = new Set(logs30.map((log) => dayKey(log.reviewedAt))).size;
  const avgPerActiveDay30 = activeDays30 === 0 ? 0 : (total30 / activeDays30).toFixed(1);

  const reviewCoverage = totalWords === 0 ? 0 : Math.round((activeReviewWords / totalWords) * 100);
  const masteryRate = activeReviewWords === 0 ? 0 : Math.round((mastered / activeReviewWords) * 100);
  const stageWeighted =
    activeReviewWords === 0
      ? 0
      : reviewStates.reduce((sum, state) => sum + state.stage, 0) /
        (activeReviewWords * (STAGE_INTERVAL_DAYS.length - 1));
  const healthScore = Math.round(
    clamp(masteryRate * 0.45 + success30 * 0.35 + stageWeighted * 100 * 0.2, 0, 100),
  );

  const difficultWords = [...reviewStates]
    .filter((state) => state.seenCount > 0)
    .sort((a, b) => {
      if (a.lapseCount !== b.lapseCount) return b.lapseCount - a.lapseCount;
      if (a.stage !== b.stage) return a.stage - b.stage;
      return b.seenCount - a.seenCount;
    })
    .slice(0, 8);

  const heatmapWeeks = buildHeatmap(allLogs.map((log) => log.reviewedAt), 140);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Stats</h1>
        <p className="text-sm text-gray-600">
          Progress dashboard for your spaced-repetition learning pipeline.
        </p>
      </div>

      <LearningDayHero
        dayNumber={dayNumber}
        healthScore={healthScore}
        masteryRate={masteryRate}
        startedAt={startOfDay(user.createdAt)}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-600">Total words</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{totalWords}</div>
          <div className="mt-2 text-xs text-slate-500">Priority {priorityWords}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-600">Due now</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{dueNow}</div>
          <div className="mt-2 text-xs text-slate-500">Overdue {overdue}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-600">Reviews today</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{logsToday}</div>
          <div className="mt-2 text-xs text-slate-500">Last 7d {logs7d}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-600">Streak</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{currentStreak}d</div>
          <div className="mt-2 text-xs text-slate-500">Best {longestStreak}d</div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ActivityBarChart series={logs14Series} max={max14} />
          <QualityMetrics
            know={grade30.know}
            fuzzy={grade30.fuzzy}
            again={grade30.again}
            success={success30}
            activeDays={activeDays30}
            avgPerActiveDay={avgPerActiveDay30}
          />
          <ActivityHeatmap weeks={heatmapWeeks} hasActivity={allLogs.length > 0} />
        </div>

        <div className="space-y-4">
          <StageDistribution
            stageCounts={stageCounts}
            stageIntervalDays={STAGE_INTERVAL_DAYS}
            activeReviewWords={activeReviewWords}
            reviewCoverage={reviewCoverage}
            newWords={newWords}
          />
          <FocusWordsList words={difficultWords} />
          <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <h2 className="text-base font-semibold text-slate-900">Vocabulary details</h2>
            <div className="flex items-center justify-between">
              <span>Words with notes</span>
              <span className="font-medium">{manualMeanings}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Words in review</span>
              <span className="font-medium">{activeReviewWords}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Not yet started</span>
              <span className="font-medium">{newWords}</span>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
