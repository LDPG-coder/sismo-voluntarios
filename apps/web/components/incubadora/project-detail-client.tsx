"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectStatusBadge } from "@/components/incubadora/status-badge";
import { MarkdownView } from "@/components/incubadora/markdown-view";
import { BudgetTable, type BudgetLineView, type BudgetTotals } from "@/components/incubadora/budget-builder";
import { ProjectTimeline } from "@/components/incubadora/timeline";
import { EvaluationForm } from "@/components/incubadora/evaluation-form";
import { ContributionForm, type PendingLine } from "@/components/incubadora/contribution-form";
import { UpdatesList, type UpdateItem } from "@/components/incubadora/updates-list";
import { AccountabilitySection } from "@/components/incubadora/accountability-form";
import { csrfHeaders } from "@/lib/auth/csrf-client";

type Project = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  objetivos: string[];
  problematica: string | null;
  impacto_esperado: string | null;
  plan_ejecucion: string | null;
  cronograma: { label: string; date: string }[];
  recursos_necesarios: string[];
  is_anonymous: boolean;
  status: string;
  creator: { id: string | null; name: string; photo_url: string | null; is_anonymous: boolean };
  is_creator: boolean;
  created_at: string | null;
  budget: { lines: BudgetLineView[]; totals: BudgetTotals };
  evaluation: {
    count: number;
    percentage: number;
    threshold_met: boolean;
    target: number;
    averages: { impact: number | null; planning: number | null; viability: number | null; trust: number | null };
    budget_rating_counts: Record<string, number>;
    items: unknown[];
  };
  timeline: { id: string; type: string; title: string; created_at: string | null }[];
  images: { id: string; data: string; filename: string | null }[];
  documents: { id: string; data: string; filename: string | null; content_type: string | null }[];
  updates: UpdateItem[];
  contributions: {
    id: string;
    type: string;
    amount: number | null;
    description: string | null;
    budget_line_id: string | null;
    is_anonymous: boolean;
    contributor: { id: string; name: string };
    created_at: string | null;
  }[];
  accountability: {
    id: string;
    body: string;
    presupuesto_final: { concept: string; quantity: number; unit_cost: number; status?: string }[];
    explicacion_cambios: string | null;
    impacto_generado: string | null;
  } | null;
  permissions: {
    can_evaluate: boolean;
    can_contribute: boolean;
    can_publish_update: boolean;
    can_publish_accountability: boolean;
    can_start_execution: boolean;
    can_finish: boolean;
  };
};

export function ProjectDetailClient({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [evalOpen, setEvalOpen] = useState(false);

  const load = useCallback(async () => {
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    try {
      const res = await fetch(`${API}/api/v1/incubator/projects/${id}`, { credentials: "include" });
      if (res.ok) setProject((await res.json()) as Project);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = useCallback(
    async (path: string) => {
      const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${API}/api/v1/incubator/projects/${id}${path}`, {
        method: "POST",
        credentials: "include",
        headers: csrfHeaders("POST"),
      });
      if (res.ok) setProject((await res.json()) as Project);
    },
    [id],
  );

  const publishUpdate = useCallback(
    async (body: string, images: { filename: string; content_type: string; data: string; size: number }[]) => {
      const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${API}/api/v1/incubator/projects/${id}/updates`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeaders("POST") },
        body: JSON.stringify({ body, images }),
      });
      if (res.ok) setProject((await res.json()) as Project);
    },
    [id],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-4">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-zinc-500">
        No se encontro el proyecto.{" "}
        <Link href="/incubadora" className="text-emerald-600 underline">
          Volver
        </Link>
      </div>
    );
  }

  const authorName = project.is_anonymous ? "Anonimo" : project.creator?.name || "Desconocido";
  const pendingLines: PendingLine[] = project.budget.lines
    .filter((l) => l.status === "pending")
    .map((l) => ({ id: l.id, concept: l.concept, line_total: l.line_total }));
  const avg = project.evaluation.averages;

  return (
    <div>
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-4">
        <Link href="/incubadora" className="text-sm text-zinc-500 hover:text-zinc-700">
          ← Incubadora
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline">{project.category}</Badge>
              <ProjectStatusBadge status={project.status} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {authorName}
              {project.created_at && ` · ${new Date(project.created_at).toLocaleDateString("es")}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {project.permissions.can_start_execution && (
              <Button variant="outline" onClick={() => void post("/start-execution")}>
                Iniciar ejecucion
              </Button>
            )}
            {project.permissions.can_evaluate && (
              <Button onClick={() => setEvalOpen(true)}>Evaluar propuesta</Button>
            )}
            {project.is_creator && project.status === "evaluating" && (
              <Link href={`/incubadora/${project.id}/editar`}>
                <Button variant="outline">Editar</Button>
              </Link>
            )}
          </div>
        </div>

        {project.status === "evaluating" && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/30">
            En evaluación comunitaria: <strong>{project.evaluation.percentage}%</strong> del quorum
            ({project.evaluation.count}/{project.evaluation.target} evaluaciones).
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Propuesta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <MarkdownView content={project.description} />
                {project.problematica && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Problematica</p>
                    <MarkdownView content={project.problematica} />
                  </div>
                )}
                {project.impacto_esperado && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Impacto esperado</p>
                    <MarkdownView content={project.impacto_esperado} />
                  </div>
                )}
                {project.objetivos?.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Objetivos</p>
                    <ul className="list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                      {project.objetivos.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {project.plan_ejecucion && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Plan de ejecucion</p>
                    <MarkdownView content={project.plan_ejecucion} />
                  </div>
                )}
                {project.cronograma?.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Cronograma</p>
                    <ul className="space-y-1 text-sm">
                      {project.cronograma.map((c, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="font-medium">{c.date}</span>
                          <span className="text-zinc-600 dark:text-zinc-400">{c.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {project.recursos_necesarios?.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Recursos necesarios</p>
                    <div className="flex flex-wrap gap-2">
                      {project.recursos_necesarios.map((r, i) => (
                        <Badge key={i} variant="secondary">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {project.images?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Galeria</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {project.images.map((img) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={img.id} src={img.data} alt={img.filename || ""} className="h-40 w-full rounded object-cover" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {project.documents?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Documentos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {project.documents.map((d) => (
                      <li key={d.id}>
                        <a
                          href={d.data}
                          download={d.filename || "documento"}
                          className="text-emerald-600 underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {d.filename || "Documento"}
                        </a>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Avances</CardTitle>
              </CardHeader>
              <CardContent>
                <UpdatesList
                  updates={project.updates}
                  canPublish={project.permissions.can_publish_update}
                  onPublish={publishUpdate}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rendición de cuentas</CardTitle>
              </CardHeader>
              <CardContent>
                <AccountabilitySection
                  projectId={project.id}
                  existing={project.accountability}
                  canPublish={project.permissions.can_publish_accountability}
                  canFinish={project.permissions.can_finish}
                  onPublished={load}
                  onFinished={load}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Presupuesto</CardTitle>
              </CardHeader>
              <CardContent>
                <BudgetTable lines={project.budget.lines} totals={project.budget.totals} />
                {project.permissions.can_contribute && (
                  <div className="mt-4">
                    <ContributionForm projectId={project.id} pendingLines={pendingLines} onContributed={load} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Evaluación comunitaria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Impacto" value={avg.impact} />
                  <Metric label="Planificacion" value={avg.planning} />
                  <Metric label="Viabilidad" value={avg.viability} />
                  <Metric label="Confianza" value={avg.trust} />
                </div>
                {Object.keys(project.evaluation.budget_rating_counts).length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Presupuesto</p>
                    <ul className="space-y-0.5 text-xs">
                      {Object.entries(project.evaluation.budget_rating_counts).map(([k, v]) => (
                        <li key={k} className="flex justify-between">
                          <span className="capitalize">{k}</span>
                          <span>{v}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-zinc-400">
                  {project.evaluation.count} evaluación(es) · quorum {project.evaluation.target}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cronologia</CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectTimeline events={project.timeline} />
              </CardContent>
            </Card>

            {project.contributions?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Aportes recibidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {project.contributions.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {c.is_anonymous ? "Anonimo" : c.contributor.name} · {c.type}
                          {c.amount ? ` (${c.amount})` : ""}
                          {c.description ? `: ${c.description}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <EvaluationForm
        projectId={project.id}
        open={evalOpen}
        onClose={() => setEvalOpen(false)}
        onEvaluated={load}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-md bg-[#f7f8f9] px-3 py-2 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-base font-semibold">{value ?? "—"}</p>
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  return <ProjectDetailClient id={params.id} />;
}
