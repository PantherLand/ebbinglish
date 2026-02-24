"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import YouglishModal from "@/app/components/youglish-modal";
import { generatePracticeStoryAction, submitReviewBatchAction } from "./actions";

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
  startImmediately?: boolean;
  persistProgress?: boolean;
  progressStorageKey?: string;
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
  audioUrls: string[];
};

type PracticeReading = {
  title: string;
  focusWords: string[];
  fuzzyWords: string[];
  unknownWords: string[];
  passage: string;
  prompts: string[];
};

type PersistedSessionState = {
  version: 1;
  cardsSignature: string;
  cardsSnapshot?: ReviewCard[];
  started: boolean;
  index: number;
  revealed: boolean;
  results: SessionResult[];
  practiceReadings: PracticeReading[];
  activePracticeIndex: number;
  // Backward compatibility for older local data shape.
  practiceReading?: PracticeReading | null;
};
type LastRoundSnapshot = {
  version: 1;
  cards: ReviewCard[];
  savedAt: string;
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
const MAX_PRACTICE_WORDS = 20;

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitPassageByFocusWords(
  passage: string,
  focusWords: string[],
  gradeByWord: Map<string, SessionGrade>,
): Array<{ text: string; kind: "fuzzy" | "unknown" | null }> {
  const normalized = [...new Set(focusWords.map((word) => word.trim().toLowerCase()).filter(Boolean))];
  if (!passage || normalized.length === 0) {
    return [{ text: passage, kind: null }];
  }

  const pattern = normalized
    .map((word) => escapeRegExp(word))
    .sort((a, b) => b.length - a.length)
    .join("|");
  if (!pattern) {
    return [{ text: passage, kind: null }];
  }

  const regex = new RegExp(`\\b(${pattern})\\b`, "gi");
  const parts: Array<{ text: string; kind: "fuzzy" | "unknown" | null }> = [];
  let lastIndex = 0;
  let match = regex.exec(passage);

  while (match) {
    const index = match.index;
    if (index > lastIndex) {
      parts.push({ text: passage.slice(lastIndex, index), kind: null });
    }
    const wordKey = match[0].trim().toLowerCase();
    const grade = gradeByWord.get(wordKey);
    const kind: "fuzzy" | "unknown" | null = grade === 0 ? "unknown" : grade === 1 ? "fuzzy" : null;
    parts.push({ text: match[0], kind });
    lastIndex = index + match[0].length;
    match = regex.exec(passage);
  }

  if (lastIndex < passage.length) {
    parts.push({ text: passage.slice(lastIndex), kind: null });
  }

  return parts.length > 0 ? parts : [{ text: passage, kind: null }];
}

function isPracticeReading(value: unknown): value is PracticeReading {
  if (!value || typeof value !== "object") {
    return false;
  }

  const raw = value as {
    title?: unknown;
    focusWords?: unknown;
    fuzzyWords?: unknown;
    unknownWords?: unknown;
    passage?: unknown;
    prompts?: unknown;
  };

  return (
    typeof raw.title === "string" &&
    Array.isArray(raw.focusWords) &&
    raw.focusWords.every((item) => typeof item === "string") &&
    (raw.fuzzyWords === undefined ||
      (Array.isArray(raw.fuzzyWords) && raw.fuzzyWords.every((item) => typeof item === "string"))) &&
    (raw.unknownWords === undefined ||
      (Array.isArray(raw.unknownWords) &&
        raw.unknownWords.every((item) => typeof item === "string"))) &&
    typeof raw.passage === "string" &&
    Array.isArray(raw.prompts) &&
    raw.prompts.every((item) => typeof item === "string")
  );
}

function normalizePracticeReading(value: PracticeReading): PracticeReading {
  return {
    title: value.title.trim(),
    focusWords: [...new Set(value.focusWords.map((item) => item.trim()))].filter(Boolean),
    fuzzyWords: [...new Set((value.fuzzyWords ?? []).map((item) => item.trim()))].filter(Boolean),
    unknownWords: [...new Set((value.unknownWords ?? []).map((item) => item.trim()))].filter(
      Boolean,
    ),
    passage: value.passage.trim(),
    prompts: value.prompts.map((item) => item.trim()).filter(Boolean),
  };
}

function isReviewCard(value: unknown): value is ReviewCard {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.id === "string" &&
    typeof raw.text === "string" &&
    typeof raw.language === "string" &&
    (typeof raw.meaning === "string" || raw.meaning === null) &&
    typeof raw.stage === "number" &&
    typeof raw.seenCount === "number" &&
    typeof raw.isPriority === "boolean"
  );
}

function isLastRoundSnapshot(value: unknown): value is LastRoundSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as {
    version?: unknown;
    cards?: unknown;
    savedAt?: unknown;
  };
  return (
    raw.version === 1 &&
    Array.isArray(raw.cards) &&
    raw.cards.every(isReviewCard) &&
    typeof raw.savedAt === "string"
  );
}

function langToLocale(lang: string): string {
  const lower = lang.trim().toLowerCase();
  if (lower === "zh" || lower === "chinese" || lower === "mandarin" || lower.startsWith("zh-"))
    return "zh-CN";
  if (lower === "ja" || lower === "japanese") return "ja-JP";
  if (lower === "ko" || lower === "korean") return "ko-KR";
  if (lower === "fr" || lower === "french") return "fr-FR";
  if (lower === "de" || lower === "german") return "de-DE";
  if (lower === "es" || lower === "spanish") return "es-ES";
  return "en-US";
}

export default function ReviewSession({
  cards,
  backHref,
  roundLabel,
  startImmediately = false,
  persistProgress = false,
  progressStorageKey,
}: ReviewSessionProps) {
  const router = useRouter();
  const [started, setStarted] = useState(startImmediately);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [dictInfoByCardId, setDictInfoByCardId] = useState<Record<string, DictCardInfo>>({});
  const [meaningLoadingCardId, setMeaningLoadingCardId] = useState<string | null>(null);
  const [showYouglish, setShowYouglish] = useState(false);
  const [replayCards, setReplayCards] = useState<ReviewCard[] | null>(null);
  const [practiceReadings, setPracticeReadings] = useState<PracticeReading[]>([]);
  const [activePracticeIndex, setActivePracticeIndex] = useState(0);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [restoreReady, setRestoreReady] = useState(false);
  const latestPersistedStateRef = useRef<{
    cardsSignature: string;
    cardsSnapshot: ReviewCard[];
    started: boolean;
    index: number;
    revealed: boolean;
    results: SessionResult[];
    practiceReadings: PracticeReading[];
    activePracticeIndex: number;
  } | null>(null);

  const activeCards = replayCards ?? cards;
  const total = activeCards.length;
  const current = activeCards[index];
  const done = results.length;
  const remaining = Math.max(total - done, 0);
  const newInSession = activeCards.filter((c) => c.seenCount === 0).length;
  const currentStoredMeaning = current?.meaning?.trim() || null;
  const currentDictInfo = current ? dictInfoByCardId[current.id] : null;
  const currentPronunciations = currentDictInfo?.pronunciations ?? [];
  const currentAudioUrls = currentDictInfo?.audioUrls ?? [];
  const currentHeadword = current?.text.trim() || "";
  const cardsSignature = useMemo(() => activeCards.map((card) => card.id).join("|"), [activeCards]);
  const serverCardsSignature = useMemo(() => cards.map((card) => card.id).join("|"), [cards]);
  const lastRoundStorageKey = progressStorageKey ? `${progressStorageKey}:last-round` : null;
  const isReplaySession = replayCards !== null && cards.length === 0;

  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stopAudio() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // ignore
    }
  }

  async function playAudio(url: string) {
    if (typeof window === "undefined") {
      return;
    }

    stopAudio();

    try {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setSpeaking(true);
      audio.onended = () => setSpeaking(false);
      audio.onerror = () => setSpeaking(false);
      // Some browsers require a user gesture for play(); if blocked, we'll just stay silent.
      await audio.play();
    } catch {
      setSpeaking(false);
    }
  }

  // Auto-play pronunciation audio (dictionaryapi.dev) when the session is active.
  useEffect(() => {
    if (!started || !current) {
      setSpeaking(false);
      stopAudio();
      return;
    }

    const url = currentAudioUrls[0];
    if (!url) {
      setSpeaking(false);
      stopAudio();
      return;
    }

    void playAudio(url);

    return () => {
      stopAudio();
      setSpeaking(false);
    };
  }, [current?.id, started, currentAudioUrls.join("|")]);

  function speakCurrent() {
    const url = currentAudioUrls[0];
    if (!url) {
      return;
    }
    void playAudio(url);
  }

  useEffect(() => {
    setRestoreReady(false);
    setStarted(startImmediately);
    setIndex(0);
    setRevealed(false);
    setError(null);
    setResults([]);
    setShowYouglish(false);
    setReplayCards(null);
    setPracticeReadings([]);
    setActivePracticeIndex(0);
    setPracticeLoading(false);

    if (!persistProgress || !progressStorageKey) {
      setRestoreReady(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(progressStorageKey);
      if (!raw) {
        if (cards.length === 0 && lastRoundStorageKey) {
          const snapshotRaw = window.localStorage.getItem(lastRoundStorageKey);
          if (snapshotRaw) {
            const parsedSnapshot = JSON.parse(snapshotRaw);
            if (isLastRoundSnapshot(parsedSnapshot) && parsedSnapshot.cards.length > 0) {
              setReplayCards(parsedSnapshot.cards);
            }
          }
        }
        setRestoreReady(true);
        return;
      }
      const parsed = JSON.parse(raw) as PersistedSessionState;
      if (parsed?.version !== 1) {
        return;
      }

      const safeResults = Array.isArray(parsed.results)
        ? parsed.results.filter(
            (item) =>
              item &&
              typeof item.wordId === "string" &&
              typeof item.text === "string" &&
              (item.grade === 0 || item.grade === 1 || item.grade === 2) &&
              typeof item.revealed === "boolean",
          )
        : [];
      const snapshotCards = Array.isArray(parsed.cardsSnapshot)
        ? parsed.cardsSnapshot.filter(isReviewCard)
        : [];
      const shouldLockToSnapshot =
        snapshotCards.length > 0 && (safeResults.length > 0 || Boolean(parsed.started));
      if (shouldLockToSnapshot) {
        setReplayCards(snapshotCards);
      }

      const restoreBaseCards = shouldLockToSnapshot ? snapshotCards : cards;
      const currentWordIds = new Set(restoreBaseCards.map((card) => card.id));
      const restoredResults =
        restoreBaseCards.length > 0
          ? safeResults.filter((item) => currentWordIds.has(item.wordId))
          : safeResults;
      const dedupedResults: SessionResult[] = [];
      const seenResultWordIds = new Set<string>();
      for (const item of restoredResults) {
        if (seenResultWordIds.has(item.wordId)) {
          continue;
        }
        seenResultWordIds.add(item.wordId);
        dedupedResults.push(item);
      }

      const matchedCardsLength =
        restoreBaseCards.length === 0
          ? Math.max(dedupedResults.length, 1)
          : restoreBaseCards.length;
      const safeIndex = Math.min(
        Math.max(Number.isFinite(parsed.index) ? parsed.index : dedupedResults.length, 0),
        matchedCardsLength,
      );
      setStarted(Boolean(parsed.started) || startImmediately || dedupedResults.length > 0);
      setIndex(safeIndex);
      setRevealed(Boolean(parsed.revealed) && safeIndex < matchedCardsLength);
      setResults(dedupedResults.slice(0, matchedCardsLength));

      const readingsFromArray = Array.isArray(parsed.practiceReadings)
        ? parsed.practiceReadings.filter(isPracticeReading).map(normalizePracticeReading)
        : [];
      const readingsFromLegacy = isPracticeReading(parsed.practiceReading)
        ? [normalizePracticeReading(parsed.practiceReading)]
        : [];
      const mergedReadings = readingsFromArray.length > 0 ? readingsFromArray : readingsFromLegacy;
      setPracticeReadings(mergedReadings);
      const safeActiveIndex = Math.min(
        Math.max(Number.isFinite(parsed.activePracticeIndex) ? parsed.activePracticeIndex : 0, 0),
        Math.max(mergedReadings.length - 1, 0),
      );
      setActivePracticeIndex(safeActiveIndex);
    } catch {
      // Ignore invalid local progress payload.
    } finally {
      setRestoreReady(true);
    }
  }, [
    cards.length,
    lastRoundStorageKey,
    persistProgress,
    progressStorageKey,
    serverCardsSignature,
    startImmediately,
  ]);

  useEffect(() => {
    if (!persistProgress || !progressStorageKey || !restoreReady) {
      return;
    }

    const payload: PersistedSessionState = {
      version: 1,
      cardsSignature,
      cardsSnapshot: activeCards,
      started,
      index,
      revealed,
      results,
      practiceReadings,
      activePracticeIndex,
    };
    try {
      window.localStorage.setItem(progressStorageKey, JSON.stringify(payload));
    } catch {
      // Ignore quota or serialization failures.
    }
  }, [
    cardsSignature,
    index,
    persistProgress,
    practiceReadings,
    activePracticeIndex,
    progressStorageKey,
    results,
    revealed,
    restoreReady,
    started,
  ]);

  useEffect(() => {
    if (!restoreReady) {
      return;
    }
    latestPersistedStateRef.current = {
      cardsSignature,
      cardsSnapshot: activeCards,
      started,
      index,
      revealed,
      results,
      practiceReadings,
      activePracticeIndex,
    };
  }, [
    cardsSignature,
    started,
    index,
    revealed,
    results,
    practiceReadings,
    activePracticeIndex,
    restoreReady,
  ]);

  useEffect(() => {
    if (!persistProgress || !progressStorageKey || !restoreReady) {
      return;
    }

    const flushProgress = () => {
      const latest = latestPersistedStateRef.current;
      if (!latest) {
        return;
      }
      const payload: PersistedSessionState = {
        version: 1,
        cardsSignature: latest.cardsSignature,
        cardsSnapshot: latest.cardsSnapshot,
        started: latest.started,
        index: latest.index,
        revealed: latest.revealed,
        results: latest.results,
        practiceReadings: latest.practiceReadings,
        activePracticeIndex: latest.activePracticeIndex,
      };
      try {
        window.localStorage.setItem(progressStorageKey, JSON.stringify(payload));
      } catch {
        // Ignore storage failures on unload.
      }
    };

    window.addEventListener("pagehide", flushProgress);
    window.addEventListener("beforeunload", flushProgress);

    return () => {
      flushProgress();
      window.removeEventListener("pagehide", flushProgress);
      window.removeEventListener("beforeunload", flushProgress);
    };
  }, [persistProgress, progressStorageKey, restoreReady]);

  useEffect(() => {
    if (practiceReadings.length === 0 && activePracticeIndex !== 0) {
      setActivePracticeIndex(0);
      return;
    }
    if (activePracticeIndex > practiceReadings.length - 1 && practiceReadings.length > 0) {
      setActivePracticeIndex(practiceReadings.length - 1);
    }
  }, [activePracticeIndex, practiceReadings]);

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
          audioUrls?: string[];
        };

        if (!response.ok) {
          throw new Error("meaning request failed");
        }

        const value = payload.meaning?.trim() || payload.fallbackText?.trim() || null;
        const pronunciations = (payload.pronunciations ?? [])
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .slice(0, 3);
        const audioUrls = (payload.audioUrls ?? [])
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .slice(0, 3);
        setDictInfoByCardId((prev) => ({
          ...prev,
          [current.id]: {
            meaning: value,
            pronunciations,
            audioUrls,
          },
        }));
      } catch {
        if (!controller.signal.aborted) {
          setDictInfoByCardId((prev) => ({
            ...prev,
            [current.id]: { meaning: null, pronunciations: [], audioUrls: [] },
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

  const practiceCandidates = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of results) {
      if (item.grade === 2) {
        continue;
      }
      const word = item.text.trim();
      const key = word.toLowerCase();
      if (!word || seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(word);
    }
    return out;
  }, [results]);
  const gradeByReviewedWord = useMemo(() => {
    const map = new Map<string, SessionGrade>();
    for (const item of results) {
      map.set(item.text.trim().toLowerCase(), item.grade);
    }
    return map;
  }, [results]);
  const activePracticeReading =
    practiceReadings[activePracticeIndex] ??
    (practiceReadings.length > 0 ? practiceReadings[practiceReadings.length - 1] : null);
  const focusWordGradeByWord = useMemo(() => {
    const map = new Map<string, SessionGrade>();
    if (!activePracticeReading) {
      return map;
    }

    for (const word of activePracticeReading.fuzzyWords) {
      map.set(word.trim().toLowerCase(), 1);
    }
    for (const word of activePracticeReading.unknownWords) {
      map.set(word.trim().toLowerCase(), 0);
    }

    if (map.size === 0) {
      for (const word of activePracticeReading.focusWords) {
        const grade = gradeByReviewedWord.get(word.trim().toLowerCase());
        if (grade === 0 || grade === 1) {
          map.set(word.trim().toLowerCase(), grade);
        }
      }
    }

    return map;
  }, [activePracticeReading, gradeByReviewedWord]);
  const practicePassageParts = useMemo(
    () =>
      activePracticeReading
        ? splitPassageByFocusWords(
            activePracticeReading.passage,
            activePracticeReading.focusWords,
            focusWordGradeByWord,
          )
        : [],
    [activePracticeReading, focusWordGradeByWord],
  );

  const markCurrent = (grade: SessionGrade) => {
    if (!current || isFinishing) {
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

  const handleSecondaryGrade = (grade: 0 | 1) => {
    markCurrent(grade);
  };

  const updateResultGrade = (wordId: string, grade: SessionGrade) => {
    setResults((prev) =>
      prev.map((item) => (item.wordId === wordId ? { ...item, grade } : item)),
    );
  };

  const saveRound = () => {
    if (results.length === 0 || isFinishing) {
      return;
    }

    if (isReplaySession) {
      setError(null);
      setIsFinishing(true);
      try {
        if (persistProgress && progressStorageKey) {
          window.localStorage.removeItem(progressStorageKey);
        }
      } catch {
        // Ignore localStorage failures and allow the user to leave replay mode.
      }
      router.push(backHref);
      router.refresh();
      return;
    }

    setError(null);
    setIsFinishing(true);
    void (async () => {
      try {
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

        if (persistProgress && progressStorageKey) {
          try {
            if (lastRoundStorageKey) {
              const snapshot: LastRoundSnapshot = {
                version: 1,
                cards: activeCards,
                savedAt: new Date().toISOString(),
              };
              window.localStorage.setItem(lastRoundStorageKey, JSON.stringify(snapshot));
            }
            window.localStorage.removeItem(progressStorageKey);
          } catch {
            // Storage is a best-effort cache only.
          }
        }

        router.push(backHref);
        router.refresh();
      } catch {
        setError("Failed to finish round. Please try again.");
      } finally {
        setIsFinishing(false);
      }
    })();
  };

  const generatePractice = async () => {
    if (practiceCandidates.length === 0 || practiceLoading) {
      return;
    }

    const requestWords = practiceCandidates.slice(0, MAX_PRACTICE_WORDS);
    setPracticeLoading(true);
    setError(null);
    const result = await generatePracticeStoryAction({ words: requestWords });
    setPracticeLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    const allFocusWords = result.usedWords.length > 0 ? result.usedWords : requestWords;
    const nextReading = normalizePracticeReading({
      title: result.title,
      focusWords: result.usedWords.length > 0 ? result.usedWords : requestWords.slice(0, 6),
      fuzzyWords: allFocusWords.filter(
        (word) => gradeByReviewedWord.get(word.trim().toLowerCase()) === 1,
      ),
      unknownWords: allFocusWords.filter(
        (word) => gradeByReviewedWord.get(word.trim().toLowerCase()) === 0,
      ),
      passage: result.story,
      prompts: result.prompts,
    });
    setPracticeReadings((prev) => {
      const next = [...prev, nextReading];
      setActivePracticeIndex(next.length - 1);
      return next;
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
              {activeCards.filter((card) => card.isPriority).length}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">New</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{newInSession}</div>
          </div>
        </div>
        <button
          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-lg font-semibold text-white transition hover:bg-slate-800 active:scale-95"
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
            disabled={isFinishing || results.length === 0}
            onClick={saveRound}
            type="button"
          >
            {isFinishing ? "Finishing..." : "Finish Round"}
          </button>
          <button
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => router.push(backHref)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-xl border border-indigo-300 bg-white px-5 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
            disabled={practiceCandidates.length === 0 || practiceLoading || isFinishing}
            onClick={() => void generatePractice()}
            type="button"
          >
            {practiceLoading ? "Generating..." : "More Practice"}
          </button>
        </div>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        {activePracticeReading ? (
          <section className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
            <div className="flex flex-wrap gap-2">
              {practiceReadings.map((_, index) => {
                const active = index === activePracticeIndex;
                return (
                  <button
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                      active
                        ? "bg-indigo-600 text-white"
                        : "border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
                    }`}
                    key={`exercise-tab-${index + 1}`}
                    onClick={() => setActivePracticeIndex(index)}
                    type="button"
                  >
                    Exercise {index + 1}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-indigo-950">
                More Practice: {activePracticeReading.title}
              </h3>
              <div className="text-xs text-indigo-700">
                Focus words: {activePracticeReading.focusWords.join(", ")}
              </div>
            </div>
            <p className="text-sm leading-7 text-slate-800">
              {practicePassageParts.map((part, index) =>
                part.kind === "fuzzy" ? (
                  <strong
                    className="rounded bg-amber-100 px-0.5 font-semibold text-amber-700"
                    key={`focus-fuzzy-${index}`}
                  >
                    {part.text}
                  </strong>
                ) : part.kind === "unknown" ? (
                  <strong
                    className="rounded bg-rose-100 px-0.5 font-semibold text-rose-700"
                    key={`focus-unknown-${index}`}
                  >
                    {part.text}
                  </strong>
                ) : (
                  <span key={`plain-${index}`}>{part.text}</span>
                ),
              )}
            </p>
            <div>
              <div className="text-xs uppercase tracking-wide text-indigo-700">Practice prompts</div>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                {activePracticeReading.prompts.map((prompt) => (
                  <li key={prompt}>{prompt}</li>
                ))}
              </ol>
            </div>
            <div className="pt-1">
              <button
                className="rounded-xl border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                disabled={practiceCandidates.length === 0 || practiceLoading || isFinishing}
                onClick={() => void generatePractice()}
                type="button"
              >
                {practiceLoading ? "Generating..." : "Generate more"}
              </button>
            </div>
          </section>
        ) : null}
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
          <div className="mt-5 flex items-center gap-4">
            <span className="text-5xl font-semibold tracking-tight text-slate-900 md:text-6xl">
              {current.text}
            </span>
            <button
              aria-label="Pronounce word"
              className={`shrink-0 rounded-full p-2 transition ${speaking ? "text-sky-500" : "text-slate-400 hover:text-slate-600"}`}
              onClick={(e) => {
                e.stopPropagation();
                speakCurrent();
              }}
              title="Pronounce"
              type="button"
            >
              <svg
                aria-hidden="true"
                className={`h-7 w-7 ${speaking ? "animate-pulse" : ""}`}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
              </svg>
            </button>
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
            disabled={isFinishing}
            onClick={() => markCurrent(2)}
            type="button"
          >
            Known
          </button>
          <button
            className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
            disabled={isFinishing}
            onClick={() => handleSecondaryGrade(1)}
            type="button"
          >
            Fuzzy
          </button>
          <button
            className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
            disabled={isFinishing}
            onClick={() => handleSecondaryGrade(0)}
            type="button"
          >
            Unknown
          </button>
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
