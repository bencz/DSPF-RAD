import { IbmiSystemName } from './IbmiSystemName.js';

const SOURCE_FILE_TYPES = Object.freeze([
    ['SQLRPGLE', 'SQLRPGLE'],
    ['SQLRPG', 'SQLRPG'],
    ['RPGLE', 'RPGLE'],
    ['RPG', 'RPG'],
    ['CBLLE', 'CBLLE'],
    ['CBL', 'CBL'],
    ['CLLE', 'CLLE'],
    ['CL', 'CLLE'],
    ['CMD', 'CMD'],
    ['DDS', 'DDS'],
    ['PNL', 'PNLGRP'],
    ['SQL', 'SQL'],
]);

export class IbmiSourceTypeResolver {
    static fromSourceFile (sourceFile) {
        const name = IbmiSystemName.normalize(sourceFile, 'source file');
        return SOURCE_FILE_TYPES.find(([fragment]) => name.includes(fragment))?.[1] ?? '';
    }
}
