// Public conversion and code-generation surface.
// Keep consumers on named exports so implementation modules can evolve.

export { buildDspfSemanticIR } from './semanticIR.js';
export { generateRpgle } from './rpgle.js';
export { generateCobol } from './cobol.js';
