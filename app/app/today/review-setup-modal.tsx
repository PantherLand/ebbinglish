"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { advanceToNextSessionAction } from "./actions";

type ReviewSource = "all" | "priority" | "new" | "review";

const SOURCE_LABEL: Record<ReviewSource, string> = {
  all: "All active words",
  priority: "Priority words",
  new: "New words",
  review: "Review words",
};

type ReviewSetupModalProps = {
  globalRound: number;
  selectedSource: ReviewSource;
  selectedCount: number;
  selectedCards: number;
  sourceTotal: number;
  refreshHref: string;
  totalBySource: Record<ReviewSource, number>;
};

export default function ReviewSetupModal({
  globalRound,
  selectedSource,
  selectedCount,
  selectedCards,
  sourceTotal,
  refreshHref,
  totalBySource,
}: ReviewSetupModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleRefreshNextSession = async () => {
    if (isPending) {
      return;
    }

    setRefreshError(null);
    setIsPending(true);
    const result = await advanceToNextSessionAction();
    if (!result.ok) {
      setRefreshError(result.message);
      setIsPending(false);
      return;
    }
    const nextHref = `${refreshHref}${refreshHref.includes("?") ? "&" : "?"}gr=${result.nextGlobalRound}`;
    router.replace(nextHref);
    router.refresh();
    setIsPending(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Review setup</div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Round {globalRound}</h2>
          </div>
          <button
            aria-label="Edit review setup"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700"
            onClick={() => setOpen(true)}
            title="Edit setup"
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                d="M16.86 3.49a2 2 0 112.83 2.83L8.27 17.74 4 19l1.26-4.27L16.86 3.49z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M14.5 5.85l3.65 3.65" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="text-xs uppercase tracking-wide text-slate-500">Source</div>
            <div className="text-sm font-medium text-slate-900">{SOURCE_LABEL[selectedSource]}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="text-xs uppercase tracking-wide text-slate-500">Card count</div>
            <div className="text-sm font-medium text-slate-900">
              {selectedCards} / {sourceTotal}
            </div>
          </div>
        </div>

        <button
          className="inline-flex rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-500"
          disabled={isPending}
          onClick={() => void handleRefreshNextSession()}
          type="button"
        >
          {isPending ? "Refreshing..." : "Refresh to next session"}
        </button>
        {refreshError ? <p className="text-xs text-rose-600">{refreshError}</p> : null}
      </div>

      {open ? (
        <div
          aria-label="Review setup modal"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/50 p-4 md:p-10"
          onClick={() => setOpen(false)}
          role="dialog"
        >
          <div
            className="mx-auto flex h-full w-full items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex w-full max-w-4xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Round setup</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">Round {globalRound}</div>
                </div>
                <button
                  aria-label="Close setup modal"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                <form className="grid gap-4 md:grid-cols-3" method="GET">
                  <label className="space-y-1 text-sm">
                    <span className="text-slate-700">Word source</span>
                    <select
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                      defaultValue={selectedSource}
                      name="source"
                    >
                      <option value="all">All ({totalBySource.all})</option>
                      <option value="priority">Priority ({totalBySource.priority})</option>
                      <option value="new">New ({totalBySource.new})</option>
                      <option value="review">Review ({totalBySource.review})</option>
                    </select>
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="text-slate-700">Card count</span>
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2"
                      defaultValue={selectedCount}
                      max={120}
                      min={1}
                      name="count"
                      type="number"
                    />
                  </label>

                  <div className="flex items-end">
                    <button
                      className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                      type="submit"
                    >
                      Apply setup
                    </button>
                  </div>
                </form>

                <p className="mt-3 text-xs text-slate-600">
                  Selected: {SOURCE_LABEL[selectedSource]} • {selectedCards} / {sourceTotal} cards
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
