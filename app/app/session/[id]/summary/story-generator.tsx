"use client";

import { useState, useTransition } from "react";
import { generateStoryAction } from "./story-action";

type Props = {
  words: string[];
};

export default function StoryGenerator({ words }: Props) {
  const [story, setStory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setStory(null);
    setError(null);
    startTransition(async () => {
      const result = await generateStoryAction(words);
      if (result.ok) {
        setStory(result.story);
      } else {
        setError(result.message);
      }
    });
  }

  // Render story with **bold** markdown
  function renderStory(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-5 text-left">
      <div className="flex items-center gap-2">
        <span className="text-lg">📖</span>
        <h2 className="font-semibold text-indigo-900">More Practice</h2>
      </div>
      <p className="mt-1 text-sm text-indigo-700">
        Generate a story using your {words.length} fuzzy &amp; unknown word{words.length !== 1 ? "s" : ""} to help remember them.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {words.map((w) => (
          <span key={w} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm border border-indigo-100" suppressHydrationWarning>
            {w}
          </span>
        ))}
      </div>

      <button
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        disabled={isPending}
        onClick={handleGenerate}
        type="button"
      >
        {isPending ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Generating...
          </>
        ) : story ? (
          "Regenerate Story"
        ) : (
          "Generate Story"
        )}
      </button>

      {error ? (
        <p className="mt-3 text-sm text-rose-600">{error}</p>
      ) : null}

      {story ? (
        <div className="mt-4 rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-700 shadow-sm border border-indigo-100">
          {renderStory(story)}
        </div>
      ) : null}
    </div>
  );
}
