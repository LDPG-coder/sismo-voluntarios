"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MisActividadesSkeleton } from "@/components/skeletons";
import { ActivityStatusBadges } from "@/components/activity-status-badges";
import { CedeDialog } from "@/components/cede-dialog";
import { csrfHeaders } from "@/lib/auth/csrf-client";
import { useSession } from "@/components/session-provider";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Activity {
  id: string;
  title: string;
  description: string | null;
  zone: string;
  raw_address: string;
  date_time: string;
  end_time: string | null;
  estimated_duration_min: number | null;
  max_participants: number | null;
  requirements: string | null;
  contact_info: string | null;
  is_internal?: boolean;
  is_private?: boolean;
  creator_id: string;
  member_count: number;
  status: string;
  my_attended?: boolean | null;
  created_at: string;
}

type Tab = "created" | "enrolled" | "ceded";

export function MisActividadesClient() {
  const [tab, setTab] = useState<Tab>("created");
  const [created, setCreated] = useState<Activity[]>([]);
  const [enrolled, setEnrolled] = useState<Activity[]>([]);
  const [ceded, setCeded] = useState<Activity[]>([]);
  const [loadingCreated, setLoadingCreated] = useState(true);
  const [loadingEnrolled, setLoadingEnrolled] = useState(true);
  const [loadingCeded, setLoadingCeded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; title: string; action: "cancel" | "archive" } | null>(null);
  const [processing, setProcessing] = useState(false);
  const { user } = useSession();
  const canCreate = !!user;

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

    fetch(`${API}/api/v1/activities/ceded`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCeded(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingCeded(false));
  }, []);

  // Asegura la publicacion privada de practica (induccion) para el becario.
  // Idempotente en el servidor: cubre usuarios que ya terminaron el tour o
  // cuyo disparo inicial no llego. Solo aplica a no-admin.
  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") return;
    fetch(`${API}/api/v1/activities/demo/ensure`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...csrfHeaders("POST") },
    }).catch(() => {});
  }, [user]);

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
      if (!res.ok) throw new Error("Error al procesar");
      const newStatus = confirmAction.action === "archive" ? "archived" : "cancelled";
      setCreated((prev) =>
        prev.map((a) => (a.id === confirmAction.id ? { ...a, status: newStatus } : a))
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(false);
      setConfirmAction(null);
    }
  };

  const activities = tab === "created" ? created : tab === "enrolled" ? enrolled : ceded;
  const loading = tab === "created" ? loadingCreated : tab === "enrolled" ? loadingEnrolled : loadingCeded;
  const variant: "created" | "enrolled" | "ceded" = tab;
  const active = activities.filter((a) => a.status === "active");
  const archived = activities.filter((a) => a.status === "archived");
  const cancelled = activities.filter((a) => a.status === "cancelled");
  const isCreated = tab === "created";
  const pendingConfirm =
    tab === "created"
      ? created.filter(
          (a) => a.status === "active" && new Date(a.date_time) < new Date(),
        )
      : [];

  return (
    <div>
      <main className="mx-auto max-w-4xl px-4 pt-8 pb-4">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">Mis actividades</h1>
          {canCreate && (
            <Link
              href="/voluntarios/crear"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-white"
            >
              + Nueva
            </Link>
          )}
        </div>

        <div className="mb-6 flex gap-1 rounded-xl bg-[#eaebed] p-1 dark:bg-zinc-800">
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
          <TabButton
            active={tab === "ceded"}
            onClick={() => setTab("ceded")}
            count={ceded.length}
          >
            Cedidos
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
              title="Pendientes por confirmar"
              count={pendingConfirm.length}
              items={pendingConfirm}
              isCreated={isCreated}
              variant={variant}
              estado="pending"
            />
            <Section
              title="Activas"
              count={active.length}
              items={active}
              isCreated={isCreated}
              variant={variant}
              estado="active"
              onArchive={(id, title) => setConfirmAction({ id, title, action: "archive" })}
              onCancel={(id, title) => setConfirmAction({ id, title, action: "cancel" })}
              onCeded={(id) => setEnrolled((prev) => prev.filter((a) => a.id !== id))}
            />
            <Section
              title="Realizadas"
              count={archived.length}
              items={archived}
              isCreated={isCreated}
              variant={variant}
              estado="archived"
            />
            <Section
              title="Canceladas"
              count={cancelled.length}
              items={cancelled}
              isCreated={isCreated}
              variant={variant}
              estado="cancelled"
            />
          </>
        )}
      </main>

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-[#18181b]">
            <h3 className="mb-2 text-lg font-bold">
              {confirmAction.action === "archive"
                ? "Marcar como realizada"
                : "Cancelar actividad"}
            </h3>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              {confirmAction.action === "archive"
                ? `"${confirmAction.title}" sera marcada como realizada. Los inscritos seran notificados.`
                : `"${confirmAction.title}" sera cancelada. Los inscritos seran notificados.`}
            </p>
            {confirmAction.action === "archive" && (
              <p className="mb-4 text-xs text-amber-600 dark:text-amber-400">
                Nota: una vez marcada como realizada, los inscritos ya no podran subir comprobantes de asistencia.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-emerald-700"
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
                {processing
                  ? "Procesando..."
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
          ? "bg-white text-emerald-600 shadow-sm dark:bg-zinc-700 dark:text-emerald-400"
          : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      }`}
    >
      {children}
      {count > 0 && (
        <span className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${
          active
            ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white"
            : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
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
  variant = "created",
  estado,
  onArchive,
  onCancel,
  onCeded,
}: {
  title: string;
  count: number;
  items: Activity[];
  isCreated: boolean;
  variant?: "created" | "enrolled" | "ceded";
  estado: string;
  onArchive?: (id: string, title: string) => void;
  onCancel?: (id: string, title: string) => void;
  onCeded?: (id: string) => void;
}) {
  if (count === 0) return null;
  const visible = items;
  const titleEl = (
    <>
      {title} ({count})
    </>
  );
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-400">
        {titleEl}
      </h2>
      <div className="space-y-3">
        {visible.map((a) => (
          <ActivityCard
            key={a.id}
            activity={a}
            isCreated={isCreated}
            variant={variant}
            onArchive={onArchive}
            onCancel={onCancel}
            onCeded={onCeded}
          />
        ))}
      </div>
    </section>
  );
}

export function ActivityCard({
  activity: a,
  isCreated,
  variant = "created",
  onArchive,
  onCancel,
  onCeded,
}: {
  activity: Activity;
  isCreated: boolean;
  variant?: "created" | "enrolled" | "ceded";
  onArchive?: (id: string, title: string) => void;
  onCancel?: (id: string, title: string) => void;
  onCeded?: (id: string) => void;
}) {
  const [ceding, setCeding] = useState(false);
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
          ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#18181b]"
          : "border-zinc-100 bg-zinc-50 opacity-70 dark:border-zinc-800 dark:bg-[#18181b]"
      }`}
    >
      <div className="mb-2 flex items-start justify-between">
        <Link href={`/voluntarios/${a.id}`} className="font-semibold hover:underline">
          {a.title}
        </Link>
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              variant === "ceded"
                ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                : isCreated
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            }`}
          >
            {variant === "ceded" ? "Cedido" : isCreated ? "Creador" : "Inscrito"}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              a.is_private
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            }`}
          >
            {a.is_private ? "Registro previo" : "Proponer"}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{a.zone}</span>
          {date && <span>{date}</span>}
          {time && <span>{time}</span>}
          <span>{a.member_count} inscritos</span>
          <ActivityStatusBadges activity={a} isEnrolled={!isCreated} />
        </div>
        {isActive && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end sm:gap-2">
            {isCreated ? (
            <>
              {a.is_private ? null : (
                <Link
                  href={`/voluntarios/${a.id}/admin`}
                  className="rounded-md bg-[#eaebed] px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:brightness-95 dark:bg-zinc-700 dark:text-zinc-200"
                >
                  Administrar
                </Link>
              )}
              <Link
                href={`/voluntarios/${a.id}/editar`}
                className="rounded-md bg-[#eaebed] px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:brightness-95 dark:bg-zinc-700 dark:text-zinc-200"
              >
                Editar
              </Link>
              {onArchive && (
                <button
                  onClick={() => onArchive(a.id, a.title)}
                  className="rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 shadow-sm transition hover:brightness-95 dark:bg-amber-900/30 dark:text-amber-400"
                >
                  Realizada
                </button>
              )}
              {onCancel && (
                <button
                  onClick={() => onCancel(a.id, a.title)}
                  className="rounded-md bg-[#f7cdd9] px-3 py-1.5 text-xs font-medium text-[#f42366] shadow-sm transition hover:brightness-95 dark:bg-[#f42366]/20 dark:text-[#f7cdd9]"
                >
                  Cancelar
                </button>
              )}
            </>
            ) : (
            onCeded && (
              <button
                onClick={() => setCeding(true)}
                className="rounded-md bg-[#eaebed] px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm transition hover:brightness-95 dark:bg-zinc-700 dark:text-zinc-300"
              >
                Ceder cupo
              </button>
            )
          )}
        </div>
        )}
      </div>
      <CedeDialog
        open={ceding}
        activity={{ id: a.id, title: a.title, date_time: a.date_time, zone: a.zone }}
        onCancel={() => setCeding(false)}
        onCeded={() => {
          setCeding(false);
          onCeded?.(a.id);
        }}
      />
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-zinc-500">
        {tab === "created"
          ? "No has creado ninguna actividad aún."
          : tab === "enrolled"
            ? "No te has inscrito en ninguna actividad aún."
            : "No has cedido ningún cupo aún."}
      </p>
      <Link
        href="/voluntarios"
        className="mt-3 inline-block text-sm font-medium text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300"
      >
        {tab === "created" ? "Crear mi primera actividad" : "Explorar actividades"}
      </Link>
    </div>
  );
}
