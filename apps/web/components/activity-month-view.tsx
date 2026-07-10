"use client";

import { useMemo, useState } from "react";
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
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
            {weekDays.map((day) => (
              <div
                key={day}
                className="px-2 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400"
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
                  className={`min-h-[120px] cursor-pointer border-b border-r border-slate-100 p-2 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 ${
                    !day.isCurrentMonth
                      ? "bg-slate-50/50 dark:bg-slate-900/50"
                      : ""
                  } ${isSelected ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      day.isToday
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : day.isCurrentMonth
                        ? "text-slate-700 dark:text-slate-300"
                        : "text-slate-400 dark:text-slate-600"
                    } ${isSelected && !day.isToday ? "ring-2 ring-blue-500" : ""}`}
                  >
                    {day.date.getDate()}
                  </span>

                  {day.activities.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {day.activities.slice(0, 4).map((activity) => {
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
                            className={`cursor-pointer truncate rounded px-1.5 py-1 text-[11px] font-medium leading-tight transition ${
                              isEnrolled
                                ? "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                            }`}
                            title={activity.title}
                          >
                            {isEnrolled && "✓ "}
                            <span className="tabular-nums opacity-70">{time}</span>{" "}
                            {activity.title}
                          </div>
                        );
                      })}
                      {day.activities.length > 4 && (
                        <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                          +{day.activities.length - 4} más
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
        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <h4 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
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
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
                    isEnrolled
                      ? "border-blue-200 bg-blue-50 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:hover:bg-blue-900"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {isEnrolled && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Inscrito
                        </span>
                      )}
                      <p className={`text-sm font-medium ${
                        isEnrolled
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-slate-700 dark:text-slate-300"
                      }`}>
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
