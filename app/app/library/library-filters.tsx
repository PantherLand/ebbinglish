"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

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

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All Status" },
  { value: "priority", label: "Priority" },
  { value: "normal", label: "Normal" },
  { value: "new", label: "New" },
  { value: "seen", label: "Seen" },
  { value: "fuzzy", label: "Fuzzy" },
  { value: "unknown", label: "Unknown" },
  { value: "frozen", label: "Frozen" },
  { value: "mastered", label: "Mastered" },
];

function buildHref(pathname: string, query: string, status: StatusFilter, tag: string | null) {
  const params = new URLSearchParams();
  const normalizedQuery = query.trim();
  if (normalizedQuery) params.set("q", normalizedQuery);
  if (status !== "all") params.set("status", status);
  if (tag) params.set("tag", tag);
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export default function LibraryFilters({
  initialQuery,
  initialStatus,
  initialTag,
  tagOptions = [],
}: {
  initialQuery: string;
  initialStatus: StatusFilter;
  initialTag: string | null;
  tagOptions?: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [tag, setTag] = useState<string>(initialTag ?? "");
  const lastAppliedRef = useRef({
    query: initialQuery.trim(),
    status: initialStatus,
    tag: initialTag ?? "",
  });

  useEffect(() => {
    setQuery(initialQuery);
    setStatus(initialStatus);
    setTag(initialTag ?? "");
    lastAppliedRef.current = {
      query: initialQuery.trim(),
      status: initialStatus,
      tag: initialTag ?? "",
    };
  }, [initialQuery, initialStatus, initialTag]);

  const applyFilters = (nextQuery: string, nextStatus: StatusFilter, nextTag: string) => {
    const normalizedQuery = nextQuery.trim();
    const normalizedTag = nextTag.trim();
    if (
      lastAppliedRef.current.query === normalizedQuery &&
      lastAppliedRef.current.status === nextStatus &&
      lastAppliedRef.current.tag === normalizedTag
    ) {
      return;
    }
    lastAppliedRef.current = { query: normalizedQuery, status: nextStatus, tag: normalizedTag };
    router.replace(buildHref(pathname, normalizedQuery, nextStatus, normalizedTag || null), { scroll: false });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      applyFilters(query, status, tag);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [query, status, tag]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-base text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search words..."
            value={query}
          />
        </div>
        <select
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-44"
          onChange={(event) => {
            const nextStatus = event.target.value as StatusFilter;
            setStatus(nextStatus);
            applyFilters(query, nextStatus, tag);
          }}
          value={status}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-48"
          onChange={(event) => {
            const nextTag = event.target.value;
            setTag(nextTag);
            applyFilters(query, status, nextTag);
          }}
          value={tag}
        >
          <option value="">All Tags</option>
          {(Array.isArray(tagOptions) ? tagOptions : []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
