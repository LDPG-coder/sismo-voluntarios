"use client";

import Link from "next/link";

type ActivityType = "proponer" | "realizada";

interface ActivityTypeSelectorProps {
  onSelect: (type: ActivityType) => void;
}

const TYPES = [
  {
    type: "proponer" as const,
    title: "Proponer",
    description: "Propón una actividad a la que vayas para que otros becarios puedan sumarse.",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
    color: "emerald",
    bgClass: "bg-emerald-50 dark:bg-emerald-900/20",
    borderClass: "border-emerald-200 dark:border-emerald-800",
    textClass: "text-emerald-700 dark:text-emerald-400",
    hoverClass: "hover:border-emerald-400 dark:hover:border-emerald-600",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  {
    type: "realizada" as const,
    title: "Registro previo",
    description: "Documenta cualquier actividad de voluntariado que hayas realizado por tu cuenta.",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "amber",
    bgClass: "bg-amber-50 dark:bg-amber-900/20",
    borderClass: "border-amber-200 dark:border-amber-800",
    textClass: "text-amber-700 dark:text-amber-400",
    hoverClass: "hover:border-amber-400 dark:hover:border-amber-600",
    iconBg: "bg-amber-100 dark:bg-amber-900/40",
  },
];

export function ActivityTypeSelector({ onSelect }: ActivityTypeSelectorProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 pb-4">
      <Link
        href="/voluntarios"
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Volver
      </Link>
      <h1 className="mb-2 text-xl font-semibold">Nueva actividad</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Elegí el tipo de actividad que querés crear.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {TYPES.map((t) => (
          <button
            key={t.type}
            onClick={() => onSelect(t.type)}
            className={`group flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center transition-all hover:scale-[1.02] ${t.borderClass} ${t.bgClass} ${t.hoverClass}`}
          >
            <div className={`rounded-full p-3 ${t.iconBg} ${t.textClass}`}>
              {t.icon}
            </div>
            <div>
              <h2 className={`text-sm font-semibold ${t.textClass}`}>{t.title}</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {t.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
