"use client";

import { useCallback, useEffect, useState } from "react";
import { imageTooLarge, MAX_IMAGE_BYTES } from "@/lib/file";
import { csrfHeaders } from "@/lib/auth/csrf-client";
import type { ActivityEvidence } from "@/lib/types";

type ActivityEvidenceProps = {
  activityId: string;
  currentUserId: string | null;
  creatorId: string;
  canUpload: boolean;
  maxImages?: number;
};

export function ActivityEvidence({
  activityId,
  currentUserId,
  creatorId,
  canUpload,
  maxImages = 10,
}: ActivityEvidenceProps) {
  const [items, setItems] = useState<ActivityEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  // Comprobantes propios del usuario actual.
  const myCount = items.filter((e) => e.uploaded_by === currentUserId).length;
  const room = Math.max(0, maxImages - myCount);
  const atLimit = myCount >= maxImages;

  const canDelete = (ev: ActivityEvidence) =>
    canUpload &&
    (currentUserId === creatorId || ev.uploaded_by === currentUserId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/v1/activities/${activityId}/evidence`,
        { credentials: "include" },
      );
      const data = res.ok ? await res.json() : [];
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activityId, API]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    setError(null);
    const picked = Array.from(list);
    const accepted: File[] = [];
    for (const f of picked) {
      if (!f.type.startsWith("image/")) {
        setError("Solo se permiten imagenes.");
        continue;
      }
      if (imageTooLarge(f)) {
        setError(`Cada imagen debe pesar menos de ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length > room) {
      setError(`Solo puedes subir hasta ${maxImages} comprobantes en total.`);
      accepted.splice(room);
    }
    setFiles((prev) => [...prev, ...accepted].slice(0, room));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const images: string[] = await Promise.all(
        files.map(
          (f) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
              reader.readAsDataURL(f);
            }),
        ),
      );
      const res = await fetch(
        `${API}/api/v1/activities/${activityId}/evidence`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...csrfHeaders("POST") },
          body: JSON.stringify({ images }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || "Error al subir los comprobantes");
      }
      const data = await res.json();
      setItems((prev) => [...prev, ...(data.items ?? [])]);
      setFiles([]);
    } catch (e: any) {
      setError(e?.message || "Error al subir los comprobantes");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (evidenceId: string) => {
    setRemovingId(evidenceId);
    setError(null);
    try {
      const res = await fetch(
        `${API}/api/v1/activities/${activityId}/evidence/${evidenceId}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: csrfHeaders("DELETE"),
        },
      );
      if (!res.ok) throw new Error("No se pudo eliminar el comprobante");
      setItems((prev) => prev.filter((x) => x.id !== evidenceId));
    } catch (e: any) {
      setError(e?.message || "No se pudo eliminar el comprobante");
    } finally {
      setRemovingId(null);
    }
  };

  // Ocultar la seccion por completo si no hay nada que mostrar y el usuario
  // no puede gestionar comprobantes (p.ej. tercero no inscrito).
  if (!canUpload && !loading && items.length === 0) return null;

  return (
    <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-700">
      <h2 className="mb-1 text-sm font-semibold">Comprobantes de la actividad</h2>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        {currentUserId === creatorId
          ? "Fotos que verifican la realizacion de la actividad."
          : "Sube tus fotos de la actividad. Tambien veras las del organizador."}
      </p>

      {canUpload && (
        <p className="mb-3 text-xs font-medium">
          {myCount > 0 ? (
            <span className="text-emerald-700 dark:text-[#079669]">
              Ya cargaste {myCount} comprobante{myCount === 1 ? "" : "s"}.
            </span>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">
              Aun no has cargado tus comprobantes.
            </span>
          )}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Cargando comprobantes...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Aun no hay comprobantes cargados.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((ev) => {
            const isCreatorEvidence = ev.uploaded_by === creatorId;
            return (
              <div key={ev.id} className="relative">
                <img
                  src={ev.image_url}
                  alt="Comprobante de la actividad"
                  className="aspect-square w-full rounded-lg border border-zinc-200 object-cover dark:border-zinc-800"
                />
                {isCreatorEvidence && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white">
                    Organizador
                  </span>
                )}
                {canDelete(ev) && (
                  <button
                    type="button"
                    onClick={() => handleRemove(ev.id)}
                    disabled={removingId === ev.id}
                    aria-label="Eliminar comprobante"
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white transition hover:bg-rose-600 disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canUpload && (
        <div className="mt-4">
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={atLimit || uploading}
            onChange={(e) => handleFiles(e.target.files)}
            className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-[#eaebed] file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 disabled:opacity-50 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300"
          />

          {files.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {f.name}
                </span>
              ))}
            </div>
          )}

          {error && (
            <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}

          {files.length > 0 && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500"
            >
              {uploading
                ? "Subiendo..."
                : `Subir ${files.length} comprobante${files.length === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
