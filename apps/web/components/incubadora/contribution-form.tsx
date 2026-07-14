"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { csrfHeaders } from "@/lib/auth/csrf-client";
import { formatCurrency } from "@/lib/file";

export type PendingLine = { id: string; concept: string; line_total: number };

export function ContributionForm({
  projectId,
  pendingLines,
  onContributed,
}: {
  projectId: string;
  pendingLines: PendingLine[];
  onContributed: () => void;
}) {
  const [type, setType] = useState("money");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [budgetLineId, setBudgetLineId] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const payload: Record<string, unknown> = {
      type,
      description: description || undefined,
      budget_line_id: budgetLineId || undefined,
      is_anonymous: isAnonymous,
    };
    if (type === "money") {
      const amt = Number(amount);
      if (!amt || amt <= 0) {
        setError("Indica un monto mayor a 0.");
        return;
      }
      payload.amount = amt;
    } else if (!description && !budgetLineId) {
      setError("Describe el recurso que aportas.");
      return;
    }
    setSubmitting(true);
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    try {
      const res = await fetch(`${API}/api/v1/incubator/projects/${projectId}/contributions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeaders("POST") },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "No se pudo registrar el aporte.");
        setSubmitting(false);
        return;
      }
      setAmount("");
      setDescription("");
      setBudgetLineId("");
      onContributed();
    } catch {
      setError("Error de red al aportar.");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-sm font-semibold">Realizar un aporte</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Tipo de aporte</Label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="money">Donacion economica</option>
            <option value="in_kind">Donacion en especie</option>
            <option value="loan">Prestamo de herramientas</option>
            <option value="tools">Herramientas</option>
            <option value="materials">Materiales</option>
            <option value="transport">Transporte</option>
            <option value="other">Otro</option>
          </select>
        </div>
        {type === "money" ? (
          <div className="space-y-1.5">
            <Label>Monto</Label>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Recurso (linea del presupuesto)</Label>
            <select
              value={budgetLineId}
              onChange={(e) => setBudgetLineId(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">Sin linea especifica</option>
              {pendingLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.concept} ({formatCurrency(l.line_total)})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Descripcion {type !== "money" ? "(obligatoria)" : "(opcional)"}</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej. Aporto las brochas solicitadas"
          className="min-h-[60px]"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
        Aportar de forma anonima
      </label>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Registrando…" : "Registrar aporte"}
        </Button>
      </div>
    </div>
  );
}
