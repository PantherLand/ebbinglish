export type FocusWord = {
  stage: number;
  lapseCount: number;
  seenCount: number;
  word: {
    text: string;
    isPriority: boolean;
  };
};

type FocusWordsListProps = {
  words: FocusWord[];
};

export function FocusWordsList({ words }: FocusWordsListProps) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">Focus words</h2>
      {words.length === 0 ? (
        <p className="text-sm text-slate-600">No weak words yet.</p>
      ) : (
        <ul className="space-y-2">
          {words.map((item) => (
            <li
              key={item.word.text}
              className="rounded-lg border border-slate-200 bg-slate-50 p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-slate-900">{item.word.text}</div>
                <div className="text-xs text-slate-500">
                  Stage {item.stage} · Lapses {item.lapseCount}
                </div>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Seen {item.seenCount}
                {item.word.isPriority ? " · Priority" : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
