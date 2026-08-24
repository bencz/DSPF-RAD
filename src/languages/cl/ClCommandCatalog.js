export class ClParameterDefinition {
    constructor ({
        name,
        description = '',
        values = [],
        acceptsVariable = true,
        acceptsCommand = false,
    }) {
        this.name = normalizeName(name, 'CL parameter name');
        this.description = String(description ?? '').trim();
        this.values = Object.freeze([...new Set(values.map(value =>
            String(value).trim().toUpperCase()).filter(Boolean))]);
        this.acceptsVariable = Boolean(acceptsVariable);
        this.acceptsCommand = Boolean(acceptsCommand);
        Object.freeze(this);
    }
}

export class ClCommandDefinition {
    #parametersByName;

    constructor ({ name, description = '', parameters = [] }) {
        this.name = normalizeName(name, 'CL command name');
        this.description = String(description ?? '').trim();
        this.parameters = Object.freeze(parameters.map(parameter =>
            parameter instanceof ClParameterDefinition
                ? parameter
                : new ClParameterDefinition(parameter)));
        this.#parametersByName = new Map(
            this.parameters.map(parameter => [parameter.name, parameter]));
        Object.freeze(this);
    }

    parameter (name) {
        return this.#parametersByName.get(String(name ?? '').trim().toUpperCase()) ?? null;
    }
}

export class ClCommandCatalog {
    #commands = new Map();

    constructor (definitions = DEFAULT_COMMANDS) {
        for (const definition of definitions) this.register(definition);
    }

    register (definitionLike) {
        const definition = definitionLike instanceof ClCommandDefinition
            ? definitionLike
            : new ClCommandDefinition(definitionLike);
        if (this.#commands.has(definition.name)) {
            throw new Error(`CL command is already registered: ${definition.name}`);
        }
        this.#commands.set(definition.name, definition);
        return () => this.#commands.delete(definition.name);
    }

    get (name) {
        return this.#commands.get(String(name ?? '').trim().toUpperCase()) ?? null;
    }

    list () {
        return Object.freeze([...this.#commands.values()]);
    }
}

function normalizeName (value, label) {
    const name = String(value ?? '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{0,9}$/.test(name)) {
        throw new TypeError(`${label} must be a valid IBM i name: ${name || '(empty)'}`);
    }
    return name;
}

const objectAuthority = ['*LIBCRTAUT', '*CHANGE', '*ALL', '*USE', '*EXCLUDE'];
const replace = ['*YES', '*NO'];
const debugView = ['*STMT', '*SOURCE', '*LIST', '*COPY', '*ALL', '*NONE'];

const DEFAULT_COMMANDS = Object.freeze([
    {
        name: 'PGM', description: 'Begin a CL program or procedure',
        parameters: [
            { name: 'PARM', description: 'Parameters received by the program' },
        ],
    },
    {
        name: 'ENDPGM', description: 'End a CL program or procedure',
    },
    {
        name: 'DCL', description: 'Declare a CL variable',
        parameters: [
            { name: 'VAR', description: 'Variable being declared', acceptsVariable: false },
            { name: 'TYPE', values: ['*CHAR', '*DEC', '*LGL', '*INT', '*UINT', '*PTR'] },
            { name: 'LEN', description: 'Variable length and decimal positions' },
            { name: 'VALUE', description: 'Initial value' },
            { name: 'STG', values: ['*AUTO', '*DEFINED'] },
        ],
    },
    {
        name: 'DCLF', description: 'Declare fields from a display or database file',
        parameters: [
            { name: 'FILE' },
            { name: 'RCDFMT' },
            { name: 'OPNID' },
        ],
    },
    {
        name: 'CHGVAR', description: 'Change a CL variable',
        parameters: [
            { name: 'VAR' },
            { name: 'VALUE' },
        ],
    },
    {
        name: 'IF', description: 'Conditionally run another CL command',
        parameters: [
            { name: 'COND' },
            { name: 'THEN', acceptsCommand: true, acceptsVariable: false },
        ],
    },
    {
        name: 'ELSE', description: 'Run the alternative branch of an IF command',
        parameters: [
            { name: 'CMD', acceptsCommand: true, acceptsVariable: false },
        ],
    },
    {
        name: 'DO', description: 'Begin a group of CL commands',
    },
    {
        name: 'ENDDO', description: 'End a DO group',
    },
    {
        name: 'DOWHILE', description: 'Repeat while a condition is true',
        parameters: [{ name: 'COND' }],
    },
    {
        name: 'DOUNTIL', description: 'Repeat until a condition is true',
        parameters: [{ name: 'COND' }],
    },
    {
        name: 'SELECT', description: 'Begin a SELECT group',
    },
    {
        name: 'WHEN', description: 'Select a branch by condition',
        parameters: [{ name: 'COND' }, { name: 'THEN', acceptsCommand: true }],
    },
    {
        name: 'OTHERWISE', description: 'Select the fallback branch',
        parameters: [{ name: 'CMD', acceptsCommand: true }],
    },
    {
        name: 'ENDSELECT', description: 'End a SELECT group',
    },
    {
        name: 'CALL', description: 'Call a program',
        parameters: [{ name: 'PGM' }, { name: 'PARM' }],
    },
    {
        name: 'CALLPRC', description: 'Call a bound procedure',
        parameters: [
            { name: 'PRC' }, { name: 'PARM' }, { name: 'RTNVAL' },
        ],
    },
    {
        name: 'RETURN', description: 'Return from a CL program or procedure',
    },
    {
        name: 'MONMSG', description: 'Monitor escape or notify messages',
        parameters: [
            { name: 'MSGID', values: ['CPF0000', 'MCH0000'] },
            { name: 'CMPDTA' },
            { name: 'EXEC', acceptsCommand: true },
        ],
    },
    {
        name: 'SNDPGMMSG', description: 'Send a program message',
        parameters: [
            { name: 'MSG' }, { name: 'MSGID' }, { name: 'MSGF' },
            { name: 'MSGDTA' }, { name: 'TOPGMQ' },
            { name: 'MSGTYPE', values: ['*INFO', '*INQ', '*COMP', '*DIAG', '*ESCAPE', '*NOTIFY', '*STATUS'] },
            { name: 'KEYVAR' },
        ],
    },
    {
        name: 'RCVMSG', description: 'Receive a message',
        parameters: [
            { name: 'PGMQ' }, { name: 'MSGTYPE', values: ['*ANY', '*COMP', '*DIAG', '*EXCP', '*RQS'] },
            { name: 'WAIT' }, { name: 'MSGDTA' }, { name: 'MSGID' },
            { name: 'RTNTYPE' }, { name: 'SNDMSGFLIB' }, { name: 'SNDMSGF' },
        ],
    },
    {
        name: 'CRTLIB', description: 'Create a library',
        parameters: [
            { name: 'LIB' }, { name: 'TYPE', values: ['*PROD', '*TEST'] },
            { name: 'TEXT' }, { name: 'AUT', values: objectAuthority },
        ],
    },
    {
        name: 'DLTLIB', description: 'Delete a library',
        parameters: [{ name: 'LIB' }],
    },
    {
        name: 'CRTSRCPF', description: 'Create a source physical file',
        parameters: [
            { name: 'FILE' }, { name: 'RCDLEN' }, { name: 'IGCDTA', values: ['*NO', '*YES'] },
            { name: 'MAXMBRS' }, { name: 'TEXT' }, { name: 'AUT', values: objectAuthority },
        ],
    },
    {
        name: 'CRTDSPF', description: 'Create a display file',
        parameters: [
            { name: 'FILE' }, { name: 'SRCFILE' }, { name: 'SRCMBR' },
            { name: 'DEV', values: ['*REQUESTER', '*DEVD', '*MRT'] },
            { name: 'RSTDSP', values: ['*NO', '*YES'] },
            { name: 'DFRWRT', values: ['*NO', '*YES'] },
            { name: 'REPLACE', values: replace }, { name: 'TEXT' },
            { name: 'AUT', values: objectAuthority },
        ],
    },
    {
        name: 'CRTPF', description: 'Create a physical file',
        parameters: [
            { name: 'FILE' }, { name: 'SRCFILE' }, { name: 'SRCMBR' },
            { name: 'RCDLEN' }, { name: 'SIZE' }, { name: 'REPLACE', values: replace },
            { name: 'TEXT' }, { name: 'AUT', values: objectAuthority },
        ],
    },
    {
        name: 'CRTLF', description: 'Create a logical file',
        parameters: [
            { name: 'FILE' }, { name: 'SRCFILE' }, { name: 'SRCMBR' },
            { name: 'DTAMBRS', values: ['*ALL', '*NONE'] },
            { name: 'REPLACE', values: replace }, { name: 'TEXT' },
            { name: 'AUT', values: objectAuthority },
        ],
    },
    {
        name: 'CRTBNDRPG', description: 'Create a bound ILE RPG program',
        parameters: [
            { name: 'PGM' }, { name: 'SRCFILE' }, { name: 'SRCMBR' },
            { name: 'OPTION', values: ['*SRCSTMT', '*NOSRCSTMT', '*XREF', '*NOXREF', '*EVENTF', '*NOEVENTF'] },
            { name: 'DBGVIEW', values: debugView },
            { name: 'REPLACE', values: replace }, { name: 'TGTRLS' },
            { name: 'TEXT' }, { name: 'AUT', values: objectAuthority },
        ],
    },
    {
        name: 'CRTBNDCL', description: 'Create a bound CL program',
        parameters: [
            { name: 'PGM' }, { name: 'SRCFILE' }, { name: 'SRCMBR' },
            { name: 'OPTION', values: ['*GEN', '*NOGEN', '*XREF', '*NOXREF'] },
            { name: 'DBGVIEW', values: debugView },
            { name: 'REPLACE', values: replace }, { name: 'TGTRLS' },
            { name: 'TEXT' }, { name: 'AUT', values: objectAuthority },
        ],
    },
    {
        name: 'OVRDBF', description: 'Override a database file',
        parameters: [
            { name: 'FILE' }, { name: 'TOFILE' }, { name: 'MBR' },
            { name: 'POSITION' }, { name: 'OVRSCOPE', values: ['*ACTGRPDFN', '*CALLLVL', '*JOB'] },
            { name: 'SHARE', values: ['*NO', '*YES'] },
        ],
    },
    {
        name: 'DLTOVR', description: 'Delete file overrides',
        parameters: [
            { name: 'FILE', values: ['*ALL'] },
            { name: 'LVL', values: ['*ACTGRPDFN', '*CALLLVL', '*JOB'] },
        ],
    },
    {
        name: 'SBMJOB', description: 'Submit a batch job',
        parameters: [
            { name: 'CMD', acceptsCommand: true }, { name: 'JOB' },
            { name: 'JOBQ' }, { name: 'JOBD' }, { name: 'USER' },
            { name: 'SCDDATE' }, { name: 'SCDTIME' },
            { name: 'CPYENVVAR', values: ['*NO', '*YES'] },
        ],
    },
]);
