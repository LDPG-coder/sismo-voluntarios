"use client";

import { useEffect, useState } from "react";
import { csrfHeaders } from "@/lib/auth/csrf-client";

type CedeActivity = {
  id: string;
  title: string;
  date_time: string;
  zone: string;
};

type DirectoryUser = {
  id: string;
  name: string;
  photo_url: string | null;
};

type CedeDialogProps = {
  open: boolean;
  activity: CedeActivity;
  onCancel: () => void;
  onCeded: () => void;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function CedeDialog({ open, activity, onCancel, onCeded }: CedeDialogProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<DirectoryUser[]>([]);
  const [selected, setSelected] = useState<DirectoryUser | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const dateLabel = activity.date_time
    ? new Date(activity.date_time).toLocaleDateString("es-VE", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/voluntarios/${activity.id}`
      : "";

  const shareText = `Hola, estoy cediendo mi cupo en la actividad "${activity.title}" (${dateLabel}, ${activity.zone}). Si te interesa, avisame para pasartelo. ${link}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !transferring) onCancel();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onCancel, transferring]);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setResults([]);
    setSelected(null);
    setError(null);
    setCopied(false);
  }, [open]);

  useEffect(() => {
    if (!open || search.trim().length === 0) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`${API}/api/v1/users/directory?search=${encodeURIComponent(search.trim())}&activity_id=${encodeURIComponent(activity.id)}`, {
        credentials: "include",
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((d: DirectoryUser[]) => setResults(d))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [search, open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silencioso
    }
  };

  const confirmTransfer = async () => {
    if (!selected) return;
    setTransferring(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/v1/activities/${activity.id}/transfer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeaders("POST") },
        body: JSON.stringify({ to_user_id: selected.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          (data && (data.detail || data.message)) ||
          "No se pudo ceder el cupo";
        throw new Error(msg);
      }
      onCeded();
      onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo ceder el cupo");
    } finally {
      setTransferring(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !transferring && onCancel()} />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-[#18181b]">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Ceder mi cupo
        </h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Comparte esta informacion en tus medios privados y luego busca al becario
          al que le cederas el cupo.
        </p>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-[#f4f5f7] p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {shareText}
          </p>
          <button
            onClick={copy}
            className="mt-3 rounded-md bg-[#eaebed] px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {copied ? "Copiado" : "Copiar texto"}
          </button>
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Buscar becario por nombre
          </label>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelected(null);
            }}
            placeholder="Escribe un nombre..."
            className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          />

          <div className="mt-3 space-y-2">
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelected(u)}
                className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition ${
                  selected?.id === u.id
                    ? "border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/30"
                    : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                }`}
              >
                {u.photo_url ? (
                  <img src={u.photo_url} alt={u.name} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm text-zinc-900 dark:text-zinc-100">{u.name}</span>
              </button>
            ))}
            {search.trim().length > 0 && results.length === 0 && (
              <p className="text-sm text-zinc-400">Sin resultados</p>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={transferring}
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            onClick={confirmTransfer}
            disabled={!selected || transferring}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            {transferring ? "Cediendo..." : selected ? `Ceder a ${selected.name.split(" ")[0]}` : "Selecciona un becario"}
          </button>
        </div>
      </div>
    </div>
  );
}
