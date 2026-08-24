// Extract target-side layout/component overrides from an exported OpenPencil
// document into a deterministic layout-overrides.json consumed by the Mapping
// Contract (contract/03-generated-react-app.md §9, decision D-15).
//
// Binding convention: a node whose name starts with `dspf:` carries the
// sourceIdentity after the prefix. Its x/width inside the nearest FRAME maps
// to a 12-grid col/span. Overrides set target-side values only — never
// sourceIdentity, source geometry, or DSPF semantics. Extraction is total:
// anything that cannot bind becomes a diagnostic entry, never a silent drop.
//
// Input today is the normalized node shape `{ name, type, x, y, width,
// height, component, children }` produced by `bun open-pencil tree --json`
// (or export). A thin adapter for raw .fig archives is a follow-up task; keep
// this module format-agnostic by depending only on the normalized shape.
//
// Output is deterministic: entries sorted by sourceIdentity, no timestamps.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const TARGET_COLUMNS = 12;
const NAME_PREFIX = 'dspf:';
const IDENTITY_MIN_SEGMENTS = 6;

// Allowed generated-app components come from contract/03 §5; anything else is
// reported as a diagnostic so the mapping stays reviewable.
const ALLOWED_COMPONENTS = new Set([
    'AppBar', 'Drawer', 'Container', 'Box', 'CssBaseline',
    'Grid', 'Stack', 'Paper', 'Divider',
    'Typography', 'Table', 'Pagination', 'Chip', 'Badge', 'Accordion', 'Tooltip', 'Link',
    'TextField', 'Select', 'Autocomplete', 'Checkbox', 'RadioGroup',
    'Button', 'IconButton', 'ButtonGroup', 'Menu', 'Dialog',
    'Alert', 'Snackbar', 'CircularProgress', 'Skeleton', 'Breadcrumbs', 'Tabs', 'List', 'Card',
]);

const [inputArg, outputArg = 'design-overrides/layout-overrides.json'] = process.argv.slice(2);
if (!inputArg) throw new Error('Usage: pnpm extract:overrides -- <openpencil-export.json> [output]');

const sourcePath = resolve(inputArg);
const outputPath = resolve(outputArg);
const document = JSON.parse(await readFile(sourcePath, 'utf8'));

const overrides = [];
const diagnostics = [];

walk(document, null);

overrides.sort((a, b) => (a.sourceIdentity < b.sourceIdentity ? -1 : 1));
diagnostics.sort((a, b) => (a.sourceIdentity < b.sourceIdentity ? -1 : 1));

const result = {
    schemaVersion: 'design-overrides/1',
    source: { file: inputArg.split(/[\\/]/).pop(), nodeCount: countNodes(document) },
    overrides,
    diagnostics,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 4)}\n`, 'utf8');
console.log(JSON.stringify({
    outputPath,
    overrides: overrides.length,
    diagnostics: diagnostics.length,
}));

function walk (node, frameWidth) {
    if (!node || typeof node !== 'object') return;
    const width = typeof node.width === 'number' && node.width > 0 ? node.width : frameWidth;
    if (typeof node.name === 'string' && node.name.startsWith(NAME_PREFIX)) {
        // Geometry resolves against the PARENT frame width, never the node's own.
        collect(node, frameWidth);
    } else {
        for (const child of node.children ?? []) {
            diagnoseUnbound(child);
        }
    }
    for (const child of node.children ?? []) {
        walk(child, width);
    }
}

function collect (node, frameWidth) {
    const sourceIdentity = node.name.slice(NAME_PREFIX.length);
    if (sourceIdentity.split(':').length < IDENTITY_MIN_SEGMENTS) {
        diagnostics.push(diagnostic('invalid-source-identity', sourceIdentity, node));
        return;
    }
    const override = {
        sourceIdentity,
        target: {},
        origin: { nodeName: node.name },
        status: 'approved',
    };
    if (typeof frameWidth === 'number' && frameWidth > 0 && typeof node.x === 'number') {
        const rawCol = Math.floor((node.x / frameWidth) * TARGET_COLUMNS) + 1;
        override.target.targetCol = Math.min(Math.max(rawCol, 1), TARGET_COLUMNS);
        const plannedSpan = Math.round(((node.width ?? 0) / frameWidth) * TARGET_COLUMNS);
        override.target.span = Math.min(Math.max(plannedSpan, 1), TARGET_COLUMNS - override.target.targetCol + 1);
    } else {
        diagnostics.push({ ...diagnostic('missing-frame-geometry', sourceIdentity, node), severity: 'warning' });
    }
    if (typeof node.component === 'string' && node.component.length > 0) {
        if (ALLOWED_COMPONENTS.has(node.component)) {
            override.target.component = node.component;
        } else {
            diagnostics.push({
                ...diagnostic('component-not-in-inventory', sourceIdentity, node),
                detail: node.component,
                severity: 'warning',
            });
        }
    }
    overrides.push(override);
}

function diagnoseUnbound (node) {
    if (!node || typeof node !== 'object' || !node.name) return;
    if (typeof node.name === 'string' && node.name.startsWith(NAME_PREFIX)) return;
    diagnostics.push({ ...diagnostic('no-dspf-prefix', String(node.name), node), severity: 'info' });
}

function diagnostic (code, sourceIdentity, node) {
    return {
        code,
        severity: 'error',
        sourceIdentity,
        origin: typeof node.name === 'string' ? { nodeName: node.name } : undefined,
    };
}

function countNodes (node) {
    if (!node || typeof node !== 'object') return 0;
    return 1 + (node.children ?? []).reduce((sum, child) => sum + countNodes(child), 0);
}
