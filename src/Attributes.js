// DSPF attributes the renderer + inspector know about.  Unrecognised
// keywords still round-trip via item.keywords[] — this file just enumerates
// what we surface in dropdowns and paint with special colours.

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

// Tuned for legibility on #050a05, not strict 5250 hardware RGB.
export const COLOR_CSS = {
    GRN: '#33ff33',
    WHT: '#e8e8e8',
    RED: '#ff5555',
    TRQ: '#33dddd',
    YLW: '#ffdd33',
    PNK: '#ff77cc',
    BLU: '#5599ff',
};

export const DEFAULT_COLOR = 'GRN';

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
