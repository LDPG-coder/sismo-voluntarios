"use client";

import { useMemo } from "react";
import type { Activity } from "@/lib/types";

type ActivityGanttViewProps = {
  activities: Activity[];
  selectedDate: Date;
  enrolledIds?: Set<string>;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  onToday?: () => void;
  onSelectActivity: (activity: Activity) => void;
};

const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;
const HOUR_WIDTH = 100;

type ActivityBlock = {
  activity: Activity;
  startHour: number;
  duration: number;
};

function getActivityBlock(
  activity: Activity,
  selectedDate: Date
): { startHour: number; duration: number } | null {
  const activityDate = new Date(activity.date_time);

  const isSameDay =
    activityDate.getFullYear() === selectedDate.getFullYear() &&
    activityDate.getMonth() === selectedDate.getMonth() &&
    activityDate.getDate() === selectedDate.getDate();

  if (!isSameDay) return null;

  const startHour =
    activityDate.getHours() + activityDate.getMinutes() / 60;

  let duration = (activity.estimated_duration_min || 60) / 60;
  if (activity.end_time) {
    const endDate = new Date(activity.end_time);
    duration = (endDate.getTime() - activityDate.getTime()) / (1000 * 60 * 60);
  }

  return { startHour, duration: Math.max(duration, 0.5) };
}

function detectConflicts(blocks: ActivityBlock[]): Set<string> {
  const conflicts = new Set<string>();

  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];

      const aEnd = a.startHour + a.duration;
      const bEnd = b.startHour + b.duration;

      if (a.startHour < bEnd && b.startHour < aEnd) {
        conflicts.add(a.activity.id);
        conflicts.add(b.activity.id);
      }
    }
  }

  return conflicts;
}

export function ActivityGanttView({
  activities,
  selectedDate,
  enrolledIds,
  onPrevDay,
  onNextDay,
  onToday,
  onSelectActivity,
}: ActivityGanttViewProps) {
  const { blocks, conflicts, hours, startHour } = useMemo(() => {
    const activityBlocks: ActivityBlock[] = [];

    let minStart = DEFAULT_START_HOUR;
    let maxEnd = DEFAULT_END_HOUR;

    for (const activity of activities) {
      const block = getActivityBlock(activity, selectedDate);
      if (block) {
        activityBlocks.push({
          activity,
          startHour: block.startHour,
          duration: block.duration,
        });
        minStart = Math.min(minStart, Math.floor(block.startHour));
        maxEnd = Math.max(maxEnd, Math.ceil(block.startHour + block.duration));
      }
    }

    const dynStart = Math.max(0, Math.min(minStart, DEFAULT_START_HOUR));
    const dynEnd = Math.min(24, Math.max(maxEnd, DEFAULT_END_HOUR));

    const hoursList: number[] = [];
    for (let h = dynStart; h <= dynEnd; h++) {
      hoursList.push(h);
    }

    const conflictIds = detectConflicts(activityBlocks);

    return {
      blocks: activityBlocks,
      conflicts: conflictIds,
      hours: hoursList,
      startHour: dynStart,
    };
  }, [activities, selectedDate]);

  const totalWidth = hours.length * HOUR_WIDTH;

  const dateLabel = selectedDate.toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const controls = (
    <div className="relative mb-3 flex items-center">
      <div className="z-10 flex items-center gap-1">
        <button
          type="button"
          onClick={onPrevDay}
          aria-label="Día anterior"
          className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onToday}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-emerald-600 transition hover:bg-emerald-50 dark:border-slate-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
        >
          Hoy
        </button>
        <button
          type="button"
          onClick={onNextDay}
          aria-label="Día siguiente"
          className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
      <span className="pointer-events-none absolute inset-x-0 text-center text-sm font-bold capitalize text-slate-800 dark:text-white">
        {dateLabel}
      </span>
    </div>
  );

  if (blocks.length === 0) {
    return (
      <div className="rounded-xl bg-[#f4f5f7] p-3 shadow-[0_0_0_1px_rgba(23,163,74,0.35),0_10px_30px_-12px_rgba(23,163,74,0.25)] dark:bg-[#0c0b0a] dark:shadow-[0_0_0_1px_rgba(23,163,74,0.5),0_10px_30px_-12px_rgba(23,163,74,0.3)]">
        {controls}
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-500 dark:text-slate-400">
            No hay actividades este día
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[#f4f5f7] p-3 shadow-[0_0_0_1px_rgba(23,163,74,0.35),0_10px_30px_-12px_rgba(23,163,74,0.25)] dark:bg-[#0c0b0a] dark:shadow-[0_0_0_1px_rgba(23,163,74,0.5),0_10px_30px_-12px_rgba(23,163,74,0.3)]">
      {controls}
      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
        <div className="overflow-x-auto">
        <div style={{ minWidth: totalWidth }}>
          <div className="flex border-b border-slate-200 dark:border-slate-800">
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

          <div className="relative">
            {hours.map((hour) => {
              const left = (hour - startHour) * HOUR_WIDTH;
              return (
                <div
                  key={hour}
                  className="absolute top-0 bottom-0 w-px bg-[#eaebed] dark:bg-slate-800"
                  style={{ left: `${left}px` }}
                />
              );
            })}

            {blocks.map((block, index) => {
              const left = (block.startHour - startHour) * HOUR_WIDTH;
              const width = block.duration * HOUR_WIDTH;
              const isConflict = conflicts.has(block.activity.id);
              const isEnrolled = enrolledIds?.has(block.activity.id) ?? false;

              return (
                <div
                  key={block.activity.id}
                  className="flex items-center border-b border-slate-100 dark:border-slate-800/50"
                  style={{ height: 84 }}
                >
                  <div
                    onClick={() => onSelectActivity(block.activity)}
                    className={`absolute cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-all hover:shadow-lg ${
                      isConflict
                        ? "border border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300"
                        : isEnrolled
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "border border-slate-200 bg-[#eaebed] text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-emerald-700"
                    }`}
                    style={{
                      left: `${left}px`,
                      width: `${width}px`,
                      height: 72,
                      top: index * 84 + 6,
                    }}
                  >
                    <span className="line-clamp-2 leading-tight">{block.activity.title}</span>
                    {isConflict && (
                      <span className="ml-1 text-xs">⚠</span>
                    )}
                    {isEnrolled && !isConflict && (
                      <span className="ml-1 text-xs">✓</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}