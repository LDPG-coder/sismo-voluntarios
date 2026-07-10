"use client";

import { useMemo } from "react";
import type { Activity } from "@/lib/types";

type ActivityGanttViewProps = {
  activities: Activity[];
  selectedDate: Date;
  enrolledIds?: Set<string>;
  onSelectActivity: (activity: Activity) => void;
};

const START_HOUR = 6;
const END_HOUR = 22;
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
  onSelectActivity,
}: ActivityGanttViewProps) {
  const { blocks, conflicts, hours } = useMemo(() => {
    const hoursList: number[] = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      hoursList.push(h);
    }

    const activityBlocks: ActivityBlock[] = [];

    for (const activity of activities) {
      const block = getActivityBlock(activity, selectedDate);
      if (block) {
        activityBlocks.push({
          activity,
          startHour: block.startHour,
          duration: block.duration,
        });
      }
    }

    const conflictIds = detectConflicts(activityBlocks);

    return {
      blocks: activityBlocks,
      conflicts: conflictIds,
      hours: hoursList,
    };
  }, [activities, selectedDate]);

  const totalWidth = (END_HOUR - START_HOUR + 1) * HOUR_WIDTH;

  if (blocks.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-slate-500 dark:text-slate-400">
          No hay actividades este día
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <div style={{ minWidth: totalWidth }}>
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            {hours.map((hour) => (
              <div
                key={hour}
                className="border-r border-slate-100 px-1 py-2 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500"
                style={{ width: HOUR_WIDTH }}
              >
                {hour === 12
                  ? "12 PM"
                  : hour > 12
                  ? `${hour - 12} PM`
                  : `${hour} AM`}
              </div>
            ))}
          </div>

          <div className="relative">
            {hours.map((hour) => {
              const left = (hour - START_HOUR) * HOUR_WIDTH;
              return (
                <div
                  key={hour}
                  className="absolute top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-800"
                  style={{ left: `${left}px` }}
                />
              );
            })}

            {blocks.map((block, index) => {
              const left = (block.startHour - START_HOUR) * HOUR_WIDTH;
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
                        ? "border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        : "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                    style={{
                      left: `${left}px`,
                      width: `${width}px`,
                      height: 72,
                      top: 6,
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
  );
}