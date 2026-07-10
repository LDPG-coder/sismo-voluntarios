import { requireSession } from "@/lib/auth/require-session";
import { CrearActivityClient } from "@/components/crear-activity-client";

export default async function CrearActivityPage() {
  await requireSession();
  return <CrearActivityClient />;
}
