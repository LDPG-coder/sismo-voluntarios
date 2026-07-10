import Link from "next/link";

type Activity = {
  id: string;
  title: string;
  zone: string;
  date_time: string;
  max_participants: number | null;
};

export function ActivityCard({ activity }: { activity: Activity }) {
  return (
    <Link
      href={`/voluntarios/${activity.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between">
        <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {activity.zone}
        </span>
      </div>
      <h3 className="mt-2 font-semibold">{activity.title}</h3>
      <p className="mt-1 text-sm text-slate-500">
        {new Date(activity.date_time).toLocaleDateString("es-VE", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </Link>
  );
}
