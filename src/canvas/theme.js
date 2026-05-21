// Visual constants for the canvas renderer.  Kept separate so a theme
// switch (e.g. amber phosphor) becomes a one-spot edit.

export const BG       = '#050a05';
export const GRID_DOT = '#0e2412';
export const COL_LINE = '#0a1a0a';
export const SELECT   = '#4a9aff';
export const SELECT_BG = 'rgba(74, 154, 255, 0.10)';
export const OVERLAY_ALPHA = 0.30;

// Per-record-type backdrops.  Subtle so they don't overwhelm content but
// still make record membership obvious at a glance.
export const RECORD_BG = {
    SFL:      'rgba( 80, 150, 220, 0.10)',
    SFLCTL:   'rgba( 80, 220, 180, 0.08)',
    MNUBAR:   'rgba(220, 200,  80, 0.12)',
    PULLDOWN: 'rgba(180, 180, 180, 0.10)',
    WINDOW:   'rgba(150, 100, 220, 0.08)',
};

export const RECORD_BORDER = {
    WINDOW: '#9b6cd9',
};

// Stable design-time widths for sysvalues (runtime fills with the real
// value; we just need a footprint).
export const SYS_WIDTH = {
    DATE: 8, TIME: 8, USER: 10, SYSNAME: 8, USRNAME: 10,
    DATEUSA: 10, TIMEUSA: 8, EUROPE: 10, JOBNAME: 10, NETID: 8,
};
