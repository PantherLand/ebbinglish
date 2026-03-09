import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import GlobalToastViewport from "@/app/components/global-toast-viewport";
import AppShellNav from "@/app/components/app-shell-nav";
import EbbinglishBrand from "@/app/components/ebbinglish-brand";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import { hasStudyPrismaModels } from "@/src/study-runtime";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") ?? "";
  const isEmbeddedIOS = userAgent.includes("EbbinglishIOS");
  const session = await auth();
  let sidebarDailyGoal: { reviewed: number; goal: number; progress: number } | null = null;

  if (session?.user?.email && hasStudyPrismaModels()) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (user) {
      const { start, end } = getTodayRange();
      const [reviewedTodayLogs, settings] = await Promise.all([
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
        prisma.studySettings.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id },
          select: { dailyGoal: true },
        }),
      ]);

      const reviewed = new Set(reviewedTodayLogs.map((item) => item.wordId)).size;
      const goal = Math.max(settings.dailyGoal, 1);
      sidebarDailyGoal = {
        reviewed,
        goal,
        progress: Math.min(100, Math.round((reviewed / goal) * 100)),
      };
    }
  }

  return (
    <div
      className={`flex text-slate-900 ${
        isEmbeddedIOS ? "min-h-dvh bg-slate-100" : "h-dvh overflow-hidden bg-slate-50"
      }`}
    >
      {!isEmbeddedIOS ? (
        <aside className="hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white md:flex">
          <div className="border-b border-slate-100 px-6 py-5">
            <EbbinglishBrand sidebar />
          </div>

          <AppShellNav />

          {sidebarDailyGoal ? (
            <div className="mt-auto border-t border-slate-100 p-4">
              <div className="rounded-2xl bg-[#EEF2FF] px-3 py-4">
                <div className="mt-1 text-sm font-bold text-indigo-900">Daily Goal</div>
                <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-[#C7D2FE]">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all"
                    style={{ width: `${sidebarDailyGoal.progress}%` }}
                  />
                </div>
                <div className="mt-3 text-sm text-indigo-600 tabular-nums">
                  {sidebarDailyGoal.reviewed}/{sidebarDailyGoal.goal} words reviewed
                </div>
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!isEmbeddedIOS ? (
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
            <EbbinglishBrand compact />
          </header>
        ) : null}

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div
            className={`mx-auto w-full ${
              isEmbeddedIOS
                ? "max-w-5xl px-4 py-5 pb-6 sm:px-6 md:px-8 md:py-8"
                : "max-w-5xl px-4 py-5 pb-24 sm:px-6 md:px-8 md:py-8 md:pb-8"
            }`}
          >
            {children}
          </div>
        </main>
      </div>

      {!isEmbeddedIOS ? <AppShellNav mobile /> : null}
      <GlobalToastViewport />
    </div>
  );
}
