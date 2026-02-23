export type ReviewLogEntry = {
  id: string;
  grade: number;
  reviewedAt: Date;
  revealedAnswer: boolean;
};

function formatDateTime(date: Date): string {
  return date.toLocaleString();
}

function formatGrade(grade: number): string {
  if (grade === 2) return "Know";
  if (grade === 1) return "Fuzzy";
  return "Don't know";
}

type ReviewLogListProps = {
  logs: ReviewLogEntry[];
};

export function ReviewLogList({ logs }: ReviewLogListProps) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-base font-semibold">Recent reviews</h2>
      {logs.length === 0 ? (
        <p className="text-sm text-gray-600">No review logs yet.</p>
      ) : (
        <ul className="divide-y">
          {logs.slice(0, 20).map((log) => (
            <li key={log.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="text-gray-700">{formatDateTime(log.reviewedAt)}</div>
              <div className="flex items-center gap-2">
                <span className="rounded border px-2 py-0.5 text-xs">{formatGrade(log.grade)}</span>
                <span className="rounded border px-2 py-0.5 text-xs text-gray-600">
                  {log.revealedAnswer ? "Revealed" : "Skipped reveal"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
