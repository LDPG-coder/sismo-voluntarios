import { defineConfig } from "@playwright/test";

// Las pruebas E2E apuntan al stack de dev (web en :3002, api en :8055) que
// comparte el unico postgres vivo. Se autentican mintiendo la cookie de
// sesion firmada (ver e2e/helpers/auth.ts), asi no hace falta OAuth/SEP.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.WEB_URL || "http://sismo-dev-web-1:3002",
    headless: true,
    actionTimeout: 10_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
