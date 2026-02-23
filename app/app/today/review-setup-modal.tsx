"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ReviewSource = "all" | "priority" | "new" | "review";

const SOURCE_LABEL: Record<ReviewSource, string> = {
  all: "All due words",
  priority: "Priority words",
  new: "New words",
  review: "Review-state words",
};

type ReviewSetupModalProps = {
  selectedRound: number;
  totalRounds: number;
  selectedSource: ReviewSource;
  selectedCount: number;
  selectedCards: number;
  sourceTotal: number;
  nextSessionHref: string;
  hasNextRound: boolean;
  totalBySource: Record<ReviewSource, number>;
};

export default function ReviewSetupModal({
  selectedRound,
  totalRounds,
  selectedSource,
  selectedCount,
  selectedCards,
  sourceTotal,
  nextSessionHref,
  hasNextRound,
  totalBySource,
}: ReviewSetupModalProps) {
  const [open, setOpen] = useState(false);

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
            <h2 className="text-xl font-semibold text-slate-900">This session</h2>
          </div>
          <button
            aria-label="Edit review setup"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
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
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Source</div>
            <div className="text-sm font-medium text-slate-900">{SOURCE_LABEL[selectedSource]}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Card count</div>
            <div className="text-sm font-medium text-slate-900">
              {selectedCards} / {sourceTotal}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-slate-500">
            Round {selectedRound + 1} / {totalRounds}
          </div>
          <Link
            aria-disabled={!hasNextRound}
            className={`rounded-2xl px-4 py-2 text-sm font-medium text-white ${
              hasNextRound
                ? "bg-slate-900 hover:bg-slate-800"
                : "pointer-events-none bg-slate-400"
            }`}
            href={nextSessionHref}
          >
            Next round
          </Link>
        </div>
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
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Review
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">Setup</div>
                </div>
                <button
                  aria-label="Close setup modal"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm transition hover:bg-slate-700"
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
                  <input name="round" type="hidden" value={selectedRound} />
                  <label className="space-y-1 text-sm">
                    <span className="text-slate-700">Word source</span>
                    <select
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                      defaultValue={selectedSource}
                      name="source"
                    >
                      <option value="all">All due ({totalBySource.all})</option>
                      <option value="priority">Priority ({totalBySource.priority})</option>
                      <option value="new">New words ({totalBySource.new})</option>
                      <option value="review">Review-state ({totalBySource.review})</option>
                    </select>
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="text-slate-700">Card count</span>
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2"
                      defaultValue={selectedCount}
                      max={100}
                      min={1}
                      name="count"
                      type="number"
                    />
                  </label>

                  <div className="flex items-end">
                    <button
                      className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
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
