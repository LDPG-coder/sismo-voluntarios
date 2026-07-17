import { test, expect } from "@playwright/test";
import { mintSessionCookie, ensureUser } from "./helpers/auth";

test("registro previo: toggle IA visible y rellena campos", async ({
  page,
  context,
}) => {
  const adminId = await ensureUser({
    email: `qa-ai-${Date.now()}@sismo.local`,
    role: "admin",
    auth_source: "sep",
    status: "active",
  });
  const cookie = mintSessionCookie(adminId, "admin", "active");
  await context.addCookies([
    { name: "sismo_session", value: cookie, domain: "sismo-dev-web-1", path: "/" },
    { name: "XSRF-TOKEN", value: "qa-csrf-" + Date.now(), domain: "sismo-dev-web-1", path: "/" },
  ]);

  await page.goto("http://sismo-dev-web-1:3002/voluntarios/crear");

  // Seleccionar el tipo "Registro previo".
  await page
    .getByRole("button")
    .filter({ hasText: "Registro previo" })
    .click();

  // El toggle de Autocompletar con IA debe estar visible (antes estaba oculto).
  const aiToggle = page.getByText("Autocompletar con IA");
  await expect(aiToggle).toBeVisible();

  // Escribir una descripcion y dejar que la IA rellene los campos.
  const desc =
    "El sabado 14 de junio fuimos 10 voluntarios a la playa Los Cocos en " +
    "Caracas a recoger basura plastica durante 3 horas. Llevamos guantes, " +
    "bolsas y prototector solar. Recogimos 15 bolsas de residuos.";
  await page.locator("textarea").first().fill(desc);

  // La IA debe poblar el titulo (primer input type=text visible).
  const title = page.locator('input[type="text"]').first();
  await expect(title).not.toHaveValue("", { timeout: 30000 });

  // Y la direccion.
  const address = page.locator('input[placeholder*="Av. Principal"]');
  await expect(address).not.toHaveValue("", { timeout: 30000 });

  console.log("AI autocompleto: titulo =", await title.inputValue());
});
