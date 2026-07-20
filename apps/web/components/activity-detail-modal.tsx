"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Activity } from "@/lib/types";
import { CedeDialog } from "@/components/cede-dialog";
import { displayPhoto } from "@/lib/photo";

type User = { id: string; role: string; status: string } | null;

type ActivityDetailModalProps = {
  activity: Activity | null;
  user: User;
  isEnrolled?: boolean;
  isCeded?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onJoin?: (activityId: string) => void;
  onCeded?: (activityId: string) => void;
};

export function ActivityDetailModal({
  activity,
  user,
  isEnrolled = false,
  isCeded = false,
  isOpen,
  onClose,
  onJoin,
  onCeded,
}: ActivityDetailModalProps) {
  const [ceding, setCeding] = useState(false);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  const router = useRouter();
  const [titleActive, setTitleActive] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !activity) return null;

  const activityDate = new Date(activity.date_time);
  const endDate = activity.end_time ? new Date(activity.end_time) : null;

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });

  const formatDateShort = (date: Date) =>
    date.toLocaleDateString("es-VE", { weekday: "short", day: "numeric", month: "short" });

  const formatTimeRange = () => {
    const start = formatTime(activityDate);
    if (endDate) {
      return `${start} - ${formatTime(endDate)}`;
    }
    return start;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#18181b]">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-zinc-400 transition hover:bg-[#eaebed] hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6">
          <div className="mb-1">
            <span className="inline-block rounded-full bg-[#eaebed] px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {activity.zone}
            </span>
          </div>

          <h2
            onClick={() => {
              setTitleActive(true);
              setTimeout(() => {
                onClose();
                router.push(`/voluntarios/${activity.id}`);
              }, 250);
            }}
            className={`group block mt-2 cursor-pointer text-lg font-semibold transition-colors ${titleActive ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-900 dark:text-zinc-100"}`}
          >
            {activity.title}
          </h2>

          <div className="mt-4 space-y-2.5 text-sm text-zinc-600 dark:text-zinc-400">
            <div className="flex items-start gap-2.5">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span>
                {formatDateShort(activityDate)}, {formatTimeRange()}
              </span>
            </div>

            <div className="flex items-start gap-2.5">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <span className="line-clamp-2 text-normal">{activity.raw_address}</span>
            </div>

            <div className="flex items-start gap-2.5">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span className={activity.is_internal ? "font-medium text-emerald-700 dark:text-[#079669]" : ""}>
                {activity.is_internal
                  ? "Voluntariado interno"
                  : "Voluntariado"}
              </span>
            </div>
          </div>

          {activity.creator && (
            <div className="mt-5 flex items-center gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              {activity.creator.photo_url ? (
                <img
                  src={displayPhoto(activity.creator.photo_url) ?? ""}
                  loading="lazy"
                  decoding="async"
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  {(activity.creator.name || "V").charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {activity.creator.name || "Voluntario"}
              </span>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            {user?.id && String(user.id) === String(activity.creator_id) ? (
              <p className="flex-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Esta es tu actividad
              </p>
            ) : isEnrolled ? (
              <button
                onClick={() => setCeding(true)}
                className="flex-1 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Ceder cupo
              </button>
            ) : isCeded ? (
              <p className="flex-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Cupo cedido
              </p>
            ) : (
              <button
                onClick={() => onJoin?.(activity.id)}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-600"
              >
                Unirme
              </button>
            )}
          </div>
        </div>
      </div>

      {activity && (
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
      )}
    </div>
  );
}