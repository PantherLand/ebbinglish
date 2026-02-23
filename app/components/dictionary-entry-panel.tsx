"use client";

import { useMemo, useState } from "react";
import YouglishModal from "@/app/components/youglish-modal";

export type DictionaryEntryExample = {
  en: string | null;
  zh: string | null;
};

export type DictionaryEntrySubsense = {
  labels: string[];
  definitionEn: string | null;
  definitionZh: string | null;
  examples: DictionaryEntryExample[];
};

export type DictionaryEntrySense = {
  num: string | null;
  labels: string[];
  definitionEn: string | null;
  definitionZh: string | null;
  examples: DictionaryEntryExample[];
  subsenses: DictionaryEntrySubsense[];
};

export type DictionaryEntryPosBlock = {
  pos: string | null;
  labels: string[];
  senses: DictionaryEntrySense[];
};

export type DictionaryEntryIdiomSense = {
  num: string | null;
  labels: string[];
  definitionEn: string | null;
  definitionZh: string | null;
  examples: DictionaryEntryExample[];
};

export type DictionaryEntryIdiom = {
  phrase: string;
  senses: DictionaryEntryIdiomSense[];
};

export type DictionaryEntryData = {
  headword: string;
  meaning: string | null;
  pos: string | null;
  pronunciations: string[];
  posBlocks: DictionaryEntryPosBlock[];
  senses: DictionaryEntrySense[];
  idioms: DictionaryEntryIdiom[];
  fallbackText: string | null;
};

type DictionaryEntryPanelProps = {
  entry: DictionaryEntryData;
  title?: string;
  emptyText?: string;
  className?: string;
  maxHeightClassName?: string;
};

function DefinitionText({
  zh,
  en,
}: {
  zh: string | null;
  en: string | null;
}) {
  if (!zh && !en) {
    return <span className="text-gray-500">-</span>;
  }

  return (
    <div className="space-y-0.5">
      {zh ? <div className="text-gray-900">{zh}</div> : null}
      {en ? <div className="text-gray-600">{en}</div> : null}
    </div>
  );
}

function ExampleList({ examples }: { examples: DictionaryEntryExample[] }) {
  if (examples.length === 0) {
    return null;
  }

  return (
    <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-gray-600">
      {examples.map((example, idx) => (
        <li key={`${example.en || ""}-${example.zh || ""}-${idx}`}>
          {example.en ? <span>{example.en}</span> : null}
          {example.en && example.zh ? <span> / </span> : null}
          {example.zh ? <span>{example.zh}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function SenseCard({
  sense,
  index,
  senseKey,
}: {
  sense: DictionaryEntrySense;
  index: number;
  senseKey: string;
}) {
  return (
    <li className="rounded-lg border border-slate-300 bg-white p-3 text-sm shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
          {sense.num ? `${sense.num}.` : `${index + 1}.`}
        </span>
        {sense.labels.map((label, labelIdx) => (
          <span
            key={`${senseKey}-label-${labelIdx}`}
            className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
          >
            {label}
          </span>
        ))}
      </div>

      <div className="mt-2 rounded-md bg-slate-50 p-2">
        <DefinitionText en={sense.definitionEn} zh={sense.definitionZh} />
      </div>

      <ExampleList examples={sense.examples} />

      {sense.subsenses.length > 0 ? (
        <ul className="mt-2 space-y-2 border-l-2 border-slate-300 pl-3">
          {sense.subsenses.map((subsense, subIdx) => (
            <li key={`${senseKey}-subsense-${subIdx}`} className="text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {subsense.labels.map((label, labelIdx) => (
                  <span
                    key={`${senseKey}-subsense-${subIdx}-label-${labelIdx}`}
                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div className="mt-1 rounded-md bg-slate-50 p-2">
                <DefinitionText en={subsense.definitionEn} zh={subsense.definitionZh} />
              </div>
              <ExampleList examples={subsense.examples} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function DictionaryEntryPanel({
  entry,
  title = "Dictionary entry",
  emptyText = "No meaning available.",
  className,
  maxHeightClassName = "max-h-[30rem]",
}: DictionaryEntryPanelProps) {
  const fallbackText = entry.fallbackText?.trim() || entry.meaning?.trim() || null;
  const youglishHeadword = entry.headword.trim();
  const normalizedPosBlocks = useMemo(
    () =>
      entry.posBlocks.length > 0
        ? entry.posBlocks
        : entry.senses.length > 0
          ? [{ pos: entry.pos, labels: [], senses: entry.senses }]
          : [],
    [entry.posBlocks, entry.senses, entry.pos],
  );
  const [activeTabKey, setActiveTabKey] = useState<string | null>(null);
  const [showYouglish, setShowYouglish] = useState(false);
  const posTags = Array.from(
    new Set(
      normalizedPosBlocks
        .map((block) => block.pos?.trim() || "")
        .filter((value) => value.length > 0),
    ),
  );
  if (posTags.length === 0 && entry.pos?.trim()) {
    posTags.push(entry.pos.trim());
  }

  const tabItems = useMemo(() => {
    const posCount = new Map<string, number>();
    return normalizedPosBlocks.map((block, idx) => {
      const raw = block.pos?.trim();
      if (!raw) {
        return {
          key: `sense-${idx}`,
          label: `Sense ${idx + 1}`,
          block,
        };
      }
      const seen = posCount.get(raw) ?? 0;
      const next = seen + 1;
      posCount.set(raw, next);
      return {
        key: `${raw}-${idx}`,
        label: seen > 0 ? `${raw} ${next}` : raw,
        block,
      };
    });
  }, [normalizedPosBlocks]);

  const foundTabIndex = activeTabKey
    ? tabItems.findIndex((tab) => tab.key === activeTabKey)
    : -1;
  const activeTabIndex = foundTabIndex >= 0 ? foundTabIndex : 0;
  const activeBlock = tabItems[activeTabIndex]?.block ?? null;

  return (
    <section
      className={`space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-4 ${className ?? ""}`}
    >
      {title ? (
        <div className="text-sm font-semibold tracking-wide text-slate-700">{title}</div>
      ) : null}

      <div className={`${maxHeightClassName} space-y-3 overflow-y-auto pr-1`}>
        <div className="rounded-lg border border-slate-300 bg-white px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xl font-semibold tracking-tight text-slate-900">{entry.headword}</div>
            <button
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              disabled={!youglishHeadword}
              onClick={() => setShowYouglish(true)}
              type="button"
            >
              Open YouGlish
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {posTags.map((pos) => (
              <span
                key={`head-pos-${pos}`}
                className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
              >
                {pos}
              </span>
            ))}
            {entry.pronunciations.map((p) => (
              <span
                key={p}
                className="rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        {activeBlock ? (
          <div className="space-y-4">
            {tabItems.length > 1 ? (
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Meaning tabs">
                {tabItems.map((tab, idx) => {
                  const isActive = idx === activeTabIndex;
                  return (
                    <button
                      aria-selected={isActive}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                      key={tab.key}
                      onClick={() => setActiveTabKey(tab.key)}
                      role="tab"
                      type="button"
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <section className="space-y-2 rounded-lg border border-slate-300 bg-slate-100/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {activeBlock.pos ? (
                  <span className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    {activeBlock.pos}
                  </span>
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Senses
                  </span>
                )}
                {activeBlock.labels.map((label, labelIdx) => (
                  <span
                    key={`active-pos-label-${labelIdx}`}
                    className="rounded bg-white px-2 py-0.5 text-xs font-medium text-slate-700"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <ol className="space-y-3">
                {activeBlock.senses.map((sense, senseIdx) => (
                  <SenseCard
                    index={senseIdx}
                    key={`active-sense-${senseIdx}`}
                    sense={sense}
                    senseKey={`active-sense-${senseIdx}`}
                  />
                ))}
              </ol>
            </section>
          </div>
        ) : fallbackText ? (
          <div className="rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-800 shadow-sm whitespace-pre-wrap">
            {fallbackText}
          </div>
        ) : (
          <p className="text-sm text-gray-600">{emptyText}</p>
        )}

        {entry.idioms.length > 0 ? (
          <section className="space-y-2 rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Idioms
            </div>
            <div className="space-y-2">
              {entry.idioms.map((idiom, idiomIdx) => (
                <div key={`${idiom.phrase}-${idiomIdx}`} className="text-sm">
                  <div className="font-medium text-slate-900">{idiom.phrase}</div>
                  <ul className="mt-1 space-y-1 text-xs text-gray-700">
                    {idiom.senses.map((sense, senseIdx) => (
                      <li key={`${idiom.phrase}-${senseIdx}`}>
                        <DefinitionText en={sense.definitionEn} zh={sense.definitionZh} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {showYouglish ? (
        <YouglishModal
          headword={entry.headword}
          onClose={() => setShowYouglish(false)}
        />
      ) : null}
    </section>
  );
}
