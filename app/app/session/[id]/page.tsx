import { redirect } from "next/navigation";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import { parseSessionResults } from "@/src/study-model";
import { hasStudyPrismaModels, STUDY_PRISMA_HINT } from "@/src/study-runtime";
import SessionRunClient from "./session-run-client";

type SessionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    redirect("/");
  }

  if (!hasStudyPrismaModels()) {
    return <div className="text-sm text-rose-700">{STUDY_PRISMA_HINT}</div>;
  }

  const studySession = await prisma.studySession.findFirst({
    where: {
      id,
      userId: user.id,
    },
    select: {
      id: true,
      roundId: true,
      wordIds: true,
      results: true,
      completedAt: true,
    },
  });
  if (!studySession) {
    return <div className="text-sm text-rose-700">Session not found.</div>;
  }

  if (studySession.completedAt) {
    redirect(`/app/session/${studySession.id}/summary`);
  }

  const [words, settings] = await Promise.all([
    prisma.word.findMany({
      where: {
        userId: user.id,
        id: { in: studySession.wordIds },
      },
      select: {
        id: true,
        text: true,
        note: true,
      },
    }),
    prisma.studySettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    }),
  ]);

  const wordById = new Map(words.map((word) => [word.id, word]));
  const orderedWords = studySession.wordIds
    .map((wordId) => wordById.get(wordId))
    .filter(Boolean)
    .map((word) => ({
      id: word!.id,
      text: word!.text,
      translation: word!.note ?? "",
    }));

  const initialResults = parseSessionResults(studySession.results);

  return (
    <SessionRunClient
      autoPlayAudio={settings.autoPlayAudio}
      initialResults={initialResults}
      roundId={studySession.roundId}
      sessionId={studySession.id}
      words={orderedWords}
    />
  );
}
