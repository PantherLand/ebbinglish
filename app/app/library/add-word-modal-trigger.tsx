"use client";

import { useEffect, useState } from "react";
import AddWordForm from "./add-word-form";

export default function AddWordModalTrigger() {
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
      <button
        className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        onClick={() => setOpen(true)}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
          viewBox="0 0 24 24"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add Word
      </button>

      {open ? (
        <div
          aria-label="Add word modal"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/45 p-4 md:p-8"
          onClick={() => setOpen(false)}
          role="dialog"
        >
          <div className="mx-auto flex h-full w-full max-w-5xl items-start justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl">
            <div className="flex h-full w-full flex-col" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">Add Word</h2>
                  <p className="text-xs text-slate-500">Search dictionary and add to your cards.</p>
                </div>
                <button
                  aria-label="Close add word modal"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:bg-slate-100"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <div className="overflow-auto p-5 md:p-6">
                <AddWordForm className="border-slate-200 bg-white" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
