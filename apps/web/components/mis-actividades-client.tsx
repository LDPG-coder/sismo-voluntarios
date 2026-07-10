"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MisActividadesSkeleton } from "@/components/skeletons";
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

type Tab = "created" | "enrolled";

export function MisActividadesClient() {
  const [tab, setTab] = useState<Tab>("created");
  const [created, setCreated] = useState<Activity[]>([]);
  const [enrolled, setEnrolled] = useState<Activity[]>([]);
  const [loadingCreated, setLoadingCreated] = useState(true);
  const [loadingEnrolled, setLoadingEnrolled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; title: string; action: "cancel" | "archive" | "leave" } | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/v1/activities/mine`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCreated(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingCreated(false));

    fetch(`${API}/api/v1/activities/enrolled`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setEnrolled(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingEnrolled(false));
  }, []);

  const handleAction = async () => {
    if (!confirmAction) return;
    setProcessing(true);
    try {
      if (confirmAction.action === "leave") {
        const res = await fetch(`${API}/api/v1/activities/${confirmAction.id}/leave`, {
          method: "POST",
          credentials: "include",
          headers: csrfHeaders("POST"),
        });
        if (!res.ok) throw new Error("Error al salir");
        setEnrolled((prev) => prev.filter((a) => a.id !== confirmAction.id));
      } else {
        const res = await fetch(`${API}/api/v1/activities/${confirmAction.id}`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...csrfHeaders("DELETE") },
          body: JSON.stringify({ archive: confirmAction.action === "archive" }),
        });
        if (!res.ok) throw new Error("Error al procesar");
        const newStatus = confirmAction.action === "archive" ? "archived" : "cancelled";
        setCreated((prev) =>
          prev.map((a) => (a.id === confirmAction.id ? { ...a, status: newStatus } : a))
        );
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(false);
      setConfirmAction(null);
    }
  };

  const activities = tab === "created" ? created : enrolled;
  const loading = tab === "created" ? loadingCreated : loadingEnrolled;
  const active = activities.filter((a) => a.status === "active");
  const archived = activities.filter((a) => a.status === "archived");
  const cancelled = activities.filter((a) => a.status === "cancelled");
  const isCreated = tab === "created";

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">Mis actividades</h1>
          <Link
            href="/voluntarios/crear"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-white"
          >
            + Nueva
          </Link>
        </div>

        <div className="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <TabButton
            active={tab === "created"}
            onClick={() => setTab("created")}
            count={created.length}
          >
            Creadas
          </TabButton>
          <TabButton
            active={tab === "enrolled"}
            onClick={() => setTab("enrolled")}
            count={enrolled.length}
          >
            Inscritas
          </TabButton>
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}

        {loading ? (
          <MisActividadesSkeleton />
        ) : activities.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <>
            <Section
              title="Activas"
              count={active.length}
              items={active}
              isCreated={isCreated}
              onArchive={(id, title) => setConfirmAction({ id, title, action: "archive" })}
              onCancel={(id, title) => setConfirmAction({ id, title, action: "cancel" })}
              onLeave={(id, title) => setConfirmAction({ id, title, action: "leave" })}
            />
            <Section
              title="Realizadas"
              count={archived.length}
              items={archived}
              isCreated={isCreated}
            />
            <Section
              title="Canceladas"
              count={cancelled.length}
              items={cancelled}
              isCreated={isCreated}
            />
          </>
        )}
      </main>

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <h3 className="mb-2 text-lg font-bold">
              {confirmAction.action === "leave"
                ? "Salir de la actividad"
                : confirmAction.action === "archive"
                ? "Marcar como realizada"
                : "Cancelar actividad"}
            </h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              {confirmAction.action === "leave"
                ? `¿Seguro que quieres salir de "${confirmAction.title}"?`
                : confirmAction.action === "archive"
                ? `"${confirmAction.title}" sera marcada como realizada. Los inscritos seran notificados.`
                : `"${confirmAction.title}" sera cancelada. Los inscritos seran notificados.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-emerald-700"
              >
                Volver
              </button>
              <button
                onClick={handleAction}
                disabled={processing}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold text-white transition ${
                  confirmAction.action === "leave"
                    ? "bg-slate-600 hover:bg-emerald-700"
                    : confirmAction.action === "archive"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-rose-600 hover:bg-rose-700"
                } disabled:opacity-50`}
              >
                {processing
                  ? "Procesando..."
                  : confirmAction.action === "leave"
                  ? "Salir"
                  : confirmAction.action === "archive"
                  ? "Marcar realizada"
                  : "Cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-950/40 dark:text-emerald-400"
          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {children}
      {count > 0 && (
        <span className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${
          active
            ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white"
            : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function Section({
  title,
  count,
  items,
  isCreated,
  onArchive,
  onCancel,
  onLeave,
}: {
  title: string;
  count: number;
  items: Activity[];
  isCreated: boolean;
  onArchive?: (id: string, title: string) => void;
  onCancel?: (id: string, title: string) => void;
  onLeave?: (id: string, title: string) => void;
}) {
  if (count === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase text-slate-400">
        {title} ({count})
      </h2>
      <div className="space-y-3">
        {items.map((a) => (
          <ActivityCard
            key={a.id}
            activity={a}
            isCreated={isCreated}
            onArchive={onArchive}
            onCancel={onCancel}
            onLeave={onLeave}
          />
        ))}
      </div>
    </section>
  );
}

function ActivityCard({
  activity: a,
  isCreated,
  onArchive,
  onCancel,
  onLeave,
}: {
  activity: Activity;
  isCreated: boolean;
  onArchive?: (id: string, title: string) => void;
  onCancel?: (id: string, title: string) => void;
  onLeave?: (id: string, title: string) => void;
}) {
  const date = a.date_time
    ? new Date(a.date_time).toLocaleDateString("es-VE", { weekday: "short", day: "numeric", month: "short" })
    : "";
  const time = a.date_time
    ? new Date(a.date_time).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })
    : "";
  const isActive = a.status === "active";

  return (
    <div
      className={`rounded-lg border p-4 ${
        isActive
          ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          : "border-slate-100 bg-slate-50 opacity-70 dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div className="mb-2 flex items-start justify-between">
        <Link href={`/voluntarios/${a.id}`} className="font-semibold hover:underline">
          {a.title}
        </Link>
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isCreated
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            }`}
          >
            {isCreated ? "Creador" : "Inscrito"}
          </span>
          {isActive && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Activa
            </span>
          )}
          {!isActive && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {a.status === "archived" ? "Realizada" : "Cancelada"}
            </span>
          )}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>{a.zone}</span>
        {date && <span>{date}</span>}
        {time && <span>{time}</span>}
        <span>{a.member_count} inscritos</span>
      </div>
      {isActive && (
        <div className="flex gap-2">
          {isCreated ? (
            <>
              <Link
                href={`/voluntarios/${a.id}/admin`}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Administrar
              </Link>
              <Link
                href={`/voluntarios/${a.id}/editar`}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Editar
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
            </>
          ) : (
            onLeave && (
              <button
                onClick={() => onLeave(a.id, a.title)}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Salir
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-slate-500">
        {tab === "created"
          ? "No has creado ninguna actividad aun."
          : "No te has inscrito en ninguna actividad aun."}
      </p>
      <Link
        href="/voluntarios"
        className="mt-3 inline-block text-sm font-medium text-slate-700 underline hover:text-slate-900 dark:text-slate-300"
      >
        {tab === "created" ? "Crear mi primera actividad" : "Explorar actividades"}
      </Link>
    </div>
  );
}
