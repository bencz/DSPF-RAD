// Containment sweep runner for Gate C5 (design doc v4a §4, ticket L4-0D).
// Sweeps every corpus fixture through the full pipeline twice, audits the
// results with containmentSweep.auditFixture (E1–E3), checks determinism
// (E4) and catches pipeline throws (E5). Any escape exits non-zero so CI
// goes red. Output matrix is deterministic: sorted inputs, no timestamps.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDspf } from '../src/parser/parseDspf.js';
import { buildCompleteSemanticIR } from '../src/codegen/semanticAssembly.js';
import { buildMappingContract } from '../src/codegen/mappingContract.js';
import { auditFixture } from '../src/codegen/containmentSweep.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORPORA = ['TESTS', 'QDDSSRC'];
const outArgIndex = process.argv.indexOf('--out');
const outputPath = resolve(outArgIndex > -1 ? process.argv[outArgIndex + 1] : '.tmp/coverage-matrix.json');

function fnv1a (text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function runPipeline (text) {
    const doc = parseDspf(text);
    const ir = buildCompleteSemanticIR(doc);
    const contract = buildMappingContract(ir);
    return JSON.stringify({ ir, contract });
}

const fixtures = [];
for (const dir of CORPORA) {
    const names = (await readdir(resolve(root, dir))).filter(name => name.toUpperCase().endsWith('.DSPF')).sort();
    for (const name of names) fixtures.push(`${dir}/${name}`);
}

const escapes = [];
const histogram = {};
const references = {};
let passed = 0;

for (const fixture of fixtures) {
    let run1;
    try {
        // latin1 keeps the legacy single-byte sources byte-stable across runs.
        const text = (await readFile(resolve(root, fixture))).toString('latin1');
        run1 = runPipeline(text);
        const run2 = runPipeline(text);
        if (fnv1a(run1) !== fnv1a(run2)) {
            escapes.push({ rule: 'E4', severity: 'error', identity: fixture, reason: 'pipeline is not deterministic' });
        }
        const { ir, contract } = JSON.parse(run1);
        const audit = auditFixture({ name: fixture, ir, contract });
        escapes.push(...audit.escapes.map(escape => ({ ...escape, fixture })));
        for (const [key, count] of Object.entries(audit.histogram)) histogram[key] = (histogram[key] ?? 0) + count;
        for (const [key, count] of Object.entries(audit.references)) references[key] = (references[key] ?? 0) + count;
        if (audit.escapes.length === 0) passed += 1;
    } catch (error) {
        escapes.push({ rule: 'E5', severity: 'error', identity: fixture, reason: `pipeline threw: ${error.message}` });
    }
}

const failed = fixtures.length - passed;
const matrix = {
    schemaVersion: 'containment-sweep/1',
    corpora: CORPORA,
    fixtures: { total: fixtures.length, passed, failed },
    histogram,
    references,
    escapes,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
    outputPath,
    fixtures: matrix.fixtures,
    escapes: escapes.length,
    histogramKeys: Object.keys(histogram).length,
}));

if (escapes.length > 0 || failed > 0) process.exit(1);
