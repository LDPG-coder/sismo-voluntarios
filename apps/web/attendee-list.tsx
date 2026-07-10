"use client";

type Attendee = {
  user_id: string;
  name: string;
  email: string;
  attended: boolean | null;
};

export function AttendeeList({
  attendees,
  onToggle,
}: {
  attendees: Attendee[];
  onToggle: (userId: string, attended: boolean) => void;
}) {
  if (attendees.length === 0) {
    return <p className="text-sm text-slate-500">No hay inscritos aun.</p>;
  }

  return (
    <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
      {attendees.map((a) => (
        <div key={a.user_id} className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium">{a.name}</p>
            <p className="text-xs text-slate-500">{a.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={a.attended === true}
                onChange={(e) => onToggle(a.user_id, e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Asistio
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
