export type ReviewGrade = 0 | 1 | 2;

export type NextReviewPlan = {
  nextStage: number;
  dueAt: Date;
  lapseIncrement: number;
};

// Fixed intervals (days) for a lightweight Ebbinghaus-style schedule.
export const STAGE_INTERVAL_DAYS = [0, 1, 2, 4, 7, 15, 30] as const;
const FUZZY_RETRY_HOURS = 12;
const AGAIN_RETRY_MINUTES = 10;

function addMs(base: Date, ms: number): Date {
  return new Date(base.getTime() + ms);
}

function clampStage(stage: number): number {
  const maxStage = STAGE_INTERVAL_DAYS.length - 1;
  return Math.min(Math.max(stage, 0), maxStage);
}

export function planNextReview(
  currentStage: number,
  grade: ReviewGrade,
  now: Date = new Date(),
): NextReviewPlan {
  const stage = clampStage(currentStage);

  if (grade === 2) {
    const nextStage = clampStage(stage + 1);
    const intervalDays = STAGE_INTERVAL_DAYS[nextStage];
    return {
      nextStage,
      dueAt: addMs(now, intervalDays * 24 * 60 * 60 * 1000),
      lapseIncrement: 0,
    };
  }

  if (grade === 1) {
    return {
      nextStage: Math.max(1, stage),
      dueAt: addMs(now, FUZZY_RETRY_HOURS * 60 * 60 * 1000),
      lapseIncrement: 0,
    };
  }

  return {
    nextStage: 0,
    dueAt: addMs(now, AGAIN_RETRY_MINUTES * 60 * 1000),
    lapseIncrement: 1,
  };
}
