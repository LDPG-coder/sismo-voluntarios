import { requireSession } from "@/lib/auth/require-session";
import { ActivityAdminClient } from "@/components/activity-admin-client";

export default async function ActivityAdminPage() {
  await requireSession();
  return <ActivityAdminClient />;
}
