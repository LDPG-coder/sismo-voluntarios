"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  ClipboardList,
  CheckCircle2,
  List,
} from "lucide-react";
import { displayPhoto } from "@/lib/photo";
import { useSession } from "@/components/session-provider";
import { PageGuide } from "@/components/page-guide";
import { ColumnSelector, type ColumnDef } from "@/components/column-selector";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const EXPORT_COLUMNS: readonly ColumnDef[] = [
  { key: "becario_id", label: "ID becario" },
  { key: "becario_email", label: "Email becario" },
  { key: "becario_nombre", label: "Nombre becario" },
  { key: "becario_telefono", label: "Teléfono becario" },
  { key: "becario_auth_source", label: "Auth becario" },
  { key: "actividad_id", label: "ID actividad" },
  { key: "titulo", label: "Título" },
  { key: "tipo", label: "Tipo" },
  { key: "zona", label: "Zona" },
  { key: "direccion", label: "Dirección" },
  { key: "fecha_inicio", label: "Fecha inicio" },
  { key: "fecha_fin", label: "Fecha fin" },
  { key: "descripcion", label: "Descripción" },
  { key: "horas_realizadas", label: "Horas realizadas" },
  { key: "duracion_estimada_min", label: "Duración est." },
  { key: "estado", label: "Estado" },
  { key: "estado_label", label: "Estado (label)" },
  { key: "n_evidencias", label: "Nº evidencias" },
  { key: "enlaces_comprobantes", label: "Enlaces comprobantes" },
  { key: "referencias_archivo", label: "Referencias archivo" },
] as const;

interface DashboardStats {
  total_users: number;
  total_activities: number;
  active_activities: number;
  completed_activities: number;
  total_members: number;
  total_evidence: number;
  recent_activities: {
    id: string;
    title: string;
    zone: string;
    date_time: string | null;
    status: string;
    type: string;
    member_count: number;
    created_at: string | null;
  }[];
  recent_users: {
    id: string;
    email: string;
    name: string | null;
    photo_url: string | null;
    role: string;
    status: string;
    created_at: string | null;
  }[];
}

const STATUS_BADGES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  archived: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const TYPE_BADGES: Record<string, string> = {
  Interno: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  ProExcelencia: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Registro previo": "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

function KPICard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  accent: string;
}) {
  return (
    <div className="rounded-xl bg-white p-4 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <Icon className={`h-6 w-6 shrink-0 ${accent}`} strokeWidth={2} />
        <div>
          <p className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{value}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    active: "Programada",
    archived: "Realizada",
    cancelled: "Cancelada",
  };
  return map[s] || s;
}

export function AdminDashboardClient() {
  const { user } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filtroBecario, setFiltroBecario] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    () => new Set(EXPORT_COLUMNS.map((c) => c.key)),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/admin/dashboard`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Error cargando dashboard");
        return r.json();
      })
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filtroBecario.trim()) params.set("becario", filtroBecario.trim());
      if (filtroFecha) params.set("fecha", filtroFecha);
      if (filtroDesde) params.set("desde", filtroDesde);
      if (filtroHasta) params.set("hasta", filtroHasta);
      if (filtroEstado) params.set("estado", filtroEstado);
      if (selectedColumns.size < EXPORT_COLUMNS.length) {
        params.set("columns", Array.from(selectedColumns).join(","));
      }
      const qs = params.toString();
      const res = await fetch(
        `${API}/api/v1/admin/export${qs ? `?${qs}` : ""}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sismo_reporte_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // silencioso
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-4">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-4">
        <p className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </p>
      </main>
    );
  }

  if (!stats) return null;

  return (
      <main className="mx-auto max-w-5xl overflow-x-hidden px-4 pt-8 pb-4">
      {user?.role === "admin" && (
        <PageGuide id="admin" title="Panel de administración">
          Aquí supervisas usuarios, actividades y validaciones. Usa los filtros
          para exportar reportes y da seguimiento a las horas del programa.
        </PageGuide>
      )}
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">
            Panel de administración
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Resumen del programa de voluntariado
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {exporting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Exportando...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Exportar reporte (Excel)
            </>
          )}
        </button>
      </div>

      {/* Filtros de exportación */}
      <div className="mb-6 rounded-xl bg-white p-4 dark:bg-zinc-900">
        <p className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          Filtros del reporte
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            Becario (email/nombre)
            <input
              type="text"
              value={filtroBecario}
              onChange={(e) => setFiltroBecario(e.target.value)}
              placeholder="ej. maria@correo.com"
              className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            Estado
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">Todos</option>
              <option value="active">Programada</option>
              <option value="archived">Realizada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            Fecha exacta
            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            Desde (período)
            <input
              type="date"
              value={filtroDesde}
              onChange={(e) => setFiltroDesde(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            Hasta (período)
            <input
              type="date"
              value={filtroHasta}
              onChange={(e) => setFiltroHasta(e.target.value)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
        </div>
        <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <ColumnSelector
            columns={EXPORT_COLUMNS}
            selected={selectedColumns}
            onChange={setSelectedColumns}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <KPICard label="Voluntarios" value={stats.total_users} icon={Users} accent="text-emerald-500" />
        <KPICard label="Actividades" value={stats.total_activities} icon={ClipboardList} accent="text-blue-500" />
        <KPICard label="Inscripciones" value={stats.total_members} icon={CheckCircle2} accent="text-purple-500" />
      </div>

      {/* Quick links */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/admin/usuarios"
          className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Users className="h-4 w-4" />
          Gestionar usuarios
        </Link>
        <Link
          href="/voluntarios"
          className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <List className="h-4 w-4" />
          Ver actividades
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent activities */}
        <section className="min-w-0">
          <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            Actividades recientes
          </h2>
          {stats.recent_activities.length === 0 ? (
            <p className="text-sm text-zinc-400">No hay actividades todavía.</p>
          ) : (
            <div className="space-y-2">
              {stats.recent_activities.map((a) => (
                <Link
                  key={a.id}
                  href={`/voluntarios/${a.id}`}
                  className="block overflow-hidden rounded-lg bg-white p-3 transition hover:shadow-sm dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        {a.title}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {a.zone} · {formatDate(a.date_time)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_BADGES[a.type] || TYPE_BADGES["ProExcelencia"]}`}
                      >
                        {a.type}
                      </span>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGES[a.status] || ""}`}
                      >
                        {statusLabel(a.status)}
                      </span>
                    </div>
                  </div>
                  {a.member_count > 0 && (
                    <p className="mt-1 text-[11px] text-zinc-400">
                      {a.member_count} participante{a.member_count !== 1 ? "s" : ""}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Recent users */}
        <section className="min-w-0">
          <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            Usuarios recientes
          </h2>
          {stats.recent_users.length === 0 ? (
            <p className="text-sm text-zinc-400">No hay usuarios todavía.</p>
          ) : (
            <div className="space-y-2">
              {stats.recent_users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 rounded-lg bg-white p-3 dark:bg-zinc-900"
                >
                  {u.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayPhoto(u.photo_url) ?? ""}
                      loading="lazy"
                      decoding="async"
                      alt={u.name || u.email}
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {(u.name || u.email).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {u.name || u.email}
                    </p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{u.email}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      u.role === "admin"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
