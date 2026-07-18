"use client";

import { useEffect, useState, type ReactNode } from "react";

const PREFIX = "sismo_guide_";

export function PageGuide({
  id,
  title,
  children,
}: {
  /** Clave única de la página; la guía se muestra una sola vez. */
  id: string;
  title: string;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(PREFIX + id)) setVisible(true);
  }, [id]);

  if (!visible) return null;

  const dismiss = () => {
    if (typeof window !== "undefined") localStorage.setItem(PREFIX + id, "1");
    setVisible(false);
  };

  return (
    <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            {title}
          </p>
          <div className="mt-1 text-sm leading-snug text-emerald-700/90 dark:text-emerald-200/80">
            {children}
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 dark:bg-emerald-500"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
