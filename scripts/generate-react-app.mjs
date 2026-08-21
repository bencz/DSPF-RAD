// Generate a standalone React/Vite app from a DSPF source member.
// The command writes a real npm project, not a JSON file map.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseDspf } from '../src/parser/parseDspf.js';
import { buildCompleteSemanticIR } from '../src/codegen/semanticAssembly.js';
import { buildMappingContract } from '../src/codegen/mappingContract.js';
import { generateReactApp } from '../src/codegen/reactApp.js';

const [sourceArg, outputArg = 'generated/react-app'] = process.argv.slice(2);
if (!sourceArg) throw new Error('Usage: npm run generate:react -- <DSPF path> [output directory]');
const sourcePath = resolve(sourceArg);
const outputPath = resolve(outputArg);
const source = await readFile(sourcePath, 'utf8');
const contract = buildMappingContract(buildCompleteSemanticIR(parseDspf(source)));
const files = generateReactApp(contract);
for (const [relativePath, content] of Object.entries(files)) {
    const target = resolve(outputPath, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
}
console.log(JSON.stringify({ outputPath, files: Object.keys(files).length, mappings: contract.mappings.length, diagnostics: contract.diagnostics.length }));
