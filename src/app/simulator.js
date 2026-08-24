export function bindSimulator ({ doc, designer, flash }) {
    const toggle = document.getElementById('simulateToggle');
    const bar = document.getElementById('simulationBar');
    const indicators = document.getElementById('simIndicators');
    const fieldSel = document.getElementById('simFieldSel');
    const fieldValue = document.getElementById('simFieldValue');
    const setValue = document.getElementById('simSetValue');
    const clear = document.getElementById('simClear');
    if (!toggle || !bar || !indicators || !fieldSel || !fieldValue) return;

    const simulation = designer.renderer.simulation;

    const redraw = () => designer.renderer.draw();
    const rebuildFields = () => {
        const previous = fieldSel.value;
        fieldSel.innerHTML = '';
        for (const item of doc.activeRecord.items) {
            if (item.kind !== 'field' && item.kind !== 'sysvalue') continue;
            if (item.kind === 'field' && ['H', 'P', 'M'].includes(item.usage)) continue;
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.kind === 'sysvalue'
                ? `<${item.sysName || 'SYSVALUE'}>`
                : (item.name || item.id);
            fieldSel.appendChild(option);
        }
        if ([...fieldSel.options].some(option => option.value === previous)) {
            fieldSel.value = previous;
        }
        syncValueInput();
    };

    const selectedItem = () => doc.findItem(fieldSel.value);
    const syncValueInput = () => {
        const item = selectedItem();
        const key = item?.name || item?.id;
        fieldValue.value = key ? (simulation.values.get(key) ?? '') : '';
        fieldValue.disabled = !item;
        setValue.disabled = !item;
    };

    const setEnabled = enabled => {
        simulation.enabled = enabled;
        bar.hidden = !enabled;
        toggle.classList.toggle('on', enabled);
        document.body.classList.toggle('simulation-active', enabled);
        if (enabled) rebuildFields();
        requestAnimationFrame(() => designer.forceResize());
        redraw();
        flash(enabled ? 'Runtime preview enabled.' : 'Runtime preview disabled.', 'ok');
    };

    toggle.addEventListener('click', () => setEnabled(!simulation.enabled));
    indicators.addEventListener('input', () => {
        simulation.indicators = parseActiveIndicators(indicators.value);
        redraw();
    });
    fieldSel.addEventListener('change', syncValueInput);
    setValue.addEventListener('click', () => {
        const item = selectedItem();
        if (!item) return;
        simulation.values.set(item.name || item.id, fieldValue.value);
        redraw();
    });
    fieldValue.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            setValue.click();
        }
    });
    clear.addEventListener('click', () => {
        simulation.indicators = new Set();
        simulation.values.clear();
        indicators.value = '';
        syncValueInput();
        redraw();
    });

    doc.onChange((_doc, meta = {}) => {
        if (!meta.transient) rebuildFields();
    });
    rebuildFields();
}

function parseActiveIndicators (text) {
    const active = new Set();
    for (const match of String(text ?? '').matchAll(/\d{1,2}/g)) {
        const value = parseInt(match[0], 10);
        if (value >= 1 && value <= 99) active.add(String(value).padStart(2, '0'));
    }
    return active;
}
