# IBM i language services

Language intelligence is a product subsystem, not a collection of CodeMirror
callbacks. Parsing, completion, diagnostics, symbols, and build metadata must
remain reusable by editors, project analysis, quick fixes, and future remote
IBM i integrations.

## Pipeline

```text
source document
  -> language registry
  -> lexical/syntactic context analyzer
  -> document and project symbols
  -> language completion providers
  -> deterministic merge/ranking
  -> editor adapter
```

- `IbmiLanguageDefinition` models member types, local extensions, language
  families, and applicable compile commands.
- `IbmiLanguageRegistry` resolves a language from authoritative member type
  metadata first, then from a local filename.
- `LanguageCompletionContext` is an immutable editor-independent request.
- `ContextualCompletionEngine` combines and deduplicates providers without
  knowing language syntax.
- A language analyzer owns grammar-specific context. The CL analyzer currently
  identifies commands, parameters, values, comments, strings, line
  continuations, document variables, labels, and nested command parameters.
- `SourceDocument` owns source identity, text version, dirty state, resource
  URI, and change events. It does not import CodeMirror or a host adapter.

## Completion depth

Completion will be built in explicit layers:

1. lexical position: string, comment, identifier, fixed column, or free form;
2. syntactic position: command, opcode, keyword, parameter, value, expression,
   declaration, or nested statement;
3. document semantics: declared variables, procedures, files, record formats,
   fields, prototypes, labels, and control-flow scope;
4. project semantics: exported symbols, copybooks, include paths, binding
   directories, referenced files, and generated artifacts;
5. IBM i semantics: libraries, objects, members, commands, job context, and
   target-release capabilities obtained through a connected desktop service.

Offline providers always work from bundled language metadata and the local
workspace index. Remote providers enrich results only when a real IBM i session
is available. Results are deterministic and must not depend on telemetry.

## CL provider

CL commands use a consistent command/parameter syntax and support prompting and
validity checking. Keyword parameters have no blank between the keyword and
opening parenthesis, and parameters may contain another command. The first
provider models those rules instead of offering one global word list.

The bundled catalog is deliberately a versioned starting set, not a claim to
contain every IBM-supplied or product command. It will grow through generated
metadata and connected-system discovery while preserving the same
`ClCommandCatalog` contract.

Primary references:

- [IBM i control language](https://www.ibm.com/docs/en/i/7.5.0?topic=control-language)
- [CL command coding rules](https://www.ibm.com/docs/en/i/7.5.0?topic=commands-cl-command-coding-rules)
- [CL command parameter types](https://www.ibm.com/docs/en/i/7.6.0?topic=parameters-cl-command-parameter-types)
- [Source types and compile names](https://www.ibm.com/docs/en/rdfi/9.9.0?topic=preferences-source-types-compile-names)

## Extension rules

- Keep analyzers and catalogs independent from the editor UI.
- Register providers by language ID; do not add language switches to the
  completion engine.
- Return structured completion items with label, type, detail, insertion text,
  and deterministic boost.
- Do not offer completion inside comments or strings unless a language-specific
  feature explicitly owns that context.
- Tests must cover context transitions, symbol visibility, nested syntax,
  duplicate suppression, and incorrect-context silence.
- Connected providers must use platform ports and must never access credentials
  or concrete SSH/Tauri implementations.
