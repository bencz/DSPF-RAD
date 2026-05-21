// Display geometries and record-type tags.  Renderer + parser branch on
// these — the type drives chrome (window frame, subfile band, …) and the
// model size drives canvas dimensions.

export const MODELS = {
    '24x80':  { rows: 24, cols: 80,  label: '24×80 · 5251-11'  },
    '27x132': { rows: 27, cols: 132, label: '27×132 · 3477-FC' },
};

export const RECORD_TYPES = {
    RECORD:   { label: 'Record (standard)' },
    SFL:      { label: 'Subfile (SFL)' },
    SFLCTL:   { label: 'Subfile control (SFLCTL)' },
    MNUBAR:   { label: 'Menu bar (ENPTUI)' },
    PULLDOWN: { label: 'Pulldown menu (ENPTUI)' },
    WINDOW:   { label: 'Window (popup)' },
};
