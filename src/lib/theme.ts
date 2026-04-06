'use client';

import { createTheme } from '@mui/material/styles';
import { Outfit } from 'next/font/google';

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
});

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1', // Indigo 500
      light: '#818cf8',
      dark: '#4f46e5',
    },
    secondary: {
      main: '#f97316', // Orange 500 (used for AWS)
    },
    background: {
      default: '#09090b', // Zinc 950
      paper: '#18181b',   // Zinc 900
    },
    divider: 'rgba(255, 255, 255, 0.08)',
    text: {
      primary: '#fafafa',
      secondary: '#a1a1aa',
    },
  },
  typography: {
    fontFamily: outfit.style.fontFamily,
    h1: { fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontSize: '1.5rem', fontWeight: 700 },
    subtitle1: { fontSize: '1rem', fontWeight: 500, color: '#a1a1aa' },
    body1: { fontSize: '0.875rem', lineHeight: 1.6 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          padding: '8px 24px',
          transition: 'all 0.2s ease-in-out',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)',
          '&:hover': {
            background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
            transform: 'translateY(-1px)',
            boxShadow: '0 6px 20px rgba(99, 102, 241, 0.23)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#09090b',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'none',
          '&.MuiPaper-elevation1': {
             backgroundColor: 'rgba(24, 24, 27, 0.4)',
             backdropFilter: 'blur(12px)',
          }
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.2)',
            },
          },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            borderBottom: '2px solid rgba(255, 255, 255, 0.05)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: '0.65rem',
            fontWeight: 800,
            color: 'rgba(255, 255, 255, 0.4)',
          }
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
          padding: '16px',
        }
      }
    }
  },
});

export default theme;
