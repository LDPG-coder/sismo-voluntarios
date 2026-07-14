import { requireSession } from "@/lib/auth/require-session";
import { TodasActividadesClient } from "@/components/todas-actividades-client";

export default async function TodasActividadesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; estado?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;
  const tab = sp.tab === "enrolled" ? "enrolled" : "created";
  const estado = sp.estado ?? "active";
  return <TodasActividadesClient tab={tab} estado={estado} />;
}
