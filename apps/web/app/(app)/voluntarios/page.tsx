"use client";

import { useEffect, useState, useMemo } from "react";
import { ViewSelector, type ViewType } from "@/components/view-selector";
import { ActivityCard } from "@/components/activity-card";
import { ActivityGanttView } from "@/components/activity-gantt-view";
import { ActivityWeekView } from "@/components/activity-week-view";
import { ActivityMonthView } from "@/components/activity-month-view";
import { ActivityDetailModal } from "@/components/activity-detail-modal";
import { ConfirmJoinDialog } from "@/components/confirm-join-dialog";
import { ZoneFilter } from "@/components/zone-filter";
import {
  VoluntariosListSkeleton,
  VoluntariosGanttSkeleton,
  VoluntariosWeekSkeleton,
  VoluntariosMonthSkeleton,
} from "@/components/skeletons";
import type { Activity } from "@/lib/types";
import { csrfHeaders } from "@/lib/auth/csrf-client";
import { useSession } from "@/components/session-provider";

type Zone = { name: string; count: number };

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function VoluntariosPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const { user } = useSession();

  const [activeView, setActiveView] = useState<ViewType>("list");

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()));
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const [modalActivity, setModalActivity] = useState<Activity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingJoin, setPendingJoin] = useState<string | null>(null);

  // Durante la induccion se piden las publicaciones de ejemplo (include_demo).
  const [includeDemo, setIncludeDemo] = useState(false);

  useEffect(() => {
    localStorage.setItem("voluntarios-view", activeView);
  }, [activeView]);

  useEffect(() => {
    setIncludeDemo(
      typeof window !== "undefined" &&
        !localStorage.getItem("sismo_onboarding_done"),
    );
  }, []);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const opts: RequestInit = { credentials: "include" };
    const zoneParam = activeZone ? `?zone=${activeZone}` : "";
    const sep = zoneParam ? "&" : "?";
    const zonesUrl = includeDemo
      ? `${API}/api/v1/activities/zones?include_demo=true`
      : `${API}/api/v1/activities/zones`;
    Promise.all([
      fetch(zonesUrl, opts).then((r) => (r.ok ? r.json() : [])),
      fetch(
        `${API}/api/v1/activities${zoneParam}${sep}include_demo=${includeDemo}`,
        opts
      ).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API}/api/v1/activities/enrolled`, opts).then((r) =>
        r.ok ? r.json() : []
      ),
    ])
      .then(([zonesData, activitiesData, enrolledData]) => {
        setZones(Array.isArray(zonesData) ? zonesData : []);
        setActivities(Array.isArray(activitiesData) ? activitiesData : []);
        const ids = new Set<string>(
          (Array.isArray(enrolledData) ? enrolledData : []).map(
            (a: Activity) => a.id
          )
        );
        setEnrolledIds(ids);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeZone, includeDemo]);

  // Al terminar el tour, el becario ya no ve las publicaciones de ejemplo.
  useEffect(() => {
    const onDone = () => setIncludeDemo(false);
    window.addEventListener("sismo:onboarding-done", onDone);
    return () => window.removeEventListener("sismo:onboarding-done", onDone);
  }, []);

  const handleSelectActivity = (activity: Activity) => {
    setModalActivity(activity);
    setIsModalOpen(true);
  };

  const requestJoin = (activityId: string) => {
    setPendingJoin(activityId);
  };

  const handleCeded = (activityId: string) => {
    setEnrolledIds((prev) => {
      const next = new Set(prev);
      next.delete(activityId);
      return next;
    });
  };

  const handleJoin = (activityId: string) => {
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${API}/api/v1/activities/${activityId}/join`, {
      method: "POST",
      credentials: "include",
      headers: csrfHeaders("POST"),
    }).then((res) => {
      if (!res.ok) return;
      setEnrolledIds((prev) => new Set(prev).add(activityId));
      setActivities((prev) =>
        prev.map((a) =>
          a.id === activityId
            ? { ...a, member_count: a.member_count + 1 }
            : a
        )
      );
    });
  };

  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
    setWeekStart(getWeekStart(new Date()));
    setCurrentMonth(new Date());
  };

  const handlePrevWeek = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  };

  const handlePrevMonth = () => {
    const prev = new Date(currentMonth);
    prev.setMonth(prev.getMonth() - 1);
    setCurrentMonth(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + 1);
    setCurrentMonth(next);
  };

  const visibleActivities = useMemo(
    () => activities.filter((a) => !enrolledIds.has(a.id)),
    [activities, enrolledIds]
  );

  return (
    <div>
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-4">
        <div className="mb-6" data-tour="feed">
          <h1 className="text-2xl font-bold tracking-tight">
            Actividades de voluntariado
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Encuentra una actividad en tu zona y unete.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <ZoneFilter zones={zones} active={activeZone} onChange={setActiveZone} />
          <ViewSelector active={activeView} onChange={setActiveView} />
        </div>

        {loading ? (
          activeView === "list" ? (
            <VoluntariosListSkeleton />
          ) : activeView === "gantt" ? (
            <VoluntariosGanttSkeleton />
          ) : activeView === "week" ? (
            <VoluntariosWeekSkeleton />
          ) : (
            <VoluntariosMonthSkeleton />
          )
        ) : visibleActivities.length === 0 ? (
          <div className="py-12 text-center text-zinc-500">
            No hay actividades disponibles
            {activeZone ? ` en ${activeZone}` : ""}.
            {enrolledIds.size > 0 && " Ya te uniste a las actividades disponibles."}
          </div>
        ) : (
          <>
            {activeView === "list" && (
              <div className="grid gap-4 sm:grid-cols-2">
                {visibleActivities.map((a) => (
                  <ActivityCard
                    key={a.id}
                    activity={a}
                    isEnrolled={enrolledIds.has(a.id)}
                    onJoin={requestJoin}
                    onCeded={handleCeded}
                  />
                ))}
              </div>
            )}

            {activeView === "gantt" && (
              <ActivityGanttView
                activities={visibleActivities}
                selectedDate={selectedDate}
                enrolledIds={enrolledIds}
                currentUserId={user?.id ?? null}
                onPrevDay={handlePrevDay}
                onNextDay={handleNextDay}
                onToday={handleToday}
                onSelectActivity={handleSelectActivity}
              />
            )}

            {activeView === "week" && (
              <ActivityWeekView
                activities={visibleActivities}
                weekStart={weekStart}
                enrolledIds={enrolledIds}
                currentUserId={user?.id ?? null}
                onPrevWeek={handlePrevWeek}
                onNextWeek={handleNextWeek}
                onToday={handleToday}
                onSelectActivity={handleSelectActivity}
              />
            )}

            {activeView === "month" && (
              <ActivityMonthView
                activities={visibleActivities}
                currentMonth={currentMonth}
                enrolledIds={enrolledIds}
                onSelectActivity={handleSelectActivity}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onToday={handleToday}
                onSelectDay={(date, dayActivities) => {
                  if (dayActivities.length === 1) {
                    handleSelectActivity(dayActivities[0]);
                  } else if (dayActivities.length > 1) {
                    setSelectedDate(date);
                    setActiveView("gantt");
                  }
                }}
              />
            )}
          </>
        )}
      </main>

      <ActivityDetailModal
        activity={modalActivity}
        user={user}
        isEnrolled={modalActivity ? enrolledIds.has(modalActivity.id) : false}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalActivity(null);
        }}
        onJoin={requestJoin}
        onCeded={handleCeded}
      />

      <ConfirmJoinDialog
        open={pendingJoin !== null}
        onCancel={() => setPendingJoin(null)}
        onConfirm={() => {
          if (!pendingJoin) return;
          const id = pendingJoin;
          handleJoin(id);
          if (modalActivity && modalActivity.id === id) {
            setModalActivity({
              ...modalActivity,
              member_count: modalActivity.member_count + 1,
            });
          }
          setPendingJoin(null);
        }}
      />
    </div>
  );
}