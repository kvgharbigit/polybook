export interface FontSettings {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  wordSpacing: number;
  paragraphSpacing: number;
}

export interface FontPreset {
  name: string;
  settings: FontSettings;
}

// Default font settings
const DEFAULT_SETTINGS: FontSettings = {
  fontSize: 16,
  lineHeight: 24,
  fontFamily: 'System',
  wordSpacing: 0,
  paragraphSpacing: 16,
};

// Predefined font size presets
export const FONT_PRESETS: FontPreset[] = [
  {
    name: 'Small',
    settings: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: 'System',
      wordSpacing: 0,
      paragraphSpacing: 12,
    },
  },
  {
    name: 'Medium',
    settings: DEFAULT_SETTINGS,
  },
  {
    name: 'Large',
    settings: {
      fontSize: 18,
      lineHeight: 28,
      fontFamily: 'System',
      wordSpacing: 0,
      paragraphSpacing: 20,
    },
  },
  {
    name: 'Extra Large',
    settings: {
      fontSize: 22,
      lineHeight: 32,
      fontFamily: 'System',
      wordSpacing: 0,
      paragraphSpacing: 24,
    },
  },
];

export class FontService {
  private static instance: FontService;
  private currentSettings: FontSettings = DEFAULT_SETTINGS;
  private listeners: Array<(settings: FontSettings) => void> = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 300; // 300ms delay

  static getInstance(): FontService {
    if (!FontService.instance) {
      FontService.instance = new FontService();
    }
    return FontService.instance;
  }

  private constructor() {
    this.loadSettings();
  }

  /**
   * Load font settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      // For now, use defaults - later integrate with user settings storage
      this.currentSettings = DEFAULT_SETTINGS;
      this.notifyListeners();
    } catch (error) {
      console.error('Error loading font settings:', error);
    }
  }

  /**
   * Get current font settings
   */
  getCurrentSettings(): FontSettings {
    return { ...this.currentSettings };
  }

  /**
   * Update font settings with debouncing for performance
   */
  updateSettings(settings: Partial<FontSettings>): void {
    // Update settings immediately for UI responsiveness
    this.currentSettings = {
      ...this.currentSettings,
      ...settings,
    };
    
    // Debounce listener notifications to prevent performance issues
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.notifyListeners();
      this.debounceTimer = null;
    }, this.DEBOUNCE_DELAY);
    
    // TODO: Save to user settings storage
  }

  /**
   * Update settings immediately without debouncing (for presets, etc.)
   */
  updateSettingsImmediate(settings: Partial<FontSettings>): void {
    this.currentSettings = {
      ...this.currentSettings,
      ...settings,
    };
    
    // Clear any pending debounced notification
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    this.notifyListeners();
  }

  /**
   * Set font size
   */
  setFontSize(size: number): void {
    const clampedSize = Math.max(12, Math.min(32, size));
    const lineHeight = clampedSize * 1.5; // Maintain 1.5 line height ratio
    this.updateSettings({
      fontSize: clampedSize,
      lineHeight: lineHeight,
    });
  }

  /**
   * Increase font size
   */
  increaseFontSize(): void {
    this.setFontSize(this.currentSettings.fontSize + 2);
  }

  /**
   * Decrease font size
   */
  decreaseFontSize(): void {
    this.setFontSize(this.currentSettings.fontSize - 2);
  }

  /**
   * Set line height
   */
  setLineHeight(height: number): void {
    const clampedHeight = Math.max(this.currentSettings.fontSize, Math.min(this.currentSettings.fontSize * 2, height));
    this.updateSettings({
      lineHeight: clampedHeight,
    });
  }

  /**
   * Set word spacing
   */
  setWordSpacing(spacing: number): void {
    const clampedSpacing = Math.max(-2, Math.min(4, spacing));
    this.updateSettings({
      wordSpacing: clampedSpacing,
    });
  }

  /**
   * Set paragraph spacing
   */
  setParagraphSpacing(spacing: number): void {
    const clampedSpacing = Math.max(8, Math.min(32, spacing));
    this.updateSettings({
      paragraphSpacing: clampedSpacing,
    });
  }

  /**
   * Apply a preset (immediate, no debouncing)
   */
  applyPreset(preset: FontPreset): void {
    this.updateSettingsImmediate(preset.settings);
  }

  /**
   * Reset to default settings (immediate, no debouncing)
   */
  resetToDefaults(): void {
    this.updateSettingsImmediate(DEFAULT_SETTINGS);
  }

  /**
   * Subscribe to font settings changes
   */
  subscribe(listener: (settings: FontSettings) => void): () => void {
    this.listeners.push(listener);
    // Call listener immediately with current settings
    listener(this.getCurrentSettings());
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Clean up timers (for testing or cleanup)
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.listeners = [];
  }

  /**
   * Notify all listeners of settings change
   */
  private notifyListeners(): void {
    const currentSettings = this.getCurrentSettings();
    this.listeners.forEach(listener => listener(currentSettings));
  }

  /**
   * Get styles for React Native Text component
   */
  getTextStyles() {
    return {
      fontSize: this.currentSettings.fontSize,
      lineHeight: this.currentSettings.lineHeight,
      letterSpacing: this.currentSettings.wordSpacing,
    };
  }

  /**
   * Get styles for paragraph spacing
   */
  getParagraphStyles() {
    return {
      marginBottom: this.currentSettings.paragraphSpacing,
    };
  }

  /**
   * Check if current settings match a preset
   */
  getCurrentPreset(): FontPreset | null {
    for (const preset of FONT_PRESETS) {
      if (
        preset.settings.fontSize === this.currentSettings.fontSize &&
        preset.settings.lineHeight === this.currentSettings.lineHeight
      ) {
        return preset;
      }
    }
    return null;
  }
}

// Export singleton instance
export const fontService = FontService.getInstance();
export default fontService;