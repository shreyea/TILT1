import { Dimensions } from 'react-native';

export const THEMES = {
  Dusk: {
    // Dusk Mode (Abyssal Teal)
    background: '#011218',
    surface: '#042029',
    surfaceLight: '#07303A',
    surfaceElevated: '#0A404D',
    
    primary: '#A855F7',       // Prism Orchid
    primaryLight: '#C084FC',
    primaryDark: '#7E22CE',
    
    secondary: '#4A7A8C',     // Steely Cyan
    secondaryDark: '#385F6E',
    
    gradientStart: '#A855F7',
    gradientMid: '#042029',
    gradientEnd: '#4A7A8C',
    
    textPrimary: '#F1F5F9',   // Arctic White
    textSecondary: '#64748B', // Deep Fog Gray
    textMuted: '#475569',
    
    error: '#EF4444',
    success: '#4A7A8C',
    warning: '#F59E0B',
    liked: '#A855F7',
    
    playerBackground: '#011A24',
    seekBarTrack: '#042029',
    seekBarFill: '#A855F7',
    
    cardBorder: 'rgba(168, 85, 247, 0.1)',
    cardGlow: 'rgba(168, 85, 247, 0.05)',
    
    overlay: 'rgba(1, 18, 24, 0.7)',
    overlayLight: 'rgba(1, 18, 24, 0.4)',
  },
  Dawn: {
    // Dawn Mode (Velvet Dawn)
    background: '#F9F0F0',    // Matte Blush
    surface: '#F2E3E3',       // Soft Clay
    surfaceLight: '#E8D3D3',
    surfaceElevated: '#DCC3C3',
    
    primary: '#B34E6B',       // Deep Berry Pink
    primaryLight: '#D27891',
    primaryDark: '#8F3550',
    
    secondary: '#D4A5B1',     // Dusty Rose
    secondaryDark: '#B88290',
    
    gradientStart: '#B34E6B',
    gradientMid: '#F2E3E3',
    gradientEnd: '#D4A5B1',
    
    textPrimary: '#2D1E22',   // Charcoal Rose
    textSecondary: '#8A767A', // Warm Ash
    textMuted: '#A69296',
    
    error: '#DC2626',
    success: '#D4A5B1',
    warning: '#D97706',
    liked: '#B34E6B',
    
    playerBackground: '#F4E8E8',
    seekBarTrack: '#E8D3D3',
    seekBarFill: '#B34E6B',
    
    cardBorder: 'rgba(179, 78, 107, 0.1)',
    cardGlow: 'rgba(179, 78, 107, 0.05)',
    
    overlay: 'rgba(249, 240, 240, 0.7)',
    overlayLight: 'rgba(249, 240, 240, 0.4)',
  },
  Teal: {
    // Teal Mode
    background: '#022A36',
    surface: '#0B3C48',
    surfaceLight: '#114B5A',
    surfaceElevated: '#175E70',
    
    primary: '#E2B13C',       // Accent: Liquid Gold
    primaryLight: '#E8C56B',
    primaryDark: '#B88A22',
    
    secondary: '#87A8A4',     // Subtle Accent: Soft Sage
    secondaryDark: '#6D8F8A',
    
    gradientStart: '#0B3C48',
    gradientMid: '#022A36',
    gradientEnd: '#87A8A4',
    
    textPrimary: '#EAEFF0',   // Crisp Off-White
    textSecondary: '#7E9398', // Ghost Gray
    textMuted: '#5C7479',
    
    error: '#EF4444',
    success: '#87A8A4',
    warning: '#F59E0B',
    liked: '#E2B13C',
    
    playerBackground: '#02212B',
    seekBarTrack: '#0B3C48',
    seekBarFill: '#E2B13C',
    
    cardBorder: 'rgba(135, 168, 164, 0.1)',
    cardGlow: 'rgba(226, 177, 60, 0.05)',
    
    overlay: 'rgba(2, 42, 54, 0.7)',
    overlayLight: 'rgba(2, 42, 54, 0.4)',
  }
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const FONT_SIZE = { xs: 10, sm: 12, md: 14, lg: 16, xl: 18, xxl: 22, xxxl: 28, title: 34 };
export const BORDER_RADIUS = { sm: 6, md: 10, lg: 14, xl: 18, xxl: 24, full: 999 };

export const getShadows = (COLORS) => ({
  card: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  player: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  button: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
});
