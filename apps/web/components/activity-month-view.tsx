"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Activity } from "@/lib/types";

type ActivityMonthViewProps = {
  activities: Activity[];
  currentMonth: Date;
  enrolledIds?: Set<string>;
  onSelectActivity: (activity: Activity) => void;
  onSelectDay: (date: Date, activities: Activity[]) => void;
};

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  activities: Activity[];
};

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getFirstDayOfMonth(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isActivityOnDay(activity: Activity, date: Date): boolean {
  const actDate = new Date(activity.date_time);
  return isSameDay(actDate, date);
}

export function ActivityMonthView({
  activities,
  currentMonth,
  enrolledIds,
  onSelectActivity,
  onSelectDay,
}: ActivityMonthViewProps) {
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const calendar = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const today = new Date();

    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);

    const days: CalendarDay[] = [];

    for (let i = 0; i < firstDay; i++) {
      const date = new Date(year, month, -(firstDay - i - 1));
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        activities: [],
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: isSameDay(date, today),
        activities: activities.filter((a) => isActivityOnDay(a, date)),
      });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        activities: [],
      });
    }

    return days;
  }, [activities, currentMonth]);

  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-600 bg-[#f4f5f7] dark:border-emerald-500 dark:bg-[#0c0b0a]">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-white/10">
            {weekDays.map((day) => (
              <div
                key={day}
                className="px-2 py-2.5 text-center text-[11px] font-bold text-slate-500 dark:text-white"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendar.map((day, idx) => {
              const isSelected =
                selectedDay && isSameDay(day.date, selectedDay.date);

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedDay(day);
                    onSelectDay(day.date, day.activities);
                  }}
                  className={cn(
                    "relative flex min-h-[116px] flex-col border-b border-r border-slate-200 p-2 transition dark:border-white/[0.06]",
                    !day.isCurrentMonth && "bg-slate-100/60 dark:bg-white/[0.02]",
                    day.isToday &&
                      "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500 dark:bg-emerald-400/10 dark:ring-emerald-400",
                    isSelected && !day.isToday && "bg-emerald-50 dark:bg-emerald-950/30"
                  )}
                >
                  <div className="flex justify-end">
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        day.isToday
                          ? "font-semibold text-slate-900 dark:text-white"
                          : day.isCurrentMonth
                          ? "font-medium text-slate-800 dark:text-white"
                          : "text-slate-400 dark:text-slate-600"
                      )}
                    >
                      {String(day.date.getDate()).padStart(2, "0")}
                    </span>
                  </div>

                  {day.activities.length > 0 && (
                    <div className="mt-auto space-y-1">
                      {day.activities.slice(0, 3).map((activity) => {
                        const isEnrolled =
                          enrolledIds?.has(activity.id) ?? false;
                        const time = new Date(
                          activity.date_time
                        ).toLocaleTimeString("es-VE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        return (
                          <div
                            key={activity.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectActivity(activity);
                            }}
                            title={activity.title}
                            className={cn(
                              "cursor-pointer truncate rounded-md px-1.5 py-1 text-[11px] leading-tight text-white transition",
                              isEnrolled
                                ? "bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                                : "bg-slate-600 hover:bg-slate-500 dark:bg-slate-700 dark:hover:bg-slate-600"
                            )}
                          >
                            <span className="opacity-80">{time}</span>{" "}
                            {activity.title}
                          </div>
                        );
                      })}
                      {day.activities.length > 3 && (
                        <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                          +{day.activities.length - 3} más
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedDay && selectedDay.activities.length > 0 && (
        <div className="border-t border-slate-200 p-4 dark:border-white/10">
          <h4 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            {selectedDay.date.toLocaleDateString("es-VE", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h4>
          <div className="space-y-2">
            {selectedDay.activities.map((activity) => {
              const actDate = new Date(activity.date_time);
              const isEnrolled = enrolledIds?.has(activity.id) ?? false;
              return (
                <button
                  key={activity.id}
                  onClick={() => onSelectActivity(activity)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition",
                    isEnrolled
                      ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:hover:bg-emerald-900"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {isEnrolled && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400">
                          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Inscrito
                        </span>
                      )}
                      <p className={cn("text-sm font-medium", isEnrolled ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-200")}>
                        {activity.title}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      {actDate.toLocaleTimeString("es-VE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {activity.zone}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {activity.member_count} inscritos
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
