import Link from "next/link";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";
import { loadWordsWithStatus } from "@/src/study-queries";
import { DeleteWordButton } from "./delete-word-button";
import AddWordModalTrigger from "./add-word-modal-trigger";
import LibraryFilters from "./library-filters";
import LibraryRefreshButton from "./library-refresh-button";
import { togglePriorityFromListAction } from "./actions";

type StatusFilter =
  | "all"
  | "new"
  | "seen"
  | "fuzzy"
  | "unknown"
  | "mastered"
  | "frozen"
  | "priority"
  | "normal";

function parseStatusFilter(value?: string): StatusFilter {
  if (
    value === "new" ||
    value === "seen" ||
    value === "fuzzy" ||
    value === "unknown" ||
    value === "mastered" ||
    value === "frozen" ||
    value === "priority" ||
    value === "normal"
  ) {
    return value;
  }
  return "all";
}

function statusChipClass(status: "new" | "seen" | "fuzzy" | "unknown" | "mastered" | "frozen"): string {
  if (status === "new") return "bg-blue-100 text-blue-700";
  if (status === "seen") return "bg-emerald-100 text-emerald-700";
  if (status === "fuzzy") return "bg-amber-100 text-amber-700";
  if (status === "unknown") return "bg-rose-100 text-rose-700";
  if (status === "frozen") return "bg-indigo-100 text-indigo-700";
  return "bg-slate-100 text-slate-700";
}

const PAGE_SIZE = 20;

function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

type LibraryPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    tag?: string;
    page?: string;
  }>;
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const { q, status, tag, page } = await searchParams;
  const selectedStatus = parseStatusFilter(status);
  const keyword = q?.trim().toLowerCase() ?? "";
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

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-sm text-red-700">User not found.</p>
      </div>
    );
  }

  const words = await loadWordsWithStatus(user.id);
  const availableTags = Array.from(
    new Set(
      words
        .map((word) => word.manualCategory?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const selectedTagRaw = tag?.trim() || "";
  const selectedTag = availableTags.includes(selectedTagRaw) ? selectedTagRaw : "";

  const filteredWords = words.filter((word) => {
    const matchKeyword =
      keyword.length === 0 ||
      word.text.toLowerCase().includes(keyword) ||
      (word.note ?? "").toLowerCase().includes(keyword);
    if (!matchKeyword) return false;

    if (selectedTag && (word.manualCategory?.trim() || "") !== selectedTag) return false;

    if (selectedStatus === "all") return true;
    if (selectedStatus === "priority") return word.isPriority;
    if (selectedStatus === "normal") return !word.isPriority;
    return word.status === selectedStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredWords.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageWords = filteredWords.slice(pageStart, pageStart + PAGE_SIZE);

  const buildPageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q?.trim()) params.set("q", q.trim());
    if (selectedStatus !== "all") params.set("status", selectedStatus);
    if (selectedTag) params.set("tag", selectedTag);
    if (p > 1) params.set("page", String(p));
    const nextQuery = params.toString();
    return nextQuery ? `/app/library?${nextQuery}` : "/app/library";
  };

  const buildTagHref = (tagName: string) => {
    const params = new URLSearchParams();
    if (q?.trim()) params.set("q", q.trim());
    if (selectedStatus !== "all") params.set("status", selectedStatus);
    // toggle: clicking the active tag deselects it
    if (tagName !== selectedTag) params.set("tag", tagName);
    const nextQuery = params.toString();
    return nextQuery ? `/app/library?${nextQuery}` : "/app/library";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Library</h1>
          <p className="text-base text-slate-600">Manage your vocabulary collection.</p>
        </div>
        <AddWordModalTrigger />
      </div>

      <LibraryFilters
        initialQuery={q?.trim() ?? ""}
        initialStatus={selectedStatus}
        initialTag={selectedTag || null}
        tagOptions={availableTags}
      />

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Your cards</h2>
            <LibraryRefreshButton />
          </div>
          <span className="text-base text-slate-500">
            {filteredWords.length} / {words.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-6 py-3.5 text-sm font-medium text-slate-500">Word</th>
                <th className="px-6 py-3.5 text-sm font-medium text-slate-500">Tag</th>
                <th className="px-6 py-3.5 text-sm font-medium text-slate-500">Status</th>
                <th className="px-6 py-3.5 text-right text-sm font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageWords.length === 0 ? (
                <tr>
                  <td className="px-6 py-12 text-center text-base text-slate-500" colSpan={4}>
                    {words.length === 0 ? "No cards yet." : "No words match current filters."}
                  </td>
                </tr>
              ) : (
                pageWords.map((word) => (
                  <tr className="group align-middle transition hover:bg-slate-50" key={word.id}>
                    <td className="px-6 py-3.5">
                      <Link
                        className="text-base font-semibold text-slate-900 hover:text-indigo-600"
                        href={`/app/library/${word.id}`}
                      >
                        {word.text}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5">
                      {word.manualCategory ? (
                        <Link
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                            selectedTag === (word.manualCategory?.trim() || "")
                              ? "bg-blue-600 text-white"
                              : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                          }`}
                          href={buildTagHref(word.manualCategory)}
                        >
                          {word.manualCategory}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusChipClass(word.status)}`}>
                        {word.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <form action={togglePriorityFromListAction}>
                          <input name="wordId" type="hidden" value={word.id} />
                          <input name="nextPriority" type="hidden" value={word.isPriority ? "false" : "true"} />
                          <button
                            aria-label={word.isPriority ? "Remove priority" : "Add priority"}
                            className={`rounded-lg p-1.5 transition ${
                              word.isPriority
                                ? "text-amber-500 hover:bg-amber-50"
                                : "text-slate-400 hover:bg-slate-100 hover:text-amber-500"
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
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                          href={`/app/library/${word.id}`}
                        >
                          Details
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-6 py-4">
            <span className="text-sm text-slate-500">
              Page {safePage} / {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Link
                aria-disabled={safePage <= 1}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  safePage <= 1
                    ? "pointer-events-none border-slate-200 text-slate-300"
                    : "border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
                href={buildPageHref(safePage - 1)}
              >
                Prev
              </Link>
              <Link
                aria-disabled={safePage >= totalPages}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
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
      </section>
    </div>
  );
}
