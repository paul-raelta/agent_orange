import { defineConfig, devices } from '@playwright/test'

// All services share a throwaway test DB so real workers/var/ao.db is untouched.
// Pydantic settings reads DATABASE_URL from env first, then .env — env wins.
const TEST_DB_URL = 'sqlite+aiosqlite:///./var/ao.test.db'

const baseEnv = {
  ...process.env,
  DATABASE_URL: TEST_DB_URL,
}

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'cd workers && .venv/bin/uvicorn ao.main:app --host 127.0.0.1 --port 8000',
      url: 'http://127.0.0.1:8000/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: baseEnv,
    },
    {
      command: 'cd workers && .venv/bin/python -m ao.daemon',
      url: 'http://127.0.0.1:8000/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: baseEnv,
    },
    {
      command: 'cd web && npm run dev -- --port 5173 --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: baseEnv,
    },
  ],
})
