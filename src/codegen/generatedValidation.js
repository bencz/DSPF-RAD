// Generated React artifact contract checks.
// Validation runs before Browser audit and reports missing evidence explicitly.

const REQUIRED_FILES = ['package.json', 'vite.config.js', 'index.html', 'src/main.jsx', 'src/App.jsx', 'src/routeManifest.js', 'src/bindings.js', 'conversion-report.json', 'traceability.json'];

export function validateGeneratedReactArtifact (files = {}) {
    const errors = REQUIRED_FILES.filter(path => !files[path]).map(path => `missing ${path}`);
    const route = files['src/routeManifest.js'] || '';
    for (const field of ['version', 'id', 'permission', 'loader', 'error', 'notFound']) {
        if (!route.includes(field)) errors.push(`missing route ${field}`);
    }
    const bindings = files['src/bindings.js'] || '';
    for (const field of ['runtimeBindingKey', 'domId', 'status', 'role', 'readOnly', 'visible']) {
        if (!bindings.includes(field)) errors.push(`missing binding ${field}`);
    }
    const app = files['src/App.jsx'] || '';
    for (const marker of ['generated-item', 'hidden-control', 'generated-review']) {
        if (!app.includes(marker)) errors.push(`missing App marker ${marker}`);
    }
    return { valid: errors.length === 0, errors };
}
