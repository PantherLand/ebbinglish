"use client";

import { useState, useTransition } from "react";
import { updateStudySettingsAction } from "@/app/app/study-actions";

type SettingsState = {
  sessionSize: number;
  freezeRounds: number;
  autoPlayAudio: boolean;
  requireConsecutiveKnown: boolean;
};

export default function SettingsClient({ initialSettings }: { initialSettings: SettingsState }) {
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function showSavedToast() {
    window.dispatchEvent(
      new CustomEvent("ebbinglish:toast", {
        detail: {
          message: "Settings saved",
          type: "success",
        },
      }),
    );
  }

  function commit(patch: Partial<SettingsState>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setError(null);
    startTransition(() => {
      void (async () => {
        const result = await updateStudySettingsAction(patch);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        showSavedToast();
      })();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Customize your learning experience.</p>
      </header>

      <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="border-b border-slate-100 pb-2 text-lg font-bold text-slate-900">Session Settings</h2>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-slate-900">Words per Session</p>
            <p className="text-sm text-slate-500">How many words per session in Rounds</p>
          </div>
          <select
            className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            onChange={(event) => commit({ sessionSize: Number(event.target.value) })}
            value={settings.sessionSize}
          >
            <option value={5}>5 Words</option>
            <option value={10}>10 Words</option>
            <option value={20}>20 Words (Recommended)</option>
            <option value={30}>30 Words</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-slate-900">Auto-Play Audio</p>
            <p className="text-sm text-slate-500">Automatically play pronunciation when card flips</p>
          </div>
          <input
            checked={settings.autoPlayAudio}
            className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            onChange={(event) => commit({ autoPlayAudio: event.target.checked })}
            type="checkbox"
          />
        </div>
      </section>

      <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="border-b border-slate-100 pb-2 text-lg font-bold text-slate-900">
          Mastery &amp; Spaced Repetition
        </h2>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-slate-900">Strict Mastery Mode</p>
            <p className="text-sm text-slate-500">Require 2 consecutive known answers to master a word</p>
          </div>
          <input
            checked={settings.requireConsecutiveKnown}
            className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            onChange={(event) => commit({ requireConsecutiveKnown: event.target.checked })}
            type="checkbox"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-slate-900">Freeze Duration (Rounds)</p>
            <p className="text-sm text-slate-500">How many rounds to wait before re-introducing mastered words</p>
          </div>
          <input
            className="w-20 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-center text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            max={20}
            min={1}
            onChange={(event) => commit({ freezeRounds: Number(event.target.value) })}
            type="number"
            value={settings.freezeRounds}
          />
        </div>
      </section>

      {pending ? <p className="text-sm text-slate-500">Saving...</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
