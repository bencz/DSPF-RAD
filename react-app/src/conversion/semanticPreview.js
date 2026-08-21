// React-side read-only conversion adapter for the V3 preview boundary.
// Every refresh rebuilds derived data from the current DspfDocument.

import { buildCompleteSemanticIR } from '@dspf/codegen/semanticAssembly.js';
import { buildMappingContract } from '@dspf/codegen/mappingContract.js';
import { buildConvertedScreen } from '@dspf/codegen/convertedScreen.js';

export function buildSemanticPreview (doc) {
    const ir = buildCompleteSemanticIR(doc);
    const contract = buildMappingContract(ir);
    const screen = buildConvertedScreen(ir, doc.activeRecord?.name);
    return { ir, contract, screen };
}
