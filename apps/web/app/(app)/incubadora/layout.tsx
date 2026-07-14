import { requireSession } from "@/lib/auth/require-session";

export default async function IncubadoraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  return <>{children}</>;
}
