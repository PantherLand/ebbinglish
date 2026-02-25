"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import YouglishModal from "@/app/components/youglish-modal";
import { generatePracticeStoryAction, submitReviewBatchAction } from "./actions";

type ReviewCard = {
  id: string;
  text: string;
  language: string;
  meaning: string | null;
  seenCount: number;
  isPriority: boolean;
};

type ReviewSessionProps = {
  cards: ReviewCard[];
  backHref: string;
  finishHref?: string;
  roundLabel: string;
  startImmediately?: boolean;
  persistProgress?: boolean;
  progressStorageKey?: string;
};

type SessionGrade = 0 | 1 | 2;
type SessionPhase = "ENCOUNTER" | "POLISH" | "SUMMARY";

type FirstImpression = {
  wordId: string;
  text: string;
  grade: SessionGrade;
  revealed: boolean;
};

type SessionState = {
  started: boolean;
  phase: SessionPhase;
  encounterIndex: number;
  segmentPause: boolean;
  revealed: boolean;
  firstImpressionsByWordId: Record<string, FirstImpression>;
  firstImpressionOrder: string[];
  hasBeenSeenIds: string[];
  polishPool: string[];
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
  version: 2;
  cardsSignature: string;
  state: SessionState;
  practiceReadings: PracticeReading[];
  activePracticeIndex: number;
};

const ENCOUNTER_BATCH_SIZE = 20;
const MAX_PRACTICE_WORDS = 20;
const EMPTY_STRINGS: string[] = [];

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

function createInitialState(startImmediately: boolean): SessionState {
  return {
    started: startImmediately,
    phase: "ENCOUNTER",
    encounterIndex: 0,
    segmentPause: false,
    revealed: false,
    firstImpressionsByWordId: {},
    firstImpressionOrder: [],
    hasBeenSeenIds: [],
    polishPool: [],
  };
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

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

function isSessionState(value: unknown): value is SessionState {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.started === "boolean" &&
    (raw.phase === "ENCOUNTER" || raw.phase === "POLISH" || raw.phase === "SUMMARY") &&
    typeof raw.encounterIndex === "number" &&
    typeof raw.segmentPause === "boolean" &&
    typeof raw.revealed === "boolean" &&
    !!raw.firstImpressionsByWordId &&
    typeof raw.firstImpressionsByWordId === "object" &&
    Array.isArray(raw.firstImpressionOrder) &&
    Array.isArray(raw.hasBeenSeenIds) &&
    Array.isArray(raw.polishPool)
  );
}

function isPracticeReading(value: unknown): value is PracticeReading {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.title === "string" &&
    Array.isArray(raw.focusWords) &&
    Array.isArray(raw.fuzzyWords) &&
    Array.isArray(raw.unknownWords) &&
    typeof raw.passage === "string" &&
    Array.isArray(raw.prompts)
  );
}

function normalizePracticeReading(value: PracticeReading): PracticeReading {
  return {
    title: value.title.trim(),
    focusWords: [...new Set(value.focusWords.map((item) => item.trim()))].filter(Boolean),
    fuzzyWords: [...new Set(value.fuzzyWords.map((item) => item.trim()))].filter(Boolean),
    unknownWords: [...new Set(value.unknownWords.map((item) => item.trim()))].filter(Boolean),
    passage: value.passage.trim(),
    prompts: value.prompts.map((item) => item.trim()).filter(Boolean),
  };
}

export default function ReviewSession({
  cards,
  backHref,
  finishHref = backHref,
  roundLabel,
  startImmediately = false,
  persistProgress = false,
  progressStorageKey,
}: ReviewSessionProps) {
  const router = useRouter();
  const cardsById = useMemo(() => {
    const map = new Map<string, ReviewCard>();
    for (const card of cards) {
      map.set(card.id, card);
    }
    return map;
  }, [cards]);
  const cardsSignature = useMemo(() => cards.map((card) => card.id).join("|"), [cards]);

  const [state, setState] = useState<SessionState>(() => createInitialState(startImmediately));
  const [restoreReady, setRestoreReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [dictInfoByCardId, setDictInfoByCardId] = useState<Record<string, DictCardInfo>>({});
  const [meaningLoadingCardId, setMeaningLoadingCardId] = useState<string | null>(null);
  const [showYouglish, setShowYouglish] = useState(false);
  const [practiceReadings, setPracticeReadings] = useState<PracticeReading[]>([]);
  const [activePracticeIndex, setActivePracticeIndex] = useState(0);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const latestRef = useRef<{
    state: SessionState;
    practiceReadings: PracticeReading[];
    activePracticeIndex: number;
  } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const total = cards.length;
  const hasBeenSeenInThisRound = useMemo(() => new Set(state.hasBeenSeenIds), [state.hasBeenSeenIds]);

  const encounterCard = state.phase === "ENCOUNTER" ? cards[state.encounterIndex] : null;
  const polishCard = state.phase === "POLISH" ? cardsById.get(state.polishPool[0] ?? "") ?? null : null;
  const current = encounterCard ?? polishCard;
  const currentHeadword = current?.text.trim() || "";

  const currentStoredMeaning = current?.meaning?.trim() || null;
  const currentDictInfo = current ? dictInfoByCardId[current.id] : null;
  const currentPronunciations = currentDictInfo?.pronunciations ?? EMPTY_STRINGS;
  const currentAudioUrls = currentDictInfo?.audioUrls ?? EMPTY_STRINGS;
  const displayedMeaning =
    currentStoredMeaning ||
    currentDictInfo?.meaning ||
    (current && meaningLoadingCardId === current.id ? "Loading dictionary meaning..." : null);

  const stopAudio = useCallback(() => {
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
  }, []);

  const playAudio = useCallback(async (url: string) => {
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
      await audio.play();
    } catch {
      setSpeaking(false);
    }
  }, [stopAudio]);

  function speakCurrent() {
    const url = currentAudioUrls[0];
    if (!url) {
      setSpeaking(false);
      return;
    }
    void playAudio(url);
  }

  useEffect(() => {
    setState(createInitialState(startImmediately));
    setError(null);
    setIsFinishing(false);
    setPracticeReadings([]);
    setActivePracticeIndex(0);
    setPracticeLoading(false);
    setRestoreReady(false);

    if (!persistProgress || !progressStorageKey) {
      setRestoreReady(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(progressStorageKey);
      if (!raw) {
        setRestoreReady(true);
        return;
      }

      const parsed = JSON.parse(raw) as PersistedSessionState;
      if (parsed.version !== 2 || parsed.cardsSignature !== cardsSignature || !isSessionState(parsed.state)) {
        setRestoreReady(true);
        return;
      }

      setState(parsed.state);
      const restoredReadings = Array.isArray(parsed.practiceReadings)
        ? parsed.practiceReadings.filter(isPracticeReading).map(normalizePracticeReading)
        : [];
      setPracticeReadings(restoredReadings);
      const safeActive = Math.min(
        Math.max(Number.isFinite(parsed.activePracticeIndex) ? parsed.activePracticeIndex : 0, 0),
        Math.max(restoredReadings.length - 1, 0),
      );
      setActivePracticeIndex(safeActive);
    } catch {
      // Ignore invalid cache.
    } finally {
      setRestoreReady(true);
    }
  }, [cardsSignature, persistProgress, progressStorageKey, startImmediately]);

  useEffect(() => {
    latestRef.current = {
      state,
      practiceReadings,
      activePracticeIndex,
    };
  }, [activePracticeIndex, practiceReadings, state]);

  useEffect(() => {
    if (!persistProgress || !progressStorageKey || !restoreReady) {
      return;
    }

    const payload: PersistedSessionState = {
      version: 2,
      cardsSignature,
      state,
      practiceReadings,
      activePracticeIndex,
    };

    try {
      window.localStorage.setItem(progressStorageKey, JSON.stringify(payload));
    } catch {
      // Ignore quota failures.
    }
  }, [
    activePracticeIndex,
    cardsSignature,
    persistProgress,
    practiceReadings,
    progressStorageKey,
    restoreReady,
    state,
  ]);

  useEffect(() => {
    if (!persistProgress || !progressStorageKey || !restoreReady) {
      return;
    }

    const flush = () => {
      const latest = latestRef.current;
      if (!latest) {
        return;
      }
      const payload: PersistedSessionState = {
        version: 2,
        cardsSignature,
        state: latest.state,
        practiceReadings: latest.practiceReadings,
        activePracticeIndex: latest.activePracticeIndex,
      };
      try {
        window.localStorage.setItem(progressStorageKey, JSON.stringify(payload));
      } catch {
        // Ignore flush failures.
      }
    };

    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [cardsSignature, persistProgress, progressStorageKey, restoreReady]);

  useEffect(() => {
    if (!state.started || !current) {
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
  }, [current, currentAudioUrls, playAudio, state.started, stopAudio]);

  useEffect(() => {
    if (!current || current.id in dictInfoByCardId) {
      return;
    }

    const controller = new AbortController();
    setMeaningLoadingCardId(current.id);

    const run = async () => {
      try {
        const response = await fetch(`/api/dict/meaning?headword=${encodeURIComponent(current.text)}`, {
          method: "GET",
          signal: controller.signal,
        });

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
            [current.id]: {
              meaning: null,
              pronunciations: [],
              audioUrls: [],
            },
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

  const doneEncounter = state.encounterIndex;
  const progress = useMemo(() => {
    if (total === 0) return 0;
    if (state.phase === "ENCOUNTER") {
      return Math.round((doneEncounter / total) * 100);
    }
    if (state.phase === "POLISH") {
      return 100;
    }
    return 100;
  }, [doneEncounter, state.phase, total]);

  const summary = useMemo(() => {
    const stats = { known: 0, fuzzy: 0, unknown: 0 };
    for (const wordId of state.firstImpressionOrder) {
      const item = state.firstImpressionsByWordId[wordId];
      if (!item) continue;
      if (item.grade === 2) stats.known += 1;
      else if (item.grade === 1) stats.fuzzy += 1;
      else stats.unknown += 1;
    }
    return stats;
  }, [state.firstImpressionOrder, state.firstImpressionsByWordId]);

  const practiceCandidates = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const wordId of state.firstImpressionOrder) {
      const item = state.firstImpressionsByWordId[wordId];
      if (!item || item.grade === 2) {
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
  }, [state.firstImpressionOrder, state.firstImpressionsByWordId]);

  const gradeByReviewedWord = useMemo(() => {
    const map = new Map<string, SessionGrade>();
    for (const wordId of state.firstImpressionOrder) {
      const item = state.firstImpressionsByWordId[wordId];
      if (!item) continue;
      map.set(item.text.trim().toLowerCase(), item.grade);
    }
    return map;
  }, [state.firstImpressionOrder, state.firstImpressionsByWordId]);

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

  const startSession = () => {
    setError(null);
    setState((prev) => ({
      ...prev,
      started: true,
    }));
  };

  const continueAfterSegment = () => {
    setState((prev) => ({
      ...prev,
      segmentPause: false,
    }));
  };

  const markEncounter = (grade: SessionGrade) => {
    if (!current || state.phase !== "ENCOUNTER" || isFinishing) {
      return;
    }

    setError(null);

    const nextSeenIds = hasBeenSeenInThisRound.has(current.id)
      ? state.hasBeenSeenIds
      : [...state.hasBeenSeenIds, current.id];

    const nextFirstImpressionsByWordId = { ...state.firstImpressionsByWordId };
    const nextFirstImpressionOrder = [...state.firstImpressionOrder];

    if (!hasBeenSeenInThisRound.has(current.id)) {
      nextFirstImpressionsByWordId[current.id] = {
        wordId: current.id,
        text: current.text,
        grade,
        revealed: state.revealed,
      };
      nextFirstImpressionOrder.push(current.id);
    }

    const nextEncounterIndex = state.encounterIndex + 1;
    const finishedEncounter = nextEncounterIndex >= total;

    if (finishedEncounter) {
      const initialPolishPool = nextFirstImpressionOrder.filter((wordId) => {
        const item = nextFirstImpressionsByWordId[wordId];
        return item ? item.grade < 2 : false;
      });

      setState((prev) => ({
        ...prev,
        hasBeenSeenIds: nextSeenIds,
        firstImpressionsByWordId: nextFirstImpressionsByWordId,
        firstImpressionOrder: nextFirstImpressionOrder,
        encounterIndex: nextEncounterIndex,
        segmentPause: false,
        revealed: false,
        phase: initialPolishPool.length === 0 ? "SUMMARY" : "POLISH",
        polishPool: shuffle(initialPolishPool),
      }));
      return;
    }

    const segmentPause = nextEncounterIndex % ENCOUNTER_BATCH_SIZE === 0;

    setState((prev) => ({
      ...prev,
      hasBeenSeenIds: nextSeenIds,
      firstImpressionsByWordId: nextFirstImpressionsByWordId,
      firstImpressionOrder: nextFirstImpressionOrder,
      encounterIndex: nextEncounterIndex,
      segmentPause,
      revealed: false,
    }));
  };

  const markPolish = (grade: SessionGrade) => {
    if (!current || state.phase !== "POLISH" || isFinishing) {
      return;
    }

    setError(null);
    const currentWordId = state.polishPool[0];
    if (!currentWordId) {
      setState((prev) => ({
        ...prev,
        phase: "SUMMARY",
      }));
      return;
    }

    let nextPool = state.polishPool.slice(1);
    if (grade < 2) {
      nextPool = shuffle([...nextPool, currentWordId]);
    }

    setState((prev) => ({
      ...prev,
      polishPool: nextPool,
      phase: nextPool.length === 0 ? "SUMMARY" : "POLISH",
      revealed: false,
    }));
  };

  const markCurrent = (grade: SessionGrade) => {
    if (state.phase === "ENCOUNTER") {
      markEncounter(grade);
      return;
    }
    if (state.phase === "POLISH") {
      markPolish(grade);
    }
  };

  const updateFirstImpressionGrade = (wordId: string, grade: SessionGrade) => {
    setState((prev) => {
      const existing = prev.firstImpressionsByWordId[wordId];
      if (!existing) {
        return prev;
      }
      return {
        ...prev,
        firstImpressionsByWordId: {
          ...prev.firstImpressionsByWordId,
          [wordId]: {
            ...existing,
            grade,
          },
        },
      };
    });
  };

  const finishRound = () => {
    if (state.firstImpressionOrder.length === 0 || isFinishing) {
      return;
    }

    setError(null);
    setIsFinishing(true);

    void (async () => {
      try {
        const items = state.firstImpressionOrder
          .map((wordId) => state.firstImpressionsByWordId[wordId])
          .filter((item): item is FirstImpression => Boolean(item))
          .map((item) => ({
            wordId: item.wordId,
            isFirstTimePerfect: item.grade === 2,
            firstImpressionGrade: item.grade,
            revealed: item.revealed,
          }));

        const result = await submitReviewBatchAction({ items });
        if (!result.ok) {
          setError(result.message);
          return;
        }

        if (persistProgress && progressStorageKey) {
          try {
            window.localStorage.removeItem(progressStorageKey);
          } catch {
            // Ignore storage failures.
          }
        }

        const targetHref = `${finishHref}${finishHref.includes("?") ? "&" : "?"}done=${Date.now()}`;
        router.replace(targetHref);
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to finish round. Please try again.";
        setError(message || "Failed to finish round. Please try again.");
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
      focusWords: allFocusWords,
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
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">No cards in this round</h2>
        <p className="mt-2 text-sm text-slate-600">Change setup in Today and open session again.</p>
        <button
          className="mt-5 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          onClick={() => router.push(backHref)}
          type="button"
        >
          Back to Today
        </button>
      </section>
    );
  }

  if (!restoreReady) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Session</div>
        <div className="mt-2 text-sm text-slate-600">Restoring session progress...</div>
      </section>
    );
  }

  if (!state.started) {
    return (
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-r from-indigo-600 to-sky-500 p-8 text-white shadow-lg">
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-16 left-4 h-40 w-40 rounded-full bg-sky-300/30 blur-3xl" />
        <div className="relative space-y-6">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.24em] text-indigo-100">Study session</div>
            <h2 className="text-5xl font-bold tracking-tight">Ready to study</h2>
            <p className="max-w-2xl text-sm text-indigo-100">
              One card at a time. Encounter all words first, then polish fuzzy and unknown words.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/30 bg-white/15 p-4 backdrop-blur">
              <div className="text-xs uppercase tracking-wide text-indigo-100">Cards</div>
              <div className="mt-2 text-4xl font-bold tracking-tight">{total}</div>
            </div>
            <div className="rounded-2xl border border-white/30 bg-white/15 p-4 backdrop-blur">
              <div className="text-xs uppercase tracking-wide text-indigo-100">Priority</div>
              <div className="mt-2 text-4xl font-bold tracking-tight">
                {cards.filter((card) => card.isPriority).length}
              </div>
            </div>
            <div className="rounded-2xl border border-white/30 bg-white/15 p-4 backdrop-blur">
              <div className="text-xs uppercase tracking-wide text-indigo-100">Mode</div>
              <div className="mt-2 text-4xl font-bold tracking-tight">Focus</div>
            </div>
          </div>

          <button
            className="inline-flex items-center justify-center rounded-2xl bg-white px-7 py-3 text-lg font-semibold text-indigo-700 transition hover:bg-indigo-50 active:scale-[0.99]"
            onClick={startSession}
            type="button"
          >
            Start session ({total})
          </button>
        </div>
      </section>
    );
  }

  if (state.phase === "SUMMARY") {
    return (
      <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Round complete</div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">{roundLabel}</h2>
          <p className="text-sm text-slate-600">
            First-impression results are locked for mastery logic. You can adjust before finish.
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
          {state.firstImpressionOrder.map((wordId) => {
            const item = state.firstImpressionsByWordId[wordId];
            if (!item) {
              return null;
            }
            return (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
                key={wordId}
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
                    onClick={() => updateFirstImpressionGrade(wordId, 2)}
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
                    onClick={() => updateFirstImpressionGrade(wordId, 1)}
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
                    onClick={() => updateFirstImpressionGrade(wordId, 0)}
                    type="button"
                  >
                    Unknown
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={isFinishing || state.firstImpressionOrder.length === 0}
            onClick={finishRound}
            type="button"
          >
            {isFinishing ? "Finishing..." : "Finish Round"}
          </button>
          <button
            className="rounded-2xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={() => router.push(backHref)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-2xl border border-indigo-300 bg-white px-5 py-2.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
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
                {activePracticeReading.prompts.map((prompt, idx) => (
                  <li key={`${prompt}-${idx}`}>{prompt}</li>
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

  if (state.phase === "ENCOUNTER" && state.segmentPause) {
    const segmentIndex = Math.floor(state.encounterIndex / ENCOUNTER_BATCH_SIZE);
    const totalSegments = Math.max(1, Math.ceil(total / ENCOUNTER_BATCH_SIZE));
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Encounter checkpoint</div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Segment {segmentIndex} / {totalSegments} complete
          </h2>
          <p className="text-sm text-slate-600">Continue to the next segment of this round.</p>
        </div>
        <button
          className="mt-5 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
          onClick={continueAfterSegment}
          type="button"
        >
          Continue next segment
        </button>
      </section>
    );
  }

  const subtitle =
    state.phase === "ENCOUNTER"
      ? `Encounter ${Math.min(state.encounterIndex + 1, total)} / ${total}`
      : `Polish pool remaining: ${state.polishPool.length}`;

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-50 via-sky-50 to-cyan-50 p-6 shadow-sm md:p-8">
      <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="relative space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{roundLabel}</div>
            <div className="mt-1 text-sm font-medium text-slate-700">{subtitle}</div>
          </div>
          <div className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700">
            {state.phase === "ENCOUNTER" ? "Encounter" : "Polish"}
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white/90">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div
          className="group w-full rounded-[2rem] border border-slate-200 bg-white p-8 text-left shadow-md transition hover:-translate-y-0.5 hover:shadow-lg md:p-12"
          onClick={() => setState((prev) => ({ ...prev, revealed: !prev.revealed }))}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setState((prev) => ({ ...prev, revealed: !prev.revealed }));
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
            {state.revealed ? "Answer" : "Term"}
          </div>
          <div className="mt-5 flex items-center gap-4">
            <span className="text-5xl font-bold tracking-tight text-slate-900 md:text-6xl">
              {current?.text}
            </span>
            <button
              aria-label="Pronounce word"
              className={`shrink-0 rounded-full p-2 transition ${speaking ? "text-sky-500" : "text-slate-400 hover:text-slate-600"}`}
              onClick={(event) => {
                event.stopPropagation();
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

          {state.revealed ? (
            <>
              <div className="mt-10 text-xs uppercase tracking-[0.22em] text-slate-500">Meaning</div>
              <div className="mt-3 text-2xl leading-relaxed text-slate-800">
                {displayedMeaning || "No meaning yet. Add manual meaning in Library."}
              </div>
              <div className="mt-5">
                <button
                  className="rounded-2xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
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

        <div className="grid gap-2 sm:grid-cols-3">
          <button
            className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            disabled={isFinishing}
            onClick={() => markCurrent(2)}
            type="button"
          >
            Known
          </button>
          <button
            className="rounded-2xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
            disabled={isFinishing}
            onClick={() => markCurrent(1)}
            type="button"
          >
            Fuzzy
          </button>
          <button
            className="rounded-2xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
            disabled={isFinishing}
            onClick={() => markCurrent(0)}
            type="button"
          >
            Unknown
          </button>
        </div>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>

      {showYouglish ? <YouglishModal headword={currentHeadword} onClose={() => setShowYouglish(false)} /> : null}
    </section>
  );
}
