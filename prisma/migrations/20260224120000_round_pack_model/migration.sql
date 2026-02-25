-- Round/session model migration
ALTER TABLE "User"
ADD COLUMN "currentGlobalRound" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "ReviewState"
ADD COLUMN "consecutivePerfect" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "freezeRounds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "isMastered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "masteryPhase" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "ReviewState_userId_freezeRounds_isMastered_idx"
ON "ReviewState"("userId", "freezeRounds", "isMastered");
