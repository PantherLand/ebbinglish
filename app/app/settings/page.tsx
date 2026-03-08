import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import { hasStudyPrismaModels, STUDY_PRISMA_HINT } from "@/src/study-runtime";
import { signOut } from "@/src/auth";
import { getApiTokenStatusAction } from "./api-token-actions";
import ApiTokenSection from "./api-token-section";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-rose-700">User not found.</p>
      </div>
    );
  }

  if (!hasStudyPrismaModels()) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-rose-700">{STUDY_PRISMA_HINT}</p>
      </div>
    );
  }

  const [settings, apiTokenStatus] = await Promise.all([
    prisma.studySettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    }),
    getApiTokenStatusAction(),
  ]);

  const displayName = session.user?.name?.trim() || email.split("@")[0] || "User";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-3xl">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Customize your learning experience.</p>
        </header>
      </div>

      <div className="mx-auto max-w-3xl">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              className="h-5 w-5 text-slate-900"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="10" cy="7" r="4" />
            </svg>
            <h2 className="text-lg font-bold text-slate-900">Account</h2>
          </div>

          <div className="mt-4 border-t border-slate-100" />

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#DCE2FF] text-base font-semibold text-[#4F46E5]">
                {avatarLetter}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">{displayName}</div>
                <div className="truncate text-sm text-slate-500">{session.user?.email || "Unavailable"}</div>
              </div>
            </div>

            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                type="submit"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="m16 17 5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
                Sign Out
              </button>
            </form>
          </div>
        </section>
      </div>
      <SettingsClient
        initialSettings={{
          sessionSize: settings.sessionSize,
          dailyGoal: settings.dailyGoal,
          freezeRounds: settings.freezeRounds,
          autoPlayAudio: settings.autoPlayAudio,
          requireConsecutiveKnown: settings.requireConsecutiveKnown,
        }}
      />
      <div className="mx-auto max-w-3xl">
        <ApiTokenSection initial={apiTokenStatus} />
      </div>
    </div>
  );
}
