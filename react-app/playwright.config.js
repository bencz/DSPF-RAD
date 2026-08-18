import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    use: {
        baseURL: 'http://localhost:4173',
        headless: true,
    },
    webServer: {
        command: 'node node_modules/vite/bin/vite.js preview --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: true,
        timeout: 30000,
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
    ],
});
