import crypto from "crypto";
import { Pool } from "pg";

/**
 * Helper de autenticacion para E2E sin OAuth/SEP.
 *
 * La API firma la cookie de sesion como:
 *   base64url(json).hmac_sha256(secret, base64url(json))
 * con payload { user_id, role, status, iat, exp, jti }.
 * Replicamos exactamente esa firma en Node para poder "loguearnos" como
 * cualquier usuario (admin SEP, voluntario SEP, voluntario externo) solo
 * conociendo su UUID.
 */

const SECRET =
  process.env.SISMO_SESSION_SECRET ||
  "dev-only-session-secret-do-not-use-in-production";
const MAX_AGE = 30 * 60; // session_max_age_seconds (default)

export function mintSessionCookie(
  userId: string,
  role: "admin" | "volunteer" = "volunteer",
  status: "active" | "pending" | "suspended" = "active",
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    user_id: userId,
    role,
    status,
    iat: now,
    exp: now + MAX_AGE,
    jti: crypto.randomBytes(12).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto
    .createHmac("sha256", SECRET)
    .update(encoded)
    .digest("hex");
  return `${encoded}.${mac}`;
}

// Usuario admin de dev fijo (scripts/seed.py -> DEV_USER_ID).
export const DEV_ADMIN_ID = "11111111-1111-1111-1111-111111111111";

const pool = new Pool({
  host: process.env.PG_HOST || "postgres",
  port: Number(process.env.PG_PORT || 5432),
  database: process.env.PG_DB || "sismo",
  user: process.env.PG_USER || "sismo",
  password: process.env.PG_PASSWORD || "sismo",
});

/** Inserta (idempotentemente) un usuario de prueba y devuelve su UUID. */
export async function ensureUser(opts: {
  email: string;
  role: "admin" | "volunteer";
  auth_source: "sep" | "google";
  status?: "active" | "pending" | "suspended";
}): Promise<string> {
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO users (id, email, role, auth_source, status, referral_code, tenant_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'00000000-0000-0000-0000-000000000001', now(), now())
     ON CONFLICT (email) DO NOTHING`,
    [
      id,
      opts.email,
      opts.role,
      opts.auth_source,
      opts.status || "active",
      "QA" + id.slice(0, 8),
    ],
  );
  const r = await pool.query("SELECT id FROM users WHERE email = $1", [
    opts.email,
  ]);
  return (r.rows[0].id as string) ?? id;
}

export async function closePool(): Promise<void> {
  await pool.end();
}

/** Borra las actividades de prueba creadas por el smoke suite. */
export async function deleteQaActivities(): Promise<void> {
  await pool.query(
    "DELETE FROM activities WHERE title LIKE 'QA Publica Futura%' OR title LIKE 'QA Privada Pasada%'",
  );
}
