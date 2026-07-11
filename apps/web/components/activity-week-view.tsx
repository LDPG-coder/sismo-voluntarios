"use client";

import { useMemo } from "react";
import type { Activity } from "@/lib/types";

type ActivityWeekViewProps = {
  activities: Activity[];
  weekStart: Date;
  enrolledIds?: Set<string>;
  currentUserId?: string | null;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  onToday?: () => void;
  onSelectActivity: (activity: Activity) => void;
};

const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;
const HOUR_WIDTH = 100;
const DAY_LABEL_WIDTH = 90;
const LANE_HEIGHT = 44;
const BLOCK_HEIGHT = 36;
const ROW_PADDING = 8;

type WeekDay = {
  date: Date;
  label: string;
};

type LaneActivity = {
  activity: Activity;
  startHour: number;
  duration: number;
  lane: number;
  conflict?: "emergency" | "warning";
};

type DayRow = {
  day: WeekDay;
  items: LaneActivity[];
  lanes: number;
};

function getWeekDays(weekStart: Date): WeekDay[] {
  const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    days.push({ date, label: labels[i] });
  }
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function packLanes(items: Omit<LaneActivity, "lane">[]): {
  laned: LaneActivity[];
  lanes: number;
} {
  const sorted = [...items].sort((a, b) => a.startHour - b.startHour);
  const laneEnds: number[] = [];
  const laned: LaneActivity[] = [];

  for (const item of sorted) {
    const end = item.startHour + item.duration;
    let lane = laneEnds.findIndex((e) => e <= item.startHour);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    laned.push({ ...item, lane });
  }

  return { laned, lanes: Math.max(laneEnds.length, 1) };
}

function computeConflicts(
  items: LaneActivity[],
  isUser: (a: Activity) => boolean
): Map<string, "emergency" | "warning"> {
  const n = items.length;
  if (n < 2) return new Map();

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number =>
    parent[x] === x ? x : (parent[x] = find(parent[x]));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = items[i];
      const b = items[j];
      const aEnd = a.startHour + a.duration;
      const bEnd = b.startHour + b.duration;
      if (a.startHour < bEnd - 1e-6 && b.startHour < aEnd - 1e-6) {
        parent[find(i)] = find(j);
      }
    }
  }

  const size = new Map<number, number>();
  const hasUser = new Map<number, boolean>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    size.set(r, (size.get(r) ?? 0) + 1);
    hasUser.set(r, (hasUser.get(r) ?? false) || isUser(items[i].activity));
  }

  const result = new Map<string, "emergency" | "warning">();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if ((size.get(r) ?? 0) > 1) {
      result.set(items[i].activity.id, hasUser.get(r) ? "emergency" : "warning");
    }
  }
  return result;
}

export function ActivityWeekView({
  activities,
  weekStart,
  enrolledIds,
  currentUserId,
  onPrevWeek,
  onNextWeek,
  onToday,
  onSelectActivity,
}: ActivityWeekViewProps) {
  const { rows, hours, startHour } = useMemo(() => {
    const daysList = getWeekDays(weekStart);

    const rawByDay: Omit<LaneActivity, "lane">[][] = daysList.map(() => []);
    let minStart = DEFAULT_START_HOUR;
    let maxEnd = DEFAULT_END_HOUR;

    for (let dayIdx = 0; dayIdx < daysList.length; dayIdx++) {
      for (const activity of activities) {
        const actDate = new Date(activity.date_time);
        if (!isSameDay(actDate, daysList[dayIdx].date)) continue;

        const start = actDate.getHours() + actDate.getMinutes() / 60;
        let duration = (activity.estimated_duration_min || 60) / 60;
        if (activity.end_time) {
          const endDate = new Date(activity.end_time);
          duration =
            (endDate.getTime() - actDate.getTime()) / (1000 * 60 * 60);
        }
        duration = Math.max(duration, 0.5);

        minStart = Math.min(minStart, Math.floor(start));
        maxEnd = Math.max(maxEnd, Math.ceil(start + duration));

        rawByDay[dayIdx].push({ activity, startHour: start, duration });
      }
    }

    const dynStart = Math.max(0, Math.min(minStart, DEFAULT_START_HOUR));
    const dynEnd = Math.min(24, Math.max(maxEnd, DEFAULT_END_HOUR));

    const hoursList: number[] = [];
    for (let h = dynStart; h <= dynEnd; h++) hoursList.push(h);

    const dayRows: DayRow[] = daysList.map((day, i) => {
      const { laned, lanes } = packLanes(rawByDay[i]);
      const conflictMap = computeConflicts(laned, (a) =>
        (enrolledIds?.has(a.id) ?? false) ||
        (currentUserId != null && a.creator_id === currentUserId)
      );
      const items = laned.map((it) => ({
        ...it,
        conflict: conflictMap.get(it.activity.id),
      }));
      return { day, items, lanes };
    });

    return { rows: dayRows, hours: hoursList, startHour: dynStart };
  }, [activities, weekStart, enrolledIds, currentUserId]);

  const gridWidth = (hours.length - 1 > 0 ? hours.length : 1) * HOUR_WIDTH;
  const totalWidth = DAY_LABEL_WIDTH + gridWidth;

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekRangeLabel = `${weekStart.toLocaleDateString("es-VE", {
    day: "numeric",
    month: "short",
  })} - ${weekEnd.toLocaleDateString("es-VE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;

  return (
    <div className="rounded-xl bg-[#f4f5f7] p-3 shadow-[0_0_0_1px_rgba(23,163,74,0.35),0_10px_30px_-12px_rgba(23,163,74,0.25)] dark:bg-[#15120e] dark:shadow-[0_0_0_1px_rgba(23,163,74,0.5),0_10px_30px_-12px_rgba(23,163,74,0.3)]">
      <div className="mb-3 flex items-center gap-2">
        <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onPrevWeek}
            aria-label="Semana anterior"
            className="flex items-center justify-center border-r border-zinc-200 px-2 py-1.5 text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onToday}
            className="border-r border-zinc-200 px-3 py-1.5 text-xs font-bold text-emerald-600 transition hover:bg-emerald-50 dark:border-zinc-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={onNextWeek}
            aria-label="Semana siguiente"
            className="flex items-center justify-center px-2 py-1.5 text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
        <span className="min-w-0 flex-1 text-center text-sm font-bold text-zinc-800 dark:text-white">
          {weekRangeLabel}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-white/10">
        <div className="overflow-x-auto">
        <div style={{ minWidth: totalWidth }}>
          <div className="flex border-b border-zinc-200 dark:border-zinc-700">
            <div
              className="shrink-0 border-r border-zinc-200 dark:border-zinc-700"
              style={{ width: DAY_LABEL_WIDTH }}
            />
            {hours.map((hour) => (
              <div
                key={hour}
                className="border-r border-zinc-100 px-1 py-2 text-center text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
                style={{ width: HOUR_WIDTH }}
              >
                {hour === 0
                  ? "12 AM"
                  : hour === 12
                  ? "12 PM"
                  : hour === 24
                  ? "12 AM"
                  : hour > 12
                  ? `${hour - 12} PM`
                  : `${hour} AM`}
              </div>
            ))}
          </div>

          {rows.map((row, i) => {
            const isToday = isSameDay(row.day.date, new Date());
            const rowHeight = row.lanes * LANE_HEIGHT + ROW_PADDING;
            return (
              <div
                key={i}
                className="flex border-b border-zinc-100 dark:border-zinc-700/50"
              >
                <div
                  className={`shrink-0 border-r border-zinc-200 px-2 py-3 dark:border-zinc-700 ${
                    isToday
                      ? "bg-emerald-50 dark:bg-emerald-950/30"
                      : "bg-[#fafafa] dark:bg-white/[0.02]"
                  }`}
                  style={{ width: DAY_LABEL_WIDTH }}
                >
                  <span
                    className={`text-xs font-medium ${
                      isToday
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {row.day.label}
                  </span>
                  <span
                    className={`ml-1.5 text-lg font-bold ${
                      isToday
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    {row.day.date.getDate()}
                  </span>
                </div>

                <div
                  className={`relative ${
                    isToday ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""
                  }`}
                  style={{ width: gridWidth, height: rowHeight }}
                >
                  {hours.map((hour, hi) => {
                    const left = (hour - startHour) * HOUR_WIDTH;
                    return (
                      <div
                        key={`band-${hour}`}
                        className={
                          hi % 2 === 0
                            ? "absolute top-0 bottom-0 bg-[#fafafa] dark:bg-white/[0.025]"
                            : "absolute top-0 bottom-0"
                        }
                        style={{ left: `${left}px`, width: HOUR_WIDTH }}
                      />
                    );
                  })}

                  {hours.map((hour) => {
                    const left = (hour - startHour) * HOUR_WIDTH;
                    return (
                      <div
                        key={hour}
                        className="absolute top-0 bottom-0 w-px bg-[#eaebed] dark:bg-zinc-700"
                        style={{ left: `${left}px` }}
                      />
                    );
                  })}

                  {row.items.map((it) => {
                    const left = (it.startHour - startHour) * HOUR_WIDTH;
                    const width = it.duration * HOUR_WIDTH;
                    const top = it.lane * LANE_HEIGHT + ROW_PADDING / 2;
                    const isEnrolled =
                      enrolledIds?.has(it.activity.id) ?? false;

                    const tone = (() => {
                      if (it.conflict === "emergency")
                        return "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300";
                      if (it.conflict === "warning")
                        return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300";
                      if (isEnrolled)
                        return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
                      return "border-zinc-200 bg-[#eaebed] text-zinc-700 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-emerald-700";
                    })();

                    const title =
                      it.conflict === "emergency"
                        ? "Conflicto de horario con tu inscripcion o creacion"
                        : it.conflict === "warning"
                        ? "Conflicto de horario"
                        : undefined;

                    return (
                      <div
                        key={it.activity.id}
                        onClick={() => onSelectActivity(it.activity)}
                        title={title}
                        className={`absolute cursor-pointer overflow-hidden rounded-md border px-2 py-1 text-xs leading-tight transition hover:shadow-md ${tone}`}
                        style={{
                          left: `${left}px`,
                          width: `${Math.max(width - 4, 24)}px`,
                          top: `${top}px`,
                          height: BLOCK_HEIGHT,
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {it.conflict === "emergency" && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                          )}
                          {it.conflict === "warning" && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          )}
                          {!it.conflict && isEnrolled && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          )}
                          <p className="truncate font-medium">
                            {it.activity.title}
                          </p>
                        </div>
                        <p className="truncate text-[10px] text-zinc-400 dark:text-zinc-500">
                          {new Date(it.activity.date_time).toLocaleTimeString(
                            "es-VE",
                            { hour: "2-digit", minute: "2-digit" }
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </div>
  );
}
