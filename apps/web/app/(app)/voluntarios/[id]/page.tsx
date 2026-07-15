"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { JoinButton } from "@/components/join-button";
import { AttendeeList } from "@/components/attendee-list";
import { ActivityEvidence } from "@/components/activity-evidence";
import { ActivityValidationClient } from "@/components/activity-validation-client";
import { ActivityDetailSkeleton } from "@/components/skeletons";
import { csrfHeaders } from "@/lib/auth/csrf-client";
import { useSession } from "@/components/session-provider";

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
  my_attended?: boolean | null;
  is_external_official?: boolean;
  is_internal?: boolean;
  has_attendance?: boolean;
  external_certificate?: string | null;
  external_relevant_data?: string | null;
  validated_at?: string | null;
  validated_by?: string | null;
  validated_by_name?: string | null;
  validation_notes?: string | null;
  creator?: {
    id: string;
    name: string | null;
    photo_url: string | null;
    phone: string | null;
  };
};

type Attendee = {
  user_id: string;
  name: string;
  email: string | null;
  photo_url: string | null;
  attended: boolean | null;
  status?: string;
  joined_at: string;
};

export default function ActivityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showCeded, setShowCeded] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certUploading, setCertUploading] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const { user } = useSession();

  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const handleResolve = async (archive: boolean) => {
    if (!activity) return;
    setProcessing(true);
    try {
      const res = await fetch(`${API}/api/v1/activities/${activity.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeaders("DELETE") },
        body: JSON.stringify({ archive }),
      });
      if (!res.ok) throw new Error("Error al procesar");
      setActivity((prev) =>
        prev ? { ...prev, status: archive ? "archived" : "cancelled" } : prev,
      );
    } catch {
      // silencioso: el estado se mantiene
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleAttendance = async (userId: string, attended: boolean) => {
    if (!activity) return;
    try {
      await fetch(`${API}/api/v1/activities/${activity.id}/attendees/${userId}/attended`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeaders("POST") },
        body: JSON.stringify({ attended }),
      });
    } catch {
      // silencioso
    }
    setAttendees((prev) =>
      prev.map((a) => (a.user_id === userId ? { ...a, attended } : a)),
    );
  };

  const handleUploadCertificate = async () => {
    if (!activity || !certFile) return;
    setCertError(null);
    if (certFile.type !== "application/pdf") {
      setCertError("Solo se permiten archivos PDF");
      return;
    }
    if (certFile.size > 6 * 1024 * 1024) {
      setCertError("El PDF no debe superar los 6 MB");
      return;
    }
    setCertUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
        reader.readAsDataURL(certFile);
      });
      const res = await fetch(`${API}/api/v1/activities/${activity.id}/external-certificate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeaders("POST") },
        body: JSON.stringify({ certificate: dataUrl }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Error al subir la constancia");
      }
      const data = await res.json();
      setActivity((prev) => (prev ? { ...prev, external_certificate: data.external_certificate } : prev));
      setCertFile(null);
    } catch (e: any) {
      setCertError(e?.message || "Error al subir la constancia");
    } finally {
      setCertUploading(false);
    }
  };

  const handleRemoveCertificate = async () => {
    if (!activity) return;
    setCertUploading(true);
    try {
      const res = await fetch(`${API}/api/v1/activities/${activity.id}/external-certificate`, {
        method: "DELETE",
        credentials: "include",
        headers: { ...csrfHeaders("DELETE") },
      });
      if (!res.ok) throw new Error("Error al quitar la constancia");
      setActivity((prev) => (prev ? { ...prev, external_certificate: null } : prev));
    } catch {
      // silencioso
    } finally {
      setCertUploading(false);
    }
  };

  const refresh = useCallback(async () => {
    try {
      const [actRes, attRes, memRes] = await Promise.all([
        fetch(`${API}/api/v1/activities/${params.id}`, { credentials: "include" }),
        fetch(`${API}/api/v1/activities/${params.id}/attendees`, {
          credentials: "include",
        }),
        fetch(`${API}/api/v1/activities/${params.id}/membership`, {
          credentials: "include",
        }),
      ]);
      const act = await actRes.json();
      const att = attRes.ok ? await attRes.json() : [];
      const mem = memRes.ok ? await memRes.json() : { is_member: false };
      setActivity(act);
      setAttendees(att);
      setIsMember(Boolean(mem.is_member));
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [params.id, API]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-2xl px-4 py-8">
          <ActivityDetailSkeleton />
        </main>
      </div>
    );
  }
  if (!activity?.id) return <div className="py-12 text-center text-zinc-500">Actividad no encontrada</div>;

  const isCreator = user?.id === activity.creator_id;
  const isPast = new Date(activity.date_time) < new Date();
  const isPendingConfirm =
    isCreator && activity.status === "active" && isPast;
  const canUploadEvidence =
    (isCreator || isMember) &&
    activity.status === "active" &&
    isPast;

  const statusLabel: Record<string, string> = {
    active: "Programada",
    archived: "Realizada",
    cancelled: "Cancelada",
    pending_validation: "En revisión",
    validated: "Validada",
  };
  const statusText =
    statusLabel[activity.status] ?? "Programada";
  const attended = activity.my_attended;
  const statusTextClass =
    activity.status === "archived" && attended !== undefined
      ? attended === true
        ? "text-emerald-700 dark:text-[#079669]"
        : "text-rose-600 dark:text-rose-400"
      : "";

  const activeAttendees = attendees.filter((a) => a.status !== "ceded");
  const cededAttendees = attendees.filter((a) => a.status === "ceded");

  const startDate = new Date(activity.date_time);
  const dateLabel = startDate.toLocaleDateString("es-VE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const startTime = startDate.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = activity.estimated_duration_min
    ? new Date(
        startDate.getTime() + activity.estimated_duration_min * 60000,
      ).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-2xl px-4 py-8">
        <button onClick={() => router.back()} className="mb-4 text-sm text-zinc-500 hover:text-zinc-700">
          &larr; Volver
        </button>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#18181b]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-block rounded-full bg-[#eaebed] px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {activity.zone}
                </span>
                <span className={`inline-block rounded-full bg-[#eaebed] px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 ${statusTextClass}`}>
                  {statusText}
                </span>
              </div>
              <h1 className="mt-2 text-xl font-bold text-emerald-700 dark:text-[#079669]">{activity.title}</h1>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-700 dark:text-[#079669]">
                <CalendarIcon />
              </span>
              <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                Fecha
              </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{dateLabel}</p>
                <div className="mt-1 flex items-center gap-1.5 pl-1">
                  <span className="text-emerald-700 dark:text-[#079669]">
                    <ClockIcon />
                  </span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {startTime}
                    {endTime ? ` ~ ${endTime}` : ""}
                  </span>
                </div>
              </div>
            </div>

            <InfoRow icon={<MapPinIcon />} label="Ubicacion">
              {activity.raw_address}
            </InfoRow>
            {activity.description && (
              <InfoRow icon={<DocumentIcon />} label="Descripcion">
                {activity.description}
              </InfoRow>
            )}
            {activity.is_external_official && activity.external_relevant_data && (
              <InfoRow icon={<DocumentIcon />} label="Datos relevantes">
                {activity.external_relevant_data}
              </InfoRow>
            )}
            <InfoRow icon={<BadgeIcon />} label="Tipo de voluntariado">
              {activity.is_external_official ? (
                <span className="font-medium text-emerald-700 dark:text-[#079669]">
                  Voluntariado externo oficial
                </span>
              ) : activity.is_internal ? (
                <span className="font-medium text-emerald-700 dark:text-[#079669]">
                  Voluntariado interno
                </span>
              ) : (
                <span className="font-medium text-zinc-600 dark:text-zinc-400">
                  Voluntariado no oficial
                </span>
              )}
            </InfoRow>
            {activity.requirements && (
              <InfoRow icon={<ClipboardIcon />} label="Requisitos">
                {activity.requirements}
              </InfoRow>
            )}
            {activity.contact_info && (
              <InfoRow icon={<PhoneIcon />} label="Contacto">
                {activity.contact_info}
              </InfoRow>
            )}
          </div>

          {activity.creator && (
            <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Publicado por</p>
              <div className="flex items-center gap-3">
                {activity.creator.photo_url ? (
                  <img
                    src={activity.creator.photo_url}
                    alt={activity.creator.name || ""}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    {(activity.creator.name || "V").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{activity.creator.name || "Voluntario"}</p>
                  {activity.creator.phone && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{activity.creator.phone}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {isPendingConfirm && (
            <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Esta actividad ya paso su momento de inicio
              </p>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-200/80">
                Confirma si se realizo para moverla a Realizadas (y validar
                asistencias), o marcala como no realizada.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => handleResolve(true)}
                  disabled={processing}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:text-white"
                >
                  {processing ? "Procesando..." : "Confirmar realizacion"}
                </button>
                <button
                  onClick={() => handleResolve(false)}
                  disabled={processing}
                  className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  {processing ? "Procesando..." : "Marcar como no realizada"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-6">
            {!isCreator && <JoinButton activity={activity} user={user} onChange={refresh} />}
            {isCreator && (
              <div className="flex gap-2">
                <Link
                  href={`/voluntarios/${activity.id}/admin`}
                  className="inline-block rounded-md bg-[#eaebed] px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  Administrar
                </Link>
                <Link
                  href={`/voluntarios/${activity.id}/editar`}
                  className="inline-block rounded-md bg-[#eaebed] px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  Editar
                </Link>
              </div>
            )}
          </div>

          {activeAttendees.length > 0 && (
            <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <p className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Inscritos ({activeAttendees.length})
              </p>
              <div className="flex flex-wrap gap-3">
                {activeAttendees.map((a) => (
                  <div key={a.user_id} className="flex items-center gap-2">
                    {a.photo_url ? (
                      <img
                        src={a.photo_url}
                        alt={a.name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                        {a.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm">{a.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isCreator && cededAttendees.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowCeded((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${showCeded ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5.25l7.5 7.5-7.5 7.5" />
                </svg>
                Cupos cedidos ({cededAttendees.length})
              </button>
              {showCeded && (
                <div className="mt-3 flex flex-wrap gap-3 opacity-60">
                  {cededAttendees.map((a) => (
                    <div key={a.user_id} className="flex items-center gap-2">
                      {a.photo_url ? (
                        <img
                          src={a.photo_url}
                          alt={a.name}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                          {a.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm">{a.name}</span>
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        Cedido
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isCreator && activity.status === "archived" && (
            <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <h2 className="mb-3 text-sm font-semibold">Validar asistencias</h2>
              <AttendeeList attendees={activeAttendees} onToggle={handleToggleAttendance} />
            </div>
          )}

          {activity.is_external_official && activity.external_certificate && !isCreator && (
            <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <h2 className="mb-2 text-sm font-semibold">Constancia</h2>
              <a
                href={activity.external_certificate}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:bg-emerald-500"
              >
                Ver constancia emitida
              </a>
            </div>
          )}

          {isCreator && activity.is_external_official && (activity.status === "archived" || activity.status === "pending_validation" || activity.status === "validated") && (
            <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <h2 className="mb-1 text-sm font-semibold">Constancia del voluntariado oficial externo</h2>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                Agrega la constancia emitida por la organizacion, empresa o institucion beneficiaria (solo PDF).
              </p>

              {activity.external_certificate ? (
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={activity.external_certificate}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:bg-emerald-500"
                  >
                    Ver constancia
                  </a>
                  <button
                    type="button"
                    onClick={handleRemoveCertificate}
                    disabled={certUploading}
                    className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:bg-[#18181b] dark:text-rose-400 dark:hover:bg-rose-950"
                  >
                    {certUploading ? "Procesando..." : "Quitar"}
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-[#eaebed] file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300"
                  />
                  {certError && (
                    <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{certError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleUploadCertificate}
                    disabled={!certFile || certUploading}
                    className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500"
                  >
                    {certUploading ? "Subiendo..." : "Subir constancia (PDF)"}
                  </button>
                </div>
              )}
            </div>
          )}

          <ActivityValidationClient
            activity={activity}
            user={user}
            onChanged={refresh}
          />

          <ActivityEvidence
            activityId={activity.id}
            currentUserId={user?.id ?? null}
            creatorId={activity.creator_id}
            canUpload={canUploadEvidence}
          />
        </div>
      </main>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-emerald-700 dark:text-[#079669]">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
          {label}
        </p>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">{children}</div>
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.125A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625A3.375 3.375 0 0 0 2.25 7.125v10.5A3.375 3.375 0 0 0 5.625 21h10.5A3.375 3.375 0 0 0 19.5 17.625V14.25Z"
      />
    </svg>
  );
}

function BadgeIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.09-1.956-2.19a48.971 48.971 0 0 0-3.275-.772 48.971 48.971 0 0 0-3.275.772 2.25 2.25 0 0 0-1.956 2.19V18a2.25 2.25 0 0 0 2.25 2.25h1.5Zm-9-4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.105c0-.897-.63-1.742-1.523-1.977l-1.348-.362a1.125 1.125 0 0 1-.838-.338l-.878-.878a1.125 1.125 0 0 1-.338-.838l-.362-1.348A2.25 2.25 0 0 0 9.105 4.5H7.5a2.25 2.25 0 0 0-2.25 2.25Z"
      />
    </svg>
  );
}
