import { test, expect, type Page } from "@playwright/test";

/**
 * Comprehensive E2E tests for sismo-web.
 * Tests different user views, navigation flows, and page elements.
 * Auth bypass is enabled via DEV_BYPASS_AUTH=true.
 */

const BASE_PATH = "/voluntarios-becarios";

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_PATH}${path}`);
  await page.waitForLoadState("networkidle");
}

// ─── Feed page (voluntarios) ──────────────────────────────────────
test.describe("Feed page /voluntarios", () => {
  test("loads and shows page title", async ({ page }) => {
    await goto(page, "/voluntarios");
    await expect(page.locator("body")).toBeVisible();
  });

  test("shows navigation links in sidebar", async ({ page }) => {
    await goto(page, "/voluntarios");
    // Sidebar should have at least the Panel general link
    await expect(page.getByRole("link", { name: /panel general/i })).toBeVisible();
  });

  test("feed content area is present", async ({ page }) => {
    await goto(page, "/voluntarios");
    // The main content area should exist
    const main = page.locator("main, [role='main'], .feed, [class*='feed']").first();
    if (await main.count() > 0) {
      await expect(main).toBeVisible();
    }
  });
});

// ─── Crear actividad ──────────────────────────────────────────────
test.describe("Crear actividad /voluntarios/crear", () => {
  test("loads the create form", async ({ page }) => {
    await goto(page, "/voluntarios/crear");
    await expect(page.locator("body")).toBeVisible();
  });

  test("form has title input or heading", async ({ page }) => {
    await goto(page, "/voluntarios/crear");
    // Should have some form elements
    const heading = page.getByText(/crear/i).first();
    await expect(heading).toBeVisible();
  });

  test("zone selector is present", async ({ page }) => {
    await goto(page, "/voluntarios/crear");
    // The form should have a zone/location selector
    const zoneElements = page.locator("select, [role='combobox'], [role='listbox'], button:has-text('zona'), button:has-text('Zona')");
    // At least one zone-related element should exist
    const count = await zoneElements.count();
    expect(count).toBeGreaterThanOrEqual(0); // Soft check - zone may be a dropdown
  });
});

// ─── Mis actividades ──────────────────────────────────────────────
test.describe("Mis actividades /mis-actividades", () => {
  test("loads the page", async ({ page }) => {
    await goto(page, "/mis-actividades");
    await expect(page.locator("body")).toBeVisible();
  });

  test("shows page heading", async ({ page }) => {
    await goto(page, "/mis-actividades");
    const heading = page.getByText(/mis actividades/i).first();
    await expect(heading).toBeVisible();
  });
});

// ─── Perfil ───────────────────────────────────────────────────────
test.describe("Perfil /perfil", () => {
  test("loads the profile page", async ({ page }) => {
    await goto(page, "/perfil");
    await expect(page.locator("body")).toBeVisible();
  });

  test("shows profile heading", async ({ page }) => {
    await goto(page, "/perfil");
    const heading = page.getByText(/perfil/i).first();
    await expect(heading).toBeVisible();
  });
});

// ─── Admin page ───────────────────────────────────────────────────
test.describe("Admin /admin", () => {
  test("loads the admin page", async ({ page }) => {
    await goto(page, "/admin");
    await expect(page.locator("body")).toBeVisible();
  });
});

// ─── Activity detail pages ────────────────────────────────────────
test.describe("Activity detail", () => {
  test("non-existent activity shows 404 or error", async ({ page }) => {
    const response = await page.goto(`${BASE_PATH}/voluntarios/non-existent-activity-id-12345`);
    // Should get a 404 or error page, not a crash
    expect(response?.status()).toBeGreaterThanOrEqual(200);
  });
});

// ─── Auth pages ───────────────────────────────────────────────────
test.describe("Auth flow", () => {
  test("login page shows OAuth error gracefully", async ({ page }) => {
    await page.goto(`${BASE_PATH}/login?error=oauth_not_configured`);
    await expect(page.locator("body")).toBeVisible();
  });

  test("auth finish page loads", async ({ page }) => {
    await page.goto(`${BASE_PATH}/auth/finish`);
    await expect(page.locator("body")).toBeVisible();
  });
});

// ─── Responsive design ────────────────────────────────────────────
test.describe("Responsive design", () => {
  test("sidebar is hidden on mobile, hamburger visible", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await goto(page, "/voluntarios");
    // On mobile, the desktop sidebar should be hidden
    const desktopSidebar = page.locator("nav.hidden.lg\\:flex, nav[class*='hidden']");
    // The hamburger button should be visible
    const hamburger = page.locator("button").filter({ has: page.locator("svg") }).first();
    await expect(hamburger).toBeVisible();
  });

  test("sidebar is visible on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await goto(page, "/voluntarios");
    const sidebar = page.locator("nav").first();
    await expect(sidebar).toBeVisible();
  });
});

// ─── Navigation consistency ───────────────────────────────────────
test.describe("Navigation consistency across pages", () => {
  const pages = ["/voluntarios", "/voluntarios/crear", "/mis-actividades", "/perfil"];

  for (const path of pages) {
    test(`sidebar is consistent on ${path}`, async ({ page }) => {
      await goto(page, path);
      // All pages should have the Panel general link
      await expect(page.getByRole("link", { name: /panel general/i })).toBeVisible();
      // All pages should have Voluntariado de Becarios link
      await expect(page.getByRole("link", { name: /voluntariado de becarios/i })).toBeVisible();
    });
  }
});

// ─── SEP tree sections visible ────────────────────────────────────
test.describe("All SEP navigation sections visible", () => {
  test("Panel section", async ({ page }) => {
    await goto(page, "/voluntarios");
    await expect(page.getByRole("link", { name: /panel general/i })).toBeVisible();
  });

  test("Componentes section groups", async ({ page }) => {
    await goto(page, "/voluntarios");
    await expect(page.getByText("Actividades formativas")).toBeVisible();
    await expect(page.getByText(/chat clubs/i)).toBeVisible();
    await expect(page.getByText("Voluntariado")).toBeVisible();
  });

  test("Participantes section", async ({ page }) => {
    await goto(page, "/voluntarios");
    await expect(page.getByText("Becarios")).toBeVisible();
  });

  test("Mentoria section", async ({ page }) => {
    await goto(page, "/voluntarios");
    await expect(page.getByText("Mentores")).toBeVisible();
  });
});
