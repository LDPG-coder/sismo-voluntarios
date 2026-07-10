"use client";

import { useCallback, useRef, useState } from "react";
import { csrfHeaders } from "@/lib/auth/csrf-client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const VIEW = 260;
const OUTPUT = 320;

export function ProfilePhoto({ initialPhotoUrl }: { initialPhotoUrl: string | null }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl);
  const [pending, setPending] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const openPicker = () => fileRef.current?.click();

  const loadFile = (file: File | undefined | null) => {
    setError(null);
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Solo se permiten imagenes JPG o PNG.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("La imagen es demasiado pesada (max 4MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setPending(src);
      setNatural(null);
      setOffset({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    loadFile(e.dataTransfer.files?.[0]);
  };

  const clampOffset = useCallback(
    (next: { x: number; y: number }, nat: { w: number; h: number } | null, z: number) => {
      if (!nat) return next;
      const baseScale = Math.max(VIEW / nat.w, VIEW / nat.h);
      const dispW = nat.w * baseScale * z;
      const dispH = nat.h * baseScale * z;
      const maxX = dispW > VIEW ? (dispW - VIEW) / 2 : 0;
      const maxY = dispH > VIEW ? (dispH - VIEW) / 2 : 0;
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    []
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!natural) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !natural) return;
    const next = clampOffset(
      { x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) },
      natural,
      zoom
    );
    setOffset(next);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const exportCropped = (): string | null => {
    if (!imgRef.current || !natural) return null;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const baseScale = Math.max(VIEW / natural.w, VIEW / natural.h);
    const dispW = natural.w * baseScale * zoom;
    const dispH = natural.h * baseScale * zoom;
    const scale = baseScale * zoom;
    const sx = (dispW / 2 - VIEW / 2 - offset.x) / scale;
    const sy = (dispH / 2 - VIEW / 2 - offset.y) / scale;
    const sSize = VIEW / scale;
    ctx.drawImage(imgRef.current, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT);
    return canvas.toDataURL("image/jpeg", 0.85);
  };

  const save = async () => {
    const cropped = exportCropped();
    if (!cropped) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/v1/users/me/photo`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeaders("PUT") },
        body: JSON.stringify({ photo: cropped }),
      });
      if (!res.ok) throw new Error("No se pudo guardar la foto");
      const data = await res.json();
      setPhotoUrl(data.photo_url ?? cropped);
      setPending(null);
      setNatural(null);
    } catch (e: any) {
      setError(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/v1/users/me/photo`, {
        method: "DELETE",
        credentials: "include",
        headers: csrfHeaders("DELETE"),
      });
      if (!res.ok) throw new Error("No se pudo eliminar la foto");
      setPhotoUrl(null);
      setPending(null);
    } catch (e: any) {
      setError(e.message || "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#18181b]">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Foto de perfil</h2>
      <p className="mb-4 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Se muestra en tu perfil y en las actividades que participes.
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
          {error}
        </p>
      )}

      {!pending ? (
        <>
          <div
            onClick={openPicker}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed p-4 transition ${
              dragOver
                ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/20"
                : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
            }`}
          >
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-zinc-400">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="min-w-0 text-sm">
              <p className="font-medium text-zinc-700 dark:text-zinc-200">
                Arrastra una imagen o selecciónala
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                JPG o PNG · podrás recortarla en un cuadrado antes de guardar.
              </p>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => loadFile(e.target.files?.[0])}
          />

          <div className="mt-4 flex gap-2">
            <button
              onClick={openPicker}
              className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              Cambiar foto
            </button>
            <button
              onClick={remove}
              disabled={deleting || !photoUrl}
              className="rounded-md bg-[#f7cdd9] px-4 py-1.5 text-xs font-semibold text-[#f42366] shadow-sm transition hover:brightness-95 disabled:opacity-50 dark:bg-[#f42366]/20 dark:text-[#f7cdd9]"
            >
              Eliminar
            </button>
          </div>
        </>
      ) : (
        <>
          <div
            className="relative mx-auto overflow-hidden rounded-xl border border-zinc-200 bg-black/5 dark:border-zinc-700"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={pending}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                setNatural({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              className="max-w-none select-none"
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: natural ? natural.w * Math.max(VIEW / natural.w, VIEW / natural.h) * zoom : VIEW,
                height: natural ? natural.h * Math.max(VIEW / natural.w, VIEW / natural.h) * zoom : VIEW,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                cursor: "grab",
              }}
            />
          </div>

          <div className="mx-auto mt-3 max-w-[260px]">
            <label className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => {
                  const z = Number(e.target.value);
                  setZoom(z);
                  setOffset((o) => clampOffset(o, natural, z));
                }}
                className="w-40 accent-emerald-600"
              />
            </label>
            <p className="mt-1 text-center text-xs text-zinc-400">
              Arrastra la imagen para encuadrarla.
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar foto"}
            </button>
            <button
              onClick={() => {
                setPending(null);
                setNatural(null);
                setError(null);
              }}
              disabled={saving}
              className="rounded-md border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
