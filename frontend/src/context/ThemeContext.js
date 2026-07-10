// src/context/ThemeContext.js
// Provides theme colors and toggle. Persists selection via AsyncStorage.
import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from 'react';
import { THEMES, getShadows } from '../theme';
import * as Storage from '../services/StorageService';

const ThemeContext = createContext();

const THEME_CYCLE = ['Teal', 'Dusk', 'Dawn'];

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState('Teal');
  const initializedRef = useRef(false);

  // Restore saved theme on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await Storage.getTheme();
        if (saved && THEMES[saved]) {
          setThemeName(saved);
        }
      } catch (e) {
        console.warn('Failed to restore theme:', e);
      }
      initializedRef.current = true;
    })();
  }, []);

  // Persist theme on change
  useEffect(() => {
    if (!initializedRef.current) return;
    Storage.saveTheme(themeName);
  }, [themeName]);

  const toggleTheme = () => {
    setThemeName((prev) => {
      const idx = THEME_CYCLE.indexOf(prev);
      return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
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
