"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finishSessionAction, saveSessionProgressAction } from "@/app/app/study-actions";
import YouglishEmbed from "@/app/components/youglish-embed";
import type { SessionResultRecord } from "@/src/study-model";

type SessionWord = {
  id: string;
  text: string;
  translation: string;
};

type DictInfo = {
  meaning: string | null;
  pronunciations: string[];
  audioUrls: string[];
};

const OUTCOME_KEYS = {
  unknown: "1",
  fuzzy: "2",
  known: "3",
} as const;

const PROGRESS_STORAGE_VERSION = 1;

type PersistedSessionProgress = {
  version: typeof PROGRESS_STORAGE_VERSION;
  results: SessionResultRecord[];
};

function isOutcome(value: unknown): value is SessionResultRecord["outcome"] {
  return value === "known" || value === "fuzzy" || value === "unknown";
}

function normalizeProgressResults(rawResults: unknown, orderedWordIds: string[]): SessionResultRecord[] {
  if (!Array.isArray(rawResults)) {
    return [];
  }

  const limited = rawResults.slice(0, orderedWordIds.length);
  const out: SessionResultRecord[] = [];

  for (let index = 0; index < limited.length; index += 1) {
    const raw = limited[index];
    if (!raw || typeof raw !== "object") {
      break;
    }
    const item = raw as Record<string, unknown>;
    const wordId = typeof item.wordId === "string" ? item.wordId : "";
    const outcome = item.outcome;
    if (wordId !== orderedWordIds[index] || !isOutcome(outcome)) {
      break;
    }
    out.push({
      wordId,
      outcome,
      timestamp: typeof item.timestamp === "string" ? item.timestamp : new Date().toISOString(),
    });
  }

  return out;
}

function toActionResults(results: SessionResultRecord[]) {
  return results.map((item) => ({
    wordId: item.wordId,
    outcome: item.outcome,
    timestamp: item.timestamp,
  }));
}

function getResumeIndex(doneCount: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.min(doneCount, total - 1);
}

export default function SessionRunClient({
  sessionId,
  roundId,
  words,
  initialResults,
  autoPlayAudio,
}: {
  sessionId: string;
  roundId: string;
  words: SessionWord[];
  initialResults: SessionResultRecord[];
  autoPlayAudio: boolean;
}) {
  const router = useRouter();
  const orderedWordIds = useMemo(() => words.map((word) => word.id), [words]);
  const normalizedInitialResults = useMemo(
    () => normalizeProgressResults(initialResults, orderedWordIds),
    [initialResults, orderedWordIds],
  );
  const progressStorageKey = `ebbinglish:session-progress:${sessionId}`;

  const [currentIndex, setCurrentIndex] = useState(() =>
    getResumeIndex(normalizedInitialResults.length, words.length),
  );
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<SessionResultRecord[]>(() => normalizedInitialResults);
  const [restoreReady, setRestoreReady] = useState(false);
  const [dictMap, setDictMap] = useState<Record<string, DictInfo>>({});
  const [loadingDictWordId, setLoadingDictWordId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const currentWord = words[currentIndex] ?? null;
  const progress = words.length === 0 ? 0 : Math.round((results.length / words.length) * 100);

  const persistProgressToServer = useCallback((nextResults: SessionResultRecord[]) => {
    if (nextResults.length === 0) {
      return;
    }
    void saveSessionProgressAction({
      sessionId,
      results: toActionResults(nextResults),
    }).catch(() => {});
  }, [sessionId]);

  const clearLocalProgress = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.removeItem(progressStorageKey);
    } catch {
      // Ignore localStorage failures.
    }
  }, [progressStorageKey]);

  useEffect(() => {
    setResults(normalizedInitialResults);
    setCurrentIndex(getResumeIndex(normalizedInitialResults.length, words.length));
    setRestoreReady(false);

    if (typeof window === "undefined") {
      setRestoreReady(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(progressStorageKey);
      if (!raw) {
        setRestoreReady(true);
        return;
      }

      const parsed = JSON.parse(raw) as PersistedSessionProgress;
      if (parsed.version !== PROGRESS_STORAGE_VERSION) {
        setRestoreReady(true);
        return;
      }

      const restoredResults = normalizeProgressResults(parsed.results, orderedWordIds);
      if (restoredResults.length > normalizedInitialResults.length) {
        setResults(restoredResults);
        setCurrentIndex(getResumeIndex(restoredResults.length, words.length));
        persistProgressToServer(restoredResults);
      }
    } catch {
      // Ignore invalid local cache.
    } finally {
      setRestoreReady(true);
    }
  }, [
    clearLocalProgress,
    normalizedInitialResults,
    orderedWordIds,
    persistProgressToServer,
    progressStorageKey,
    words.length,
  ]);

  useEffect(() => {
    if (!restoreReady || typeof window === "undefined") {
      return;
    }

    if (results.length === 0) {
      clearLocalProgress();
      return;
    }

    const payload: PersistedSessionProgress = {
      version: PROGRESS_STORAGE_VERSION,
      results,
    };
    try {
      window.localStorage.setItem(progressStorageKey, JSON.stringify(payload));
    } catch {
      // Ignore localStorage failures.
    }
  }, [clearLocalProgress, progressStorageKey, restoreReady, results]);

  useEffect(() => {
    setIsFlipped(false);
  }, [currentIndex]);

  useEffect(() => {
    if (!currentWord) {
      return;
    }
    if (dictMap[currentWord.id]) {
      return;
    }

    const controller = new AbortController();
    setLoadingDictWordId(currentWord.id);

    void (async () => {
      try {
        const response = await fetch(`/api/dict/meaning?headword=${encodeURIComponent(currentWord.text)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          meaning?: string | null;
          fallbackText?: string | null;
          pronunciations?: string[];
          audioUrls?: string[];
        };
        if (!response.ok) {
          throw new Error("Failed to load dictionary");
        }
        setDictMap((prev) => ({
          ...prev,
          [currentWord.id]: {
            meaning: payload.meaning?.trim() || payload.fallbackText?.trim() || null,
            pronunciations: (payload.pronunciations ?? []).filter(Boolean).slice(0, 3),
            audioUrls: (payload.audioUrls ?? []).filter(Boolean).slice(0, 2),
          },
        }));
      } catch {
        if (!controller.signal.aborted) {
          setDictMap((prev) => ({
            ...prev,
            [currentWord.id]: {
              meaning: null,
              pronunciations: [],
              audioUrls: [],
            },
          }));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingDictWordId((prev) => (prev === currentWord.id ? null : prev));
        }
      }
    })();

    return () => controller.abort();
  }, [currentWord, dictMap]);

  useEffect(() => {
    if (!currentWord || !autoPlayAudio) {
      return;
    }
    const info = dictMap[currentWord.id];
    const audio = info?.audioUrls?.[0];
    if (!audio) {
      return;
    }
    const player = new Audio(audio);
    void player.play().catch(() => {});
    return () => {
      player.pause();
      player.currentTime = 0;
    };
  }, [autoPlayAudio, currentWord, dictMap]);

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if (!currentWord || finishing || pending) {
        return;
      }
      if ((event.key === " " || event.key === "Enter") && !isFlipped) {
        event.preventDefault();
        setIsFlipped(true);
        return;
      }
      if (!isFlipped) {
        return;
      }
      if (event.key === OUTCOME_KEYS.known) {
        event.preventDefault();
        handleMark("known");
      } else if (event.key === OUTCOME_KEYS.fuzzy) {
        event.preventDefault();
        handleMark("fuzzy");
      } else if (event.key === OUTCOME_KEYS.unknown) {
        event.preventDefault();
        handleMark("unknown");
      }
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });

  const currentInfo = currentWord ? dictMap[currentWord.id] : null;
  const displayMeaning = useMemo(() => {
    if (!currentWord) return "";
    if (currentWord.translation.trim()) return currentWord.translation.trim();
    if (currentInfo?.meaning?.trim()) return currentInfo.meaning.trim();
    if (loadingDictWordId === currentWord.id) return "Loading dictionary meaning...";
    return "No meaning yet.";
  }, [currentInfo?.meaning, currentWord, loadingDictWordId]);

  function playCurrentAudio() {
    if (!currentWord) return;
    const audioUrl = dictMap[currentWord.id]?.audioUrls?.[0];
    if (!audioUrl) return;
    const player = new Audio(audioUrl);
    void player.play().catch(() => {});
  }

  function handleMark(outcome: "known" | "fuzzy" | "unknown") {
    if (!restoreReady || !currentWord || finishing || pending) {
      return;
    }
    const hasCurrentWordResult = results[currentIndex]?.wordId === currentWord.id;
    const nextResults = hasCurrentWordResult
      ? results
      : [
          ...results,
          {
            wordId: currentWord.id,
            outcome,
            timestamp: new Date().toISOString(),
          } satisfies SessionResultRecord,
        ];
    setResults(nextResults);
    persistProgressToServer(nextResults);

    if (currentIndex < words.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    setFinishing(true);
    setError(null);
    startTransition(() => {
      void (async () => {
        const result = await finishSessionAction({
          sessionId,
          results: nextResults.map((item) => ({
            wordId: item.wordId,
            outcome: item.outcome,
            timestamp: item.timestamp,
          })),
        });
        if (!result.ok) {
          setError(result.message);
          setFinishing(false);
          return;
        }
        clearLocalProgress();
        router.push(`/app/session/${sessionId}/summary`);
      })();
    });
  }

  if (!restoreReady) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-120px)] max-w-2xl items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Restoring session progress...
        </div>
      </div>
    );
  }

  if (!currentWord) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-120px)] max-w-2xl items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          No words in this session.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-120px)] max-w-3xl flex-col justify-center">
      <div className="mb-6 flex items-center justify-between text-sm text-slate-500">
        <span>
          Word {Math.min(currentIndex + 1, words.length)} of {words.length}
        </span>
        <Link
          className="transition hover:text-slate-800"
          href={`/app/rounds/${roundId}`}
          onClick={() => persistProgressToServer(results)}
        >
          Exit
        </Link>
      </div>

      <div className="mb-8 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <section className="relative h-[560px] rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
        {!isFlipped ? (
          <button
            className="flex h-full w-full flex-col items-center justify-center text-center"
            onClick={() => setIsFlipped(true)}
            type="button"
          >
            <span className="mb-4 text-xs uppercase tracking-[0.2em] text-slate-400">Tap to reveal</span>
            <h2 className="text-5xl font-bold tracking-tight text-slate-900">{currentWord.text}</h2>
          </button>
        ) : (
          <div className="flex h-full flex-col gap-4 overflow-y-auto">
            <div className="space-y-5">
              <div className="text-center">
                <div className="inline-flex items-center gap-2">
                  <h2 className="text-4xl font-bold tracking-tight text-slate-900">{currentWord.text}</h2>
                  <button
                    aria-label="Pronounce word"
                    className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    onClick={playCurrentAudio}
                    title="Pronounce"
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                    </svg>
                  </button>
                </div>
                {currentInfo?.pronunciations?.length ? (
                  <div className="mt-2 text-sm text-slate-500">{currentInfo.pronunciations.join(" · ")}</div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xl leading-relaxed text-slate-700">
                {displayMeaning}
              </div>
              <div className="w-full pt-1">
                <YouglishEmbed
                  className="min-h-[200px]"
                  headword={currentWord.text}
                  minHeightClassName="min-h-[200px]"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {!isFlipped ? (
        <button
          className="mx-auto mt-8 w-full max-w-sm rounded-xl bg-slate-900 py-4 text-lg font-semibold text-white transition hover:bg-slate-800"
          onClick={() => setIsFlipped(true)}
          type="button"
        >
          Show Answer
        </button>
      ) : (
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <button
            className="rounded-xl border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
            onClick={() => handleMark("unknown")}
            type="button"
          >
            Unknown
            <div className="mt-1 text-[11px] font-normal opacity-70">Key: 1</div>
          </button>
          <button
            className="rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
            onClick={() => handleMark("fuzzy")}
            type="button"
          >
            Fuzzy
            <div className="mt-1 text-[11px] font-normal opacity-70">Key: 2</div>
          </button>
          <button
            className="rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            onClick={() => handleMark("known")}
            type="button"
          >
            Known
            <div className="mt-1 text-[11px] font-normal opacity-70">Key: 3</div>
          </button>
        </div>
      )}

      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
      {finishing || pending ? <p className="mt-4 text-sm text-slate-500">Saving session...</p> : null}
    </div>
  );
}
