"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type Day = {
  date: string;
  key: string;
  count: number;
  active: boolean;
};

type Week = {
  days: Day[];
  monthLabel: string | null;
};

type Props = {
  weeks: Week[];
  dailyGoal: number;
};

function cellColor(count: number, active: boolean, dailyGoal: number): string {
  if (!active) return "bg-transparent";
  if (count === 0) return "bg-slate-100";
  if (count < dailyGoal) return "bg-indigo-200";
  if (count < dailyGoal * 2) return "bg-indigo-500";
  return "bg-indigo-800";
}

function formatDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function HeatmapGrid({ weeks, dailyGoal }: Props) {
  const [tooltip, setTooltip] = useState<{
    key: string;
    count: number;
    x: number; // viewport x (cell center)
    y: number; // viewport y (cell top)
  } | null>(null);

  return (
    <div className="inline-flex gap-1">
      {/* Day labels */}
      <div className="mr-1 flex flex-col gap-[3px] pt-5">
        {["", "Mon", "", "Wed", "", "Fri", ""].map((label, i) => (
          <div key={i} className="flex h-3 items-center text-[9px] leading-none text-slate-400">
            {label}
          </div>
        ))}
      </div>

      {/* Grid + month labels */}
      <div>
        {/* Month labels */}
        <div className="mb-1 flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div
              key={wi}
              className="w-3 shrink-0 overflow-visible whitespace-nowrap text-[10px] text-slate-400"
            >
              {week.monthLabel ?? ""}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div
          className="grid grid-rows-7 gap-[3px]"
          style={{ gridAutoFlow: "column", gridAutoColumns: "0.75rem" }}
        >
          {weeks.flatMap((week) =>
            week.days.map((day, di) => (
              <div
                key={day.key + di}
                className={`h-3 w-3 cursor-default rounded-sm transition-opacity hover:opacity-80 ${cellColor(day.count, day.active, dailyGoal)}`}
                onMouseEnter={(e) => {
                  if (!day.active) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({
                    key: day.key,
                    count: day.count,
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            )),
          )}
        </div>
      </div>

      {/* Tooltip — rendered via portal so it escapes overflow containers */}
      {tooltip &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] leading-none text-white shadow-md"
            style={{ left: tooltip.x, top: tooltip.y - 8 }}
          >
            {tooltip.count === 0
              ? "No reviews"
              : `${tooltip.count} word${tooltip.count !== 1 ? "s" : ""} reviewed`}
            {" · "}
            <span className="text-slate-400">{formatDate(tooltip.key)}</span>
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-[3px] border-transparent border-t-slate-900" />
          </div>,
          document.body,
        )}
    </div>
  );
}
