"use client";

import { useMemo } from "react";
import type { Activity } from "@/lib/types";

type ActivityWeekViewProps = {
  activities: Activity[];
  weekStart: Date;
  enrolledIds?: Set<string>;
  onSelectActivity: (activity: Activity) => void;
};

const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_HEIGHT = 60;

type WeekDay = {
  date: Date;
  label: string;
  shortLabel: string;
};

type PlacedActivity = {
  activity: Activity;
  dayIndex: number;
  top: number;
  height: number;
};

function getWeekDays(weekStart: Date): WeekDay[] {
  const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const days: WeekDay[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    days.push({
      date,
      label: labels[i],
      shortLabel: labels[i].charAt(0),
    });
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

export function ActivityWeekView({
  activities,
  weekStart,
  enrolledIds,
  onSelectActivity,
}: ActivityWeekViewProps) {
  const { days, placedActivities, hours } = useMemo(() => {
    const daysList = getWeekDays(weekStart);
    const hoursList: number[] = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      hoursList.push(h);
    }

    const placed: PlacedActivity[] = [];

    for (const activity of activities) {
      const actDate = new Date(activity.date_time);

      for (let dayIdx = 0; dayIdx < daysList.length; dayIdx++) {
        if (isSameDay(actDate, daysList[dayIdx].date)) {
          const startHour =
            actDate.getHours() + actDate.getMinutes() / 60;

          let duration = (activity.estimated_duration_min || 60) / 60;
          if (activity.end_time) {
            const endDate = new Date(activity.end_time);
            duration =
              (endDate.getTime() - actDate.getTime()) / (1000 * 60 * 60);
          }

          const top = (startHour - START_HOUR) * HOUR_HEIGHT;
          const height = Math.max(duration * HOUR_HEIGHT, 30);

          placed.push({
            activity,
            dayIndex: dayIdx,
            top,
            height,
          });
          break;
        }
      }
    }

    return {
      days: daysList,
      placedActivities: placed,
      hours: hoursList,
    };
  }, [activities, weekStart]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <div className="w-12 shrink-0 border-r border-slate-200 dark:border-slate-800" />
            {days.map((day, i) => {
              const isToday = isSameDay(day.date, new Date());
              return (
                <div
                  key={i}
                  className={`flex-1 border-r border-slate-100 px-2 py-3 text-center dark:border-slate-800 ${
                    isToday
                      ? "bg-blue-50 dark:bg-blue-950/30"
                      : ""
                  }`}
                >
                  <span
                    className={`text-xs font-medium ${
                      isToday
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {day.label}
                  </span>
                  <span
                    className={`ml-1.5 text-lg font-bold ${
                      isToday
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-900 dark:text-slate-100"
                    }`}
                  >
                    {day.date.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="relative flex">
            <div className="w-12 shrink-0 border-r border-slate-200 dark:border-slate-800">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="border-b border-slate-100 dark:border-slate-800/50"
                  style={{ height: HOUR_HEIGHT }}
                >
                  <span className="relative -top-2.5 px-1 text-[10px] text-slate-400 dark:text-slate-500">
                    {hour === 12
                      ? "12p"
                      : hour > 12
                      ? `${hour - 12}p`
                      : `${hour}a`}
                  </span>
                </div>
              ))}
            </div>

            <div className="relative flex-1">
              {days.map((day, dayIdx) => (
                <div
                  key={dayIdx}
                  className={`absolute top-0 bottom-0 border-r border-slate-100 dark:border-slate-800/50 ${
                    isSameDay(day.date, new Date())
                      ? "bg-blue-50/50 dark:bg-blue-950/20"
                      : ""
                  }`}
                  style={{
                    left: `${(dayIdx / 7) * 100}%`,
                    width: `${100 / 7}%`,
                  }}
                />
              ))}

              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-b border-slate-100 dark:border-slate-800/50"
                  style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px` }}
                />
              ))}

              {placedActivities.map((pa) => {
                const dayWidth = 100 / 7;
                const left = pa.dayIndex * dayWidth;
                const isEnrolled = enrolledIds?.has(pa.activity.id) ?? false;

                return (
                  <div
                    key={pa.activity.id}
                    onClick={() => onSelectActivity(pa.activity)}
                    className={`absolute cursor-pointer overflow-hidden rounded border px-1.5 py-1 text-[11px] leading-tight transition hover:shadow-md ${
                      isEnrolled
                        ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
                        : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                    }`}
                    style={{
                      left: `calc(${left}% + 2px)`,
                      width: `calc(${dayWidth}% - 4px)`,
                      top: `${pa.top}px`,
                      height: `${pa.height}px`,
                    }}
                  >
                    <div className="flex items-center gap-1">
                      {isEnrolled && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      )}
                      <p className={`truncate font-medium ${
                        isEnrolled
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-slate-700 dark:text-slate-300"
                      }`}>
                        {pa.activity.title}
                      </p>
                    </div>
                    <p className="truncate text-slate-400 dark:text-slate-500">
                      {new Date(pa.activity.date_time).toLocaleTimeString(
                        "es-VE",
                        { hour: "2-digit", minute: "2-digit" }
                      )}
                    </p>
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