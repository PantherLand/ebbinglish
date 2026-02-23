"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DictionaryEntryPanel, {
  type DictionaryEntryData,
} from "@/app/components/dictionary-entry-panel";
import { createWordAction, type CreateWordState } from "./actions";

type DictSuggestItem = {
  headword: string;
  score: number;
};

type DictMeaningPayload = {
  headword?: string;
  meaning?: string | null;
  pos?: string | null;
  pronunciations?: string[];
  posBlocks?: DictionaryEntryData["posBlocks"];
  senses?: DictionaryEntryData["senses"];
  idioms?: DictionaryEntryData["idioms"];
  fallbackText?: string | null;
  disabled?: boolean;
  error?: string;
};

const initialState: CreateWordState = {
  status: "idle",
};

export default function AddWordForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const suggestAbortRef = useRef<AbortController | null>(null);
  const checkAbortRef = useRef<AbortController | null>(null);
  const [state, formAction, pending] = useActionState(
    createWordAction,
    initialState,
  );

  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [selectedHeadword, setSelectedHeadword] = useState("");
  const [entryDetail, setEntryDetail] = useState<DictionaryEntryData | null>(null);

  const [suggestions, setSuggestions] = useState<DictSuggestItem[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [fillingMeaning, setFillingMeaning] = useState(false);

  const [dictDisabled, setDictDisabled] = useState(false);
  const [dictError, setDictError] = useState<string | null>(null);
  const [meaningHint, setMeaningHint] = useState<string | null>(null);
  const [alreadyAdded, setAlreadyAdded] = useState(false);
  const [checkingAdded, setCheckingAdded] = useState(false);
  const [inputCommitted, setInputCommitted] = useState(false);
  const [manualMeaningMode, setManualMeaningMode] = useState(false);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setText("");
      setNote("");
      setSelectedHeadword("");
      setEntryDetail(null);
      setSuggestions([]);
      setMeaningHint(null);
      setDictError(null);
      setAlreadyAdded(false);
      setCheckingAdded(false);
      setInputCommitted(false);
      setManualMeaningMode(false);
      router.refresh();
    }
  }, [router, state.status]);

  useEffect(() => {
    const q = text.trim();

    if (q.length < 2 || inputCommitted) {
      suggestAbortRef.current?.abort();
      setSuggestions([]);
      setSuggesting(false);
      return;
    }

    const timer = setTimeout(async () => {
      suggestAbortRef.current?.abort();
      const controller = new AbortController();
      suggestAbortRef.current = controller;

      setSuggesting(true);
      setDictError(null);

      try {
        const response = await fetch(
          `/api/dict/suggest?q=${encodeURIComponent(q)}&limit=8`,
          {
            method: "GET",
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as {
          items?: DictSuggestItem[];
          disabled?: boolean;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Suggestion request failed");
        }

        if (payload.disabled) {
          setDictDisabled(true);
          setSuggestions([]);
          return;
        }

        setDictDisabled(false);

        const unique = new Map<string, DictSuggestItem>();
        for (const item of payload.items ?? []) {
          const normalized = item.headword.trim().toLowerCase();
          if (!normalized) {
            continue;
          }
          const existing = unique.get(normalized);
          if (!existing || item.score > existing.score) {
            unique.set(normalized, item);
          }
        }

        setSuggestions(Array.from(unique.values()));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSuggestions([]);
        setDictError(error instanceof Error ? error.message : "Failed to search word");
      } finally {
        setSuggesting(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      suggestAbortRef.current?.abort();
    };
  }, [inputCommitted, text]);

  const handleWordInput = (value: string) => {
    setText(value);
    setSelectedHeadword("");
    setNote("");
    setEntryDetail(null);
    setMeaningHint(null);
    setAlreadyAdded(false);
    setInputCommitted(false);
    setManualMeaningMode(false);
  };

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
          {
            method: "GET",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          setAlreadyAdded(false);
          return;
        }

        const payload = (await response.json()) as { exists?: boolean };
        setAlreadyAdded(Boolean(payload.exists));
      } catch {
        if (!controller.signal.aborted) {
          setAlreadyAdded(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setCheckingAdded(false);
        }
      }
    }, 240);

    return () => clearTimeout(timer);
  }, [text]);

  const selectHeadword = async (
    headword: string,
    options?: { preserveInputText?: boolean; commitInput?: boolean },
  ) => {
    const query = headword.trim();
    if (!query) {
      return;
    }

    if (options?.commitInput) {
      suggestAbortRef.current?.abort();
      setInputCommitted(true);
      setSuggestions([]);
      setSuggesting(false);
    }

    setFillingMeaning(true);
    setDictError(null);
    setMeaningHint(null);
    setManualMeaningMode(false);

    try {
      const response = await fetch(
        `/api/dict/meaning?headword=${encodeURIComponent(query)}`,
        { method: "GET" },
      );

      const payload = (await response.json()) as DictMeaningPayload;

      if (!response.ok) {
        throw new Error(payload.error || "Meaning request failed");
      }

      if (payload.disabled) {
        setDictDisabled(true);
        setMeaningHint("Dictionary API is not configured yet");
        return;
      }

      setDictDisabled(false);

      const normalizedHeadword = payload.headword?.trim() || query;
      const meaning = payload.meaning?.trim() || "";
      const finalText = options?.preserveInputText ? query : normalizedHeadword;
      const hasStructuredContent =
        (payload.posBlocks?.length ?? 0) > 0 ||
        (payload.senses?.length ?? 0) > 0 ||
        (payload.idioms?.length ?? 0) > 0 ||
        Boolean(payload.fallbackText?.trim());
      const foundFromDict = Boolean(meaning) || hasStructuredContent;

      if (!foundFromDict && options?.commitInput) {
        setText(query);
        setSelectedHeadword(query);
        setNote("");
        setSuggestions([]);
        setInputCommitted(true);
        setEntryDetail(null);
        setManualMeaningMode(true);
        setMeaningHint("无该单词释义，可由用户自行输入meaning");
        return;
      }

      setText(finalText);
      setSelectedHeadword(finalText);
      setNote("");
      setManualMeaningMode(false);
      setSuggestions([]);
      setInputCommitted(Boolean(options?.commitInput));
      setEntryDetail({
        headword: normalizedHeadword,
        meaning: payload.meaning || null,
        pos: payload.pos || null,
        pronunciations: payload.pronunciations ?? [],
        posBlocks: payload.posBlocks ?? [],
        senses: payload.senses ?? [],
        idioms: payload.idioms ?? [],
        fallbackText: payload.fallbackText || null,
      });

      setMeaningHint(
        foundFromDict
          ? `已获取字典释义：${normalizedHeadword}（加入时不单独存储释义）`
          : "未找到明确释义，加入后可在详情页补充",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch meaning";

      if (
        options?.commitInput &&
        /(404|not found|no entry|no match|不存在|未找到|找不到)/i.test(message)
      ) {
        setText(query);
        setSelectedHeadword(query);
        setNote("");
        setSuggestions([]);
        setInputCommitted(true);
        setEntryDetail(null);
        setManualMeaningMode(true);
        setMeaningHint("无该单词释义，可由用户自行输入meaning");
        setDictError(null);
      } else {
        setDictError(message);
      }
    } finally {
      setFillingMeaning(false);
    }
  };

  const canSubmit =
    Boolean(text.trim()) &&
    !pending &&
    !fillingMeaning &&
    !alreadyAdded &&
    (dictDisabled || Boolean(selectedHeadword));

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-xl border border-slate-300 bg-white p-5 shadow-sm"
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
              if (!text.trim() || fillingMeaning) {
                return;
              }
              suggestAbortRef.current?.abort();
              setInputCommitted(true);
              setSuggestions([]);
              setSuggesting(false);
              void selectHeadword(text, {
                preserveInputText: true,
                commitInput: true,
              });
            }
          }}
          placeholder="输入单词，例如 available"
          required
          maxLength={100}
          value={text}
        />
        <p className="text-xs text-slate-500">
          输入后按 Enter：将按你的输入精确查询，并隐藏模糊候选。
        </p>
      </label>

      <input name="language" type="hidden" value="en" />
      <input name="note" type="hidden" value={note} />

      {suggesting ? <p className="text-xs text-gray-500">正在搜索候选词...</p> : null}

      {suggestions.length > 0 && !inputCommitted ? (
        <ul className="max-h-44 divide-y overflow-auto rounded-md border border-slate-300 bg-white text-sm shadow-sm">
          {suggestions.map((item) => (
            <li key={item.headword}>
              <button
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                onClick={() =>
                  void selectHeadword(item.headword, {
                    preserveInputText: false,
                    commitInput: true,
                  })
                }
                type="button"
              >
                <span>{item.headword}</span>
                <span className="text-xs text-gray-500">{item.score.toFixed(2)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {fillingMeaning ? <p className="text-xs text-gray-500">正在获取释义...</p> : null}

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
            placeholder="无该单词释义，可由用户自行输入meaning"
            value={note}
          />
        </label>
      ) : null}

      {meaningHint ? <p className="text-xs text-gray-600">{meaningHint}</p> : null}
      {dictError ? <p className="text-xs text-red-700">{dictError}</p> : null}
      {checkingAdded ? <p className="text-xs text-gray-500">检查是否已加入...</p> : null}
      {alreadyAdded ? (
        <p className="text-xs text-amber-700">该单词已在你的背诵 cards 中。</p>
      ) : null}
      {dictDisabled ? (
        <p className="text-xs text-amber-700">
          Dictionary API disabled. Set `DICT_BACK_API` in `.env` first.
        </p>
      ) : null}
      {!dictDisabled && text.trim() && !selectedHeadword ? (
        <p className="text-xs text-gray-500">
          请选择候选词，或按 Enter 以当前输入词直接查询后再加入。
        </p>
      ) : null}

      <button
        className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!canSubmit}
        type="submit"
      >
        {pending ? "Adding..." : alreadyAdded ? "已加入" : "加入背诵 cards"}
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
