import { IbmiLanguageRegistry } from './IbmiLanguageRegistry.js';

export function createDefaultIbmiLanguageRegistry () {
    const registry = new IbmiLanguageRegistry();
    for (const definition of DEFAULT_LANGUAGES) registry.register(definition);
    return registry;
}

const DEFAULT_LANGUAGES = Object.freeze([
    {
        id: 'cl',
        label: 'IBM i Control Language',
        family: 'cl',
        memberTypes: ['CL', 'CLP', 'CLLE'],
        extensions: ['.cl', '.clp', '.clle'],
        compileCommands: ['CRTBNDCL', 'CRTCLMOD', 'CRTCLPGM'],
    },
    {
        id: 'rpgle',
        label: 'ILE RPG',
        family: 'rpg',
        memberTypes: ['RPG', 'RPGLE'],
        extensions: ['.rpg', '.rpgle'],
        compileCommands: ['CRTBNDRPG', 'CRTRPGMOD', 'CRTRPGPGM'],
    },
    {
        id: 'sqlrpgle',
        label: 'SQL ILE RPG',
        family: 'rpg',
        memberTypes: ['SQLRPG', 'SQLRPGLE'],
        extensions: ['.sqlrpg', '.sqlrpgle'],
        compileCommands: ['CRTSQLRPGI', 'CRTSQLRPG'],
    },
    {
        id: 'cobol',
        label: 'ILE COBOL',
        family: 'cobol',
        memberTypes: ['CBL', 'CBLLE'],
        extensions: ['.cbl', '.cobol', '.cblle'],
        compileCommands: ['CRTBNDCBL', 'CRTCBLMOD', 'CRTCBLPGM'],
    },
    {
        id: 'sql',
        label: 'SQL',
        family: 'sql',
        memberTypes: ['SQL'],
        extensions: ['.sql'],
        compileCommands: ['RUNSQLSTM'],
    },
    {
        id: 'dds-display',
        label: 'Display File DDS',
        family: 'dds',
        memberTypes: ['DSPF'],
        extensions: ['.dspf'],
        compileCommands: ['CRTDSPF'],
    },
    {
        id: 'dds-menu',
        label: 'Menu DDS',
        family: 'dds',
        memberTypes: ['MNUDDS'],
        extensions: ['.mnudds'],
        compileCommands: ['CRTDSPF'],
    },
    {
        id: 'dds-database',
        label: 'Database DDS',
        family: 'dds',
        memberTypes: ['PF', 'LF'],
        extensions: ['.pf', '.lf'],
        compileCommands: ['CRTPF', 'CRTLF'],
    },
    {
        id: 'dds-printer',
        label: 'Printer File DDS',
        family: 'dds',
        memberTypes: ['PRTF'],
        extensions: ['.prtf'],
        compileCommands: ['CRTPRTF'],
    },
    {
        id: 'dds',
        label: 'Data Description Specifications',
        family: 'dds',
        memberTypes: [],
        extensions: ['.dds'],
        compileCommands: [],
    },
    {
        id: 'command-definition',
        label: 'IBM i Command Definition',
        family: 'cl',
        memberTypes: ['CMD'],
        extensions: ['.cmd'],
        compileCommands: ['CRTCMD'],
    },
    {
        id: 'panel-group',
        label: 'IBM i Panel Group',
        memberTypes: ['PNLGRP'],
        extensions: ['.pnlgrp'],
        compileCommands: ['CRTPNLGRP'],
    },
    {
        id: 'plaintext',
        label: 'Plain Text',
        memberTypes: [],
        extensions: ['.txt'],
        compileCommands: [],
    },
]);
