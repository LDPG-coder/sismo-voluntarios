import { requireSession } from "@/lib/auth/require-session";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  if (session.role !== "admin") {
    redirect("/voluntarios");
  }
  return <>{children}</>;
}
