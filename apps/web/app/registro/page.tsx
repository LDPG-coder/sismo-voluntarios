import { redirect } from "next/navigation";

// El registro por token de invitación (y cualquier alta de usuarios desde la
// app) está desactivado: todas las cuentas se cargan manualmente. Redirigimos
// a /login. Ver docs/external-users-access.md.
export default function RegistroPage() {
  redirect("/login");
}
