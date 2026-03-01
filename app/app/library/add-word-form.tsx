"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DictionaryEntryPanel, {
  type DictionaryEntryData,
} from "@/app/components/dictionary-entry-panel";
import { createWordAction, type CreateWordState } from "./actions";

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

const initialState: CreateWordState = { status: "idle" };

type AddWordFormProps = { className?: string };

export default function AddWordForm({ className }: AddWordFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const checkAbortRef = useRef<AbortController | null>(null);
  const [state, formAction, pending] = useActionState(createWordAction, initialState);

  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [entryJsonStr, setEntryJsonStr] = useState("");
  const [selectedHeadword, setSelectedHeadword] = useState("");
  const [entryDetail, setEntryDetail] = useState<DictionaryEntryData | null>(null);
  const [fillingMeaning, setFillingMeaning] = useState(false);
  const [dictDisabled, setDictDisabled] = useState(false);
  const [dictError, setDictError] = useState<string | null>(null);
  const [meaningHint, setMeaningHint] = useState<string | null>(null);
  const [alreadyAdded, setAlreadyAdded] = useState(false);
  const [checkingAdded, setCheckingAdded] = useState(false);
  const [manualMeaningMode, setManualMeaningMode] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    setEntryJsonStr(entryDetail ? JSON.stringify(entryDetail) : "");
  }, [entryDetail]);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setJustAdded(true);
      setText("");
      setNote("");
      setEntryJsonStr("");
      setSelectedHeadword("");
      setEntryDetail(null);
      setMeaningHint(null);
      setDictError(null);
      setAlreadyAdded(false);
      setCheckingAdded(false);
      setManualMeaningMode(false);
      router.refresh();
    }
  }, [router, state.status]);

  const handleWordInput = (value: string) => {
    setText(value);
    setJustAdded(false);
    setSelectedHeadword("");
    setNote("");
    setEntryDetail(null);
    setMeaningHint(null);
    setDictError(null);
    setAlreadyAdded(false);
    setManualMeaningMode(false);
  };

  // Duplicate-check effect
  useEffect(() => {
    const q = text.trim();
    if (!q) {
      setAlreadyAdded(false);
      setCheckingAdded(false);
      return;
    }

    const timer = setTimeout(async () => {
      checkAbortRef.current?.abort();
      const controller = new AbortController();
      checkAbortRef.current = controller;
      setCheckingAdded(true);
      try {
        const response = await fetch(
          `/api/library/check?text=${encodeURIComponent(q)}&language=en`,
          { method: "GET", signal: controller.signal },
        );
        if (!response.ok) { setAlreadyAdded(false); return; }
        const payload = (await response.json()) as { exists?: boolean };
        setAlreadyAdded(Boolean(payload.exists));
      } catch {
        if (!controller.signal.aborted) setAlreadyAdded(false);
      } finally {
        if (!controller.signal.aborted) setCheckingAdded(false);
      }
    }, 240);

    return () => clearTimeout(timer);
  }, [text]);

  const fetchMeaning = async (headword: string) => {
    const query = headword.trim();
    if (!query) return;

    setFillingMeaning(true);
    setJustAdded(false);
    setDictError(null);
    setMeaningHint(null);
    setManualMeaningMode(false);
    setEntryDetail(null);
    setSelectedHeadword("");

    try {
      const response = await fetch(
        `/api/dict/meaning?headword=${encodeURIComponent(query)}`,
        { method: "GET" },
      );

      const payload = (await response.json()) as DictMeaningPayload;

      if (!response.ok) {
        throw new Error(payload.error || `AI lookup failed (${response.status})`);
      }

      if (payload.disabled) {
        setDictDisabled(true);
        setText(query);
        setSelectedHeadword(query);
        setManualMeaningMode(true);
        return;
      }

      setDictDisabled(false);

      const normalizedHeadword = payload.headword?.trim() || query;
      const hasStructuredContent =
        (payload.posBlocks?.length ?? 0) > 0 ||
        (payload.senses?.length ?? 0) > 0 ||
        (payload.idioms?.length ?? 0) > 0 ||
        Boolean(payload.fallbackText?.trim());
      const foundFromDict = Boolean(payload.meaning?.trim()) || hasStructuredContent;

      setText(normalizedHeadword);
      setSelectedHeadword(normalizedHeadword);
      setNote("");

      if (!foundFromDict) {
        setManualMeaningMode(true);
        setMeaningHint("AI 未找到释义，请手动输入 meaning");
        return;
      }

      setEntryDetail({
        headword: normalizedHeadword,
        meaning: payload.meaning || null,
        pos: payload.pos || null,
        pronunciations: payload.pronunciations ?? [],
        audioUrls: payload.audioUrls ?? [],
        posBlocks: payload.posBlocks ?? [],
        senses: payload.senses ?? [],
        idioms: payload.idioms ?? [],
        fallbackText: payload.fallbackText || null,
      });
      setMeaningHint(`已获取 AI 释义：${normalizedHeadword}（释义将随单词一同存储）`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch meaning";
      // Show the error and fall back to manual mode so the user can still add the word
      setDictError(message);
      setText(query);
      setSelectedHeadword(query);
      setManualMeaningMode(true);
      setMeaningHint("AI 释义获取失败，可手动输入 meaning");
    } finally {
      setFillingMeaning(false);
    }
  };

  const canSubmit =
    Boolean(text.trim()) &&
    !pending &&
    !fillingMeaning &&
    !alreadyAdded &&
    !justAdded &&
    Boolean(selectedHeadword);
  const submitLabel = pending ? "Adding..." : alreadyAdded || justAdded ? "Added" : "Add to list";

  return (
    <form
      ref={formRef}
      action={formAction}
      className={`space-y-4 rounded-xl border border-slate-300 bg-white p-5 shadow-sm ${className ?? ""}`}
    >
      <h2 className="text-base font-semibold">Add a new word card</h2>

      <label className="block space-y-1 text-sm">
        <span className="text-gray-700">Word</span>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-slate-600 focus:outline-none"
          name="text"
          onChange={(event) => handleWordInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (!text.trim() || fillingMeaning) return;
              void fetchMeaning(text);
            }
          }}
          placeholder="输入单词，例如 available"
          required
          maxLength={100}
          value={text}
        />
        <p className="text-xs text-slate-500">按 Enter 查询 AI 释义后再加入</p>
      </label>

      <input name="language" type="hidden" value="en" />
      <input name="note" type="hidden" value={note} />
      <input name="entryJson" type="hidden" value={entryJsonStr} />

      {fillingMeaning ? (
        <p className="text-xs text-gray-500">正在获取 AI 释义...</p>
      ) : null}

      {entryDetail ? (
        <DictionaryEntryPanel
          entry={entryDetail}
          emptyText="（暂无详细字典内容）"
          title="Dictionary entry"
        />
      ) : null}

      {manualMeaningMode ? (
        <label className="block space-y-1 text-sm">
          <span className="text-gray-700">Meaning (manual)</span>
          <textarea
            className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-600 focus:outline-none"
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="请输入单词释义"
            value={note}
          />
        </label>
      ) : null}

      {meaningHint && !dictError ? (
        <p className="text-xs text-gray-600">{meaningHint}</p>
      ) : null}
      {dictError ? <p className="text-xs text-red-700">{dictError}</p> : null}
      {checkingAdded ? (
        <p className="text-xs text-gray-500">检查是否已加入...</p>
      ) : null}
      {alreadyAdded ? (
        <p className="text-xs text-amber-700">该单词已在你的背诵 cards 中。</p>
      ) : null}
      {dictDisabled ? (
        <p className="text-xs text-amber-700">
          AI lookup is not configured. Set OPENROUTER_API_KEY in .env to enable automatic definitions.
        </p>
      ) : null}
      {!selectedHeadword && !fillingMeaning && text.trim() ? (
        <p className="text-xs text-gray-500">按 Enter 查询 AI 释义后再加入。</p>
      ) : null}

      <button
        className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!canSubmit}
        type="submit"
      >
        {submitLabel}
      </button>

      {state.status !== "idle" ? (
        <p
          className={`text-sm ${
            state.status === "success" ? "text-green-700" : "text-red-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
