import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import { loadWordsWithStatus } from "@/src/study-queries";
import RoundBuilderClient from "./round-builder-client";

export default async function NewRoundPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create New Round</h1>
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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create New Round</h1>
        <p className="text-sm text-rose-700">User not found.</p>
      </div>
    );
  }

  const words = await loadWordsWithStatus(user.id);
  const availableWords = words.filter((word) => word.status !== "mastered");

  return <RoundBuilderClient words={availableWords} />;
}
