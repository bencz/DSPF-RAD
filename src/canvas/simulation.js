export function isVisibleInSimulation (gc, target) {
    const simulation = gc?.simulation;
    if (!simulation?.enabled) return true;
    const lines = [
        ...(target?.conditionLines ?? []),
        {
            conditionOp: target?.conditionOp ?? '',
            indicators: target?.indicators ?? [],
        },
    ].filter(line => line.indicators?.length);
    if (!lines.length) return true;

    let result = evaluateLine(lines[0], simulation.indicators, gc.document?.modelKey);
    for (let index = 1; index < lines.length; index++) {
        const lineResult = evaluateLine(
            lines[index], simulation.indicators, gc.document?.modelKey);
        result = lines[index].conditionOp === 'O'
            ? result || lineResult
            : result && lineResult;
    }
    return result;
}

export function simulationValue (gc, item) {
    if (!gc?.simulation?.enabled) return null;
    const values = gc.simulation.values;
    if (values.has(item.id)) return values.get(item.id);
    if (item.name && values.has(item.name)) return values.get(item.name);
    return null;
}

function evaluateLine (line, active, modelKey) {
    return (line.indicators ?? []).every(token => {
        const value = String(token).toUpperCase();
        if (value === '*DS3') return modelKey === '24x80';
        if (value === '*DS4') return modelKey === '27x132';
        if (value.startsWith('N')) return !active.has(value.slice(1));
        return active.has(value);
    });
}
