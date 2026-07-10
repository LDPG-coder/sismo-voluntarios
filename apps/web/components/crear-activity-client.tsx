"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { csrfHeaders } from "@/lib/auth/csrf-client";

const DRAFT_KEY = "sismo-activity-draft";
const DRAFT_DEBOUNCE_MS = 800;

const ZONES = ["Caracas", "Guatire", "Guarenas", "La Guaira", "Altos Mirandinos", "Caucagua"];

const INPUT_cls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:placeholder:text-zinc-500";

const INPUT_LOADING_cls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm animate-shimmer relative overflow-hidden disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800";

export function CrearActivityClient() {
  const router = useRouter();
  const reqInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [zone, setZone] = useState("");
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
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const mountedRef = useRef(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.description) setDescription(saved.description);
        if (saved.title) setTitle(saved.title);
        if (saved.zone) setZone(saved.zone);
        if (saved.rawAddress) setRawAddress(saved.rawAddress);
        if (saved.dateTime) setDateTime(saved.dateTime);
        if (saved.endDateTime) setEndDateTime(saved.endDateTime);
        if (saved.estimatedDuration) setEstimatedDuration(saved.estimatedDuration);
        if (saved.maxParticipants) setMaxParticipants(saved.maxParticipants);
        if (saved.contactInfo) setContactInfo(saved.contactInfo);
        if (saved.requirements?.length) setRequirements(saved.requirements);
        if (typeof saved.aiEnabled === "boolean") setAiEnabled(saved.aiEnabled);
      }
    } catch {}
    mountedRef.current = true;
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            description,
            title,
            zone,
            rawAddress,
            dateTime,
            endDateTime,
            estimatedDuration,
            maxParticipants,
            contactInfo,
            requirements,
            aiEnabled,
          }),
        );
      } catch {}
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [description, title, zone, rawAddress, dateTime, endDateTime, estimatedDuration, maxParticipants, contactInfo, requirements, aiEnabled]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  };

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
        if (!res.ok) {
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
                try {
                  const partial = JSON.parse(data);
                  applySuggestion(partial);
                } catch {}
              } else if (eventType === "result") {
                const result = JSON.parse(data);
                applySuggestion(result);
                setAiThinking(false);
              } else if (eventType === "error") {
                setAiThinking(false);
              }
            }
          }
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          console.error("[AI] stream error:", e);
        }
      } finally {
        if (!abortRef.current?.signal.aborted) {
          setAiThinking(false);
        }
      }
    },
    [],
  );

  const applySuggestion = (data: any) => {
    if (data.title && !title) setTitle(typeof data.title === "string" ? data.title : String(data.title));
    if (data.zone && !zone) setZone(typeof data.zone === "string" ? data.zone : String(data.zone));
    if (data.raw_address && !rawAddress) {
      const addr = Array.isArray(data.raw_address) ? data.raw_address.join(", ") : String(data.raw_address);
      setRawAddress(addr);
    }
    if (data.date_time && !dateTime) {
      const d = new Date(data.date_time);
      if (!isNaN(d.getTime())) {
        const utc = d.getTime() + d.getTimezoneOffset() * 60000;
        const local = new Date(utc - 4 * 3600000);
        const yyyy = local.getFullYear();
        const mm = String(local.getMonth() + 1).padStart(2, "0");
        const dd = String(local.getDate()).padStart(2, "0");
        const hh = String(local.getHours()).padStart(2, "0");
        const mi = String(local.getMinutes()).padStart(2, "0");
        setDateTime(`${yyyy}-${mm}-${dd}T${hh}:${mi}`);
      }
    }
    if (data.end_time && !endDateTime) {
      const d = new Date(data.end_time);
      if (!isNaN(d.getTime())) {
        const utc = d.getTime() + d.getTimezoneOffset() * 60000;
        const local = new Date(utc - 4 * 3600000);
        const yyyy = local.getFullYear();
        const mm = String(local.getMonth() + 1).padStart(2, "0");
        const dd = String(local.getDate()).padStart(2, "0");
        const hh = String(local.getHours()).padStart(2, "0");
        const mi = String(local.getMinutes()).padStart(2, "0");
        setEndDateTime(`${yyyy}-${mm}-${dd}T${hh}:${mi}`);
      }
    }
    if (data.estimated_duration_min && !estimatedDuration) setEstimatedDuration(String(data.estimated_duration_min));
    if (data.max_participants && !maxParticipants) setMaxParticipants(String(data.max_participants));
    if (data.contact_info && !contactInfo) {
      const c = Array.isArray(data.contact_info) ? data.contact_info.join(", ") : String(data.contact_info);
      setContactInfo(c);
    }
    if (data.requirements?.length && requirements.length === 0) setRequirements(data.requirements);
  };

  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [description]);

  useEffect(() => {
    const t = setTimeout(() => callAi(description), 1500);
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
    clearDraft();
    router.push(`/voluntarios/${data.id}`);
  };

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="mb-2 text-xl font-bold">Crear actividad</h1>
        <p className="mb-6 text-sm text-zinc-500">
          Escribe la descripcion y los campos se rellenan solos.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium">Descripción *</label>
              <button
                type="button"
                onClick={() => setAiEnabled(!aiEnabled)}
                className="flex items-center gap-2 text-xs text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <span>Autocompletar con IA</span>
                <div className={`relative h-5 w-9 rounded-full transition-colors ${aiEnabled ? "bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-600"}`}>
                  <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${aiEnabled ? "tranzinc-x-4" : "tranzinc-x-0.5"}`} />
                </div>
              </button>
            </div>
            <textarea
              ref={descriptionRef}
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                aiEnabled
                  ? "Describe la actividad y los campos se rellenan solos..."
                  : "Describe la actividad de voluntariado..."
              }
              className={`${aiThinking ? INPUT_LOADING_cls : INPUT_cls} resize-none overflow-hidden`}
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
                disabled={aiThinking}
                className={aiThinking ? INPUT_LOADING_cls : INPUT_cls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Hora inicio *</label>
              <input
                type="time"
                required
                value={dateTime.split("T")[1] || ""}
                onChange={(e) => {
                  const date = dateTime.split("T")[0] || new Date().toISOString().split("T")[0];
                  setDateTime(`${date}T${e.target.value}`);
                }}
                disabled={aiThinking}
                className={aiThinking ? INPUT_LOADING_cls : INPUT_cls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Fecha fin</label>
              <input
                type="date"
                value={endDateTime.split("T")[0]}
                onChange={(e) => {
                  const time = endDateTime.split("T")[1] || "17:00";
                  if (e.target.value) {
                    setEndDateTime(`${e.target.value}T${time}`);
                  } else {
                    setEndDateTime("");
                  }
                }}
                disabled={aiThinking}
                className={aiThinking ? INPUT_LOADING_cls : INPUT_cls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Hora fin</label>
              <input
                type="time"
                value={endDateTime.split("T")[1] || ""}
                onChange={(e) => {
                  const date = endDateTime.split("T")[0] || dateTime.split("T")[0];
                  if (date) {
                    setEndDateTime(`${date}T${e.target.value}`);
                  }
                }}
                disabled={aiThinking}
                className={aiThinking ? INPUT_LOADING_cls : INPUT_cls}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Duracion (minutos)</label>
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
            <p className="mt-1 text-xs text-zinc-400">Numero de telefono, usuario de Telegram/WhatsApp, o enlace al grupo</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Requisitos</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {requirements.map((req, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-[#eaebed] px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {req}
                  <button
                    type="button"
                    onClick={() => removeRequirement(i)}
                    className="ml-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100"
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
            className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-600"
          >
            {submitting ? "Creando..." : "Crear actividad"}
          </button>
        </form>
      </main>
    </div>
  );
}
