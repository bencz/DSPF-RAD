import { defineConfig } from 'vite';

export default defineConfig({
    // Relative assets work in static deployments and inside a desktop webview.
    base: './',
    build: {
        target: 'es2022',
        outDir: 'dist',
        emptyOutDir: true,
        // 98.css intentionally uses `@media (not(hover))`. Lightning CSS,
        // Vite 8's default minifier, rejects that valid legacy-compatible
        // spelling; esbuild preserves the library without a vendor patch.
        cssMinify: 'esbuild',
        rolldownOptions: {
            output: {
                // Keep the relatively stable editor engine cacheable apart
                // from frequently changing IBM i feature code.
                codeSplitting: {
                    groups: [{
                        name: 'editor',
                        test: /node_modules[\\/](@codemirror|codemirror|@lezer)[\\/]/,
                        includeDependenciesRecursively: true,
                    }],
                },
            },
        },
    },
    server: {
        host: '127.0.0.1',
    },
});
