// Integrated converted-preview renderer for the main controller.
// It consumes conversion output and never mutates the design document.

import { buildConvertedScreen } from '../codegen/convertedScreen.js';
import { buildDspfSemanticIR } from '../codegen/semanticIR.js';
import { buildMappingContract } from '../codegen/mappingContract.js';

export function bindConvertedPreview ({ doc, pane, content }) {
    const refresh = () => {
        const ir = buildDspfSemanticIR(doc);
        const contract = buildMappingContract(ir);
        const screen = buildConvertedScreen(ir, doc.activeRecord?.name);
        renderConvertedScreen({ pane, content, screen, contract });
    };
    doc.onChange(refresh);
    refresh();
    return refresh;
}

function renderConvertedScreen ({ pane, content, screen, contract }) {
    if (!pane || !content) return;
    content.replaceChildren();
    if (!screen.record) {
        content.textContent = 'No record available for conversion.';
        return;
    }
    const heading = document.createElement('h3');
    heading.textContent = `${screen.record.name} · ${screen.status}`;
    content.appendChild(heading);
    const meta = document.createElement('p');
    meta.textContent = `${screen.items.length} items · ${contract.mappings.length} mappings`;
    content.appendChild(meta);
    for (const item of screen.items) {
        const row = document.createElement('div');
        row.className = `converted-item status-${item.status}`;
        const source = item.source;
        row.textContent = `${item.kind}: ${source.name || source.text || ''} `
            + `[${item.target.sourceRow},${item.target.sourceCol}] `
            + `→ col ${item.target.targetCol}, span ${item.target.actualSpan} · ${item.status}`;
        content.appendChild(row);
    }
    pane.dataset.status = screen.status;
}
