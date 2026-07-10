import { requireSession } from "@/lib/auth/require-session";
import { AdminUsuariosClient } from "@/components/admin-usuarios-client";

export default async function AdminUsuariosPage() {
  await requireSession();
  return <AdminUsuariosClient />;
}
