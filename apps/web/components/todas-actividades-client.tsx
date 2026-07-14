"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ActivityCard, type Activity } from "@/components/mis-actividades-client";
import { useSession } from "@/components/session-provider";
import { csrfHeaders } from "@/lib/auth/csrf-client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Tab = "created" | "enrolled";

const TITLE: Record<string, string> = {
  pending: "Pendientes por confirmar",
  active: "Activas",
  archived: "Realizadas",
  cancelled: "Canceladas",
};

function filterByEstado(list: Activity[], estado: string): Activity[] {
  const now = new Date();
  if (estado === "pending") {
    return list.filter((a) => a.status === "active" && new Date(a.date_time) < now);
  }
  if (estado === "active") return list.filter((a) => a.status === "active");
  if (estado === "archived") return list.filter((a) => a.status === "archived");
  if (estado === "cancelled") return list.filter((a) => a.status === "cancelled");
  return list;
}

export function TodasActividadesClient({ tab, estado }: { tab: Tab; estado: string }) {
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; title: string; action: "cancel" | "archive" } | null>(null);
  const [processing, setProcessing] = useState(false);
  const { user } = useSession();
  // TEMPORAL (ver docs/external-users-access.md): también los usuarios externos
  // (google) pueden crear actividades.
  const canCreate =
    user?.auth_source === "sep" || user?.role === "admin" || user?.auth_source === "google";
  const isCreated = tab === "created";

  useEffect(() => {
    setLoading(true);
    const url = isCreated
      ? `${API}/api/v1/activities/mine`
      : `${API}/api/v1/activities/enrolled`;
    fetch(url, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setError("No se pudieron cargar las actividades"))
      .finally(() => setLoading(false));
  }, [isCreated]);

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
      setItems((prev) =>
        prev.map((a) => (a.id === confirmAction.id ? { ...a, status: newStatus } : a))
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(false);
      setConfirmAction(null);
    }
  };

  const visible = filterByEstado(items, estado);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href="/mis-actividades"
              className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
            >
              ← Volver a Mis actividades
            </Link>
            <h1 className="mt-1 text-xl font-bold">{TITLE[estado] ?? "Actividades"}</h1>
          </div>
          {canCreate && isCreated && (
            <Link
              href="/voluntarios/crear"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-white"
            >
              + Nueva
            </Link>
          )}
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-zinc-500">Cargando...</p>
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">
            No hay actividades en esta sección.
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                isCreated={isCreated}
                onArchive={(id, title) => setConfirmAction({ id, title, action: "archive" })}
                onCancel={(id, title) => setConfirmAction({ id, title, action: "cancel" })}
                onCeded={(id) => setItems((prev) => prev.filter((x) => x.id !== id))}
              />
            ))}
          </div>
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
