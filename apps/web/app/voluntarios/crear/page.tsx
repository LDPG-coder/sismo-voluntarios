"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/nav-bar";
import { csrfHeaders } from "@/lib/auth/csrf-client";

const ZONES = ["Caracas", "Guatire", "Guarenas", "La Guaira", "Altos Mirandinos", "Caucagua"];

const INPUT_cls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:placeholder:text-slate-500";

const INPUT_LOADING_cls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm animate-shimmer relative overflow-hidden disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800";

export default function CreateActivityPage() {
  const router = useRouter();
  const reqInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [zone, setZone] = useState(ZONES[0]);
  const [rawAddress, setRawAddress] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [requirements, setRequirements] = useState<string[]>([]);
  const [reqInput, setReqInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const callAi = useCallback(
    async (desc: string) => {
      if (!aiEnabled || desc.length < 15) return;
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setAiThinking(true);
      try {
        const res = await fetch(`/api/ai/suggest/stream`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: desc }),
          signal: ctrl.signal,
        });
        console.log("[AI] stream status:", res.status);
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          console.log("[AI] stream error:", err);
          setAiThinking(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) { setAiThinking(false); return; }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (eventType === "chunk") {
                // Progressive JSON parsing attempt
                try {
                  const partial = JSON.parse(data);
                  applySuggestion(partial);
                } catch {
                  // partial JSON, try to extract what we can
                }
              } else if (eventType === "result") {
                const result = JSON.parse(data);
                applySuggestion(result);
                setAiThinking(false);
              } else if (eventType === "error") {
                console.log("[AI] stream error event:", data);
                setAiThinking(false);
              }
            }
          }
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          console.log("[AI] stream catch:", e);
        }
      } finally {
        setAiThinking(false);
      }
    },
    [],
  );

  const applySuggestion = (data: any) => {
    if (data.title) setTitle(data.title);
    if (data.zone) setZone(data.zone);
    if (data.raw_address) setRawAddress(data.raw_address);
    if (data.date_time) setDateTime(String(data.date_time).slice(0, 16));
    if (data.end_time) setEndDateTime(String(data.end_time).slice(0, 16));
    if (data.estimated_duration_min) setEstimatedDuration(String(data.estimated_duration_min));
    if (data.max_participants) setMaxParticipants(String(data.max_participants));
    if (data.requirements?.length) setRequirements(data.requirements);
  };

  useEffect(() => {
    const t = setTimeout(() => callAi(description), 500);
    return () => clearTimeout(t);
  }, [description, callAi, aiEnabled]);

  const addRequirement = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    setRequirements((prev) => [...prev, ...parts]);
    setReqInput("");
  };

  const removeRequirement = (idx: number) => {
    setRequirements((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleReqKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addRequirement(reqInput);
    }
  };

  const handleReqBlur = () => {
    if (reqInput.trim()) addRequirement(reqInput);
  };

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
      requirements: requirements.join(", "),
      contact_info: contactInfo || null,
    };

    const res = await fetch(`${API}/api/v1/activities`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...csrfHeaders("POST") },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.message || "Error al crear actividad");
      setSubmitting(false);
      return;
    }

    const data = await res.json();
    router.push(`/voluntarios/${data.id}`);
  };

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="mb-2 text-xl font-bold">Crear actividad</h1>
        <p className="mb-6 text-sm text-slate-500">
          Escribe la descripcion y los campos se rellenan solos.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium">Descripcion *</label>
              <button
                type="button"
                onClick={() => setAiEnabled(!aiEnabled)}
                className="flex items-center gap-2 text-xs text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <span>Autocompletar con IA</span>
                <div className={`relative h-5 w-9 rounded-full transition-colors ${aiEnabled ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                  <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${aiEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
              </button>
            </div>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={aiEnabled ? "Describe la actividad y los campos se rellenan solos..." : "Describe la actividad de voluntariado..."}
              className={aiThinking ? INPUT_LOADING_cls : INPUT_cls}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Titulo *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={aiThinking}
              className={aiThinking ? INPUT_LOADING_cls : INPUT_cls}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Zona *</label>
            <input
              type="text"
              required
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              list="zones-list"
              disabled={aiThinking}
              className={aiThinking ? INPUT_LOADING_cls : INPUT_cls}
            />
            <datalist id="zones-list">
              {ZONES.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Direccion *</label>
            <input
              type="text"
              required
              value={rawAddress}
              onChange={(e) => setRawAddress(e.target.value)}
              placeholder="Ej: Av. Principal, Edif. X, piso Y"
              disabled={aiThinking}
              className={aiThinking ? INPUT_LOADING_cls : INPUT_cls}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Fecha y hora *</label>
            <input
              type="datetime-local"
              required
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              disabled={aiThinking}
              className={aiThinking ? INPUT_LOADING_cls : INPUT_cls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Hora fin</label>
              <input
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                disabled={aiThinking}
                className={aiThinking ? INPUT_LOADING_cls : INPUT_cls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Duracion (min)</label>
              <input
                type="number"
                min="1"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
                placeholder="Ej: 120"
                disabled={aiThinking}
                className={aiThinking ? INPUT_LOADING_cls : INPUT_cls}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Maximo participantes</label>
            <input
              type="number"
              min="1"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              placeholder="Vacio = ilimitado"
              disabled={aiThinking}
              className={aiThinking ? INPUT_LOADING_cls : INPUT_cls}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Contacto *</label>
            <input
              type="text"
              required
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="Ej: @usuarioTelegram, +58 412 1234567, grupo de WhatsApp"
              className={INPUT_cls}
            />
            <p className="mt-1 text-xs text-slate-400">Numero de telefono, usuario de Telegram/WhatsApp, o enlace al grupo</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Requisitos</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {requirements.map((req, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {req}
                  <button
                    type="button"
                    onClick={() => removeRequirement(i)}
                    className="ml-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <input
              ref={reqInputRef}
              type="text"
              value={reqInput}
              onChange={(e) => setReqInput(e.target.value)}
              onKeyDown={handleReqKeyDown}
              onBlur={handleReqBlur}
              placeholder="Escribe y presiona Enter o coma para agregar"
              className={INPUT_cls}
            />
          </div>

          {error && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {submitting ? "Creando..." : "Crear actividad"}
          </button>
        </form>
      </main>
    </div>
  );
}
