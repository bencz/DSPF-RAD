// Extract target-side layout/component overrides from an exported OpenPencil
// document into a deterministic layout-overrides.json consumed by the Mapping
// Contract (contract/03-generated-react-app.md §9, decision D-15).
//
// Binding convention: a node whose name is `<sourceIdentity>` or
// `dspf:<sourceIdentity>` binds to that source object. The canonical
// downstream identity itself starts with `dspf:` (see sourceIdentities.js),
// so both spellings normalize to the same string. Its x/width inside the
// nearest frame maps to a 12-grid col/span; any node with a positive width
// acts as a frame for its children (lenient until the real .fig adapter,
// ticket L4-2A, pins the export shape). Overrides set target-side values
// only — never sourceIdentity, source geometry, or DSPF semantics.
// Extraction is total: anything that cannot bind becomes a diagnostic entry,
// never a silent drop — including unprefixed children of bound nodes and
// duplicate bindings of the same identity (first wins, later ones warn).
//
// Input today is the normalized node shape `{ name, type, x, y, width,
// height, component, children }` produced by `bun open-pencil tree --json`
// (or export). Keep this module format-agnostic by depending only on the
// normalized shape; malformed input degrades to diagnostics, not crashes.
//
// Output is deterministic: entries sorted by sourceIdentity, no timestamps.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const TARGET_COLUMNS = 12;
const NAME_PREFIX = 'dspf:';
const IDENTITY_PATTERN = /^dspf:.+:.+(:.+)*:occurrence:\d+$/;

// Allowed generated-app components come from contract/03 §5; anything else is
// reported as a diagnostic so the mapping stays reviewable. Component names
// are matched space-insensitively so doc spellings like "Radio Group" bind to
// the canonical `RadioGroup`.
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
const document = JSON.parse((await readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, ''));

const overrides = [];
const diagnostics = [];
const seenIdentities = new Set();

walk(document, null);

overrides.sort((a, b) => (a.sourceIdentity < b.sourceIdentity ? -1 : a.sourceIdentity > b.sourceIdentity ? 1 : 0));
diagnostics.sort((a, b) => {
    if (a.sourceIdentity !== b.sourceIdentity) return a.sourceIdentity < b.sourceIdentity ? -1 : 1;
    return (a.code ?? '').localeCompare(b.code ?? '');
});

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

function kids (node) {
    return Array.isArray(node?.children) ? node.children : [];
}

function walk (node, frameWidth) {
    if (!node || typeof node !== 'object') return;
    const width = typeof node.width === 'number' && node.width > 0 ? node.width : frameWidth;
    for (const child of kids(node)) {
        // Geometry resolves against the PARENT frame width, never the child's own.
        if (isBindableName(child.name)) collect(child, width);
        else diagnoseUnbound(child);
        walk(child, width);
    }
}

function isBindableName (name) {
    return typeof name === 'string'
        && (name.startsWith(NAME_PREFIX) || IDENTITY_PATTERN.test(NAME_PREFIX + name));
}

function collect (node, frameWidth) {
    // Both spellings normalize to the downstream canonical form, which itself
    // starts with `dspf:` — never slice an unprefixed name.
    const sourceIdentity = node.name.startsWith(NAME_PREFIX)
        ? node.name
        : NAME_PREFIX + node.name;
    if (!IDENTITY_PATTERN.test(sourceIdentity)) {
        diagnostics.push(diagnostic('invalid-source-identity', sourceIdentity, node));
        return;
    }
    if (seenIdentities.has(sourceIdentity)) {
        diagnostics.push({ ...diagnostic('duplicate-source-identity', sourceIdentity, node), severity: 'warning' });
        return;
    }
    seenIdentities.add(sourceIdentity);

    const override = {
        sourceIdentity,
        target: {},
        origin: { nodeName: node.name },
        status: 'approved',
    };
    const hasGeometry = typeof frameWidth === 'number' && frameWidth > 0
        && typeof node.x === 'number' && typeof node.width === 'number' && node.width > 0;
    if (hasGeometry) {
        const rawCol = Math.floor((node.x / frameWidth) * TARGET_COLUMNS) + 1;
        override.target.targetCol = Math.min(Math.max(rawCol, 1), TARGET_COLUMNS);
        const plannedSpan = Math.round((node.width / frameWidth) * TARGET_COLUMNS);
        override.target.span = Math.min(Math.max(plannedSpan, 1), TARGET_COLUMNS - override.target.targetCol + 1);
    } else {
        diagnostics.push({ ...diagnostic('missing-frame-geometry', sourceIdentity, node), severity: 'warning' });
    }
    if (typeof node.component === 'string' && node.component.length > 0) {
        const normalized = node.component.replace(/\s+/g, '');
        if (ALLOWED_COMPONENTS.has(normalized)) {
            override.target.component = normalized;
        } else {
            diagnostics.push({
                ...diagnostic('component-not-in-inventory', sourceIdentity, node),
                detail: node.component,
                severity: 'warning',
            });
        }
    }
    if (Object.keys(override.target).length === 0) {
        diagnostics.push({ ...diagnostic('empty-override', sourceIdentity, node), severity: 'warning' });
        return;
    }
    overrides.push(override);
}

function diagnoseUnbound (node) {
    if (!node || typeof node !== 'object' || typeof node.name !== 'string') return;
    if (isBindableName(node.name)) return;
    diagnostics.push({ ...diagnostic('no-dspf-prefix', node.name, node), severity: 'info' });
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
    return 1 + kids(node).reduce((sum, child) => sum + countNodes(child), 0);
}
