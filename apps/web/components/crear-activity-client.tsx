"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { csrfHeaders } from "@/lib/auth/csrf-client";
import { ZONES } from "@/lib/zones";

const DRAFT_KEY = "sismo-activity-draft";
const DRAFT_DEBOUNCE_MS = 800;

const INPUT_cls =
  "w-full rounded-md bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:placeholder:text-zinc-500";

const INPUT_LOADING_cls =
  "w-full rounded-md bg-white px-3 py-2 text-sm animate-shimmer relative overflow-hidden disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800";

export function CrearActivityClient({
  activityType = "proponer",
  onBack,
}: {
  activityType?: "proponer" | "oficial" | "realizada";
  onBack?: () => void;
} = {}) {
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

  const [showExternal, setShowExternal] = useState(false);
  const [extBeneficiary, setExtBeneficiary] = useState("");
  const [extSupervisor, setExtSupervisor] = useState("");
  const [extSupervisorEmail, setExtSupervisorEmail] = useState("");
  const [extHours, setExtHours] = useState("");
  const [extRelevantData, setExtRelevantData] = useState("");

  // Voluntariado interno: suma horas al programa. Excluyente con externo oficial.
  const [isInternal, setIsInternal] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [textShimmer, setTextShimmer] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const aiEnabledRef = useRef(aiEnabled);
  aiEnabledRef.current = aiEnabled;

  const isRealizada = activityType === "realizada";
  const isOficial = activityType === "oficial";
  const typeLabel = isRealizada ? "Registrar actividad realizada" : isOficial ? "Crear voluntariado oficial" : "Crear actividad";

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const mountedRef = useRef(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.description) setDescription(saved.description);
        if (typeof saved.aiEnabled === "boolean") setAiEnabled(saved.aiEnabled);
        const restoreAiFields = saved.aiEnabled !== false;
        if (restoreAiFields) {
          if (saved.title) setTitle(saved.title);
          if (saved.zone) setZone(saved.zone);
          if (saved.rawAddress) setRawAddress(saved.rawAddress);
          if (saved.dateTime) setDateTime(saved.dateTime);
          if (saved.endDateTime) setEndDateTime(saved.endDateTime);
          if (saved.estimatedDuration) setEstimatedDuration(saved.estimatedDuration);
          if (saved.maxParticipants) setMaxParticipants(saved.maxParticipants);
          if (saved.contactInfo) setContactInfo(saved.contactInfo);
          if (saved.requirements?.length) setRequirements(saved.requirements);
          if (typeof saved.showExternal === "boolean") setShowExternal(saved.showExternal);
          if (saved.extBeneficiary) setExtBeneficiary(saved.extBeneficiary);
          if (saved.extSupervisor) setExtSupervisor(saved.extSupervisor);
          if (saved.extSupervisorEmail) setExtSupervisorEmail(saved.extSupervisorEmail);
          if (saved.extHours) setExtHours(saved.extHours);
          if (typeof saved.isInternal === "boolean") setIsInternal(saved.isInternal);
        }
      }
    } catch {}
    mountedRef.current = true;
    setDraftReady(true);
    if (activityType === "oficial") setShowExternal(true);
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
            showExternal,
            extBeneficiary,
            extSupervisor,
            extSupervisorEmail,
            extHours,
            isInternal,
          }),
        );
      } catch {}
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  },     [description, title, zone, rawAddress, dateTime, endDateTime, estimatedDuration, maxParticipants, contactInfo, requirements, aiEnabled, showExternal, extBeneficiary, extSupervisor, extSupervisorEmail, extHours, isInternal]);

  useEffect(() => {
    if (!aiEnabled) return;
    setTextShimmer(true);
    const t = setTimeout(() => setTextShimmer(false), 1300);
    return () => clearTimeout(t);
  }, []);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  };

  const applySuggestion = useCallback(
    (data: any) => {
      if (!aiEnabledRef.current) return;
      if (data.title && !title) setTitle(typeof data.title === "string" ? data.title : String(data.title));
      if (data.zone && !zone) setZone(typeof data.zone === "string" ? data.zone : String(data.zone));
      if (data.raw_address && !rawAddress) {
        const addr = Array.isArray(data.raw_address) ? data.raw_address.join(", ") : String(data.raw_address);
        setRawAddress(addr);
      }
      const dt = data.date_time || data.date_time_suggestion;
      if (dt && !dateTime) {
        const d = new Date(dt);
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
      const et = data.end_time || data.end_time_suggestion;
      if (et && !endDateTime) {
        const d = new Date(et);
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
      if (Array.isArray(data.requirements) && data.requirements.length > 0 && requirements.length === 0) {
        setRequirements(data.requirements);
      }
    },
    [title, zone, rawAddress, dateTime, endDateTime, estimatedDuration, maxParticipants, contactInfo, requirements],
  );

  const callAi = useCallback(
    async (desc: string) => {
      if (!aiEnabledRef.current || desc.length < 30) return;
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setAiThinking(true);
      try {
        const res = await fetch(`/api/ai/suggest/stream`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...csrfHeaders("POST") },
          body: JSON.stringify({ description: desc }),
          signal: ctrl.signal,
        });
    const extAnyFilled = !!(
      extBeneficiary ||
      extSupervisor ||
      extSupervisorEmail ||
      extHours
    );
    if (extAnyFilled) {
      const extComplete =
        extBeneficiary.trim() &&
        extSupervisor.trim() &&
        extSupervisorEmail.trim() &&
        extHours.trim();
      if (!extComplete) {
        setError(
          "Si completas datos de Voluntariados oficiales Externos, todos los campos son obligatorios",
        );
        setSubmitting(false);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extSupervisorEmail.trim())) {
        setError("El correo del supervisor no es válido");
        setSubmitting(false);
        return;
      }
    }

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
    [applySuggestion],
  );

  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [description]);

  useEffect(() => {
    if (!draftReady) return;
    if (!aiEnabled) {
      if (abortRef.current) abortRef.current.abort();
      setAiThinking(false);
      return;
    }
    const t = setTimeout(() => callAi(description), 1500);
    return () => clearTimeout(t);
  }, [description, callAi, aiEnabled, draftReady]);

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

  // Registro de actividades ya realizadas: si la fecha (fin, o inicio si no hay
  // fin) ya paso, la actividad no entra al flujo de publicacion. El backend la
  // crea como privada (solo del becario, sin participantes, fuera del listado
  // publico) y aqui redirigimos a la vista individual para cargar comprobantes.
  const isPastActivity = (() => {
    if (!dateTime) return false;
    const ref = endDateTime || dateTime;
    const d = new Date(ref);
    return !isNaN(d.getTime()) && d.getTime() < Date.now();
  })();

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
      external_beneficiary: isInternal || isRealizada ? null : isOficial ? extBeneficiary || null : null,
      external_supervisor: isInternal || isRealizada ? null : isOficial ? extSupervisor || null : null,
      external_supervisor_email: isInternal || isRealizada ? null : isOficial ? extSupervisorEmail || null : null,
      external_assigned_hours: isInternal || isRealizada ? null : isOficial ? extHours ? parseFloat(extHours) : null : null,
      external_relevant_data: isInternal || isRealizada ? null : isOficial ? extRelevantData.trim() || null : null,
      is_internal: isRealizada ? false : isInternal,
      is_private: isRealizada || undefined,
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
    <div>
      <main className="mx-auto max-w-lg px-4 pt-8 pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 text-sm text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Volver
        </button>
        <h1 className="mb-2 text-xl font-bold">{typeLabel}</h1>
        <p className="mb-6 text-sm text-zinc-500">
          Escribe la descripcion y los campos se rellenan solos.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium">Descripción *</label>
              <button
                type="button"
                onClick={() => {
                  const next = !aiEnabled;
                  setAiEnabled(next);
                  if (next) {
                    setTextShimmer(true);
                    setTimeout(() => setTextShimmer(false), 1300);
                  }
                }}
                className="flex items-center gap-2 text-xs text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <span className={textShimmer ? "text-shimmer" : ""}>Autocompletar con IA</span>
                <div className={`relative h-5 w-9 rounded-full transition-colors ${aiEnabled ? "bg-emerald-500 dark:bg-emerald-400" : "bg-zinc-300 dark:bg-zinc-600"}`}>
                  <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${aiEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
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

          {isRealizada ? null : (
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
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Direccion *</label>
            <input
              type="text"
              required={!isRealizada}
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

          {isRealizada ? null : (
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
          )}

          {isRealizada ? null : (
          <div>
            <label className="mb-1 block text-sm font-medium">Contacto *</label>
            <input
              type="text"
              required
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="Ej: @usuarioTelegram, +58 412 1234567, grupo de WhatsApp"
              disabled={aiThinking}
              className={aiThinking ? INPUT_LOADING_cls : INPUT_cls}
            />
            <p className="mt-1 text-xs text-zinc-400">Numero de telefono, usuario de Telegram/WhatsApp, o enlace al grupo</p>
          </div>
          )}

          {isRealizada ? null : (
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
              disabled={aiThinking}
              className={aiThinking ? INPUT_LOADING_cls : INPUT_cls}
            />
          </div>
          )}

          {/* Voluntariado interno: suma horas al programa. Excluyente con externo oficial. */}
          {/* TODO (control por rol): de momento este checkbox es visible para
              cualquier usuario con permiso de crear actividades. Si en el futuro
              solo deben poder marcarlo ciertos roles (coordinadores, staff,
              becarios de AVAA), condicionar este bloque al rol del usuario, p.ej.
              envolverlo en {(user.role === "admin" || user.role === "coordinator" || ...) && (...)}. */}
          {isRealizada || isOficial ? null : (
          <button
            type="button"
            onClick={() =>
              setIsInternal((v) => {
                const next = !v;
                if (next) {
                  // Exclusividad: al marcar interno se descarta lo externo oficial.
                  setShowExternal(false);
                  setExtBeneficiary("");
                  setExtSupervisor("");
                  setExtSupervisorEmail("");
                  setExtHours("");
                }
                return next;
              })
            }
            className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition ${
              isInternal
                ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500/60 dark:bg-emerald-950/30"
                : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                isInternal
                  ? "border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-emerald-950"
                  : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
              }`}
            >
              {isInternal && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
                Voluntariado interno
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                Suma horas de voluntariado al programa. Para tareas rápidas publicadas por
                coordinadores y becarios de AVAA.
              </span>
            </span>
          </button>
          )}

          {isOficial ? (
          <div className={`rounded-lg border border-zinc-200 transition dark:border-zinc-700 ${isInternal ? "pointer-events-none opacity-50" : ""}`}>
            <button
              type="button"
              onClick={() => setShowExternal((v) => !v)}
              disabled={isInternal}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium disabled:cursor-not-allowed"
            >
              <span>Voluntariados oficiales Externos</span>
              <svg
                className={`h-4 w-4 transition-transform ${showExternal ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {showExternal && (
              <div className="space-y-4 border-t border-zinc-200 px-4 py-4 dark:border-zinc-700">
                <p className="text-xs text-zinc-400">
                  Si completas cualquier campo, todos se vuelven obligatorios al crear la actividad.
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium">Beneficiario *</label>
                  <input
                    type="text"
                    value={extBeneficiary}
                    onChange={(e) => setExtBeneficiary(e.target.value)}
                    className={INPUT_cls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Supervisor de la actividad *</label>
                  <input
                    type="text"
                    value={extSupervisor}
                    onChange={(e) => setExtSupervisor(e.target.value)}
                    className={INPUT_cls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Correo del supervisor *</label>
                  <input
                    type="email"
                    value={extSupervisorEmail}
                    onChange={(e) => setExtSupervisorEmail(e.target.value)}
                    placeholder="Ej: supervisor@organizacion.org"
                    className={INPUT_cls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Horas asignadas *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={extHours}
                    onChange={(e) => setExtHours(e.target.value)}
                    placeholder="Ej: 4"
                    className={INPUT_cls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Datos relevantes</label>
                  <textarea
                    value={extRelevantData}
                    onChange={(e) => setExtRelevantData(e.target.value)}
                    rows={3}
                    placeholder="Contexto, logros, observaciones u otra informacion relevante de la actividad externa"
                    className={INPUT_cls}
                  />
                </div>
              </div>
            )}
          </div>
          ) : null}

          {isPastActivity && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Esta actividad ya ocurrio
              </p>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-200/80">
                Se registrara como una actividad realizada, privada y solo tuya:
                no aparece en el listado publico ni acepta participantes. Sirve
                para validar tus horas externas. Al guardarla podras cargar los
                comprobantes (fotografias).
              </p>
            </div>
          )}

          {/* Fin IA section */}
        {error && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-600"
          >
            {submitting
              ? "Guardando..."
              : isRealizada
                ? "Registrar actividad realizada"
                : isOficial
                  ? "Crear voluntariado oficial"
                  : isPastActivity
                    ? "Registrar actividad realizada"
                    : "Crear actividad"}
          </button>
        </form>
      </main>
    </div>
  );
}
