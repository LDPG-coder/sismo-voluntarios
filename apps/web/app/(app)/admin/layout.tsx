import { requireSession } from "@/lib/auth/require-session";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TEMPORAL (ver docs/external-users-access.md): se permite el acceso al panel
  // de admin a usuarios externos (google). El backend (`require_admin_session`)
  // es la fuente de verdad y solo deja pasar role=admin o auth_source=google,
  // así que aquí se quita el bloqueo de rol y se delega al backend.
  // if ((await requireSession()).role !== "admin") {
  //   redirect("/voluntarios");
  // }
  await requireSession();
  return <>{children}</>;
}
