import { requireSession } from "@/lib/auth/require-session";
import { MisActividadesClient } from "@/components/mis-actividades-client";

export default async function MisActividadesPage() {
  await requireSession();
  return <MisActividadesClient />;
}
