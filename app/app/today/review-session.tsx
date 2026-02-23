"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import YouglishModal from "@/app/components/youglish-modal";
import { submitReviewBatchAction } from "./actions";

type ReviewCard = {
  id: string;
  text: string;
  language: string;
  meaning: string | null;
  stage: number;
  seenCount: number;
  isPriority: boolean;
};

type ReviewSessionProps = {
  cards: ReviewCard[];
  backHref: string;
  roundLabel: string;
};

type SessionGrade = 0 | 1 | 2;

type SessionResult = {
  wordId: string;
  text: string;
  grade: SessionGrade;
  revealed: boolean;
};

type DictCardInfo = {
  meaning: string | null;
  pronunciations: string[];
};

const GRADE_LABEL: Record<SessionGrade, string> = {
  2: "Known",
  1: "Fuzzy",
  0: "Unknown",
};

const GRADE_BADGE_CLASS: Record<SessionGrade, string> = {
  2: "bg-emerald-100 text-emerald-700 border-emerald-200",
  1: "bg-amber-100 text-amber-700 border-amber-200",
  0: "bg-rose-100 text-rose-700 border-rose-200",
};

export default function ReviewSession({ cards, backHref, roundLabel }: ReviewSessionProps) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [dictInfoByCardId, setDictInfoByCardId] = useState<Record<string, DictCardInfo>>({});
  const [meaningLoadingCardId, setMeaningLoadingCardId] = useState<string | null>(null);
  const [showYouglish, setShowYouglish] = useState(false);
  const [pending, startTransition] = useTransition();

  const total = cards.length;
  const current = cards[index];
  const done = results.length;
  const remaining = Math.max(total - done, 0);
  const currentStoredMeaning = current?.meaning?.trim() || null;
  const currentDictInfo = current ? dictInfoByCardId[current.id] : null;
  const currentPronunciations = currentDictInfo?.pronunciations ?? [];
  const currentHeadword = current?.text.trim() || "";

  useEffect(() => {
    if (!current || current.id in dictInfoByCardId) {
      return;
    }

    const controller = new AbortController();
    setMeaningLoadingCardId(current.id);

    const run = async () => {
      try {
        const response = await fetch(
          `/api/dict/meaning?headword=${encodeURIComponent(current.text)}`,
          {
            method: "GET",
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as {
          meaning?: string | null;
          fallbackText?: string | null;
          pronunciations?: string[];
        };

        if (!response.ok) {
          throw new Error("meaning request failed");
        }

        const value = payload.meaning?.trim() || payload.fallbackText?.trim() || null;
        const pronunciations = (payload.pronunciations ?? [])
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .slice(0, 3);
        setDictInfoByCardId((prev) => ({
          ...prev,
          [current.id]: {
            meaning: value,
            pronunciations,
          },
        }));
      } catch {
        if (!controller.signal.aborted) {
          setDictInfoByCardId((prev) => ({
            ...prev,
            [current.id]: { meaning: null, pronunciations: [] },
          }));
        }
      } finally {
        if (!controller.signal.aborted) {
          setMeaningLoadingCardId((prev) => (prev === current.id ? null : prev));
        }
      }
    };

    void run();

    return () => controller.abort();
  }, [current, dictInfoByCardId]);

  const displayedMeaning =
    currentStoredMeaning ||
    currentDictInfo?.meaning ||
    (current && meaningLoadingCardId === current.id ? "Loading dictionary meaning..." : null);

  const progress = useMemo(() => {
    if (total === 0) {
      return 0;
    }
    return Math.round((done / total) * 100);
  }, [done, total]);

  const summary = useMemo(() => {
    const stats = { known: 0, fuzzy: 0, unknown: 0 };
    for (const item of results) {
      if (item.grade === 2) {
        stats.known += 1;
      } else if (item.grade === 1) {
        stats.fuzzy += 1;
      } else {
        stats.unknown += 1;
      }
    }
    return stats;
  }, [results]);

  const markCurrent = (grade: SessionGrade) => {
    if (!current || pending) {
      return;
    }

    setShowYouglish(false);
    setError(null);
    setResults((prev) => [
      ...prev,
      {
        wordId: current.id,
        text: current.text,
        grade,
        revealed,
      },
    ]);
    setIndex((prev) => prev + 1);
    setRevealed(false);
  };

  const updateResultGrade = (wordId: string, grade: SessionGrade) => {
    setResults((prev) =>
      prev.map((item) => (item.wordId === wordId ? { ...item, grade } : item)),
    );
  };

  const saveRound = () => {
    if (results.length === 0 || pending) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const payload = results.map((item) => ({
        wordId: item.wordId,
        grade: item.grade,
        revealed: item.revealed,
      }));
      const result = await submitReviewBatchAction({ items: payload });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.push(backHref);
      router.refresh();
    });
  };

  if (total === 0) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">No cards in this round</h2>
        <p className="mt-2 text-sm text-slate-600">Switch source or round, then start again.</p>
        <button
          className="mt-5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => router.push(backHref)}
          type="button"
        >
          Back to Today
        </button>
      </section>
    );
  }

  if (!started) {
    return (
      <section className="space-y-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-5 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">Ready to study</h2>
          <p className="text-sm text-slate-600">
            One card at a time. Click the card to reveal meaning, or mark as known to move on.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Cards</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{total}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Priority</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {cards.filter((card) => card.isPriority).length}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Mode</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">Focus</div>
          </div>
        </div>
        <button
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          onClick={() => setStarted(true)}
          type="button"
        >
          Start session ({total})
        </button>
      </section>
    );
  }

  if (!current) {
    return (
      <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Round complete</div>
          <h2 className="text-3xl font-semibold text-slate-900">{roundLabel}</h2>
          <p className="text-sm text-slate-600">
            Check each word result. You can adjust before saving this session.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-xs uppercase tracking-wide text-emerald-700">Known</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-800">{summary.known}</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs uppercase tracking-wide text-amber-700">Fuzzy</div>
            <div className="mt-1 text-2xl font-semibold text-amber-800">{summary.fuzzy}</div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="text-xs uppercase tracking-wide text-rose-700">Unknown</div>
            <div className="mt-1 text-2xl font-semibold text-rose-800">{summary.unknown}</div>
          </div>
        </div>

        <div className="max-h-[50vh] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
          {results.map((item) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
              key={item.wordId}
            >
              <div className="min-w-[120px] flex-1">
                <div className="text-lg font-semibold text-slate-900">{item.text}</div>
                <div
                  className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                    GRADE_BADGE_CLASS[item.grade]
                  }`}
                >
                  {GRADE_LABEL[item.grade]}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    item.grade === 2
                      ? "bg-emerald-600 text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => updateResultGrade(item.wordId, 2)}
                  type="button"
                >
                  Known
                </button>
                <button
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    item.grade === 1
                      ? "bg-amber-500 text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => updateResultGrade(item.wordId, 1)}
                  type="button"
                >
                  Fuzzy
                </button>
                <button
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    item.grade === 0
                      ? "bg-rose-600 text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => updateResultGrade(item.wordId, 0)}
                  type="button"
                >
                  Unknown
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={pending || results.length === 0}
            onClick={saveRound}
            type="button"
          >
            {pending ? "Saving..." : "Save round"}
          </button>
          <button
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => router.push(backHref)}
            type="button"
          >
            Cancel
          </button>
        </div>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-50 via-sky-50 to-cyan-50 p-6 shadow-sm md:p-10">
      <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="relative space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <span>{roundLabel}</span>
          <span>
            Card {done + 1}/{total}
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white/90">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div
          className="group w-full rounded-[2rem] border border-slate-200 bg-white p-8 text-left shadow-md transition hover:-translate-y-0.5 hover:shadow-lg md:p-12"
          onClick={() => setRevealed((prev) => !prev)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setRevealed((prev) => !prev);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {revealed ? "Answer" : "Term"}
          </div>
          <div className="mt-5 text-5xl font-semibold tracking-tight text-slate-900 md:text-6xl">
            {current.text}
          </div>
          {currentPronunciations.length > 0 ? (
            <div className="mt-3 text-base text-slate-500">{currentPronunciations.join("  ·  ")}</div>
          ) : null}
          {current.isPriority ? (
            <div className="mt-5 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              Priority card
            </div>
          ) : null}

          {revealed ? (
            <>
              <div className="mt-10 text-xs uppercase tracking-[0.2em] text-slate-500">Meaning</div>
              <div className="mt-3 text-2xl leading-relaxed text-slate-800">
                {displayedMeaning || "No meaning yet. Add manual meaning in Library."}
              </div>
              <div className="mt-5">
                <button
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  disabled={!currentHeadword}
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowYouglish(true);
                  }}
                  type="button"
                >
                  Open YouGlish
                </button>
              </div>
            </>
          ) : (
            <div className="mt-10 text-sm text-slate-500">Tap to reveal meaning</div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            disabled={pending}
            onClick={() => markCurrent(2)}
            type="button"
          >
            Known
          </button>
          <button
            className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
            disabled={pending || !revealed}
            onClick={() => markCurrent(1)}
            type="button"
          >
            Fuzzy
          </button>
          <button
            className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
            disabled={pending || !revealed}
            onClick={() => markCurrent(0)}
            type="button"
          >
            Unknown
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Stage: {current.stage} | Seen: {current.seenCount} | Remaining: {remaining}
        </div>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>

      {showYouglish ? (
        <YouglishModal
          headword={currentHeadword}
          onClose={() => setShowYouglish(false)}
        />
      ) : null}
    </section>
  );
}
