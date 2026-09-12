// src/theme.js
// Two themes, both dark, both built on the same token names so screens never
// branch on which one is active.
//
//   Teal — deep teal-black ground, warm gold accent.
//   Noir — neutral charcoal ground, moon-white accent.
//
// In each, exactly one accent colour is saturated. Everything gold (Teal) or
// bright white (Noir) reads as "interactive or playing", which is what lets
// the UI drop cards and borders and still stay legible.

const TEAL = {
  key: 'Teal',
  label: 'Teal',

  background: '#010E12',
  surface: '#04191F',
  surfaceLight: '#07262F',
  surfaceElevated: '#0C3441',

  primary: '#E8BE5A',
  primaryLight: '#F3D488',
  primaryDark: '#B98C2C',

  secondary: '#6FA8A3',
  secondaryDark: '#4F8480',

  gradientStart: '#04191F',
  gradientMid: '#010E12',
  gradientEnd: '#6FA8A3',

  textPrimary: '#EFF5F5',
  textSecondary: '#8FA7AB',
  textMuted: '#546B70',

  error: '#E0645C',
  success: '#6FA8A3',
  warning: '#E5A03C',
  liked: '#E8BE5A',

  playerBackground: '#010E12',
  seekBarTrack: 'rgba(255,255,255,0.10)',
  seekBarFill: '#E8BE5A',

  cardBorder: 'rgba(255,255,255,0.07)',
  cardGlow: 'rgba(232,190,90,0.06)',
  divider: 'rgba(255,255,255,0.05)',

  overlay: 'rgba(1,14,18,0.74)',
  overlayLight: 'rgba(1,14,18,0.42)',

  // Backdrop wash behind blurred artwork.
  scrim: ['rgba(1,14,18,0.55)', 'rgba(1,14,18,0.88)', '#010E12'],
};

const NOIR = {
  key: 'Noir',
  label: 'Noir',

  background: '#08090A',
  surface: '#121315',
  surfaceLight: '#1A1B1E',
  surfaceElevated: '#232428',

  // Moon white carries the accent role here — no hue, just light.
  primary: '#EFECE4',
  primaryLight: '#FFFFFF',
  primaryDark: '#BFBBB2',

  secondary: '#8A8A93',
  secondaryDark: '#66666E',

  gradientStart: '#121315',
  gradientMid: '#08090A',
  gradientEnd: '#8A8A93',

  textPrimary: '#F4F3EF',
  textSecondary: '#9A9AA3',
  textMuted: '#5C5C64',

  error: '#D9645C',
  success: '#A8A8B0',
  warning: '#D8B26A',
  liked: '#EFECE4',

  playerBackground: '#08090A',
  seekBarTrack: 'rgba(255,255,255,0.12)',
  seekBarFill: '#EFECE4',

  cardBorder: 'rgba(255,255,255,0.08)',
  cardGlow: 'rgba(239,236,228,0.05)',
  divider: 'rgba(255,255,255,0.06)',

  overlay: 'rgba(8,9,10,0.76)',
  overlayLight: 'rgba(8,9,10,0.44)',

  scrim: ['rgba(8,9,10,0.55)', 'rgba(8,9,10,0.88)', '#08090A'],
};

export const THEMES = { Teal: TEAL, Noir: NOIR };
export const THEME_ORDER = ['Teal', 'Noir'];
export const DEFAULT_THEME = 'Teal';

// Default palette for the few places that render before the provider mounts.
export const COLORS = TEAL;

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const FONT_SIZE = { xs: 10, sm: 12, md: 14, lg: 16, xl: 18, xxl: 22, xxxl: 28, title: 34 };
export const BORDER_RADIUS = { sm: 6, md: 10, lg: 14, xl: 18, xxl: 24, full: 999 };

// Shadows lift the few things that genuinely float (the play button, the mini
// player) — not every list row.
export const getShadows = (palette = COLORS) => ({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 6,
  },
  player: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.42,
    shadowRadius: 24,
    elevation: 20,
  },
  button: {
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
});

export const SHADOWS = getShadows(COLORS);
