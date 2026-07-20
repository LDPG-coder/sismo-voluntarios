"use client";

import { useCallback } from "react";

export type ColumnDef = { key: string; label: string };

type ColumnSelectorProps = {
  columns: readonly ColumnDef[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
};

export function ColumnSelector({ columns, selected, onChange }: ColumnSelectorProps) {
  const toggle = useCallback(
    (key: string) => {
      const next = new Set(selected);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onChange(next);
    },
    [selected, onChange],
  );

  const selectAll = useCallback(() => onChange(new Set(columns.map((c) => c.key))), [columns, onChange]);
  const selectNone = useCallback(() => onChange(new Set()), [onChange]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-medium">Columnas a exportar</span>
        <button onClick={selectAll} className="text-emerald-600 hover:underline dark:text-emerald-400">
          Todas
        </button>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <button onClick={selectNone} className="text-zinc-400 hover:underline dark:text-zinc-500">
          Ninguna
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {columns.map((col) => {
          const active = selected.has(col.key);
          return (
            <button
              key={col.key}
              onClick={() => toggle(col.key)}
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950 dark:text-emerald-300"
                  : "border-zinc-200 bg-white text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
              }`}
            >
              {active && (
                <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
              {col.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
