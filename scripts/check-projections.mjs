// Projection consistency gate for the Markdown SSOT (D-10/D-12).
// Verifies that machine-readable projections stay parseable and that
// contract/schemas/README.md lists exactly the schemas that exist.
// Zero dependencies; exits non-zero on any drift so CI can gate on it.

import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemasDir = resolve(root, 'contract', 'schemas');
const problems = [];

// 1. Every JSON projection must parse.
for (const name of (await readdir(schemasDir)).filter(name => name.endsWith('.json')).sort()) {
    try {
        JSON.parse(await readFile(resolve(schemasDir, name), 'utf8'));
    } catch (error) {
        problems.push(`${name}: invalid JSON (${error.message})`);
    }
}

// 2. openapi.yaml must be present and carry the seed-demo contract markers.
const openapi = await readFile(resolve(root, 'contract', 'openapi.yaml'), 'utf8');
if (!/^openapi:\s*3\.\d/m.test(openapi)) problems.push('openapi.yaml: missing openapi 3.x declaration');
if (!/components:/.test(openapi)) problems.push('openapi.yaml: missing components section');
if (!/seed-demo/.test(openapi)) problems.push('openapi.yaml: missing seed-demo mode marker (04-seed-backend.md §2)');

// 3. schemas/README.md must list exactly the schemas that exist on disk.
const readme = await readFile(resolve(schemasDir, 'README.md'), 'utf8');
const listed = new Set([...readme.matchAll(/([a-z0-9-]+\.(?:schema\.)?json)/g)].map(match => match[1]));
const onDisk = new Set((await readdir(schemasDir)).filter(name => name.endsWith('.json')));
for (const name of onDisk) {
    if (!listed.has(name)) problems.push(`schemas/README.md does not list ${name}`);
}
for (const name of listed) {
    if (!onDisk.has(name)) problems.push(`schemas/README.md lists missing file ${name}`);
}

// 4. Contract docs referenced from the index must exist.
const contractReadme = await readFile(resolve(root, 'contract', 'README.md'), 'utf8');
for (const match of contractReadme.matchAll(/\]\((\d{2}-[a-z-]+\.md)\)/g)) {
    const path = resolve(root, 'contract', match[1]);
    try {
        await readFile(path, 'utf8');
    } catch {
        problems.push(`contract/README.md links missing document ${match[1]}`);
    }
}

if (problems.length > 0) {
    for (const problem of problems) console.error(`[check:projections] ${problem}`);
    console.error(`[check:projections] FAILED with ${problems.length} problem(s)`);
    process.exit(1);
}
console.log(JSON.stringify({ ok: true, schemas: onDisk.size, checked: ['json-parse', 'openapi-markers', 'readme-sync', 'index-links'] }));
