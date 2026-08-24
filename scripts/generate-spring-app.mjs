// Generate a Spring Boot project from a DSPF source member.
// The command writes a Maven project and keeps unresolved source evidence.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseDspf } from '../src/parser/parseDspf.js';
import { buildCompleteSemanticIR } from '../src/codegen/semanticAssembly.js';
import { buildMappingContract } from '../src/codegen/mappingContract.js';
import { generateSpringBootApp } from '../src/codegen/springBoot.js';
import { hashOverrides, normalizeOverrideInput } from '../src/codegen/designOverrides.js';

const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let index = 0; index < args.length; index++) {
    if (args[index] === '--overrides') {
        flags.overridesPath = args[++index];
        if (!flags.overridesPath) throw new Error('--overrides requires a file path');
    }
    else positional.push(args[index]);
}
const [sourceArg, outputArg = 'generated/spring-runtime'] = positional;
if (!sourceArg) throw new Error('Usage: npm run generate:spring -- <DSPF path> [output directory] [--overrides <layout-overrides.json>]');
const source = await readFile(resolve(sourceArg), 'utf8');
let overrides = [];
let overridesHash = null;
if (flags.overridesPath) {
    overrides = normalizeOverrideInput(JSON.parse((await readFile(resolve(flags.overridesPath), 'utf8')).replace(/^\uFEFF/, '')));
    if (!overrides) throw new Error(`Invalid overrides payload in ${flags.overridesPath}`);
    overridesHash = `fnv1a:${hashOverrides(overrides)}`;
}
const contract = buildMappingContract(buildCompleteSemanticIR(parseDspf(source)), { overrides });
if (contract.overridesHash) overridesHash = contract.overridesHash;
const files = generateSpringBootApp(contract);
const outputPath = resolve(outputArg);
for (const [relativePath, content] of Object.entries(files)) {
    const target = resolve(outputPath, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
}
console.log(JSON.stringify({ outputPath, files: Object.keys(files).length, mappings: contract.mappings.length, diagnostics: contract.diagnostics.length, overridesHash }));
