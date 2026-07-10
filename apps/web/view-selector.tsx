"use client";

import { cn } from "@/lib/utils";

export type ViewType = "list" | "gantt" | "week" | "month";

type ViewSelectorProps = {
  active: ViewType;
  onChange: (view: ViewType) => void;
};

const views: { type: ViewType; icon: React.ReactNode; label: string }[] = [
  {
    type: "list",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
      </svg>
    ),
    label: "Lista",
  },
  {
    type: "month",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5m0 0A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v0m0 0v0" />
      </svg>
    ),
    label: "Mes",
  },
  {
    type: "week",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    label: "Semana",
  },
  {
    type: "gantt",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
      </svg>
    ),
    label: "Gantt",
  },
];

export function ViewSelector({ active, onChange }: ViewSelectorProps) {
  return (
    <div className="inline-flex rounded-lg bg-[#eaebed] p-1 dark:bg-slate-800">
      {views.map((view) => (
        <button
          key={view.type}
          onClick={() => onChange(view.type)}
          title={view.label}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
            active === view.type
              ? "bg-white text-emerald-600 shadow-sm dark:bg-slate-700 dark:text-emerald-400"
              : "text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          )}
        >
          {view.icon}
        </button>
      ))}
    </div>
  );
}