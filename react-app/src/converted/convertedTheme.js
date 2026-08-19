// MUI theme for the Modern React converted pane.
// Scope this theme to converted output so it cannot change the 5250 faithful UI.

import { createTheme } from '@mui/material/styles';

export const convertedTheme = createTheme({
    palette: {
        primary: {
            main: '#0F3460',
            dark: '#0B2A4D',
            contrastText: '#FFFFFF',
        },
        background: {
            default: '#F7F8FA',
            paper: '#FFFFFF',
        },
        text: {
            primary: '#101828',
            secondary: '#344054',
        },
        divider: '#D9DEE5',
        success: { main: '#16794A' },
        warning: { main: '#A15C00' },
        error: { main: '#B42318' },
    },
    typography: {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: 16,
        h6: { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.25 },
        body1: { fontSize: '1rem', lineHeight: 1.5 },
        body2: { fontSize: '0.875rem', lineHeight: 1.5 },
        caption: { fontSize: '0.75rem', lineHeight: 1.5 },
    },
    shape: {
        borderRadius: 4,
    },
    spacing: 4,
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                '.converted-pane': {
                    fontFamily: 'Inter, Arial, sans-serif',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: { backgroundImage: 'none' },
            },
        },
    },
});
