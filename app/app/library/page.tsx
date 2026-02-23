import Link from "next/link";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import AddWordForm from "./add-word-form";
import { DeleteWordButton } from "./delete-word-button";
import { togglePriorityFromListAction } from "./actions";

type PriorityFilter = "all" | "priority" | "normal";
type TagFilter = "all" | "uncategorized" | string;

function parsePriorityFilter(value?: string): PriorityFilter {
  if (value === "priority" || value === "normal") {
    return value;
  }
  return "all";
}

function normalizeCategory(value: string): string {
  return value.trim().toLowerCase();
}

const PAGE_SIZE = 20;

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

type LibraryPageProps = {
  searchParams: Promise<{
    priority?: string;
    tag?: string;
    page?: string;
  }>;
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const { priority, tag, page } = await searchParams;
  const selectedPriority = parsePriorityFilter(priority);
  const currentPage = parsePage(page);
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-sm text-red-700">Please sign in to use your library.</p>
      </div>
    );
  }

  const userWithWords = await prisma.user.findUnique({
    where: { email },
    select: {
      words: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const words = userWithWords?.words ?? [];
  const categoryMap = new Map<string, string>();
  for (const word of words) {
    const category = word.manualCategory?.trim();
    if (!category) {
      continue;
    }
    const normalized = normalizeCategory(category);
    if (!categoryMap.has(normalized)) {
      categoryMap.set(normalized, category);
    }
  }

  const availableCategories = [...categoryMap.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const rawTag = tag?.trim().toLowerCase();
  const selectedTag: TagFilter =
    rawTag === "uncategorized" ||
    (rawTag && availableCategories.some((item) => item.key === rawTag))
      ? rawTag
      : "all";

  const filteredWords = words.filter((word) => {
    const matchesPriority =
      selectedPriority === "all" ||
      (selectedPriority === "priority" ? word.isPriority : !word.isPriority);

    if (!matchesPriority) {
      return false;
    }

    if (selectedTag === "all") {
      return true;
    }

    const category = word.manualCategory?.trim();
    if (selectedTag === "uncategorized") {
      return !category;
    }

    return normalizeCategory(category ?? "") === selectedTag;
  });

  const totalPages = Math.max(1, Math.ceil(filteredWords.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageWords = filteredWords.slice(pageStart, pageStart + PAGE_SIZE);

  const buildFilterHref = (nextPriority: PriorityFilter, nextTag: TagFilter) => {
    const params = new URLSearchParams();
    if (nextPriority !== "all") params.set("priority", nextPriority);
    if (nextTag !== "all") params.set("tag", nextTag);
    // Reset to page 1 when filter changes
    const query = params.toString();
    return query ? `/app/library?${query}` : "/app/library";
  };

  const buildPageHref = (p: number) => {
    const params = new URLSearchParams();
    if (selectedPriority !== "all") params.set("priority", selectedPriority);
    if (selectedTag !== "all") params.set("tag", selectedTag);
    if (p > 1) params.set("page", String(p));
    const query = params.toString();
    return query ? `/app/library?${query}` : "/app/library";
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-sm text-gray-600">
          Add new word cards and keep your personal vocabulary list.
        </p>
      </div>

      <AddWordForm />

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Your cards</h2>
          <span className="text-sm text-gray-600">
            {filteredWords.length} / {words.length} words
          </span>
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Priority
            </span>
            {[
              { key: "all" as const, label: "All" },
              { key: "priority" as const, label: "Priority" },
              { key: "normal" as const, label: "Non-priority" },
            ].map((item) => {
              const isActive = selectedPriority === item.key;
              return (
                <Link
                  key={`priority-${item.key}`}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                  href={buildFilterHref(item.key, selectedTag)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tags
            </span>
            {[
              { key: "all" as const, label: "All tags" },
              { key: "uncategorized" as const, label: "Uncategorized" },
              ...availableCategories,
            ].map((item) => {
              const isActive = selectedTag === item.key;
              return (
                <Link
                  key={`tag-${item.key}`}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                  href={buildFilterHref(selectedPriority, item.key)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {words.length === 0 ? (
          <p className="text-sm text-gray-600">
            No cards yet. Add your first word above.
          </p>
        ) : filteredWords.length === 0 ? (
          <p className="text-sm text-gray-600">
            No cards match current filters.
          </p>
        ) : (
          <>
          <ul className="divide-y">
            {pageWords.map((word) => (
              <li key={word.id} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="space-y-1">
                    <Link className="font-medium underline" href={`/app/library/${word.id}`}>
                      {word.text}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1">
                      {word.isPriority ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          Priority
                        </span>
                      ) : null}
                      {word.manualCategory ? (
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                          {word.manualCategory}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <form action={togglePriorityFromListAction}>
                      <input name="wordId" type="hidden" value={word.id} />
                      <input
                        name="nextPriority"
                        type="hidden"
                        value={word.isPriority ? "false" : "true"}
                      />
                      <button
                        aria-label={word.isPriority ? "Remove priority" : "Add priority"}
                        className={`rounded p-1.5 transition ${
                          word.isPriority
                            ? "text-amber-600 hover:bg-amber-50"
                            : "text-gray-500 hover:bg-gray-100 hover:text-amber-600"
                        }`}
                        title={word.isPriority ? "Remove priority" : "Add priority"}
                        type="submit"
                      >
                        <svg
                          aria-hidden="true"
                          className="h-4 w-4"
                          fill={word.isPriority ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="1.8"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M11.05 2.93c.3-.92 1.6-.92 1.9 0l1.2 3.7a1 1 0 00.95.69h3.89c.97 0 1.37 1.24.59 1.81l-3.15 2.29a1 1 0 00-.37 1.12l1.2 3.7c.3.92-.76 1.68-1.54 1.12l-3.15-2.29a1 1 0 00-1.18 0l-3.15 2.29c-.78.56-1.84-.2-1.54-1.12l1.2-3.7a1 1 0 00-.37-1.12L3.47 9.13c-.78-.57-.38-1.81.59-1.81h3.89a1 1 0 00.95-.69l1.2-3.7z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </form>

                    <DeleteWordButton wordId={word.id} wordText={word.text} />

                    <Link
                      className="rounded border px-2 py-1 text-xs text-gray-700"
                      href={`/app/library/${word.id}`}
                    >
                      Details
                    </Link>
                  </div>
                </div>
                {word.note ? (
                  <p className="mt-1 text-sm text-gray-600">{word.note}</p>
                ) : null}
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
              <span className="text-xs text-slate-500">
                Page {safePage} / {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Link
                  aria-disabled={safePage <= 1}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    safePage <= 1
                      ? "pointer-events-none border-slate-200 text-slate-300"
                      : "border-slate-300 text-slate-700 hover:bg-slate-100"
                  }`}
                  href={buildPageHref(safePage - 1)}
                >
                  Prev
                </Link>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "…" ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-slate-400">
                        …
                      </span>
                    ) : (
                      <Link
                        key={item}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          item === safePage
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 text-slate-700 hover:bg-slate-100"
                        }`}
                        href={buildPageHref(item)}
                      >
                        {item}
                      </Link>
                    ),
                  )}
                <Link
                  aria-disabled={safePage >= totalPages}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    safePage >= totalPages
                      ? "pointer-events-none border-slate-200 text-slate-300"
                      : "border-slate-300 text-slate-700 hover:bg-slate-100"
                  }`}
                  href={buildPageHref(safePage + 1)}
                >
                  Next
                </Link>
              </div>
            </div>
          ) : null}
          </>
        )}
      </section>
    </div>
  );
}
