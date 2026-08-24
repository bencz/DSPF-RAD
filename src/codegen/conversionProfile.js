// Effective semantic conversion profile recorder.
// This module does not decide anything — it records the semantic rules that
// are already in force so every generated manifest can self-declare which
// policy produced it. Rule changes must land in contract Markdown first
// (D-10); this file only mirrors what the implementation actually does.

export function describeConversionProfile () {
    return {
        layoutPolicy: {
            targetColumns: 12,
            packingDefault: 'manual-review',
            overlapHandling: 'lossiness=overlap → manual-review',
            unknownProfile: 'manual-review',
        },
        statusVocabulary: [
            'converted',
            'converted-with-warning',
            'manual-review',
            'unsupported',
            'error',
        ],
        componentRules: [
            { match: 'field + usage=H', component: 'HiddenControl' },
            { match: 'field', component: 'ConvertedField' },
            { match: 'constant', component: 'ConvertedLabel' },
            { match: 'sysvalue', component: 'ConvertedSystemValue' },
            { match: 'unclassified kind', component: 'UnsupportedItem' },
        ],
        authorityOrder: [
            'compiled-dds',
            'exact-pf-lf-source',
            'approved-alias',
            'missing-source → block-runtime-and-deployment',
        ],
        sources: {
            layoutPolicy: 'contract/schemas/layout-policy.json',
            diagnostics: 'contract/schemas/semantic-diagnostics.json',
            conversionRules: 'contract/02-conversion-core.md §3–§11',
            designOverlay: 'contract/03-generated-react-app.md §9 + decisions.md D-15',
        },
    };
}
