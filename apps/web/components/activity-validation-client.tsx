"use client";

import { useState } from "react";
import { csrfHeaders } from "@/lib/auth/csrf-client";

type Activity = {
  id: string;
  title: string;
  status: string;
  creator_id: string;
  is_external_official?: boolean;
  validated_at?: string | null;
  validated_by_name?: string | null;
  validation_notes?: string | null;
};

type User = { id: string; role: string } | null;

export function ActivityValidationClient({
  activity,
  user,
  onChanged,
}: {
  activity: Activity;
  user: User;
  onChanged?: () => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  if (!activity.is_external_official) return null;

  const isCreator = user?.id === activity.creator_id;
  const isAdmin = user?.role === "admin";

  const call = async (path: string, method: string, body?: unknown) => {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/v1/activities/${activity.id}${path}`, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeaders(method) },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || "Error en la operación");
      }
      onChanged?.();
    } catch (e: any) {
      setError(e.message || "Error");
    } finally {
      setProcessing(false);
    }
  };

  const showSubmit = isCreator && activity.status === "active";
  const showReview = isAdmin && activity.status === "pending_validation";

  return (
    <div className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="mb-3 text-sm font-semibold">Validación de actividad externa</h2>

      {showSubmit && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Completa los datos relevantes, las horas y sube al menos un comprobante
            fotográfico, luego envíala a revisión de un administrador.
          </p>
          <button
            onClick={() => call("/submit-validation", "POST")}
            disabled={processing}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500"
          >
            {processing ? "Enviando..." : "Enviar a validación"}
          </button>
        </div>
      )}

      {showReview && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Revisa la evidencia, los datos relevantes y la constancia, luego valida
            o devuelve la actividad al becario.
          </p>
          {!rejectOpen ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => call("/validate", "POST", { notes: "" })}
                disabled={processing}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500"
              >
                {processing ? "Procesando..." : "Validar"}
              </button>
              <button
                onClick={() => setRejectOpen(true)}
                disabled={processing}
                className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:bg-[#18181b] dark:text-rose-400 dark:hover:bg-rose-950"
              >
                Rechazar
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Motivo del rechazo (obligatorio)"
                rows={2}
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => call("/reject-validation", "POST", { notes: rejectReason })}
                  disabled={processing || !rejectReason.trim()}
                  className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  Confirmar rechazo
                </button>
                <button
                  onClick={() => {
                    setRejectOpen(false);
                    setRejectReason("");
                  }}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(activity.validated_at || activity.validation_notes) && (
        <div className="space-y-1 text-sm">
          {activity.validated_at && (
            <p className="text-emerald-700 dark:text-[#079669]">
              Validada el{" "}
              {new Date(activity.validated_at).toLocaleString("es-VE")}
              {activity.validated_by_name ? ` por ${activity.validated_by_name}` : ""}
            </p>
          )}
          {activity.validation_notes && (
            <p className="text-zinc-600 dark:text-zinc-400">
              <span className="font-medium">Notas:</span> {activity.validation_notes}
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
