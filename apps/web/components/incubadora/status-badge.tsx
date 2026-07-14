import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  evaluating: "En evaluación",
  collecting: "Recibiendo recursos",
  executing: "En ejecución",
  accountability: "Rendición de cuentas",
  finished: "Finalizado",
};

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  evaluating: "warning",
  collecting: "default",
  executing: "default",
  accountability: "secondary",
  finished: "outline",
};

export function ProjectStatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "secondary"} className={cn("whitespace-nowrap")}>
      {label}
    </Badge>
  );
}

export function budgetLineStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "covered_money":
      return "Cubierto (donación)";
    case "covered_in_kind":
      return "Cubierto (especie)";
    default:
      return status;
  }
}
