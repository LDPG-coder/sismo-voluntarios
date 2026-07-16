import { redirect } from "next/navigation";

import { readUserSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await readUserSession();
  if (session.authenticated && session.role === "admin") {
    redirect("/admin");
  }
  redirect("/voluntarios");
}
