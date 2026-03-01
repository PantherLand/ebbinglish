import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import { hasStudyPrismaModels, STUDY_PRISMA_HINT } from "@/src/study-runtime";
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

  return (
    <div className="space-y-6">
      <SettingsClient
        initialSettings={{
          sessionSize: settings.sessionSize,
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
