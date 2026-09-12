// src/context/ThemeContext.js
// Holds the active palette and persists the choice. Both themes expose the
// same token names, so screens read `COLORS.x` and never branch on the theme.
import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from 'react';
import { THEMES, THEME_ORDER, DEFAULT_THEME, getShadows } from '../theme';
import * as Storage from '../services/StorageService';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(DEFAULT_THEME);
  const restored = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await Storage.getTheme();
        if (saved && THEMES[saved]) setThemeName(saved);
      } catch (e) {
        // Keep the default palette.
      } finally {
        restored.current = true;
      }
    })();
  }, []);

  // Don't write on the first render — that would overwrite the stored value
  // with the default before it has been read back.
  useEffect(() => {
    if (!restored.current) return;
    Storage.saveTheme(themeName);
  }, [themeName]);

  const value = useMemo(() => {
    const COLORS = THEMES[themeName] || THEMES[DEFAULT_THEME];
    return {
      COLORS,
      SHADOWS: getShadows(COLORS),
      themeName,
      themes: THEME_ORDER,
      setTheme: (name) => {
        if (THEMES[name]) setThemeName(name);
      },
      toggleTheme: () =>
        setThemeName((prev) => {
          const i = THEME_ORDER.indexOf(prev);
          return THEME_ORDER[(i + 1) % THEME_ORDER.length];
        }),
    };
  }, [themeName]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
