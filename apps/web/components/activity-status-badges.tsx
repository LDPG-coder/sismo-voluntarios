import type { Activity } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  active: "Programada",
  archived: "Realizada",
  cancelled: "Cancelada",
};

const STATUS_CLASS: Record<string, string> = {
  active: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  archived: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-[#079669]",
  cancelled: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
};

export function ActivityStatusBadges({
  activity,
  isEnrolled,
}: {
  activity: Activity;
  isEnrolled?: boolean;
}) {
  const statusKey = activity.status in STATUS_LABEL ? activity.status : "active";
  const badges: React.ReactNode[] = [
    <span
      key="status"
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
        STATUS_CLASS[statusKey]
      }`}
    >
      {STATUS_LABEL[statusKey]}
    </span>,
  ];

  if (isEnrolled && activity.status === "archived") {
    const attended = activity.my_attended;
    badges.push(
      <span
        key="attendance"
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
          attended === true
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-[#079669]"
            : attended === false
              ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
        }`}
      >
        {attended === true ? "Asistió" : attended === false ? "No asistió" : "Asistencia sin confirmar"}
      </span>,
    );
  }

  return <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>;
}
