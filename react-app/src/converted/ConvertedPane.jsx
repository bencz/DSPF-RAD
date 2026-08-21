// Modern React visual output for the first conversion slice.
// This component consumes the read-only visual model and never mutates the document.
import { useCallback, useRef, useSyncExternalStore } from 'react';

import {
    Box,
    Chip,
    CssBaseline,
    Divider,
    Paper,
    Stack,
    ThemeProvider,
    Typography,
} from '@mui/material';

import { buildSemanticPreview } from '../conversion/semanticPreview.js';
import { buildVisualModel } from '../conversion/visualModel.js';
import { convertedTheme } from './convertedTheme.js';

const EMPTY_BUS = { current: null, subscribe: () => () => {} };

export function ConvertedPane ({ doc, bus = EMPTY_BUS, enabled = true }) {
    const versionRef = useRef(0);
    const subscribe = useCallback((onStoreChange) => doc.onChange(() => {
        versionRef.current += 1;
        onStoreChange();
    }), [doc]);
    const getSnapshot = useCallback(() => versionRef.current, []);
    useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    if (!enabled) return null;

    const semantic = buildSemanticPreview(doc);
    const model = buildVisualModel(doc);
    const selectedId = bus?.current ?? null;
    const active = model.records[model.activeRecordIndex] ?? model.records[0];
    return (
        <ThemeProvider theme={convertedTheme}>
            <CssBaseline />
            <Box className="converted-pane" data-testid="converted-pane"
                 sx={{ height: '100%', overflow: 'auto', bgcolor: 'background.default', p: 2 }}
                 data-source-revision={semantic.ir.sourceRevision.sourceHash}
                 data-mapping-count={semantic.contract.mappings.length}
                 data-semantic-status={semantic.screen.status}>
                <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                            <Typography variant="h6">{active?.name ?? 'Converted screen'}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Modern React · {model.modelKey} · {active?.type ?? 'RECORD'}
                            </Typography>
                        </Box>
                        <Chip label="Visual preview" color="primary" size="small" />
                    </Stack>

                    <Paper variant="outlined" sx={{ p: 1.5 }} data-testid="converted-provenance">
                        <Typography variant="subtitle2">Source provenance</Typography>
                        <Typography variant="caption" component="div">{active?.name} · {active?.type}</Typography>
                        <Typography variant="caption" component="div">Items: {active?.items?.length ?? 0}</Typography>
                        {active?.type === 'SFL' && <Typography variant="caption" component="div">SFL template · control relation requires runtime metadata</Typography>}
                    </Paper>

                    <Divider />

                    <Box className="converted-grid" data-testid="converted-grid" data-grid-columns="12"
                         sx={{
                             display: 'grid',
                             gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                             gridAutoRows: 'minmax(40px, auto)',
                             gap: 1,
                             alignItems: 'start',
                         }}>
                        {(active?.items ?? []).filter((item) => !item.hidden).map((item) => (
                            <ConvertedItem key={item.sourceId} item={item}
                                           selected={item.sourceId === selectedId} />
                        ))}
                    </Box>

                    {model.warnings.length > 0 && (
                        <Paper variant="outlined" sx={{ p: 1.5 }} data-testid="converted-warnings">
                            <Typography variant="subtitle2" color="warning.main">
                                Manual review
                            </Typography>
                            <Stack spacing={0.5} sx={{ mt: 1 }} data-testid="converted-review">
                                {model.warnings.map((warning) => (
                                    <Typography key={`${warning.sourceId}-${warning.message}`} variant="caption">
                                        {warning.message}
                                    </Typography>
                                ))}
                            </Stack>
                        </Paper>
                    )}
                </Stack>
            </Box>
        </ThemeProvider>
    );
}

function ConvertedItem ({ item, selected }) {
    const content = item.kind === 'field'
        ? (item.name || 'Unnamed field')
        : item.kind === 'sysvalue'
            ? (item.sysName || 'System value')
            : item.text || ' ';

    return (
        <Paper
            variant="outlined"
            data-testid="converted-item"
            data-source-id={item.sourceId}
            data-kind={item.kind}
            sx={{
                gridRow: item.row,
                minWidth: 0,
                minHeight: 40,
                display: 'flex',
                alignItems: 'center',
                gridColumn: `${item.targetCol} / span ${item.span}`,
                py: 0.75,
                borderColor: selected ? 'primary.main' : 'divider',
                borderWidth: selected ? 2 : 1,
                bgcolor: item.color ?? 'background.paper',
                color: item.color ? '#FFFFFF' : 'text.primary',
                fontWeight: item.attributes.includes('HI') ? 700 : 400,
                textDecoration: item.attributes.includes('UL') ? 'underline' : 'none',
                overflow: 'hidden',
            }}
        >
            <Typography noWrap variant="body2" component="span">
                {content}
            </Typography>
        </Paper>
    );
}
