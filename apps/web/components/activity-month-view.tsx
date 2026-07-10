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
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onToday?: () => void;
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
  onPrevMonth,
  onNextMonth,
  onToday,
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
    <div className="rounded-xl bg-[#f4f5f7] p-3 shadow-[0_0_0_1px_rgba(23,163,74,0.35),0_10px_30px_-12px_rgba(23,163,74,0.25)] dark:bg-[#15120e] dark:shadow-[0_0_0_1px_rgba(23,163,74,0.5),0_10px_30px_-12px_rgba(23,163,74,0.3)]">
      <div className="mb-3 flex items-center gap-2">
        <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onPrevMonth}
            aria-label="Mes anterior"
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
            onClick={onNextMonth}
            aria-label="Mes siguiente"
            className="flex items-center justify-center px-2 py-1.5 text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
        <span className="min-w-0 flex-1 text-center text-sm font-bold capitalize text-zinc-800 dark:text-white">
          {currentMonth.toLocaleDateString("es-VE", { month: "long", year: "numeric" })}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-white/10">
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
          <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-white/10">
            {weekDays.map((day) => (
              <div
                key={day}
                className="px-2 py-2.5 text-center text-[11px] font-bold text-zinc-500 dark:bg-white/[0.03] dark:text-white"
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
                    "relative flex min-h-[116px] flex-col border-b border-r border-zinc-200 p-2 transition dark:border-white/[0.06]",
                    day.isCurrentMonth
                      ? "bg-white dark:bg-white/[0.02]"
                      : "bg-zinc-100/60 dark:bg-white/[0.05]",
                    isSelected && !day.isToday && "bg-emerald-50 dark:bg-emerald-950/30"
                  )}
                >
                  {day.isToday && (
                    <div className="pointer-events-none absolute inset-1 z-0 rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500 dark:bg-emerald-400/15 dark:ring-emerald-400" />
                  )}
                  <div className="relative z-10 flex justify-end">
                    <span
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        day.isToday
                          ? "text-zinc-900 dark:text-white"
                          : day.isCurrentMonth
                          ? "text-zinc-800 dark:text-white"
                          : "text-zinc-400 dark:text-zinc-500"
                      )}
                    >
                      {String(day.date.getDate()).padStart(2, "0")}
                    </span>
                  </div>

                  {day.activities.length > 0 && (
                    <div className="relative z-10 mt-auto space-y-1">
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
                                : "bg-zinc-600 hover:bg-zinc-500 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                            )}
                          >
                            <span className="opacity-80">{time}</span>{" "}
                            {activity.title}
                          </div>
                        );
                      })}
                      {day.activities.length > 3 && (
                        <span className="block text-[10px] text-zinc-400 dark:text-zinc-500">
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
      </div>

      {selectedDay && selectedDay.activities.length > 0 && (
        <div className="mt-3 border-t border-zinc-200 p-4 dark:border-white/10">
          <h4 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
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
                      : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
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
                      <p className={cn("text-sm font-medium", isEnrolled ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-700 dark:text-zinc-200")}>
                        {activity.title}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                      {actDate.toLocaleTimeString("es-VE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {activity.zone}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
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
