// Public conversion and code-generation surface.
// Keep consumers on named exports so implementation modules can evolve.

export { buildDspfSemanticIR, resolveDisplayProfile } from './semanticIR.js';
export { buildIdentityGraph } from './identityGraph.js';
export { classifyKeyword, classifyCapabilities } from './capabilities.js';
export { generateRpgle } from './rpgle.js';
export { generateCobol } from './cobol.js';
