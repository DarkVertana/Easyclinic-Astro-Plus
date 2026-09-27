import { defineConfig, devices } from '@playwright/test';

// Runs against the built .vercel/output through the routing emulator (scripts/serve-output.ts).
// Run `pnpm build` first. For a real preview deploy set E2E_BASE_URL.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4322';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // Axe scans of the long post pages are CPU-heavy; too many parallel browsers on a busy machine turn them
  // into 30-second timeouts rather than real failures. E2E_WORKERS overrides.
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : process.env.CI ? 2 : 4,
  timeout: 45_000,
  reporter: [['list']],
  use: { baseURL },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'node scripts/serve-output.ts --port 4322', url: 'http://localhost:4322/', reuseExistingServer: true, timeout: 30_000 },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } }, testIgnore: /nojs/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /nojs/ },
    { name: 'nojs', use: { ...devices['Desktop Chrome'], javaScriptEnabled: false }, testMatch: /nojs/ },
  ],
});
