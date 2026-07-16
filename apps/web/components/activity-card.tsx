import Link from "next/link";
import { useState } from "react";
import type { Activity } from "@/lib/types";
import { ActivityStatusBadges } from "@/components/activity-status-badges";
import { CedeDialog } from "@/components/cede-dialog";
import { displayPhoto } from "@/lib/photo";

type ActivityCardProps = {
  activity: Activity;
  isEnrolled?: boolean;
  onJoin?: (id: string) => void;
  onCeded?: (id: string) => void;
};

export function ActivityCard({ activity, isEnrolled, onJoin, onCeded }: ActivityCardProps) {
  const [ceding, setCeding] = useState(false);
  const isExternalOfficial = activity.is_external_official;
  const isInternal = activity.is_internal;
  // Ambos tipos que suman horas comparten el mismo tratamiento visual (borde + gema).
  const isHoursType = isExternalOfficial || isInternal;
  const hoursTypeLabel = isExternalOfficial
    ? "Voluntariado externo oficial"
    : isInternal
      ? "Voluntariado interno"
      : "Voluntariado no oficial";
  const activityDate = new Date(activity.date_time);
  const endDate = activity.end_time ? new Date(activity.end_time) : null;

  const formatDate = (date: Date) =>
    date.toLocaleDateString("es-VE", { weekday: "short", day: "numeric", month: "short" });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });

  const formatTimeRange = () => {
    const start = formatTime(activityDate);
    if (endDate) {
      return `${start} - ${formatTime(endDate)}`;
    }
    return start;
  };

  const innerCls = `relative rounded-lg bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-[#18181b] ${
    isHoursType
      ? ""
      : isEnrolled
        ? "border border-emerald-200 dark:border-emerald-900"
        : "border border-zinc-200 dark:border-zinc-800"
  }`;

  return (
    <>
      <Link href={`/voluntarios/${activity.id}`} className="block">
      <div className={isHoursType ? "emerald-border-animated rounded-lg p-[2px]" : ""}>
      <div className={innerCls}>
        <div className="mb-2">
          <span className="inline-block rounded-full bg-[#eaebed] px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {activity.zone}
          </span>
        </div>

        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
          {activity.title}
        </h3>

        <div className="mt-2 space-y-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span>
              {formatDate(activityDate)}, {formatTimeRange()}
            </span>
          </div>

          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="line-clamp-1">{activity.raw_address}</span>
          </div>

          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className={isHoursType ? "font-medium text-emerald-700 dark:text-[#079669]" : ""}>
              {hoursTypeLabel}
            </span>
          </div>
        </div>

        <ActivityStatusBadges activity={activity} isEnrolled={isEnrolled} />

        <div className="mt-3 flex items-end justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {activity.creator ? (
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Publicado por</p>
              <div className="flex items-center gap-3">
                {activity.creator.photo_url ? (
                  <img
                    src={displayPhoto(activity.creator.photo_url) ?? ""}
                    loading="lazy"
                    decoding="async"
                    alt={activity.creator.name || ""}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    {(activity.creator.name || "V").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{activity.creator.name || "Voluntario"}</p>
                  {activity.creator.phone && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{activity.creator.phone}</p>
                  )}
                </div>
              </div>
            </div>
          ) : <div />}

          {isEnrolled ? (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCeding(true);
              }}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-[#18181b] dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Ceder cupo
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onJoin?.(activity.id);
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-600"
            >
              Unirme
            </button>
          )}
        </div>
      </div>
      </div>
      </Link>

      <CedeDialog
        open={ceding}
        activity={{
          id: activity.id,
          title: activity.title,
          date_time: activity.date_time,
          zone: activity.zone,
        }}
        onCancel={() => setCeding(false)}
        onCeded={() => {
          setCeding(false);
          onCeded?.(activity.id);
        }}
      />
    </>
  );
}
