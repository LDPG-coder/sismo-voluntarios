import { redirect } from "next/navigation";

import { readUserSession } from "./session";

export async function requireSession() {
  const session = await readUserSession();
  if (!session.authenticated) {
    redirect("/login");
  }
  return session;
}
