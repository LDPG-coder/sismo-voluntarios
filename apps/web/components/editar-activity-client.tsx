"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { csrfHeaders } from "@/lib/auth/csrf-client";

const ZONES = ["Caracas", "Guatire", "Guarenas", "La Guaira", "Altos Mirandinos", "Caucagua"];

const INPUT_cls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:placeholder:text-zinc-500";

function toVenezuelaParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "", time: "" };
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const local = new Date(utc - 4 * 3600000);
  const yyyy = local.getFullYear();
  const mm = String(local.getMonth() + 1).padStart(2, "0");
  const dd = String(local.getDate()).padStart(2, "0");
  const hh = String(local.getHours()).padStart(2, "0");
  const mi = String(local.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
}

export function EditarActivityClient() {
  const router = useRouter();
  const params = useParams();
  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [zone, setZone] = useState("");
  const [rawAddress, setRawAddress] = useState("");
  const [description, setDescription] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [requirements, setRequirements] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/activities/${params.id}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => {
        if (!a) {
          setError("No se pudo cargar la actividad");
          setLoading(false);
          return;
        }
        setTitle(a.title || "");
        setZone(a.zone || "");
        setRawAddress(a.raw_address || "");
        setDescription(a.description || "");
        setContactInfo(a.contact_info || "");
        setRequirements(a.requirements || "");
        setEstimatedDuration(a.estimated_duration_min ? String(a.estimated_duration_min) : "");
        setMaxParticipants(a.max_participants ? String(a.max_participants) : "");
        const start = toVenezuelaParts(a.date_time);
        setDateTime(start.date ? `${start.date}T${start.time}` : "");
        const end = toVenezuelaParts(a.end_time);
        setEndDateTime(end.date ? `${end.date}T${end.time}` : "");
        setLoading(false);
      })
      .catch(() => {
        setError("No se pudo cargar la actividad");
        setLoading(false);
      });
  }, [params.id, API]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const body = {
      title,
      description,
      zone,
      raw_address: rawAddress,
      date_time: dateTime,
      end_time: endDateTime || null,
      estimated_duration_min: estimatedDuration ? parseInt(estimatedDuration) : null,
      max_participants: maxParticipants ? parseInt(maxParticipants) : null,
      contact_info: contactInfo || null,
      requirements,
    };

    const res = await fetch(`${API}/api/v1/activities/${params.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...csrfHeaders("PATCH") },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error?.message || "Error al guardar los cambios");
      setSubmitting(false);
      return;
    }

    router.push(`/voluntarios/${params.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="py-12 text-center text-zinc-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-lg px-4 py-8">
        <button
          onClick={() => router.back()}
          className="mb-4 text-sm text-zinc-500 hover:text-zinc-700"
        >
          &larr; Volver
        </button>
        <h1 className="mb-6 text-xl font-bold">Editar actividad</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Título *</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_cls} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Zona *</label>
            <input type="text" required value={zone} onChange={(e) => setZone(e.target.value)} list="zones-list-edit" className={INPUT_cls} />
            <datalist id="zones-list-edit">
              {ZONES.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Dirección *</label>
            <input type="text" required value={rawAddress} onChange={(e) => setRawAddress(e.target.value)} className={INPUT_cls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Fecha *</label>
              <input
                type="date"
                required
                value={dateTime.split("T")[0]}
                onChange={(e) => {
                  const time = dateTime.split("T")[1] || "08:00";
                  setDateTime(`${e.target.value}T${time}`);
                }}
                className={INPUT_cls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Hora *</label>
              <input
                type="time"
                required
                value={dateTime.split("T")[1] || ""}
                onChange={(e) => {
                  const date = dateTime.split("T")[0] || new Date().toISOString().split("T")[0];
                  setDateTime(`${date}T${e.target.value}`);
                }}
                className={INPUT_cls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Fecha fin</label>
              <input
                type="date"
                value={endDateTime.split("T")[0] || ""}
                onChange={(e) => {
                  const time = endDateTime.split("T")[1] || "17:00";
                  if (e.target.value) setEndDateTime(`${e.target.value}T${time}`);
                  else setEndDateTime("");
                }}
                className={INPUT_cls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Hora fin</label>
              <input
                type="time"
                value={endDateTime.split("T")[1] || ""}
                onChange={(e) => {
                  const date = endDateTime.split("T")[0] || dateTime.split("T")[0];
                  if (date) setEndDateTime(`${date}T${e.target.value}`);
                }}
                className={INPUT_cls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Duración (min)</label>
              <input type="number" min={0} value={estimatedDuration} onChange={(e) => setEstimatedDuration(e.target.value)} className={INPUT_cls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Máximo de personas</label>
              <input type="number" min={0} value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} className={INPUT_cls} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Medio de contacto</label>
            <input type="text" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} className={INPUT_cls} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Requisitos</label>
            <input type="text" value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="Separados por comas" className={INPUT_cls} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Descripción</label>
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT_cls} />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:text-white"
          >
            {submitting ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </main>
    </div>
  );
}
