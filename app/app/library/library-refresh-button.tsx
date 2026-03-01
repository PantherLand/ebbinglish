"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function LibraryRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      aria-label="Refresh cards"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
      title={isPending ? "Refreshing..." : "Refresh cards"}
      type="button"
    >
      {isPending ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
        />
      ) : (
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M20 11a8 8 0 1 0 2 5.3" />
          <path d="M20 4v7h-7" />
        </svg>
      )}
    </button>
  );
}
