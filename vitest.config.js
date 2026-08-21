// Vitest configuration for deterministic conversion-core completeness tests.
// Tests use the Node environment because conversion modules are pure ESM.

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.js'],
        pool: 'forks',
        passWithNoTests: false,
    },
});
