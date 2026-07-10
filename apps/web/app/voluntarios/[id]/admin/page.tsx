"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { NavBar } from "@/components/nav-bar";
import { AttendeeList } from "@/components/attendee-list";

type Activity = {
  id: string;
  title: string;
  zone: string;
  date_time: string;
  max_participants: number | null;
  member_count: number;
};

type Attendee = {
  user_id: string;
  name: string;
  email: string;
  attended: boolean | null;
  joined_at: string;
};

export default function ActivityAdminPage() {
  const params = useParams();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    fetch(`${API}/api/v1/activities/${params.id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((act) => {
        setActivity(act);
        return fetch(`${API}/api/v1/activities/${params.id}/attendees`, {
          credentials: "include",
        });
      })
      .then((r) => {
        if (!r.ok) throw new Error("No tienes acceso");
        return r.json();
      })
      .then((data) => {
        setAttendees(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [params.id, API]);

  const handleToggleAttendance = async (userId: string, attended: boolean) => {
    await fetch(`${API}/api/v1/activities/${params.id}/attendees/${userId}/attended`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended }),
    });
    setAttendees((prev) =>
      prev.map((a) => (a.user_id === userId ? { ...a, attended } : a))
    );
  };

  const handleExpand = async () => {
    await fetch(`${API}/api/v1/activities/${params.id}/expand`, {
      method: "POST",
      credentials: "include",
    });
    setActivity((prev) =>
      prev ? { ...prev, max_participants: (prev.max_participants ?? 0) + 5 } : prev
    );
  };

  if (loading) return <div className="py-12 text-center text-slate-500">Cargando...</div>;
  if (error) return <div className="py-12 text-center text-rose-500">{error}</div>;

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <button onClick={() => router.back()} className="mb-4 text-sm text-slate-500 hover:text-slate-700">
          &larr; Volver
        </button>

        <div className="mb-6">
          <h1 className="text-xl font-bold">{activity?.title}</h1>
          <p className="text-sm text-slate-500">
            {activity?.zone} &middot;{" "}
            {activity && new Date(activity.date_time).toLocaleDateString("es-VE")}
          </p>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">
            Inscritos ({attendees.length}
            {activity?.max_participants != null && ` / ${activity.max_participants}`})
          </h2>
          <button
            onClick={handleExpand}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            +5 cupos
          </button>
        </div>

        <AttendeeList attendees={attendees} onToggle={handleToggleAttendance} />
      </main>
    </div>
  );
}
