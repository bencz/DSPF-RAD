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
    const routeManifest = { version: '3.4', routes: [{ id: 'converted', path: '/', screen: 'converted', permission: null, loader: 'loadScreen', error: 'renderError', notFound: 'renderNotFound', dirtyGuard: true }] };
    const bindingMap = Object.fromEntries((contract.mappings ?? []).map(mapping => [
        mapping.sourceIdentity,
        { runtimeBindingKey: mapping.runtimeBindingKey, domId: mapping.domId, status: mapping.status, role: mapping.output?.role ?? 'unknown', readOnly: mapping.output?.editable !== true, visible: mapping.output?.visible !== false, valueType: mapping.source?.dataType ?? 'string', usage: mapping.output?.role ?? 'unknown' },
    ]));
    return {
        'package.json': json({ private: true, type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' }, dependencies: { '@vitejs/plugin-react': '^5.0.0', '@emotion/cache': '^11.14.0', '@emotion/react': '^11.14.0', '@emotion/styled': '^11.14.0', '@mui/material': '^6.4.0', 'prop-types': '^15.8.1', react: '^19.0.0', 'react-dom': '^19.0.0' }, devDependencies: { vite: '^7.0.0' } }),
        'vite.config.js': "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });\n",
        'index.html': '<div id="root"></div><script type="module" src="/src/main.jsx"></script>\n',
        'src/main.jsx': "import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);\n",
        'src/App.jsx': `import { Typography, Paper, Stack } from '@mui/material';
import { routeManifest } from './routeManifest.js';
import { bindings } from './bindings.js';
const mappings = ${json(contract.mappings ?? [])};
const diagnostics = ${json(contract.diagnostics ?? [])};
export default function App () {
    return <main><Typography variant="h4">Mapping Contract · {routeManifest.routes[0].screen}</Typography><Stack spacing={1}>{mappings.map((mapping) => mapping.output?.visible === false ? <span key={mapping.sourceIdentity} data-source-id={mapping.sourceIdentity} data-role="hidden-control" hidden>{mapping.sourceIdentity}</span> : <Paper key={mapping.sourceIdentity} data-testid="generated-item" data-source-id={mapping.sourceIdentity}><Typography>{mapping.targetComponent}</Typography><Typography>{mapping.source?.record} · {mapping.sourceIdentity}</Typography></Paper>)}</Stack>{diagnostics.length > 0 && <section data-testid="generated-review"><Typography>Manual review</Typography>{diagnostics.map((diagnostic) => <Typography key={diagnostic.code + diagnostic.sourceIdentity}>{diagnostic.message}</Typography>)}</section>}<pre>{JSON.stringify(bindings, null, 2)}</pre></main>;
}
`,
        'src/theme.js': "import { createTheme } from '@mui/material/styles';\nexport const theme = createTheme({ typography: { fontSize: 16 }, palette: { primary: { main: '#0F3460' } } });\n",
        'src/routeManifest.js': `export const routeManifest = ${json(routeManifest)}`,
        'src/bindings.js': `export const bindings = ${json(bindingMap)}`,
        'conversion-report.json': json(report),
        'traceability.json': json((contract.mappings ?? []).map(mapping => mapping.traceability)),
    };
}
