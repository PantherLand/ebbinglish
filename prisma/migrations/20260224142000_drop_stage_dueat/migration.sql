-- Remove legacy stage/dueAt scheduling columns and index.
DROP INDEX IF EXISTS "ReviewState_userId_dueAt_idx";

ALTER TABLE "ReviewState"
DROP COLUMN IF EXISTS "stage",
DROP COLUMN IF EXISTS "dueAt";

CREATE INDEX IF NOT EXISTS "ReviewState_userId_createdAt_idx"
ON "ReviewState"("userId", "createdAt");
