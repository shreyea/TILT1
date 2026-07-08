import React, { createContext, useContext, useState, useMemo } from 'react';
import { THEMES, getShadows } from '../theme';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState('Teal');

  const toggleTheme = () => {
    setThemeName((prev) => {
      if (prev === 'Teal') return 'Dusk';
      if (prev === 'Dusk') return 'Dawn';
      return 'Teal';
    });
  };

  const COLORS = THEMES[themeName] || THEMES.Teal;
  const SHADOWS = useMemo(() => getShadows(COLORS), [COLORS]);

  return (
    <ThemeContext.Provider value={{ COLORS, SHADOWS, themeName, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
