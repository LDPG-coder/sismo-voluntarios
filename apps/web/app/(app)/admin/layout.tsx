import { requireSession } from "@/lib/auth/require-session";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // requireSession now returns an unauthenticated session for an expired
  // cookie (the client SessionProvider refreshes before forcing the SEP SSO),
  // so guard on authenticated before reading the role.
  const session = await requireSession();
  if (!session.authenticated || session.role !== "admin") {
    redirect("/voluntarios");
  }
  return <>{children}</>;
}
