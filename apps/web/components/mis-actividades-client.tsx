"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav-bar";
import { csrfHeaders } from "@/lib/auth/csrf-client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Activity {
  id: string;
  title: string;
  zone: string;
  raw_address: string;
  date_time: string;
  end_time: string | null;
  estimated_duration_min: number | null;
  max_participants: number | null;
  requirements: string;
  member_count: number;
  status: string;
  created_at: string;
}

export function MisActividadesClient() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; title: string; action: "cancel" | "archive" } | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const res = await fetch(`${API}/api/v1/activities/mine`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error loading activities");
      const data = await res.json();
      setActivities(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!confirmAction) return;
    setProcessing(true);
    try {
      const res = await fetch(`${API}/api/v1/activities/${confirmAction.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeaders("DELETE") },
        body: JSON.stringify({ archive: confirmAction.action === "archive" }),
      });
      if (!res.ok) throw new Error("Error processing action");
      setActivities((prev) =>
        prev.map((a) =>
          a.id === confirmAction.id
            ? { ...a, status: confirmAction.action === "archive" ? "archived" : "cancelled" }
            : a
        )
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(false);
      setConfirmAction(null);
    }
  };

  const active = activities.filter((a) => a.status === "active");
  const archived = activities.filter((a) => a.status === "archived");
  const cancelled = activities.filter((a) => a.status === "cancelled");

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">Mis actividades</h1>
          <Link
            href="/voluntarios/crear"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
          >
            + Nueva
          </Link>
        </div>

        {loading && <p className="text-sm text-slate-500">Cargando...</p>}
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        {!loading && activities.length === 0 && (
          <p className="text-sm text-slate-500">No has creado ninguna actividad aun.</p>
        )}

        {active.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase text-slate-400">Activas ({active.length})</h2>
            <div className="space-y-3">
              {active.map((a) => (
                <ActivityCard
                  key={a.id}
                  activity={a}
                  onArchive={(id, title) => setConfirmAction({ id, title, action: "archive" })}
                  onCancel={(id, title) => setConfirmAction({ id, title, action: "cancel" })}
                />
              ))}
            </div>
          </section>
        )}

        {archived.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase text-slate-400">Realizadas ({archived.length})</h2>
            <div className="space-y-3">
              {archived.map((a) => (
                <ActivityCard key={a.id} activity={a} />
              ))}
            </div>
          </section>
        )}

        {cancelled.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase text-slate-400">Canceladas ({cancelled.length})</h2>
            <div className="space-y-3">
              {cancelled.map((a) => (
                <ActivityCard key={a.id} activity={a} />
              ))}
            </div>
          </section>
        )}
      </main>

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <h3 className="mb-2 text-lg font-bold">
              {confirmAction.action === "archive" ? "Marcar como realizada" : "Cancelar actividad"}
            </h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              {confirmAction.action === "archive"
                ? `"${confirmAction.title}" sera marcada como realizada. Los inscritos seran notificados.`
                : `"${confirmAction.title}" sera cancelada. Los inscritos seran notificados.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                Volver
              </button>
              <button
                onClick={handleAction}
                disabled={processing}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold text-white transition ${
                  confirmAction.action === "archive"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-rose-600 hover:bg-rose-700"
                } disabled:opacity-50`}
              >
                {processing ? "Procesando..." : confirmAction.action === "archive" ? "Marcar realizada" : "Cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityCard({
  activity: a,
  onArchive,
  onCancel,
}: {
  activity: Activity;
  onArchive?: (id: string, title: string) => void;
  onCancel?: (id: string, title: string) => void;
}) {
  const date = a.date_time ? new Date(a.date_time).toLocaleDateString("es-VE", { weekday: "short", day: "numeric", month: "short" }) : "";
  const time = a.date_time ? new Date(a.date_time).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" }) : "";
  const isActive = a.status === "active";

  return (
    <div className={`rounded-lg border p-4 ${isActive ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" : "border-slate-100 bg-slate-50 opacity-70 dark:border-slate-800 dark:bg-slate-900"}`}>
      <div className="mb-2 flex items-start justify-between">
        <Link href={`/voluntarios/${a.id}`} className="font-semibold hover:underline">
          {a.title}
        </Link>
        {isActive && (
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">Activa</span>
        )}
        {!isActive && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {a.status === "archived" ? "Realizada" : "Cancelada"}
          </span>
        )}
      </div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>{a.zone}</span>
        {date && <span>{date}</span>}
        {time && <span>{time}</span>}
        <span>{a.member_count} inscritos</span>
        {a.max_participants && <span>Max: {a.max_participants}</span>}
      </div>
      {isActive && (
        <div className="flex gap-2">
          <Link
            href={`/voluntarios/${a.id}/admin`}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Administrar
          </Link>
          {onArchive && (
            <button
              onClick={() => onArchive(a.id, a.title)}
              className="rounded-md border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20"
            >
              Realizada
            </button>
          )}
          {onCancel && (
            <button
              onClick={() => onCancel(a.id, a.title)}
              className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/20"
            >
              Cancelar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
