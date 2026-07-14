"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { budgetLineStatusLabel } from "@/components/incubadora/status-badge";
import { formatCurrency } from "@/lib/file";
import { cn } from "@/lib/utils";

export type BudgetRow = {
  concept: string;
  quantity: number;
  unit_cost: number;
};

function rowTotal(r: BudgetRow): number {
  return (Number(r.quantity) || 0) * (Number(r.unit_cost) || 0);
}

export function BudgetBuilder({
  value,
  onChange,
}: {
  value: BudgetRow[];
  onChange: (rows: BudgetRow[]) => void;
}) {
  const rows = value.length ? value : [{ concept: "", quantity: 1, unit_cost: 0 }];

  const update = (i: number, patch: Partial<BudgetRow>) => {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, { concept: "", quantity: 1, unit_cost: 0 }]);

  const grandTotal = rows.reduce((sum, r) => sum + rowTotal(r), 0);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-[#f7f8f9] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-3 py-2">Concepto</th>
              <th className="px-3 py-2 w-24">Cantidad</th>
              <th className="px-3 py-2 w-32">Costo unit.</th>
              <th className="px-3 py-2 w-32">Subtotal</th>
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                <td className="px-3 py-2">
                  <Input
                    value={r.concept}
                    placeholder="Ej. Pintura"
                    onChange={(e) => update(i, { concept: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min={1}
                    value={r.quantity}
                    onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={r.unit_cost}
                    onChange={(e) => update(i, { unit_cost: Number(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2 font-medium">{formatCurrency(rowTotal(r))}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="text-zinc-400 transition hover:text-rose-600"
                    aria-label="Eliminar línea"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={add}>
          + Añadir línea
        </Button>
        <div className="text-sm">
          <span className="text-zinc-500">Total requerido: </span>
          <span className="font-semibold">{formatCurrency(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}

export type BudgetLineView = {
  id: string;
  concept: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  status: string;
};

export type BudgetTotals = {
  total: number;
  covered: number;
  remaining: number;
  progress: number;
};

export function BudgetTable({
  lines,
  totals,
}: {
  lines: BudgetLineView[];
  totals: BudgetTotals;
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-[#f7f8f9] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-3 py-2">Concepto</th>
              <th className="px-3 py-2 w-20">Cant.</th>
              <th className="px-3 py-2 w-28">Costo unit.</th>
              <th className="px-3 py-2 w-28">Subtotal</th>
              <th className="px-3 py-2 w-36">Estado</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                <td className="px-3 py-2">{l.concept}</td>
                <td className="px-3 py-2">{l.quantity}</td>
                <td className="px-3 py-2">{formatCurrency(l.unit_cost)}</td>
                <td className="px-3 py-2 font-medium">{formatCurrency(l.line_total)}</td>
                <td className="px-3 py-2">
                  <Badge
                    variant={
                      l.status === "pending"
                        ? "warning"
                        : l.status === "covered_money"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {budgetLineStatusLabel(l.status)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className={cn("h-full rounded-full bg-emerald-500 transition-all")}
            style={{ width: `${totals.progress}%` }}
          />
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <span className="text-zinc-500">Total: <strong>{formatCurrency(totals.total)}</strong></span>
          <span className="text-zinc-500">Cubierto: <strong className="text-emerald-600">{formatCurrency(totals.covered)}</strong></span>
          <span className="text-zinc-500">Pendiente: <strong className="text-amber-600">{formatCurrency(totals.remaining)}</strong></span>
        </div>
      </div>
    </div>
  );
}
