import { Skeleton } from "@/components/ui/skeleton";

/* ----------------------------- ActivityCard ----------------------------- */

export function ActivityCardSkeleton({ enrolled = false }: { enrolled?: boolean }) {
  return (
    <div
      className={
        "relative rounded-lg border bg-white p-4 shadow-sm dark:bg-slate-900 " +
        (enrolled
          ? "border-emerald-200 dark:border-emerald-900"
          : "border-slate-200 dark:border-slate-800")
      }
    >
      {enrolled && <Skeleton className="absolute right-3 top-3 h-4 w-16 rounded-full" />}
      <Skeleton className="mb-2 h-4 w-20 rounded-full" />
      <Skeleton className="h-5 w-3/4" />
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-6 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/* --------------------------- Voluntarios (list) -------------------------- */

export function VoluntariosListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <ActivityCardSkeleton key={i} enrolled={i % 3 === 0} />
      ))}
    </div>
  );
}

/* -------------------------- Voluntarios (gantt) -------------------------- */

const HOUR_WIDTH = 60;

export function VoluntariosGanttSkeleton() {
  const hours = Array.from({ length: 17 }, (_, i) => 6 + i);
  const totalWidth = hours.length * HOUR_WIDTH;
  const bars = [
    { left: 60, width: 240 },
    { left: 300, width: 180 },
    { left: 480, width: 300 },
    { left: 720, width: 120 },
    { left: 840, width: 180 },
  ];
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <div style={{ minWidth: totalWidth }}>
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            {hours.map((h) => (
              <div
                key={h}
                className="border-r border-slate-100 px-1 py-2 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500"
                style={{ width: HOUR_WIDTH }}
              >
                {h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}
              </div>
            ))}
          </div>
          <div className="relative" style={{ height: 6 + bars.length * 64 }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-800"
                style={{ left: `${(h - 6) * HOUR_WIDTH}px` }}
              />
            ))}
            {bars.map((b, i) => (
              <Skeleton
                key={i}
                className="absolute rounded-md"
                style={{ left: b.left, width: b.width, height: 52, top: 6 + i * 64 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------- Voluntarios (week) -------------------------- */

const WEEK_HOUR_HEIGHT = 60;

export function VoluntariosWeekSkeleton() {
  const hours = Array.from({ length: 17 }, (_, i) => 6 + i);
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const events = [
    { day: 0, top: 0, height: 90 },
    { day: 1, top: 120, height: 60 },
    { day: 2, top: 60, height: 120 },
    { day: 4, top: 180, height: 90 },
    { day: 5, top: 30, height: 120 },
  ];
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <div className="w-12 shrink-0 border-r border-slate-200 dark:border-slate-800" />
            {days.map((d, i) => (
              <div
                key={i}
                className="flex-1 border-r border-slate-100 px-2 py-3 text-center dark:border-slate-800"
              >
                <Skeleton className="mx-auto h-3 w-8" />
                <Skeleton className="mx-auto mt-1.5 h-6 w-6 rounded-full" />
              </div>
            ))}
          </div>
          <div className="relative flex">
            <div className="w-12 shrink-0 border-r border-slate-200 dark:border-slate-800">
              {hours.map((h) => (
                <div
                  key={h}
                  className="border-b border-slate-100 dark:border-slate-800/50"
                  style={{ height: WEEK_HOUR_HEIGHT }}
                />
              ))}
            </div>
            <div
              className="relative flex-1"
              style={{ height: hours.length * WEEK_HOUR_HEIGHT }}
            >
              {days.map((_, dayIdx) => (
                <div
                  key={dayIdx}
                  className="absolute top-0 bottom-0 border-r border-slate-100 dark:border-slate-800/50"
                  style={{ left: `${(dayIdx / 7) * 100}%`, width: `${100 / 7}%` }}
                />
              ))}
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-b border-slate-100 dark:border-slate-800/50"
                  style={{ top: `${(h - 6) * WEEK_HOUR_HEIGHT}px` }}
                />
              ))}
              {events.map((e, i) => {
                const dayWidth = 100 / 7;
                const left = e.day * dayWidth;
                return (
                  <Skeleton
                    key={i}
                    className="absolute rounded border px-1.5 py-1"
                    style={{
                      left: `calc(${left}% + 2px)`,
                      width: `calc(${dayWidth}% - 4px)`,
                      top: e.top,
                      height: e.height,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------- Voluntarios (month) -------------------------- */

export function VoluntariosMonthSkeleton() {
  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const cells = Array.from({ length: 42 }, (_, i) => i);
  const chipDays = new Set([4, 9, 12, 15, 20, 23, 28, 31]);
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
        {weekDays.map((d) => (
          <div
            key={d}
            className="px-2 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((i) => (
          <div
            key={i}
            className="min-h-[80px] border-b border-r border-slate-100 p-1.5 dark:border-slate-800"
          >
            <Skeleton className={"h-6 w-6 rounded-full " + (i < 5 ? "opacity-40" : "")} />
            {chipDays.has(i) && (
              <div className="mt-1 space-y-0.5">
                <Skeleton className="h-3 w-full rounded" />
                {i % 3 === 0 && <Skeleton className="h-3 w-3/4 rounded" />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- Activity detail ---------------------------- */

export function ActivityDetailSkeleton() {
  return (
    <>
      <Skeleton className="mb-4 h-4 w-16" />
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Skeleton className="inline-block h-5 w-24 rounded-full" />
            <Skeleton className="mt-3 h-6 w-3/4" />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-4 w-24 shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
          <Skeleton className="mb-2 h-3 w-24" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1.5 h-3 w-24" />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
          <Skeleton className="mb-3 h-3 w-28" />
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* --------------------------- Activity admin ----------------------------- */

export function ActivityAdminSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Skeleton className="mb-4 h-4 w-16" />
      <div className="mb-6">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="mt-2 h-4 w-40" />
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Skeleton className="mb-3 h-4 w-20" />
        <div className="mb-3 grid grid-cols-3 gap-4 text-center">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Skeleton className="mx-auto h-8 w-12" />
              <Skeleton className="mx-auto mt-2 h-3 w-16" />
            </div>
          ))}
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Skeleton className="mb-1 h-3 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
      </div>

      <div className="mb-4">
        <Skeleton className="h-5 w-40" />
      </div>

      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3">
            <div>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1.5 h-3 w-44" />
            </div>
            <Skeleton className="h-4 w-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------- Mis actividades ----------------------------- */

function MisActividadCardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-start justify-between">
        <Skeleton className="h-5 w-2/3" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-7 w-24 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>
    </div>
  );
}

export function MisActividadesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <MisActividadCardSkeleton key={i} />
      ))}
    </div>
  );
}

/* --------------------------- Admin usuarios ----------------------------- */

export function UsuariosTableSkeleton() {
  const headers = ["Email", "Nombre", "Telefono", "Rol", "Estado", ""];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
            {headers.map((h) => (
              <th key={h} className="pb-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2">
                <Skeleton className="h-4 w-40" />
              </td>
              <td className="py-2">
                <Skeleton className="h-4 w-28" />
              </td>
              <td className="py-2">
                <Skeleton className="h-4 w-24" />
              </td>
              <td className="py-2">
                <Skeleton className="h-4 w-16 rounded-full" />
              </td>
              <td className="py-2">
                <Skeleton className="h-4 w-16 rounded-full" />
              </td>
              <td className="py-2">
                <Skeleton className="h-4 w-10" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
