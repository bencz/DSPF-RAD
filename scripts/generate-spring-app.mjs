// Generate a Spring Boot project from a DSPF source member.
// The command writes a Maven project and keeps unresolved source evidence.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseDspf } from '../src/parser/parseDspf.js';
import { buildCompleteSemanticIR } from '../src/codegen/semanticAssembly.js';
import { buildMappingContract } from '../src/codegen/mappingContract.js';
import { generateSpringBootApp } from '../src/codegen/springBoot.js';

const [sourceArg, outputArg = 'generated/spring-runtime'] = process.argv.slice(2);
if (!sourceArg) throw new Error('Usage: npm run generate:spring -- <DSPF path> [output directory]');
const source = await readFile(resolve(sourceArg), 'utf8');
const contract = buildMappingContract(buildCompleteSemanticIR(parseDspf(source)));
const files = generateSpringBootApp(contract);
const outputPath = resolve(outputArg);
for (const [relativePath, content] of Object.entries(files)) {
    const target = resolve(outputPath, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
}
console.log(JSON.stringify({ outputPath, files: Object.keys(files).length, mappings: contract.mappings.length, diagnostics: contract.diagnostics.length }));
