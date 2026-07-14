"use client";

import { cn } from "@/lib/utils";

const TYPE_META: Record<string, { icon: string; color: string }> = {
  created: { icon: "🌱", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
  evaluation_started: { icon: "🔍", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  approved: { icon: "✅", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
  first_donation: { icon: "💰", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
  in_kind_received: { icon: "📦", color: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  execution_started: { icon: "🚀", color: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  update_published: { icon: "📝", color: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  accountability_published: { icon: "📊", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  finished: { icon: "🏁", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
};

export function ProjectTimeline({
  events,
}: {
  events: { id: string; type: string; title: string; created_at: string | null }[];
}) {
  if (!events.length) {
    return <p className="text-sm text-zinc-500">Aún no hay actividad registrada.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-zinc-200 pl-5 dark:border-zinc-800">
      {events.map((e) => {
        const meta = TYPE_META[e.type] ?? TYPE_META.update_published;
        return (
          <li key={e.id} className="relative">
            <span
              className={cn(
                "absolute -left-[1.65rem] flex h-7 w-7 items-center justify-center rounded-full text-sm",
                meta.color,
              )}
            >
              {meta.icon}
            </span>
            <p className="text-sm font-medium">{e.title}</p>
            {e.created_at && (
              <p className="text-xs text-zinc-400">{new Date(e.created_at).toLocaleString("es")}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
