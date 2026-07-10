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
            ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white"
            : "bg-[#eaebed] text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
        )}
      >
        Todas
      </button>
      {(Array.isArray(zones) ? zones : []).map((z) => (
        <button
          key={z.name}
          onClick={() => onChange(z.name)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition",
            active === z.name
              ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white"
              : "bg-[#eaebed] text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
          )}
        >
          {z.name} ({z.count})
        </button>
      ))}
    </div>
  );
}
