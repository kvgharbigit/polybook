import { Theme } from '@polybook/shared/src/types';

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  header: string;
  headerText: string;
  primary: string;
  success: string;
  error: string;
  shadow: string;
}

export interface ReadingTheme {
  name: string;
  colors: ThemeColors;
  statusBarStyle: 'light-content' | 'dark-content';
}

const lightTheme: ReadingTheme = {
  name: 'light',
  colors: {
    background: '#ffffff',
    surface: '#f8f9fa',
    text: '#2c3e50',
    textSecondary: '#7f8c8d',
    border: '#e9ecef',
    header: '#ffffff',
    headerText: '#2c3e50',
    primary: '#3498db',
    success: '#27ae60',
    error: '#e74c3c',
    shadow: '#000000',
  },
  statusBarStyle: 'dark-content',
};

const darkTheme: ReadingTheme = {
  name: 'dark',
  colors: {
    background: '#1a1a1a',
    surface: '#2d2d2d',
    text: '#e8e8e8',
    textSecondary: '#a0a0a0',
    border: '#404040',
    header: '#1a1a1a',
    headerText: '#e8e8e8',
    primary: '#4a9eff',
    success: '#2ecc71',
    error: '#e74c3c',
    shadow: '#000000',
  },
  statusBarStyle: 'light-content',
};

const sepiaTheme: ReadingTheme = {
  name: 'sepia',
  colors: {
    background: '#f7f3e8',
    surface: '#f0ead6',
    text: '#5d4e37',
    textSecondary: '#8b7355',
    border: '#d9cdb3',
    header: '#f7f3e8',
    headerText: '#5d4e37',
    primary: '#8b4513',
    success: '#6b8e23',
    error: '#cd853f',
    shadow: '#000000',
  },
  statusBarStyle: 'dark-content',
};

export const themes: Record<Theme, ReadingTheme> = {
  light: lightTheme,
  dark: darkTheme,
  sepia: sepiaTheme,
};

export class ThemeService {
  private static instance: ThemeService;
  private currentTheme: Theme = 'light';
  private listeners: Array<(theme: ReadingTheme) => void> = [];

  static getInstance(): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService();
    }
    return ThemeService.instance;
  }

  private constructor() {
    this.loadTheme();
  }

  /**
   * Load theme from storage
   */
  private async loadTheme(): Promise<void> {
    try {
      // For now, we'll use a simple approach - later integrate with user settings
      this.currentTheme = 'light';
      this.notifyListeners();
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  }

  /**
   * Set current theme
   */
  setTheme(theme: Theme): void {
    this.currentTheme = theme;
    this.notifyListeners();
    // TODO: Save to user settings
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): ReadingTheme {
    return themes[this.currentTheme];
  }

  /**
   * Get current theme name
   */
  getCurrentThemeName(): Theme {
    return this.currentTheme;
  }

  /**
   * Subscribe to theme changes
   */
  subscribe(listener: (theme: ReadingTheme) => void): () => void {
    this.listeners.push(listener);
    // Call listener immediately with current theme
    listener(this.getCurrentTheme());
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of theme change
   */
  private notifyListeners(): void {
    const currentTheme = this.getCurrentTheme();
    this.listeners.forEach(listener => listener(currentTheme));
  }

  /**
   * Get all available themes
   */
  getAvailableThemes(): ReadingTheme[] {
    return Object.values(themes);
  }

  /**
   * Get theme-aware styles for common components
   */
  getThemedStyles() {
    const theme = this.getCurrentTheme();
    
    return {
      container: {
        backgroundColor: theme.colors.background,
      },
      surface: {
        backgroundColor: theme.colors.surface,
      },
      text: {
        color: theme.colors.text,
      },
      textSecondary: {
        color: theme.colors.textSecondary,
      },
      border: {
        borderColor: theme.colors.border,
      },
      header: {
        backgroundColor: theme.colors.header,
      },
      headerText: {
        color: theme.colors.headerText,
      },
      shadow: {
        shadowColor: theme.colors.shadow,
      },
    };
  }
}

// Export singleton instance
export const themeService = ThemeService.getInstance();
export default themeService;