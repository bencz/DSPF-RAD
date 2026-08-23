import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateCobol } from '../src/codegen/cobol.js';
import { generateRpgle } from '../src/codegen/rpgle.js';
import { parseDspf } from '../src/parser/parseDspf.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sampleDir = path.join(root, 'SAMPLES');
const samples = [
    {
        source: 'CODEGEN_FULL.DSPF',
        programName: 'CGDEMO',
        dspfName: 'CGDEMO',
    },
    {
        source: 'CODEGEN_MULTI.DSPF',
        programName: 'CGMULTI',
        dspfName: 'CGMULTI',
    },
];

for (const sample of samples) {
    const doc = parseDspf(fs.readFileSync(
        path.join(sampleDir, sample.source), 'utf8'));
    const options = {
        programName: sample.programName,
        dspfName: sample.dspfName,
    };
    fs.writeFileSync(path.join(sampleDir, `${sample.programName}.RPGLE`),
        generateRpgle(doc, options));
    fs.writeFileSync(path.join(sampleDir, `${sample.programName}.CBLLE`),
        generateCobol(doc, options));
}
