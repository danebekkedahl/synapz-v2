import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './qa',
  timeout: 90000,
  expect: {
    timeout: 8000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'off',
    video: 'off',
  },
  webServer: {
    command: 'npm.cmd run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
