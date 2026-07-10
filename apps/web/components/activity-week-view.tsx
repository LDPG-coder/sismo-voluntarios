"use client";

import { useMemo } from "react";
import type { Activity } from "@/lib/types";

type ActivityWeekViewProps = {
  activities: Activity[];
  weekStart: Date;
  enrolledIds?: Set<string>;
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

export function ActivityWeekView({
  activities,
  weekStart,
  enrolledIds,
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
      return { day, items: laned, lanes };
    });

    return { rows: dayRows, hours: hoursList, startHour: dynStart };
  }, [activities, weekStart]);

  const gridWidth = (hours.length - 1 > 0 ? hours.length : 1) * HOUR_WIDTH;
  const totalWidth = DAY_LABEL_WIDTH + gridWidth;

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <div style={{ minWidth: totalWidth }}>
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <div
              className="shrink-0 border-r border-slate-200 dark:border-slate-800"
              style={{ width: DAY_LABEL_WIDTH }}
            />
            {hours.map((hour) => (
              <div
                key={hour}
                className="border-r border-slate-100 px-1 py-2 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500"
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
                className="flex border-b border-slate-100 dark:border-slate-800/50"
              >
                <div
                  className={`shrink-0 border-r border-slate-200 px-2 py-3 dark:border-slate-800 ${
                    isToday ? "bg-emerald-50 dark:bg-emerald-950/30" : ""
                  }`}
                  style={{ width: DAY_LABEL_WIDTH }}
                >
                  <span
                    className={`text-xs font-medium ${
                      isToday
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {row.day.label}
                  </span>
                  <span
                    className={`ml-1.5 text-lg font-bold ${
                      isToday
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-900 dark:text-slate-100"
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
                  {hours.map((hour) => {
                    const left = (hour - startHour) * HOUR_WIDTH;
                    return (
                      <div
                        key={hour}
                        className="absolute top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-800"
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
                    return (
                      <div
                        key={it.activity.id}
                        onClick={() => onSelectActivity(it.activity)}
                        className={`absolute cursor-pointer overflow-hidden rounded-md border px-2 py-1 text-xs leading-tight transition hover:shadow-md ${
                          isEnrolled
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-emerald-700"
                        }`}
                        style={{
                          left: `${left}px`,
                          width: `${Math.max(width - 4, 24)}px`,
                          top: `${top}px`,
                          height: BLOCK_HEIGHT,
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {isEnrolled && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          )}
                          <p className="truncate font-medium">
                            {it.activity.title}
                          </p>
                        </div>
                        <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">
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
  );
}
