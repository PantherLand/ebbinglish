"use client";

import { useRef, useState } from "react";
import { deleteWordFromListAction } from "./actions";

export function DeleteWordButton({ wordId, wordText }: { wordId: string; wordText: string }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <button
        aria-label="Delete card"
        className="rounded p-1.5 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
        title="Delete card"
        type="button"
        onClick={() => setOpen(true)}
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <path
            d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M18 7l-1 12a1 1 0 01-1 .92H8a1 1 0 01-1-.92L6 7m4 4v6m4-6v6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-4 w-4 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M18 7l-1 12a1 1 0 01-1 .92H8a1 1 0 01-1-.92L6 7m4 4v6m4-6v6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Delete &ldquo;{wordText}&rdquo;?</h3>
                <p className="mt-1 text-sm text-slate-500">
                  This will permanently remove the word and all its review history.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                type="button"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <form ref={formRef} action={deleteWordFromListAction}>
                <input name="wordId" type="hidden" value={wordId} />
                <button
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                  type="submit"
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
