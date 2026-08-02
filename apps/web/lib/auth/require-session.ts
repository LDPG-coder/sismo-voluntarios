import { redirect } from "next/navigation";

import { readUserSession } from "./session";

// In the SEP-integrated deployment the sismo web is served under the SEP
// domain and NEXT_PUBLIC_WEB_ORIGIN points at the SEP itself. The SEP exposes
// /api/sismo/sso (the same endpoint the "Voluntariado de Becarios" link uses)
// to mint a session for an already-signed-in SEP user.
const SEP_ORIGIN = process.env.NEXT_PUBLIC_WEB_ORIGIN?.trim() || "http://localhost:3000";
const SEP_SSO_URL = `${SEP_ORIGIN}/api/sismo/sso`;

export async function requireSession() {
  const session = await readUserSession();
  if (!session.authenticated) {
    // An expired cookie is not a hard failure on the server: the client
    // SessionProvider attempts a refresh before forcing the SEP SSO, so a
    // server redirect here would cut that refresh short. Missing / invalid /
    // bad-signature sessions go straight to the SEP SSO for auto-entry.
    if (session.reason !== "expired") {
      redirect(SEP_SSO_URL);
    }
  }
  return session;
}
