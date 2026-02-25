CREATE TABLE "StudySettings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionSize" INTEGER NOT NULL DEFAULT 20,
  "freezeRounds" INTEGER NOT NULL DEFAULT 3,
  "autoPlayAudio" BOOLEAN NOT NULL DEFAULT true,
  "requireConsecutiveKnown" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudySettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudySettings_userId_key" ON "StudySettings"("userId");

ALTER TABLE "StudySettings"
ADD CONSTRAINT "StudySettings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudyRound" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "wordIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "completedWordIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "attemptedWordIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "firstTryKnownWordIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyRound_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudyRound_userId_status_createdAt_idx" ON "StudyRound"("userId", "status", "createdAt");

ALTER TABLE "StudyRound"
ADD CONSTRAINT "StudyRound_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudySession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "wordIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "results" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudySession_userId_startedAt_idx" ON "StudySession"("userId", "startedAt");
CREATE INDEX "StudySession_roundId_startedAt_idx" ON "StudySession"("roundId", "startedAt");

ALTER TABLE "StudySession"
ADD CONSTRAINT "StudySession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudySession"
ADD CONSTRAINT "StudySession_roundId_fkey"
FOREIGN KEY ("roundId") REFERENCES "StudyRound"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
