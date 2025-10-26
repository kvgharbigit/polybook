import { useState, useEffect } from 'react';
import { themeService, ReadingTheme } from '../services/themeService';
import { Theme } from '@polybook/shared/src/types';

export interface UseThemeReturn {
  theme: ReadingTheme;
  currentThemeName: Theme;
  setTheme: (theme: Theme) => void;
  availableThemes: ReadingTheme[];
  themedStyles: ReturnType<typeof themeService.getThemedStyles>;
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<ReadingTheme>(themeService.getCurrentTheme());

  useEffect(() => {
    const unsubscribe = themeService.subscribe((newTheme) => {
      setThemeState(newTheme);
    });

    return unsubscribe;
  }, []);

  const setTheme = (newTheme: Theme) => {
    themeService.setTheme(newTheme);
  };

  return {
    theme,
    currentThemeName: themeService.getCurrentThemeName(),
    setTheme,
    availableThemes: themeService.getAvailableThemes(),
    themedStyles: themeService.getThemedStyles(),
  };
}