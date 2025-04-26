import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url'; // Import necessary functions

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e', // Point to your end-to-end tests directory

  // Path to the global setup file.
  // Use the derived __dirname for correct path resolution in ESM
  globalSetup: path.resolve(__dirname, './tests/global-setup.ts'),

  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 3 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5174', // Point to the local Inspector UI

    /* Run tests in headed mode */
    headless: process.env.CI ? true : false,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Configure multiple web servers */
  webServer: [
    {
      name: 'GitMCP-DevServer',
      command: 'pnpm run dev',
      url: 'http://localhost:5173',
      stderr: 'pipe',
      timeout: 120 * 1000,
    },
    {
      name: 'MCP Inspector',
      command: 'CLIENT_PORT=5174 SERVER_PORT=6277 npx @modelcontextprotocol/inspector',
      url: 'http://localhost:5174', // Inspector UI URL (matches baseURL)
      stdout: 'ignore',
      stderr: 'pipe',
      timeout: 120 * 1000, // Give inspector time to start
    }
  ],
}); 