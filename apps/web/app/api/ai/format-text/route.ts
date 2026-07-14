// [INCUBADORA] Proxy usado unicamente por el editor de propuestas de la
// Incubadora (seccion desactivada temporalmente, no visible en prod).
// Devuelve 404 mientras la seccion este desactivada. Para reactivar, restaura
// el cuerpo original desde el historial de git (proxyeaba a
// POST /api/v1/ai/format-text con cookie + CSRF).
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: { code: "not_found", message: "Incubadora desactivada" } },
    { status: 404 },
  );
}
