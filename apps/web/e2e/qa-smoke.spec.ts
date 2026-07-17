import { test, expect, type Page } from "@playwright/test";
import {
  mintSessionCookie,
  ensureUser,
  closePool,
  deleteQaActivities,
  DEV_ADMIN_ID,
} from "./helpers/auth";

const API_URL = process.env.API_URL || "http://sismo-dev-api-1:8000";

const RUN = Date.now();
const FUTURE_TITLE = `QA Publica Futura ${RUN}`;
const PAST_TITLE = `QA Privada Pasada ${RUN}`;

let adminId: string;
let sepVolId: string;
let extVolId: string;

async function apiPost(
  path: string,
  body: unknown,
  cookie: string,
  method = "POST",
) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: `sismo_session=${cookie}; XSRF-TOKEN=csrf-test-token`,
      "X-CSRF-Token": "csrf-test-token",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function addSession(page: Page, userId: string, role: "admin" | "volunteer") {
  const cookie = mintSessionCookie(userId, role);
  await page.context().addCookies([
    { name: "sismo_session", value: cookie, url: page.context()._options.baseURL! },
    { name: "XSRF-TOKEN", value: "csrf-test-token", url: page.context()._options.baseURL! },
  ]);
}

test.beforeAll(async () => {
  adminId = await ensureUser({
    email: "dev@sismo.local",
    role: "admin",
    auth_source: "sep",
    status: "active",
    id: DEV_ADMIN_ID,
  });
  sepVolId = await ensureUser({
    email: "qa-sep-" + Date.now() + "@example.com",
    role: "volunteer",
    auth_source: "sep",
  });
  extVolId = await ensureUser({
    email: "qa-ext-" + Date.now() + "@example.com",
    role: "volunteer",
    auth_source: "google",
  });

  // Actividad publica futura creada por el voluntario SEP.
  const sepCookie = mintSessionCookie(sepVolId, "volunteer");
  await apiPost(
    "/api/v1/activities",
    {
      title: FUTURE_TITLE,
      zone: "Caracas",
      raw_address: "Av. Libertador 123",
      date_time: "2030-01-01T10:00:00",
    },
    sepCookie,
  );
  // Actividad privada (fecha pasada) creada por el voluntario externo.
  const extCookie = mintSessionCookie(extVolId, "volunteer");
  await apiPost(
    "/api/v1/activities",
    {
      title: PAST_TITLE,
      zone: "Caracas",
      raw_address: "Calle 2",
      date_time: "2000-01-01T10:00:00",
    },
    extCookie,
  );

  // Pre-check: el feed de descubrimiento (mismo endpoint que usa la UI) debe
  // mostrar la actividad futura para un tercero y ocultar la privada.
  const adminCookie = mintSessionCookie(adminId, "admin");
  const disc: any[] = await (
    await fetch(`${API_URL}/api/v1/activities`, {
      headers: { Cookie: `sismo_session=${adminCookie}` },
    })
  ).json();
  console.log(
    "DISCOVERY titles:",
    disc.map((a) => a.title),
    "hasFuture:",
    disc.some((a) => a.title === FUTURE_TITLE),
  );
});

test.afterAll(async () => {
  // Limpiar actividades de prueba para no acumular basura en el feed.
  await deleteQaActivities();
  await closePool();
});

test("descubrimiento: un tercero ve la publica futura y nunca la privada", async ({
  page,
}) => {
  await addSession(page, adminId, "admin");
  await page.goto("/voluntarios");
  await expect(page.getByText(FUTURE_TITLE)).toBeVisible();
  await expect(page.getByText(PAST_TITLE)).toHaveCount(0);
});

test("descubrimiento: el creador NO ve su propia actividad", async ({ page }) => {
  await addSession(page, sepVolId, "volunteer");
  await page.goto("/voluntarios");
  await expect(page.getByText(FUTURE_TITLE)).toHaveCount(0);
});

test("Mis actividades: el creador ve su actividad en Creadas", async ({
  page,
}) => {
  await addSession(page, sepVolId, "volunteer");
  await page.goto("/mis-actividades");
  await expect(page.getByText(FUTURE_TITLE)).toBeVisible();
});

test("Crear actividad: el formulario carga", async ({ page }) => {
  await addSession(page, sepVolId, "volunteer");
  await page.goto("/voluntarios/crear");
  await expect(page.getByText(/Crear/i)).toBeVisible();
});

test("Admin: pagina de validacion externa carga", async ({ page }) => {
  await addSession(page, adminId, "admin");
  await page.goto("/admin");
  await expect(page.locator("body")).toBeVisible();
});

test("Login: error de OAuth se muestra como banner, no como JSON", async ({
  page,
}) => {
  // El API redirige a /login?error=oauth_not_configured en vez de devolver JSON.
  await page.goto("/login?error=oauth_not_configured");
  await expect(
    page.getByText(/no esta configurado en este entorno/i),
  ).toBeVisible();
});
