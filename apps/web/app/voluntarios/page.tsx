"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/nav-bar";
import { ActivityCard } from "@/components/activity-card";
import { ZoneFilter } from "@/components/zone-filter";

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
  creator_id: string;
  status: string;
  member_count: number;
};

type Zone = { name: string; count: number };

export default function VoluntariosPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [archived, setArchived] = useState<Activity[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    Promise.all([
      fetch(`${API}/api/v1/activities/zones`).then((r) => r.json()),
      fetch(`${API}/api/v1/activities${activeZone ? `?zone=${activeZone}` : ""}`).then((r) => r.json()),
      fetch(`${API}/api/v1/activities?status=archived`).then((r) => r.json()),
    ]).then(([zonesData, activitiesData, archivedData]) => {
      setZones(zonesData);
      setActivities(activitiesData);
      setArchived(archivedData);
      setLoading(false);
    });
  }, [activeZone]);

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Actividades de voluntariado</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Encuentra una actividad en tu zona y unete.
          </p>
        </div>

        <ZoneFilter zones={zones} active={activeZone} onChange={setActiveZone} />

        {loading ? (
          <div className="py-12 text-center text-slate-500">Cargando...</div>
        ) : activities.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            No hay actividades disponibles{activeZone ? ` en ${activeZone}` : ""}.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {activities.map((a) => (
              <ActivityCard key={a.id} activity={a} />
            ))}
          </div>
        )}

        {archived.length > 0 && !activeZone && (
          <div className="mt-10">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="mb-4 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              {showArchived ? "Ocultar archivadas" : `Ver actividades archivadas (${archived.length})`}
            </button>
            {showArchived && (
              <div className="grid gap-4 sm:grid-cols-2 opacity-70">
                {archived.map((a) => (
                  <ActivityCard key={a.id} activity={a} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
