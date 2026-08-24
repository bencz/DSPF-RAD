import { CompletionItem } from '../completion/CompletionItem.js';
import { LanguageCompletionContext } from '../completion/LanguageCompletionContext.js';
import { ClCommandCatalog } from './ClCommandCatalog.js';
import {
    ClCompletionContextKind,
    ClContextAnalyzer,
} from './ClContextAnalyzer.js';

export class ClCompletionProvider {
    constructor ({
        catalog = new ClCommandCatalog(),
        analyzer = new ClContextAnalyzer(),
    } = {}) {
        this.catalog = catalog;
        this.analyzer = analyzer;
    }

    provideCompletions (context) {
        const analysis = this.analyzer.analyze(context);
        if (analysis.kind === ClCompletionContextKind.COMMENT ||
            analysis.kind === ClCompletionContextKind.STRING) return [];
        if (analysis.kind === ClCompletionContextKind.COMMAND) {
            return this.#commandItems();
        }

        const command = this.catalog.get(analysis.commandName);
        if (!command) return this.#commandItems();
        if (analysis.kind === ClCompletionContextKind.PARAMETER) {
            const used = new Set(analysis.usedParameters);
            return command.parameters
                .filter(parameter => !used.has(parameter.name))
                .map(parameter => new CompletionItem({
                    label: parameter.name,
                    type: 'keyword',
                    detail: parameter.description || `${command.name} parameter`,
                    insertText: `${parameter.name}()`,
                    boost: 20,
                }));
        }

        const parameter = command.parameter(analysis.parameterName);
        if (!parameter) return this.#variableItems(analysis.variables);
        if (parameter.acceptsCommand) {
            const nestedSource = analysis.valueSource.trimStart();
            if (!nestedSource) return this.#commandItems(10);
            return this.provideCompletions(new LanguageCompletionContext({
                languageId: context.languageId,
                source: nestedSource,
                offset: nestedSource.length,
                explicit: context.explicit,
            }));
        }
        const items = parameter.values.map(value => new CompletionItem({
            label: value,
            type: 'value',
            detail: `${command.name} ${parameter.name}`,
            boost: 30,
        }));
        if (parameter.acceptsVariable) items.push(...this.#variableItems(analysis.variables));
        return items;
    }

    #commandItems (boost = 20) {
        return this.catalog.list().map(command => new CompletionItem({
            label: command.name,
            type: 'command',
            detail: command.description,
            boost,
        }));
    }

    #variableItems (variables) {
        return variables.map(variable => new CompletionItem({
            label: variable,
            type: 'variable',
            detail: 'CL variable declared in this source',
            boost: 15,
        }));
    }
}
