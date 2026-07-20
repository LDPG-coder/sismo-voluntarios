"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MarkdownView } from "@/components/incubadora/markdown-view";
import { csrfHeaders } from "@/lib/auth/csrf-client";

export type AccountabilityData = {
  id?: string;
  body: string;
  presupuesto_final: { concept: string; quantity: number; unit_cost: number; status?: string }[];
  explicacion_cambios: string | null;
  impacto_generado: string | null;
};

export function AccountabilitySection({
  projectId,
  existing,
  canPublish,
  canFinish,
  onPublished,
  onFinished,
}: {
  projectId: string;
  existing: AccountabilityData | null;
  canPublish: boolean;
  canFinish: boolean;
  onPublished: () => void;
  onFinished: () => void;
}) {
  const [body, setBody] = useState(existing?.body ?? "");
  const [explicacion, setExplicacion] = useState(existing?.explicacion_cambios ?? "");
  const [impacto, setImpacto] = useState(existing?.impacto_generado ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publish = async () => {
    setError(null);
    if (!body.trim()) {
      setError("La rendición requiere una explicación.");
      return;
    }
    setBusy(true);
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    try {
      const res = await fetch(`${API}/api/v1/incubator/projects/${projectId}/accountability`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeaders("POST") },
        body: JSON.stringify({
          body: body.trim(),
          explicacion_cambios: explicacion || undefined,
          impacto_generado: impacto || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "No se pudo publicar la rendición.");
        setBusy(false);
        return;
      }
      onPublished();
    } catch {
      setError("Error de red al publicar la rendición.");
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    try {
      const res = await fetch(`${API}/api/v1/incubator/projects/${projectId}/finish`, {
        method: "POST",
        credentials: "include",
        headers: csrfHeaders("POST"),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "No se pudo finalizar.");
        setBusy(false);
        return;
      }
      onFinished();
    } catch {
      setError("Error de red al finalizar.");
      setBusy(false);
    }
  };

  if (existing && !canPublish) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Rendición de cuentas</h3>
        <MarkdownView content={existing.body} />
        {existing.explicacion_cambios && (
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-500">Explicacion de cambios</p>
            <MarkdownView content={existing.explicacion_cambios} />
          </div>
        )}
        {existing.impacto_generado && (
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-500">Impacto generado</p>
            <MarkdownView content={existing.impacto_generado} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Rendición de cuentas</h3>
      {existing && (
        <div className="rounded-md border border-zinc-200 p-3 text-xs text-zinc-500 dark:border-zinc-800">
          Ya publicaste una rendición. Puedes actualizarla antes de finalizar.
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Como se utilizaron los recursos</Label>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[90px]" />
      </div>
      <div className="space-y-1.5">
        <Label>Explicacion de cambios respecto al plan</Label>
        <Textarea value={explicacion} onChange={(e) => setExplicacion(e.target.value)} className="min-h-[70px]" />
      </div>
      <div className="space-y-1.5">
        <Label>Impacto generado</Label>
        <Textarea value={impacto} onChange={(e) => setImpacto(e.target.value)} className="min-h-[70px]" />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {canFinish && (
          <Button variant="outline" onClick={finish} disabled={busy}>
            Finalizar proyecto
          </Button>
        )}
        <Button onClick={publish} disabled={busy}>
          {existing ? "Actualizar rendición" : "Publicar rendición"}
        </Button>
      </div>
    </div>
  );
}
