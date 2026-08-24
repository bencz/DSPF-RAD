import test from 'node:test';
import assert from 'node:assert/strict';

import { createLanguageServices } from '../src/languages/createLanguageServices.js';
import { createDefaultIbmiLanguageRegistry } from '../src/languages/createDefaultIbmiLanguageRegistry.js';

function labels (services, source) {
    return services.completions.complete({
        languageId: 'cl',
        source,
        offset: source.length,
        explicit: true,
    }).items.map(item => item.label);
}

test('IBM i language registry resolves source types and local file extensions', () => {
    const languages = createDefaultIbmiLanguageRegistry();

    assert.equal(languages.resolve({ sourceType: 'CLLE' }).id, 'cl');
    assert.equal(languages.resolve({ sourceType: 'MNUDDS' }).id, 'dds-menu');
    assert.equal(languages.resolve({ fileName: 'orders.sqlrpgle' }).id, 'sqlrpgle');
    assert.equal(languages.resolve({ fileName: 'screen.dspf' }).compileCommands[0], 'CRTDSPF');
    assert.equal(languages.resolve({ fileName: 'unknown.data' }).id, 'plaintext');
});

test('CL completion distinguishes commands, parameters, and predefined values', () => {
    const services = createLanguageServices();

    assert.ok(labels(services, 'CRTD').includes('CRTDSPF'));
    const parameters = labels(services, 'CRTDSPF F');
    assert.ok(parameters.includes('FILE'));
    assert.ok(!parameters.includes('DBGVIEW'));

    const values = labels(
        services,
        'CRTBNDRPG PGM(MYLIB/APP) DBGVIEW(*S');
    assert.ok(values.includes('*SOURCE'));
    assert.ok(values.includes('*STMT'));
    assert.ok(!values.includes('*YES'));
});

test('CL completion excludes parameters already present in the active command', () => {
    const services = createLanguageServices();
    const parameters = labels(
        services,
        'CRTDSPF FILE(MYLIB/SCREEN) SRCFILE(MYLIB/QDDSSRC) ');

    assert.ok(!parameters.includes('FILE'));
    assert.ok(!parameters.includes('SRCFILE'));
    assert.ok(parameters.includes('SRCMBR'));
    assert.ok(parameters.includes('REPLACE'));
});

test('CL completion discovers declared variables in the complete document', () => {
    const services = createLanguageServices();
    const source = [
        'PGM',
        'DCL VAR(&LIBRARY) TYPE(*CHAR) LEN(10)',
        'DCL VAR(&COUNT) TYPE(*DEC) LEN(5 0)',
        'CHGVAR VAR(&',
    ].join('\n');
    const variables = labels(services, source);

    assert.ok(variables.includes('&LIBRARY'));
    assert.ok(variables.includes('&COUNT'));
});

test('CL completion follows nested command parameters', () => {
    const services = createLanguageServices();
    const nestedParameters = labels(services, 'SBMJOB CMD(CRTDSPF D');

    assert.ok(nestedParameters.includes('DEV'));
    assert.ok(nestedParameters.includes('DFRWRT'));
    assert.ok(!nestedParameters.includes('JOBQ'));
});

test('CL completion stays silent inside comments and quoted strings', () => {
    const services = createLanguageServices();

    assert.deepEqual(labels(services, '/* CRTDSPF F'), []);
    assert.deepEqual(labels(services, "SNDPGMMSG MSG('CRTD"), []);
    assert.deepEqual(labels(services, '/* comment begins\nCRTD'), []);
});
