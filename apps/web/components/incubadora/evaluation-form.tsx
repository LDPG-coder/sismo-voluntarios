"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { csrfHeaders } from "@/lib/auth/csrf-client";
import { cn } from "@/lib/utils";

const SCORE_LABELS: Record<number, string> = {
  1: "Muy bajo",
  2: "Bajo",
  3: "Medio",
  4: "Alto",
  5: "Muy alto",
};

function ScoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            title={`${n} - ${SCORE_LABELS[n]}`}
            className={cn(
              "h-9 flex-1 rounded-md border text-sm font-medium transition-colors",
              value === n
                ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "border-zinc-200 text-zinc-500 hover:bg-[#eaebed] dark:border-zinc-800 dark:hover:bg-zinc-800",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function EvaluationForm({
  projectId,
  open,
  onClose,
  onEvaluated,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onEvaluated: () => void;
}) {
  const [impact, setImpact] = useState(3);
  const [planning, setPlanning] = useState(3);
  const [viability, setViability] = useState(3);
  const [trust, setTrust] = useState(3);
  const [budgetRating, setBudgetRating] = useState("adequate");
  const [collab, setCollab] = useState(false);
  const [notes, setNotes] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    try {
      const res = await fetch(`${API}/api/v1/incubator/projects/${projectId}/evaluate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeaders("POST") },
        body: JSON.stringify({
          impact_score: impact,
          planning_score: planning,
          budget_rating: budgetRating,
          resources_collab_possible: collab,
          resources_notes: notes || undefined,
          viability_score: viability,
          trust_score: trust,
          recommendation: recommendation || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "No se pudo enviar la evaluacion.");
        setSubmitting(false);
        return;
      }
      onEvaluated();
      onClose();
    } catch {
      setError("Error de red al enviar la evaluacion.");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Evaluar propuesta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <ScoreInput label="Impacto" value={impact} onChange={setImpact} />
          <ScoreInput label="Planificacion" value={planning} onChange={setPlanning} />
          <ScoreInput label="Viabilidad" value={viability} onChange={setViability} />
          <ScoreInput label="Confianza en la propuesta" value={trust} onChange={setTrust} />

          <div className="space-y-1.5">
            <Label>Presupuesto</Label>
            <select
              value={budgetRating}
              onChange={(e) => setBudgetRating(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="adequate">Adecuado</option>
              <option value="optimizable">Puede optimizarse</option>
              <option value="insufficient">Parece insuficiente</option>
              <option value="excessive">Parece excesivo</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={collab} onChange={(e) => setCollab(e.target.checked)} />
            Algunos recursos podrian obtenerse por colaboracion de otros becarios
          </label>
          {collab && (
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="¿Cuales recursos y como?"
              className="min-h-[70px]"
            />
          )}

          <div className="space-y-1.5">
            <Label>Recomendaciones para el autor (privado)</Label>
            <Textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="Sugerencias para fortalecer el proyecto"
              className="min-h-[80px]"
            />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Enviando…" : "Enviar evaluacion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
