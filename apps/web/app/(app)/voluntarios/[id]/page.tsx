"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { JoinButton } from "@/components/join-button";
import { ActivityDetailSkeleton } from "@/components/skeletons";

type Activity = {
  id: string;
  title: string;
  description: string | null;
  zone: string;
  raw_address: string;
  date_time: string;
  end_time: string | null;
  estimated_duration_min: number | null;
  max_participants: number | null;
  requirements: string | null;
  contact_info: string | null;
  creator_id: string;
  status: string;
  member_count: number;
  creator?: {
    id: string;
    name: string | null;
    photo_url: string | null;
    phone: string | null;
  };
};

type User = { id: string; role: string; status: string } | null;

type Attendee = {
  user_id: string;
  name: string;
  email: string | null;
  photo_url: string | null;
  attended: boolean | null;
  joined_at: string;
};

export default function ActivityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [user, setUser] = useState<User>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/v1/activities/${params.id}`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API}/api/v1/auth/me`, { credentials: "include" }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`${API}/api/v1/activities/${params.id}/attendees`, {
        credentials: "include",
      }).then((r) => (r.ok ? r.json() : [])),
    ]).then(([act, u, att]) => {
      setActivity(act);
      setUser(u);
      setAttendees(att);
      setLoading(false);
    });
  }, [params.id, API]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-2xl px-4 py-8">
          <ActivityDetailSkeleton />
        </main>
      </div>
    );
  }
  if (!activity?.id) return <div className="py-12 text-center text-slate-500">Actividad no encontrada</div>;

  const isCreator = user?.id === activity.creator_id;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-2xl px-4 py-8">
        <button onClick={() => router.back()} className="mb-4 text-sm text-slate-500 hover:text-slate-700">
          &larr; Volver
        </button>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-block rounded-full bg-[#eaebed] px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {activity.zone}
              </span>
              <h1 className="mt-2 text-xl font-bold">{activity.title}</h1>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p>
              <strong>Fecha:</strong>{" "}
              {new Date(activity.date_time).toLocaleDateString("es-VE", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {activity.estimated_duration_min && (
              <p>
                <strong>Duracion estimada:</strong> {activity.estimated_duration_min} minutos
              </p>
            )}
            <p>
              <strong>Direccion:</strong> <span className="text-normal">{activity.raw_address}</span>
            </p>
            {activity.description && (
              <p>
                <strong>Descripcion:</strong> <span className="text-normal">{activity.description}</span>
              </p>
            )}
            {activity.requirements && (
              <p>
                <strong>Requisitos:</strong> <span className="text-normal">{activity.requirements}</span>
              </p>
            )}
            {activity.contact_info && (
              <p>
                <strong>Contacto:</strong> <span className="text-normal">{activity.contact_info}</span>
              </p>
            )}
          </div>

          {activity.creator && (
            <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
              <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Publicado por</p>
              <div className="flex items-center gap-3">
                {activity.creator.photo_url ? (
                  <img
                    src={activity.creator.photo_url}
                    alt={activity.creator.name || ""}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {(activity.creator.name || "V").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{activity.creator.name || "Voluntario"}</p>
                  {activity.creator.phone && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{activity.creator.phone}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            {!isCreator && <JoinButton activity={activity} user={user} />}
            {isCreator && (
              <div className="flex gap-2">
                <Link
                  href={`/voluntarios/${activity.id}/admin`}
                  className="inline-block rounded-md bg-[#eaebed] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                >
                  Administrar
                </Link>
                <Link
                  href={`/voluntarios/${activity.id}/editar`}
                  className="inline-block rounded-md bg-[#eaebed] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                >
                  Editar
                </Link>
              </div>
            )}
          </div>

          {attendees.length > 0 && (
            <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
              <p className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                Inscritos ({attendees.length})
              </p>
              <div className="flex flex-wrap gap-3">
                {attendees.map((a) => (
                  <div key={a.user_id} className="flex items-center gap-2">
                    {a.photo_url ? (
                      <img
                        src={a.photo_url}
                        alt={a.name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {a.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm">{a.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
