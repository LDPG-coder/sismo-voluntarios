"use client";

import { useMemo } from "react";
import type { Activity } from "@/lib/types";
import { ExternalOfficialGem } from "@/components/external-official-gem";

type ActivityGanttViewProps = {
  activities: Activity[];
  selectedDate: Date;
  enrolledIds?: Set<string>;
  currentUserId?: string | null;
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

function detectConflicts(
  blocks: ActivityBlock[],
  isUser: (a: Activity) => boolean
): Map<string, "emergency" | "warning"> {
  const n = blocks.length;
  if (n < 2) return new Map();

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number =>
    parent[x] === x ? x : (parent[x] = find(parent[x]));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = blocks[i];
      const b = blocks[j];
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
    hasUser.set(r, (hasUser.get(r) ?? false) || isUser(blocks[i].activity));
  }

  const result = new Map<string, "emergency" | "warning">();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if ((size.get(r) ?? 0) > 1) {
      result.set(blocks[i].activity.id, hasUser.get(r) ? "emergency" : "warning");
    }
  }
  return result;
}

export function ActivityGanttView({
  activities,
  selectedDate,
  enrolledIds,
  currentUserId,
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

    const conflictMap = detectConflicts(activityBlocks, (a) =>
      (enrolledIds?.has(a.id) ?? false) ||
      (currentUserId != null && a.creator_id === currentUserId)
    );

    return {
      blocks: activityBlocks,
      conflicts: conflictMap,
      hours: hoursList,
      startHour: dynStart,
    };
  }, [activities, selectedDate, enrolledIds, currentUserId]);

  const totalWidth = hours.length * HOUR_WIDTH;

  const dateLabel = selectedDate.toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const controls = (
    <div className="mb-3 flex items-center gap-2">
      <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={onPrevDay}
          aria-label="Día anterior"
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
          onClick={onNextDay}
          aria-label="Día siguiente"
          className="flex items-center justify-center px-2 py-1.5 text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
      <span className="min-w-0 flex-1 text-center text-sm font-bold capitalize text-zinc-800 dark:text-white">
        {dateLabel}
      </span>
    </div>
  );

  if (blocks.length === 0) {
    return (
      <div className="rounded-xl bg-[#f4f5f7] p-3 shadow-[0_0_0_1px_rgba(23,163,74,0.35),0_10px_30px_-12px_rgba(23,163,74,0.25)] dark:bg-[#15120e] dark:shadow-[0_0_0_1px_rgba(23,163,74,0.5),0_10px_30px_-12px_rgba(23,163,74,0.3)]">
        {controls}
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-[#18181b]">
          <p className="text-zinc-500 dark:text-zinc-400">
            No hay actividades este día
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[#f4f5f7] p-3 shadow-[0_0_0_1px_rgba(23,163,74,0.35),0_10px_30px_-12px_rgba(23,163,74,0.25)] dark:bg-[#15120e] dark:shadow-[0_0_0_1px_rgba(23,163,74,0.5),0_10px_30px_-12px_rgba(23,163,74,0.3)]">
      {controls}
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-white/10">
        <div className="overflow-x-auto">
        <div style={{ minWidth: totalWidth }}>
          <div className="flex border-b border-zinc-200 bg-[#fafafa] dark:border-zinc-700 dark:bg-white/[0.02]">
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

          <div className="relative">
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

            {blocks.map((block, index) => {
              const left = (block.startHour - startHour) * HOUR_WIDTH;
              const width = block.duration * HOUR_WIDTH;
              const conflict = conflicts.get(block.activity.id);
              const isConflict = conflict === "emergency" || conflict === "warning";
              const isEnrolled = enrolledIds?.has(block.activity.id) ?? false;

              return (
                <div
                  key={block.activity.id}
                  className="flex items-center border-b border-zinc-100 dark:border-zinc-700/50"
                  style={{ height: 84 }}
                >
                  <div
                    onClick={() => onSelectActivity(block.activity)}
                    className={`absolute cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-all hover:shadow-lg ${
                      conflict === "emergency"
                        ? "border border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300"
                        : conflict === "warning"
                        ? "border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        : isEnrolled
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "border border-zinc-200 bg-[#eaebed] text-zinc-700 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-emerald-700"
                    }`}
                    style={{
                      left: `${left}px`,
                      width: `${width}px`,
                      height: 72,
                      top: index * 84 + 6,
                    }}
                  >
                    {block.activity.is_external_official && <ExternalOfficialGem />}
                    <span className="line-clamp-2 leading-tight">{block.activity.title}</span>
                    {conflict === "emergency" && (
                      <span className="ml-1 text-xs">⚠</span>
                    )}
                    {conflict === "warning" && (
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