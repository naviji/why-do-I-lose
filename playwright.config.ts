import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'test/e2e',
  use: {
    baseURL: 'http://localhost:5174',
    // the browser preinstalled in Claude's cloud sessions; locally Playwright's own is used
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
  },
  webServer: { command: 'npx vite --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: true },
})
