"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "privacy-notice-ack";

const PRIVACY_TEXT =
  "La información aquí suministrada será utilizada por Proexcelencia únicamente para fines administrativos y de gestión interna, incluyendo la gestión de actividades y procesos relacionados a los becarios.";

export function PrivacyNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  const acknowledge = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Si no se puede persistir, igual cerramos para no bloquear el acceso.
    }
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-notice-title"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-[#18181b]">
        <h2
          id="privacy-notice-title"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          Aviso de privacidad
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {PRIVACY_TEXT}
        </p>
        <button
          onClick={acknowledge}
          className="mt-6 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
