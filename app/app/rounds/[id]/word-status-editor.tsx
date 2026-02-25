"use client";

import { useEffect, useRef, useState } from "react";
import { editRoundWordStatusAction } from "@/app/app/study-actions";

type EditableStatus = "first_try_mastered" | "mastered" | "fuzzy" | "unknown";

const STATUS_OPTIONS: Array<{ key: EditableStatus; label: string }> = [
  { key: "first_try_mastered", label: "First-Try Mastered" },
  { key: "mastered", label: "Mastered" },
  { key: "fuzzy", label: "Fuzzy" },
  { key: "unknown", label: "Unknown" },
];

type WordStatusEditorProps = {
  roundId: string;
  wordId: string;
  activeStatus: EditableStatus | null;
};

export default function WordStatusEditor({
  roundId,
  wordId,
  activeStatus,
}: WordStatusEditorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!target || !(target instanceof Node)) {
        return;
      }
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Edit word status"
        className="cursor-pointer rounded-md p-1.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
        onClick={() => setOpen((prev) => !prev)}
        title="Edit status"
        type="button"
      >
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
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {STATUS_OPTIONS.map((item) => (
            <form action={editRoundWordStatusAction} key={item.key} onSubmit={() => setOpen(false)}>
              <input name="roundId" type="hidden" value={roundId} />
              <input name="wordId" type="hidden" value={wordId} />
              <input name="targetStatus" type="hidden" value={item.key} />
              <button
                className={`w-full px-3 py-2 text-left text-xs transition ${
                  activeStatus === item.key
                    ? "bg-indigo-50 font-semibold text-indigo-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
                type="submit"
              >
                {item.label}
              </button>
            </form>
          ))}
        </div>
      ) : null}
    </div>
  );
}
