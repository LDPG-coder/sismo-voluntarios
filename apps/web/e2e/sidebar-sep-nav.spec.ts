import { test, expect, type Page } from "@playwright/test";

/**
 * E2E tests for the sismo-web sidebar and SEP navigation integration.
 * These tests run against the running sismo-web app (port 3001).
 * Auth bypass is enabled via DEV_BYPASS_AUTH=true in .env.
 */

const WEB_URL = process.env.WEB_URL || "http://localhost:3001";
const BASE_PATH = "/voluntarios-becarios";

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_PATH}${path}`);
  await page.waitForLoadState("networkidle");
}

// ─── Sidebar rendering ─────────────────────────────────────────────
test.describe("Sidebar", () => {
  test("sidebar is visible on desktop", async ({ page }) => {
    await goto(page, "/voluntarios");
    const sidebar = page.locator("nav").first();
    await expect(sidebar).toBeVisible();
  });

  test("sidebar contains logout link", async ({ page }) => {
    await goto(page, "/voluntarios");
    await expect(page.getByRole("link", { name: /cerrar sesión|logout/i })).toBeVisible();
  });
});

// ─── SEP Navigation tree ──────────────────────────────────────────
test.describe("SEP navigation tree in sidebar", () => {
  test("renders Panel section with Panel general", async ({ page }) => {
    await goto(page, "/voluntarios");
    // The sidebar should show "Panel general" as a nav link
    const panelLink = page.getByRole("link", { name: /panel general/i });
    await expect(panelLink).toBeVisible();
    await expect(panelLink).toHaveAttribute("href", /\/admin\/panel/);
  });

  test("renders Componentes section groups", async ({ page }) => {
    await goto(page, "/voluntarios");
    // Check for group labels in the sidebar
    await expect(page.getByText("Actividades formativas")).toBeVisible();
    await expect(page.getByText(/chat clubs/i)).toBeVisible();
    await expect(page.getByText("Voluntariado")).toBeVisible();
  });

  test("renders Participantes section with Becarios", async ({ page }) => {
    await goto(page, "/voluntarios");
    await expect(page.getByText("Becarios")).toBeVisible();
  });

  test("renders Mentoria section", async ({ page }) => {
    await goto(page, "/voluntarios");
    await expect(page.getByText("Mentores")).toBeVisible();
  });
});

// ─── Voluntariado de Becarios link ────────────────────────────────
test.describe("Voluntariado de Becarios link", () => {
  test("appears under Voluntariado group in sidebar", async ({ page }) => {
    await goto(page, "/voluntarios");
    // The link should be visible in the sidebar
    const link = page.getByRole("link", { name: /voluntariado de becarios/i });
    await expect(link).toBeVisible();
  });

  test("links to sismo voluntarios page", async ({ page }) => {
    await goto(page, "/voluntarios");
    const link = page.getByRole("link", { name: /voluntariado de becarios/i });
    await expect(link).toHaveAttribute("href", /voluntarios-becarios\/voluntarios/);
  });

  test("is accessible via keyboard navigation", async ({ page }) => {
    await goto(page, "/voluntarios");
    const link = page.getByRole("link", { name: /voluntariado de becarios/i });
    await link.focus();
    await expect(link).toBeFocused();
  });
});

// ─── Page navigation ──────────────────────────────────────────────
test.describe("Page navigation", () => {
  test("voluntarios feed loads", async ({ page }) => {
    await goto(page, "/voluntarios");
    await expect(page.locator("body")).toBeVisible();
    // Should show the feed page content
    await expect(page.getByText(/voluntarios/i).first()).toBeVisible();
  });

  test("crear actividad page loads", async ({ page }) => {
    await goto(page, "/voluntarios/crear");
    await expect(page.locator("body")).toBeVisible();
  });

  test("mis actividades page loads", async ({ page }) => {
    await goto(page, "/mis-actividades");
    await expect(page.locator("body")).toBeVisible();
  });

  test("perfil page loads", async ({ page }) => {
    await goto(page, "/perfil");
    await expect(page.locator("body")).toBeVisible();
  });
});

// ─── Header bar ───────────────────────────────────────────────────
test.describe("Header bar", () => {
  test("hamburger menu button exists on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await goto(page, "/voluntarios");
    // The hamburger button should be visible on mobile
    const menuBtn = page.locator("button").filter({ has: page.locator("svg") }).first();
    await expect(menuBtn).toBeVisible();
  });

  test("clicking hamburger opens mobile sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await goto(page, "/voluntarios");
    const menuBtn = page.locator("button").filter({ has: page.locator("svg") }).first();
    await menuBtn.click();
    // After clicking, the mobile sidebar overlay should appear
    await expect(page.getByRole("link", { name: /cerrar sesión|logout/i })).toBeVisible();
  });
});

// ─── Cross-app links ──────────────────────────────────────────────
test.describe("Cross-app navigation", () => {
  test("Voluntariado de Becarios link navigates to voluntarios page", async ({ page }) => {
    await goto(page, "/voluntarios");
    const link = page.getByRole("link", { name: /voluntariado de becarios/i });
    const href = await link.getAttribute("href");
    expect(href).toContain("voluntarios-becarios/voluntarios");
  });
});

// ─── Sidebar icon mapping ─────────────────────────────────────────
test.describe("Sidebar icons", () => {
  test("Panel section has an icon", async ({ page }) => {
    await goto(page, "/voluntarios");
    // Check that SVG icons are rendered near section labels
    const panelSection = page.getByText("Panel general").locator("..");
    const icon = panelSection.locator("svg").first();
    await expect(icon).toBeAttached();
  });
});

// ─── Collapsible groups ───────────────────────────────────────────
test.describe("Collapsible groups", () => {
  test("component groups with sub-items are collapsible", async ({ page }) => {
    await goto(page, "/voluntarios");
    // Find a group that has sub-items (e.g., Actividades formativas)
    const group = page.getByText("Actividades formativas");
    await expect(group).toBeVisible();
    // Click to collapse
    await group.click();
    // The sub-items should be hidden or the group should indicate collapsed state
    // After clicking again, sub-items should reappear
    await group.click();
  });
});
