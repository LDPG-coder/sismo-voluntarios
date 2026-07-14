"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CrearPropuestaClient,
  type ProposalInitial,
} from "@/components/incubadora/crear-propuesta-client";
import type { BudgetRow } from "@/components/incubadora/budget-builder";

export default function EditarPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [initial, setInitial] = useState<ProposalInitial | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${API}/api/v1/incubator/projects/${id}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return (await res.json()) as Record<string, unknown>;
      })
      .then((data) => {
        if (!data) return;
        const budget = (data.budget as { lines: BudgetRow[] })?.lines ?? [];
        setInitial({
          title: (data.title as string) ?? "",
          category: (data.category as string) ?? "",
          description: (data.description as string | null) ?? null,
          problematica: (data.problematica as string | null) ?? null,
          impacto_esperado: (data.impacto_esperado as string | null) ?? null,
          plan_ejecucion: (data.plan_ejecucion as string | null) ?? null,
          objetivos: (data.objetivos as string[]) ?? [],
          recursos_necesarios: (data.recursos_necesarios as string[]) ?? [],
          cronograma: (data.cronograma as { label: string; date: string }[]) ?? [],
          budget,
          is_anonymous: Boolean(data.is_anonymous),
        });
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="mb-4 h-8 w-56" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (notFound || !initial) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-zinc-500">No se encontro el proyecto.</div>;
  }

  return <CrearPropuestaClient projectId={id} initial={initial} />;
}
