"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRoundAction } from "@/app/app/study-actions";

type BuilderWord = {
  id: string;
  text: string;
  note: string | null;
  manualCategory: string | null;
  isPriority: boolean;
  status: "new" | "seen" | "fuzzy" | "unknown" | "mastered" | "frozen";
};

type FilterMode = "all" | "new" | "seen";
type PriorityFilterMode = "all" | "priority" | "normal";

function statusChipClass(status: BuilderWord["status"]): string {
  if (status === "new") return "bg-blue-100 text-blue-700";
  if (status === "seen") return "bg-emerald-100 text-emerald-700";
  if (status === "fuzzy") return "bg-amber-100 text-amber-700";
  if (status === "unknown") return "bg-rose-100 text-rose-700";
  if (status === "frozen") return "bg-indigo-100 text-indigo-700";
  return "bg-slate-100 text-slate-700";
}

function parseTags(category: string | null): string[] {
  if (!category) {
    return [];
  }
  return Array.from(
    new Set(
      category
        .split(/[|,/]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export default function RoundBuilderClient({ words }: { words: BuilderWord[] }) {
  const router = useRouter();
  const [name, setName] = useState(`Round ${new Date().toISOString().slice(0, 10)}`);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("new");
  const [priorityFilterMode, setPriorityFilterMode] = useState<PriorityFilterMode>("all");
  const [selectedTag, setSelectedTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tagOptions = useMemo(
    () =>
      Array.from(
        new Set(
          words
            .flatMap((word) => parseTags(word.manualCategory))
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [words],
  );
  const activeTag = tagOptions.includes(selectedTag) ? selectedTag : "";

  const availableWords = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return words.filter((word) => {
      const wordTags = parseTags(word.manualCategory);
      if (filterMode === "new" && word.status !== "new") {
        return false;
      }
      if (
        filterMode === "seen" &&
        (word.status === "new" || word.status === "mastered")
      ) {
        return false;
      }
      if (priorityFilterMode === "priority" && !word.isPriority) {
        return false;
      }
      if (priorityFilterMode === "normal" && word.isPriority) {
        return false;
      }
      if (activeTag && !wordTags.includes(activeTag)) {
        return false;
      }
      if (
        keyword &&
        !word.text.toLowerCase().includes(keyword) &&
        !wordTags.some((tag) => tag.toLowerCase().includes(keyword))
      ) {
        return false;
      }
      return true;
    });
  }, [activeTag, filterMode, priorityFilterMode, searchTerm, words]);

  const allVisibleSelected =
    availableWords.length > 0 &&
    availableWords.every((word) => selectedWordIds.includes(word.id));

  function toggleWord(id: string) {
    setSelectedWordIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function clearVisibleSelection() {
    const visibleIds = new Set(availableWords.map((word) => word.id));
    setSelectedWordIds((prev) => prev.filter((id) => !visibleIds.has(id)));
  }

  function toggleSelectAllVisible(checked: boolean) {
    if (checked) {
      setSelectedWordIds((prev) => {
        const next = new Set(prev);
        for (const word of availableWords) {
          next.add(word.id);
        }
        return [...next];
      });
      return;
    }
    clearVisibleSelection();
  }

  function handleCreate() {
    if (pending || selectedWordIds.length === 0) {
      return;
    }
    setError(null);
    startTransition(() => {
      void (async () => {
        const result = await createRoundAction({
          name: name.trim() || `Round ${new Date().toISOString().slice(0, 10)}`,
          wordIds: selectedWordIds,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        router.push(`/app/rounds/${result.data.roundId}`);
      })();
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <Link className="mb-2 inline-flex text-sm text-slate-500 transition hover:text-slate-800" href="/app/rounds">
          ← Back
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create New Round</h1>
        <p className="text-sm text-slate-500">Select words to focus on in this learning cycle.</p>
      </header>

      <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="round-name">
            Round name
          </label>
          <input
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            id="round-name"
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Weekly Vocabulary"
            value={name}
          />
        </div>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Select Words ({selectedWordIds.length})</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="w-52 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search..."
                value={searchTerm}
              />
              <select
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                onChange={(event) => setFilterMode(event.target.value as FilterMode)}
                value={filterMode}
              >
                <option value="all">All Available</option>
                <option value="new">New Only</option>
                <option value="seen">Seen / Learning</option>
              </select>
              <select
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                onChange={(event) => setSelectedTag(event.target.value)}
                value={activeTag}
              >
                <option value="">All Tags</option>
                {tagOptions.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                onChange={(event) => setPriorityFilterMode(event.target.value as PriorityFilterMode)}
                value={priorityFilterMode}
              >
                <option value="all">All Priority</option>
                <option value="priority">Priority Only</option>
                <option value="normal">Normal Only</option>
              </select>
            </div>
          </div>

          <div className="max-h-[440px] overflow-y-auto rounded-xl border border-slate-200">
            {availableWords.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No words found matching your filters.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <input
                        checked={allVisibleSelected}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        onChange={(event) => toggleSelectAllVisible(event.target.checked)}
                        type="checkbox"
                      />
                    </th>
                    <th className="px-4 py-3">Word</th>
                    <th className="px-4 py-3">Tags</th>
                    <th className="w-32 px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {availableWords.map((word) => {
                    const selected = selectedWordIds.includes(word.id);
                    const tags = parseTags(word.manualCategory);
                    return (
                      <tr
                        className={`cursor-pointer transition hover:bg-slate-50 ${selected ? "bg-indigo-50/40" : ""}`}
                        key={word.id}
                        onClick={() => toggleWord(word.id)}
                      >
                        <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          <input
                            checked={selected}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            onChange={() => toggleWord(word.id)}
                            type="checkbox"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{word.text}</td>
                        <td className="max-w-[280px] px-4 py-3 text-slate-500">
                          {tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {tags.map((tag) => (
                                <span
                                  className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                                  key={`${word.id}-${tag}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusChipClass(word.status)}`}>
                            {word.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{selectedWordIds.length} words selected</span>
            {selectedWordIds.length > 0 ? (
              <button
                className="inline-flex items-center gap-1 font-medium text-rose-600 transition hover:text-rose-700"
                onClick={() => setSelectedWordIds([])}
                type="button"
              >
                <svg
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.9"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4.8c0-.95 0-1.43.18-1.79.16-.31.41-.56.72-.72C9.27 2 9.74 2 10.7 2h2.6c.96 0 1.43 0 1.8.28.3.16.56.41.72.72.18.36.18.84.18 1.79V6" />
                  <path d="M6 6l.64 12.13c.05 1 .08 1.5.3 1.87.2.33.5.59.86.75.4.17.9.17 1.9.17h4.6c1 0 1.5 0 1.9-.17.36-.16.66-.42.86-.75.22-.37.25-.87.3-1.87L18 6" />
                  <path d="M10 10.5v6" />
                  <path d="M14 10.5v6" />
                </svg>
                Clear Selection
              </button>
            ) : null}
          </div>
        </div>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <Link
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            href="/app/rounds"
          >
            Cancel
          </Link>
          <button
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedWordIds.length === 0 || pending}
            onClick={handleCreate}
            type="button"
          >
            {pending ? "Creating..." : "Create Round"}
          </button>
        </div>
      </section>
    </div>
  );
}
