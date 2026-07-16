"use client";

type ActivityType = "proponer" | "oficial" | "realizada";

interface ActivityTypeSelectorProps {
  onSelect: (type: ActivityType) => void;
}

const TYPES = [
  {
    type: "proponer" as const,
    title: "Proponer",
    description: "Crea una actividad para que otros becarios se inscriban.",
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
    type: "oficial" as const,
    title: "Voluntariados oficiales",
    description: "Registra una actividad con empresa validada que amerita documentación.",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
    color: "blue",
    bgClass: "bg-blue-50 dark:bg-blue-900/20",
    borderClass: "border-blue-200 dark:border-blue-800",
    textClass: "text-blue-700 dark:text-blue-400",
    hoverClass: "hover:border-blue-400 dark:hover:border-blue-600",
    iconBg: "bg-blue-100 dark:bg-blue-900/40",
  },
  {
    type: "realizada" as const,
    title: "Registro previo",
    description: "Documenta una actividad ya realizada con comprobantes fotográficos.",
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
    <div className="mx-auto max-w-2xl px-4 py-8">
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
