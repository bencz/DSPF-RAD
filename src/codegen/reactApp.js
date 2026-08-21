// Deterministic standalone React/Vite output from the Mapping Contract.
// Generated files consume serialized contract data and never import the designer.

function json (value) { return JSON.stringify(value, null, 2) + '\n'; }

export function generateReactApp (contract = {}) {
    const report = {
        version: contract.version || '2.1.0',
        displayProfile: contract.displayProfile || null,
        mappingCount: (contract.mappings ?? []).length,
        diagnostics: contract.diagnostics ?? [],
        status: (contract.diagnostics ?? []).length ? 'manual-review' : 'generated',
    };
    const routeManifest = { routes: [{ path: '/', screen: 'converted' }] };
    const bindingMap = Object.fromEntries((contract.mappings ?? []).map(mapping => [
        mapping.sourceIdentity,
        { runtimeBindingKey: mapping.runtimeBindingKey, domId: mapping.domId, status: mapping.status },
    ]));
    return {
        'package.json': json({ private: true, type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' }, dependencies: { '@vitejs/plugin-react': '^5.0.0', '@emotion/cache': '^11.14.0', '@emotion/react': '^11.14.0', '@emotion/styled': '^11.14.0', '@mui/material': '^6.4.0', 'prop-types': '^15.8.1', react: '^19.0.0', 'react-dom': '^19.0.0' }, devDependencies: { vite: '^7.0.0' } }),
        'vite.config.js': "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });\n",
        'index.html': '<div id="root"></div><script type="module" src="/src/main.jsx"></script>\n',
        'src/main.jsx': "import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);\n",
        'src/App.jsx': "import { Typography } from '@mui/material';\nimport { routeManifest } from './routeManifest.js';\nimport { bindings } from './bindings.js';\nexport default function App () { return <main><Typography variant=\"h4\">Mapping Contract</Typography><Typography>{routeManifest.routes[0].screen}</Typography><pre>{JSON.stringify(bindings, null, 2)}</pre></main>; }\n",
        'src/theme.js': "import { createTheme } from '@mui/material/styles';\nexport const theme = createTheme({ typography: { fontSize: 16 }, palette: { primary: { main: '#0F3460' } } });\n",
        'src/routeManifest.js': `export const routeManifest = ${json(routeManifest)}`,
        'src/bindings.js': `export const bindings = ${json(bindingMap)}`,
        'conversion-report.json': json(report),
        'traceability.json': json((contract.mappings ?? []).map(mapping => mapping.traceability)),
    };
}
