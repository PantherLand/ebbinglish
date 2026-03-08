ALTER TABLE "Word"
ADD COLUMN IF NOT EXISTS "isAchieved" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Word_userId_isAchieved_idx"
ON "Word"("userId", "isAchieved");
