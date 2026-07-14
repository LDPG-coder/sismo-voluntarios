"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCard, type ProjectSummary } from "@/components/incubadora/project-card";

export default function IncubadoraPage() {
  const [evaluating, setEvaluating] = useState<ProjectSummary[] | null>(null);
  const [active, setActive] = useState<ProjectSummary[] | null>(null);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const opts: RequestInit = { credentials: "include" };
    Promise.all([
      fetch(`${API}/api/v1/incubator/projects?tab=evaluating`, opts).then((r) => (r.ok ? r.json() : { projects: [] })),
      fetch(`${API}/api/v1/incubator/projects?tab=active`, opts).then((r) => (r.ok ? r.json() : { projects: [] })),
    ])
      .then(([ev, ac]) => {
        setEvaluating(ev.projects ?? []);
        setActive(ac.projects ?? []);
      })
      .catch(() => {
        setEvaluating([]);
        setActive([]);
      });
  }, []);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Incubadora de Proyectos</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Propón, evalúa en comunidad y haz realidad iniciativas de impacto social.
            </p>
          </div>
          <Link href="/incubadora/crear">
            <Button>Proponer proyecto</Button>
          </Link>
        </div>

        <Tabs defaultValue="evaluating">
          <TabsList>
            <TabsTrigger value="evaluating">Propuestas en evaluación</TabsTrigger>
            <TabsTrigger value="active">Proyectos activos</TabsTrigger>
          </TabsList>

          <TabsContent value="evaluating">
            <SectionGrid projects={evaluating} empty="Aún no hay propuestas en evaluación." />
          </TabsContent>
          <TabsContent value="active">
            <SectionGrid projects={active} empty="No hay proyectos activos recibiendo recursos." />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function SectionGrid({ projects, empty }: { projects: ProjectSummary[] | null; empty: string }) {
  if (projects === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (projects.length === 0) {
    return <div className="py-16 text-center text-sm text-zinc-500">{empty}</div>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  );
}
