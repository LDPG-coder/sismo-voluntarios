import Link from "next/link";
import type { Activity } from "@/lib/types";

type ActivityCardProps = {
  activity: Activity;
  isEnrolled?: boolean;
  onJoin?: (id: string) => void;
  onLeave?: (id: string) => void;
};

export function ActivityCard({ activity, isEnrolled, onJoin, onLeave }: ActivityCardProps) {
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

  return (
    <Link href={`/voluntarios/${activity.id}`} className="block">
      <div className={`relative rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-[#18181b] ${
        isEnrolled
          ? "border-emerald-200 dark:border-emerald-900"
          : "border-slate-200 dark:border-slate-800"
      }`}>
        {isEnrolled && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Inscrito
          </span>
        )}
        <div className="mb-2">
          <span className="inline-block rounded-full bg-[#eaebed] px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {activity.zone}
          </span>
        </div>

        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
          {activity.title}
        </h3>

        <div className="mt-2 space-y-1.5 text-sm text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span>
              {formatDate(activityDate)}, {formatTimeRange()}
            </span>
          </div>

          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="line-clamp-1">{activity.raw_address}</span>
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          {activity.creator ? (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Publicado por</p>
              <div className="flex items-center gap-3">
                {activity.creator.photo_url ? (
                  <img
                    src={activity.creator.photo_url}
                    alt={activity.creator.name || ""}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {(activity.creator.name || "V").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{activity.creator.name || "Voluntario"}</p>
                  {activity.creator.phone && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{activity.creator.phone}</p>
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
                onLeave?.(activity.id);
              }}
              className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-800 dark:bg-[#18181b] dark:text-rose-400 dark:hover:bg-rose-950"
            >
              Abandonar
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
    </Link>
  );
}
