import { requireSession } from "@/lib/auth/require-session";
import { AdminDashboardClient } from "@/components/admin-dashboard-client";

export default async function AdminDashboardPage() {
  await requireSession();
  return <AdminDashboardClient />;
}
