"use client";

import { cn } from "@/lib/utils";

type Zone = { name: string; count: number };

export function ZoneFilter({
  zones,
  active,
  onChange,
}: {
  zones: Zone[];
  active: string | null;
  onChange: (zone: string | null) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      <button
        onClick={() => onChange(null)}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-medium transition",
          active === null
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
        )}
      >
        Todas
      </button>
      {zones.map((z) => (
        <button
          key={z.name}
          onClick={() => onChange(z.name)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition",
            active === z.name
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          )}
        >
          {z.name} ({z.count})
        </button>
      ))}
    </div>
  );
}
