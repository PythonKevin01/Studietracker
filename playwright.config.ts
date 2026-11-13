import { defineConfig, devices } from '@playwright/test';

const POORT = 4180;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${POORT}/`, ...devices['Pixel 7'] },
  webServer: {
    // Vers testsleutelpaar, testbuild met die publieke sleutel, en serveren.
    command: `tsx scripts/e2e-sleutel.ts && vite build --outDir dist-e2e --emptyOutDir && vite preview --outDir dist-e2e --port ${POORT} --strictPort`,
    env: { STUDIETRACKER_SLEUTELS: 'test-uitvoer/e2e-publiek.json' },
    url: `http://localhost:${POORT}/student/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
