import { useState, useEffect, useMemo } from 'react';
import { fontService, FontSettings, FontPreset, FONT_PRESETS } from '../services/fontService';

export interface UseFontReturn {
  settings: FontSettings;
  presets: FontPreset[];
  currentPreset: FontPreset | null;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
  setWordSpacing: (spacing: number) => void;
  setParagraphSpacing: (spacing: number) => void;
  applyPreset: (preset: FontPreset) => void;
  resetToDefaults: () => void;
  textStyles: ReturnType<typeof fontService.getTextStyles>;
  paragraphStyles: ReturnType<typeof fontService.getParagraphStyles>;
  isWordTappingEnabled: boolean;
}

export function useFont(): UseFontReturn {
  const [settings, setSettings] = useState<FontSettings>(fontService.getCurrentSettings());

  useEffect(() => {
    const unsubscribe = fontService.subscribe((newSettings) => {
      setSettings(newSettings);
    });

    return unsubscribe;
  }, []);

  // Memoize text styles to prevent unnecessary re-renders
  const textStyles = useMemo(() => {
    console.log('📝 useFont: textStyles recalculating', {
      fontSize: settings.fontSize,
      lineHeight: settings.lineHeight,
      wordSpacing: settings.wordSpacing
    });
    const start = performance.now();
    const styles = fontService.getTextStyles();
    const duration = performance.now() - start;
    console.log(`📝 useFont: textStyles calc took ${duration.toFixed(2)}ms`, styles);
    return styles;
  }, [settings.fontSize, settings.lineHeight, settings.wordSpacing]);

  // Memoize paragraph styles to prevent unnecessary re-renders  
  const paragraphStyles = useMemo(() => {
    console.log('📝 useFont: paragraphStyles recalculating', {
      paragraphSpacing: settings.paragraphSpacing
    });
    const start = performance.now();
    const styles = fontService.getParagraphStyles();
    const duration = performance.now() - start;
    console.log(`📝 useFont: paragraphStyles calc took ${duration.toFixed(2)}ms`, styles);
    return styles;
  }, [settings.paragraphSpacing]);

  return {
    settings,
    presets: FONT_PRESETS,
    currentPreset: fontService.getCurrentPreset(),
    increaseFontSize: () => fontService.increaseFontSize(),
    decreaseFontSize: () => fontService.decreaseFontSize(),
    setFontSize: (size: number) => fontService.setFontSize(size),
    setLineHeight: (height: number) => fontService.setLineHeight(height),
    setWordSpacing: (spacing: number) => fontService.setWordSpacing(spacing),
    setParagraphSpacing: (spacing: number) => fontService.setParagraphSpacing(spacing),
    applyPreset: (preset: FontPreset) => fontService.applyPreset(preset),
    resetToDefaults: () => fontService.resetToDefaults(),
    textStyles,
    paragraphStyles,
    isWordTappingEnabled: fontService.isWordTappingAvailable(),
  };
}