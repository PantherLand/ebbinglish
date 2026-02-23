export type HeatmapCell = {
  date: Date;
  count: number;
  intensity: 0 | 1 | 2 | 3 | 4;
};

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

function getIntensity(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

export function buildHeatmap(logDates: Date[], days: number = 140): HeatmapCell[][] {
  const today = startOfDay(new Date());
  const targetStart = new Date(today);
  targetStart.setDate(targetStart.getDate() - (days - 1));

  const start = startOfDay(targetStart);
  const weekDay = start.getDay();
  start.setDate(start.getDate() - weekDay);

  const counts = new Map<string, number>();
  for (const d of logDates) {
    const key = dateKey(startOfDay(d));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const cells: HeatmapCell[] = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const count = counts.get(dateKey(cursor)) ?? 0;
    cells.push({
      date: new Date(cursor),
      count,
      intensity: getIntensity(count),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const weeks: HeatmapCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return weeks;
}
