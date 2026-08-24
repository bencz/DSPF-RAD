// Generate a standalone React/Vite app from a DSPF source member.
// The command writes a real npm project, not a JSON file map.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseDspf } from '../src/parser/parseDspf.js';
import { buildCompleteSemanticIR } from '../src/codegen/semanticAssembly.js';
import { buildMappingContract } from '../src/codegen/mappingContract.js';
import { generateReactApp } from '../src/codegen/reactApp.js';
import { hashOverrides, normalizeOverrideInput } from '../src/codegen/designOverrides.js';

const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let index = 0; index < args.length; index++) {
    if (args[index] === '--overrides') flags.overridesPath = args[++index];
    else positional.push(args[index]);
}
const [sourceArg, outputArg = 'generated/react-app'] = positional;
if (!sourceArg) throw new Error('Usage: npm run generate:react -- <DSPF path> [output directory] [--overrides <layout-overrides.json>]');
const sourcePath = resolve(sourceArg);
const outputPath = resolve(outputArg);
const source = await readFile(sourcePath, 'utf8');
let overrides = [];
let overridesHash = null;
if (flags.overridesPath) {
    overrides = normalizeOverrideInput(JSON.parse((await readFile(resolve(flags.overridesPath), 'utf8')).replace(/^\uFEFF/, '')));
    if (!overrides) throw new Error(`Invalid overrides payload in ${flags.overridesPath}`);
    overridesHash = hashOverrides(overrides);
}
const contract = buildMappingContract(buildCompleteSemanticIR(parseDspf(source)), { overrides });
const files = generateReactApp(contract);
for (const [relativePath, content] of Object.entries(files)) {
    const target = resolve(outputPath, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
}
console.log(JSON.stringify({ outputPath, files: Object.keys(files).length, mappings: contract.mappings.length, diagnostics: contract.diagnostics.length, overridesHash }));
