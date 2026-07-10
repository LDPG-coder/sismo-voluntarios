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

export function ActivityAdminClient() {
  const params = useParams();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [additionalCups, setAdditionalCups] = useState(0);
  const [saving, setSaving] = useState(false);

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
    if (additionalCups <= 0) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/activities/${params.id}/expand`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additional: additionalCups }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const data = await res.json();
      setActivity((prev) =>
        prev ? { ...prev, max_participants: data.max_participants } : prev
      );
      setAdditionalCups(0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-12 text-center text-slate-500">Cargando...</div>;
  if (error) return <div className="py-12 text-center text-rose-500">{error}</div>;

  const currentMax = activity?.max_participants ?? 0;
  const currentInscribed = attendees.length;
  const newMax = currentMax + additionalCups;
  const availableAfter = newMax - currentInscribed;

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

        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 font-semibold">Cupos</h2>
          <div className="mb-3 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{currentInscribed}</p>
              <p className="text-xs text-slate-500">Inscritos</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{currentMax}</p>
              <p className="text-xs text-slate-500">Capacidad actual</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${availableAfter < 0 ? "text-rose-600" : "text-green-600"}`}>
                {additionalCups > 0 ? availableAfter : currentMax - currentInscribed}
              </p>
              <p className="text-xs text-slate-500">Disponibles</p>
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Agregar cupos
              </label>
              <input
                type="number"
                min={0}
                max={999}
                value={additionalCups}
                onChange={(e) => setAdditionalCups(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <button
              onClick={handleExpand}
              disabled={saving || additionalCups <= 0}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
          {additionalCups > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              La capacidad pasaría de {currentMax} a {newMax} cupos
            </p>
          )}
        </div>

        <div className="mb-4">
          <h2 className="font-semibold">
            Inscritos ({attendees.length}
            {activity?.max_participants != null && ` / ${activity.max_participants}`})
          </h2>
        </div>

        <AttendeeList attendees={attendees} onToggle={handleToggleAttendance} />
      </main>
    </div>
  );
}
