"use client";

import { useEffect, useMemo, useState } from "react";
import DictionaryEntryPanel, {
  type DictionaryEntryData,
} from "@/app/components/dictionary-entry-panel";

type DictMeaningPayload = {
  headword?: string;
  meaning?: string | null;
  pos?: string | null;
  pronunciations?: string[];
  audioUrls?: string[];
  posBlocks?: DictionaryEntryData["posBlocks"];
  senses?: DictionaryEntryData["senses"];
  idioms?: DictionaryEntryData["idioms"];
  fallbackText?: string | null;
  disabled?: boolean;
  error?: string;
};

type WordEntryModalTriggerProps = {
  wordText: string;
  manualNote?: string | null;
  isPriority?: boolean;
  triggerClassName?: string;
};

export default function WordEntryModalTrigger({
  wordText,
  manualNote,
  isPriority = false,
  triggerClassName,
}: WordEntryModalTriggerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [dictError, setDictError] = useState<string | null>(null);
  const [entryDetail, setEntryDetail] = useState<DictionaryEntryData | null>(null);

  const fallbackEntry = useMemo<DictionaryEntryData>(
    () => ({
      headword: wordText,
      meaning: manualNote?.trim() || null,
      pos: null,
      pronunciations: [],
      audioUrls: [],
      posBlocks: [],
      senses: [],
      idioms: [],
      fallbackText: manualNote?.trim() || null,
    }),
    [manualNote, wordText],
  );

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

  async function loadEntry() {
    if (loading || fetched) {
      return;
    }
    setLoading(true);
    setDictError(null);

    try {
      const response = await fetch(
        `/api/dict/meaning?headword=${encodeURIComponent(wordText)}`,
      );
      const payload = (await response.json()) as DictMeaningPayload;
      if (!response.ok) {
        throw new Error(payload.error || "Failed to fetch dictionary entry");
      }
      if (payload.disabled) {
        setDictError("Dictionary API is not configured.");
        setEntryDetail(fallbackEntry);
        setFetched(true);
        return;
      }

      const hasStructuredContent =
        (payload.posBlocks?.length ?? 0) > 0 ||
        (payload.senses?.length ?? 0) > 0 ||
        (payload.idioms?.length ?? 0) > 0 ||
        Boolean(payload.fallbackText?.trim());

      if (!hasStructuredContent && !(payload.meaning?.trim() || fallbackEntry.meaning)) {
        setDictError("No dictionary entry found.");
      }

      setEntryDetail({
        headword: payload.headword?.trim() || wordText,
        meaning: payload.meaning || fallbackEntry.meaning,
        pos: payload.pos || null,
        pronunciations: payload.pronunciations ?? [],
        audioUrls: payload.audioUrls ?? [],
        posBlocks: payload.posBlocks ?? [],
        senses: payload.senses ?? [],
        idioms: payload.idioms ?? [],
        fallbackText: payload.fallbackText || fallbackEntry.fallbackText,
      });
      setFetched(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch dictionary entry";
      setDictError(message);
      setEntryDetail(fallbackEntry);
      setFetched(true);
    } finally {
      setLoading(false);
    }
  }

  function openModal() {
    setOpen(true);
    void loadEntry();
  }

  return (
    <>
      <button
        className={`text-left text-lg text-slate-900 transition ${
          isPriority ? "font-black text-amber-700 hover:text-amber-800" : "font-normal hover:text-indigo-600"
        } ${triggerClassName ?? ""}`}
        onClick={openModal}
        type="button"
      >
        {wordText}
      </button>

      {open ? (
        <div
          aria-label={`Dictionary modal for ${wordText}`}
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/50 p-4 md:p-8"
          onClick={() => setOpen(false)}
          role="dialog"
        >
          <div
            className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="text-lg font-semibold tracking-tight text-slate-900">{wordText}</div>
              <button
                aria-label="Close dictionary modal"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:bg-slate-100"
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

            <div className="flex-1 overflow-auto bg-slate-50 p-5 md:p-6">
              {loading ? (
                <p className="text-sm text-slate-500">Loading dictionary entry...</p>
              ) : null}
              {dictError ? <p className="mb-3 text-sm text-amber-700">{dictError}</p> : null}
              <DictionaryEntryPanel
                className="border-slate-200 bg-white"
                emptyText="No dictionary entry available."
                entry={entryDetail ?? fallbackEntry}
                maxHeightClassName="max-h-[72vh]"
                title="Dictionary entry"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
