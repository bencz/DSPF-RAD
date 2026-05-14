// DSPF attribute reference - just the keywords we render visually or
// expose in the inspector.  Anything we don't recognise should still
// round-trip through the (future) parser/writer via `extraKeywords` on
// the item, so this file stays small on purpose.

export const DSPATR_FLAGS = {
    HI: 'High intensity',
    RI: 'Reverse image',
    UL: 'Underline',
    BL: 'Blink',
    ND: 'Non-display',
    PC: 'Position cursor',
    PR: 'Protect',
    CS: 'Column separator',
};

export const COLORS = {
    GRN: 'Green',
    WHT: 'White',
    RED: 'Red',
    TRQ: 'Turquoise',
    YLW: 'Yellow',
    PNK: 'Pink',
    BLU: 'Blue',
};

// CSS colour per COLOR keyword.  Picked for taste on the dark canvas - not
// strict 5250 hardware RGB.  TRQ is teal, PNK leans magenta because pure
// pink reads badly against black.
export const COLOR_CSS = {
    GRN: '#33ff33',
    WHT: '#e8e8e8',
    RED: '#ff5555',
    TRQ: '#33dddd',
    YLW: '#ffdd33',
    PNK: '#ff77cc',
    BLU: '#5599ff',
};

// Used whenever the host hasn't asked for anything special.  Real 5250
// default is green - we follow.
export const DEFAULT_COLOR = 'GRN';

// EDTCDE: many codes exist, none rendered specially in v1.  Listed so
// the inspector can offer a dropdown; the value still flows into the
// model untouched.
export const EDTCDE = [
    '', '1', '2', '3', '4', 'A', 'B', 'C', 'D',
    'J', 'K', 'L', 'M', 'N', 'O', 'W', 'X', 'Y', 'Z',
];

export const DATA_TYPES = [
    { value: 'A', label: 'A · Char' },
    { value: 'S', label: 'S · Signed numeric' },
    { value: 'P', label: 'P · Packed' },
    { value: 'Y', label: 'Y · Date' },
    { value: 'N', label: 'N · Numeric only' },
    { value: 'I', label: 'I · Inhibit kbd' },
    { value: 'D', label: 'D · Digits only' },
    { value: 'X', label: 'X · Alpha only' },
];

export const USAGES = [
    { value: 'I', label: 'I · Input' },
    { value: 'O', label: 'O · Output' },
    { value: 'B', label: 'B · Both' },
    { value: 'H', label: 'H · Hidden' },
];
