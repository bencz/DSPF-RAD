// Main-controller data binding list for conversion diagnostics.
// Temporary fixes are explicit preview approvals and remain reportable.

import { useState } from 'react';
import { Button, Checkbox, FormControlLabel, Stack, Typography } from '@mui/material';

export function ReviewList ({ doc, warnings = [], mappings = [] }) {
    const [selected, setSelected] = useState(() => new Set());
    const toggle = (id) => setSelected((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const accept = () => {
        for (const id of selected) doc.updateItem(id, { _lengthApproved: true });
        setSelected(new Set());
    };
    return (
        <Stack spacing={0.5} data-testid="data-binding-list">
            <Typography variant="subtitle2">Data Binding List ({mappings.length})</Typography>
            <Stack spacing={0.5} data-testid="converted-review">
                {warnings.map((warning) => (
                    <FormControlLabel key={`${warning.sourceId}-${warning.message}`} control={<Checkbox size="small" checked={selected.has(warning.sourceId)} onChange={() => toggle(warning.sourceId)} />} label={<Typography variant="caption">{warning.message}</Typography>} />
                ))}
            </Stack>
            <Button size="small" variant="outlined" disabled={!selected.size} onClick={accept}>Accept selected temporary fixes</Button>
            {mappings.map((mapping) => (
                <Typography key={mapping.sourceIdentity} variant="caption" data-testid="data-binding-row">
                    {mapping.source?.record} · {mapping.sourceIdentity} → {mapping.targetComponent} · {mapping.status}
                </Typography>
            ))}
        </Stack>
    );
}
