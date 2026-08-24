export const ClCompletionContextKind = Object.freeze({
    COMMAND: 'command',
    PARAMETER: 'parameter',
    VALUE: 'value',
    COMMENT: 'comment',
    STRING: 'string',
});

export class ClContextAnalyzer {
    analyze (completionContext) {
        const documentLexical = scanStatement(
            completionContext.source.slice(0, completionContext.offset));
        if (documentLexical.mode === ClCompletionContextKind.COMMENT ||
            documentLexical.mode === ClCompletionContextKind.STRING) {
            return result({
                kind: documentLexical.mode,
                commandName: null,
                parameterName: null,
                valueSource: '',
                usedParameters: [],
                variables: collectVariables(completionContext.source),
            });
        }
        const statement = currentLogicalStatement(
            completionContext.source,
            completionContext.offset);
        const lexical = scanStatement(statement);

        const content = stripLabel(lexical.code).trimStart();
        const commandMatch = content.match(/^([A-Z][A-Z0-9]{0,9})/i);
        const commandName = commandMatch?.[1]?.toUpperCase() ?? null;
        const afterCommand = commandName ? content.slice(commandMatch[0].length) : '';
        const commandIncomplete = !commandName ||
            (!/\s|\(/.test(afterCommand) && content.trim() === commandMatch?.[0]);
        if (commandIncomplete) {
            return result({
                kind: ClCompletionContextKind.COMMAND,
                commandName,
                parameterName: null,
                valueSource: '',
                usedParameters: [],
                variables: collectVariables(completionContext.source),
            });
        }

        const parameters = analyzeParameters(afterCommand);
        return result({
            kind: parameters.activeParameter
                ? ClCompletionContextKind.VALUE
                : ClCompletionContextKind.PARAMETER,
            commandName,
            parameterName: parameters.activeParameter,
            valueSource: parameters.valueSource,
            usedParameters: parameters.usedParameters,
            variables: collectVariables(completionContext.source),
        });
    }
}

function currentLogicalStatement (source, offset) {
    const beforeCursor = source.slice(0, offset);
    const lines = beforeCursor.split('\n');
    let start = lines.length - 1;
    while (start > 0 && /[+-]\s*$/.test(withoutTrailingComment(lines[start - 1]))) start--;
    return lines.slice(start)
        .map((line, index, selected) =>
            index < selected.length - 1
                ? withoutTrailingComment(line).replace(/[+-]\s*$/, ' ')
                : line)
        .join('\n');
}

function withoutTrailingComment (line) {
    return line.replace(/\/\*.*?\*\//g, ' ').trimEnd();
}

function scanStatement (statement) {
    let code = '';
    let mode = 'code';
    for (let index = 0; index < statement.length; index++) {
        const character = statement[index];
        const next = statement[index + 1];
        if (mode === ClCompletionContextKind.COMMENT) {
            if (character === '*' && next === '/') {
                code += '  ';
                index++;
                mode = 'code';
            } else {
                code += ' ';
            }
            continue;
        }
        if (mode === ClCompletionContextKind.STRING) {
            if (character === "'" && next === "'") {
                code += '  ';
                index++;
            } else if (character === "'") {
                code += ' ';
                mode = 'code';
            } else {
                code += ' ';
            }
            continue;
        }
        if (character === '/' && next === '*') {
            code += '  ';
            index++;
            mode = ClCompletionContextKind.COMMENT;
        } else if (character === "'") {
            code += ' ';
            mode = ClCompletionContextKind.STRING;
        } else {
            code += character;
        }
    }
    return Object.freeze({ code, mode });
}

function stripLabel (statement) {
    return statement.replace(/^\s*[A-Z$#@][A-Z0-9_$#@]{0,9}\s*:\s*/i, '');
}

function analyzeParameters (sourceAfterCommand) {
    const stack = [];
    const usedParameters = new Set();
    let word = '';
    let previousWord = '';

    const flushWord = () => {
        if (!word) return;
        previousWord = word.toUpperCase();
        word = '';
    };

    for (let index = 0; index < sourceAfterCommand.length; index++) {
        const character = sourceAfterCommand[index];
        if (/[A-Za-z0-9_$#@&*%]/.test(character)) {
            word += character;
            continue;
        }
        flushWord();
        if (character === '(') {
            const parameterName = /^[A-Z][A-Z0-9]{0,9}$/.test(previousWord)
                ? previousWord
                : null;
            stack.push({ name: parameterName, contentStart: index });
            if (stack.length === 1 && parameterName) usedParameters.add(parameterName);
            previousWord = '';
        } else if (character === ')') {
            stack.pop();
            previousWord = '';
        } else if (!/\s|,/.test(character)) {
            previousWord = '';
        }
    }
    flushWord();
    return Object.freeze({
        activeParameter: stack.find(entry => entry.name)?.name ?? null,
        valueSource: stack.length
            ? sourceAfterCommand.slice(stack[0].contentStart + 1)
            : '',
        usedParameters: Object.freeze([...usedParameters]),
    });
}

function collectVariables (source) {
    const variables = new Set();
    const pattern = /\bDCL\s+(?:[^\n]*?\s+)?VAR\s*\(\s*(&[A-Z$#@][A-Z0-9_$#@]{0,9})/gi;
    for (const match of source.matchAll(pattern)) variables.add(match[1].toUpperCase());
    return Object.freeze([...variables]);
}

function result ({
    kind,
    commandName,
    parameterName,
    valueSource,
    usedParameters,
    variables,
}) {
    return Object.freeze({
        kind,
        commandName,
        parameterName,
        valueSource,
        usedParameters: Object.freeze([...usedParameters]),
        variables: Object.freeze([...variables]),
    });
}
