import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The React app reuses the existing DSPF logic modules verbatim from
// ../src (single source of truth — nothing is copied into this tree).
// `@dspf/*` aliases the old src/ root; the legacy modules import each
// other with relative paths, so they keep working unchanged.
//
// Bare CodeMirror imports are resolved by Rollup from the IMPORTING
// FILE's location — files under ../src sit outside this project root, so
// their bare imports would miss react-app/node_modules.  Every CodeMirror
// package is therefore pinned explicitly to this project's node_modules.
const pkgDir = (name) => fileURLToPath(new URL(`./node_modules/${name}`, import.meta.url));

const CM_PACKAGES = [
    'codemirror',
    '@codemirror/autocomplete',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
];

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: [
            { find: '@dspf', replacement: fileURLToPath(new URL('../src', import.meta.url)) },
            ...CM_PACKAGES.map((name) => ({ find: name, replacement: pkgDir(name) })),
        ],
    },
    server: {
        // Dev server is sandboxed to the project root; allow it to serve
        // the sibling ../src tree the alias points at.
        fs: { allow: ['..'] },
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.js'],
        exclude: ['e2e/**', 'node_modules/**'],
    },
});
