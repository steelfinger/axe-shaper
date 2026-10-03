import { defineConfig, devices } from '@playwright/test'

// Smoke flows against the production build (`vite preview` serves dist/), not
// the dev server: that is the artifact people get, and it is what `verify`
// has already built by the time this runs. `npm run e2e` builds first; the
// CI step runs `playwright test` directly after its own Build step.
//
// Deliberately Chromium only and a handful of flows - the things that fail
// silently (blank canvas, a Back that leaves /app, a deep link that flashes
// the chooser). Anything that can be a unit test is one: see src/**/__tests__.
const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    // Wide enough that the header is in its full-toolbar tier (> 1440px), so
    // flows can reach buttons directly instead of through the overflow menu.
    viewport: { width: 1600, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } } }],
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/app`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
