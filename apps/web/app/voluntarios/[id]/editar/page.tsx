import { requireSession } from "@/lib/auth/require-session";
import { EditarActivityClient } from "@/components/editar-activity-client";

export default async function EditarActivityPage() {
  await requireSession();
  return <EditarActivityClient />;
}
