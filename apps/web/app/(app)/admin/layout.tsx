import { requireSession } from "@/lib/auth/require-session";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if ((await requireSession()).role !== "admin") {
    redirect("/voluntarios");
  }
  return <>{children}</>;
}
