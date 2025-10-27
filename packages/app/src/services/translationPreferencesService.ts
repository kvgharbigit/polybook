import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TranslationPreferences {
  // Primary translation behavior
  primaryTranslationMode: 'word' | 'sentence' | 'both';
  
  // Tap behavior
  singleTapAction: 'word' | 'sentence' | 'both' | 'smart';
  doubleTapAction: 'word' | 'sentence' | 'both' | 'disabled';
  longPressAction: 'word' | 'sentence' | 'both' | 'disabled';
  
  // Display preferences
  showWordTranslation: boolean;
  showSentenceTranslation: boolean;
  showDefinitions: boolean;
  showPronunciation: boolean;
  showExamples: boolean;
  
  // Smart behavior settings
  smartDetection: boolean; // Auto-detect whether to translate word or sentence
  fallbackToSentence: boolean; // If word translation fails, try sentence
  fallbackToWord: boolean; // If sentence translation fails, try word
  
  // UI preferences
  popupPosition: 'auto' | 'above' | 'below' | 'center';
  popupSize: 'compact' | 'normal' | 'large';
  showTransliterations: boolean;
  showLanguageDetection: boolean;
  
  // Animation preferences
  enableAnimations: boolean;
  animationDuration: number;
  
  // Translation service preferences
  preferOffline: boolean; // Prefer offline translation when available
  enableOfflineOnly: boolean; // Only use offline translation
  enableFallbackServices: boolean; // Use fallback services if primary fails
  
  // Context preferences
  includeContext: boolean; // Include surrounding text for better translation
  contextLength: number; // Number of words to include as context
  
  // Auto-features
  autoSelectLanguage: boolean; // Auto-detect source language
  autoTranslateOnSelection: boolean; // Translate immediately on text selection
  
  // Accessibility
  enableVoiceOver: boolean;
  enableHapticFeedback: boolean;
  largeTextMode: boolean;
}

export const DEFAULT_TRANSLATION_PREFERENCES: TranslationPreferences = {
  // Primary behavior
  primaryTranslationMode: 'smart',
  
  // Tap actions
  singleTapAction: 'smart',
  doubleTapAction: 'sentence',
  longPressAction: 'both',
  
  // Display options
  showWordTranslation: true,
  showSentenceTranslation: true,
  showDefinitions: true,
  showPronunciation: true,
  showExamples: false,
  
  // Smart behavior
  smartDetection: true,
  fallbackToSentence: true,
  fallbackToWord: false,
  
  // UI
  popupPosition: 'auto',
  popupSize: 'normal',
  showTransliterations: true,
  showLanguageDetection: true,
  
  // Animations
  enableAnimations: true,
  animationDuration: 300,
  
  // Services
  preferOffline: true,
  enableOfflineOnly: false,
  enableFallbackServices: true,
  
  // Context
  includeContext: true,
  contextLength: 5,
  
  // Auto-features
  autoSelectLanguage: true,
  autoTranslateOnSelection: false,
  
  // Accessibility
  enableVoiceOver: false,
  enableHapticFeedback: true,
  largeTextMode: false
};

export type TranslationAction = 'word' | 'sentence' | 'both' | 'smart' | 'disabled';

export interface TranslationContext {
  selectedText: string;
  fullSentence?: string;
  beforeContext?: string;
  afterContext?: string;
  languagePair: [string, string]; // [source, target]
  position: { x: number; y: number };
  elementType: 'word' | 'sentence' | 'paragraph';
}

/**
 * Translation Preferences Service
 * Manages user customization for translation behavior
 */
export class TranslationPreferencesService {
  private static readonly STORAGE_KEY = 'translation_preferences';
  private static cachedPreferences: TranslationPreferences | null = null;

  /**
   * Get user's translation preferences
   */
  static async getPreferences(): Promise<TranslationPreferences> {
    if (this.cachedPreferences) {
      return this.cachedPreferences;
    }

    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all properties exist
        this.cachedPreferences = { ...DEFAULT_TRANSLATION_PREFERENCES, ...parsed };
        return this.cachedPreferences;
      }
    } catch (error) {
      console.error('TranslationPreferences: Error loading preferences:', error);
    }

    this.cachedPreferences = DEFAULT_TRANSLATION_PREFERENCES;
    return this.cachedPreferences;
  }

  /**
   * Update translation preferences
   */
  static async updatePreferences(updates: Partial<TranslationPreferences>): Promise<TranslationPreferences> {
    try {
      const current = await this.getPreferences();
      const updated = { ...current, ...updates };
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
      this.cachedPreferences = updated;
      
      console.log('TranslationPreferences: Updated preferences:', Object.keys(updates));
      return updated;
    } catch (error) {
      console.error('TranslationPreferences: Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Reset preferences to defaults
   */
  static async resetToDefaults(): Promise<TranslationPreferences> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(DEFAULT_TRANSLATION_PREFERENCES));
      this.cachedPreferences = DEFAULT_TRANSLATION_PREFERENCES;
      return DEFAULT_TRANSLATION_PREFERENCES;
    } catch (error) {
      console.error('TranslationPreferences: Error resetting preferences:', error);
      throw error;
    }
  }

  /**
   * Determine what translation action to take based on user preferences and context
   */
  static async determineTranslationAction(
    gestureType: 'tap' | 'doubleTap' | 'longPress',
    context: TranslationContext
  ): Promise<TranslationAction> {
    const prefs = await this.getPreferences();
    
    let action: TranslationAction;
    
    // Get the configured action for this gesture
    switch (gestureType) {
      case 'tap':
        action = prefs.singleTapAction;
        break;
      case 'doubleTap':
        action = prefs.doubleTapAction;
        break;
      case 'longPress':
        action = prefs.longPressAction;
        break;
      default:
        action = 'smart';
    }

    // Handle smart detection
    if (action === 'smart' && prefs.smartDetection) {
      return this.smartDetectTranslationAction(context, prefs);
    }

    return action;
  }

  /**
   * Smart detection of whether to translate word or sentence
   */
  private static smartDetectTranslationAction(
    context: TranslationContext,
    prefs: TranslationPreferences
  ): TranslationAction {
    const { selectedText, elementType } = context;
    
    // If user selected multiple words, assume they want sentence translation
    if (selectedText.split(' ').length > 1) {
      return 'sentence';
    }
    
    // If the selected text is very short (1-2 characters), prefer word translation
    if (selectedText.length <= 2) {
      return 'word';
    }
    
    // If element type suggests sentence (paragraph), prefer sentence
    if (elementType === 'paragraph' || elementType === 'sentence') {
      return 'sentence';
    }
    
    // For single words, check if it's a complex word that might need sentence context
    if (this.isComplexWord(selectedText)) {
      return prefs.includeContext ? 'both' : 'sentence';
    }
    
    // Default to word translation for simple words
    return 'word';
  }

  /**
   * Check if a word is complex and might benefit from sentence context
   */
  private static isComplexWord(word: string): boolean {
    // Heuristics for complex words that benefit from context
    return (
      word.length > 8 || // Long words
      /[A-Z]/.test(word) || // Contains capitals (proper nouns, acronyms)
      word.includes('-') || // Hyphenated words
      word.includes("'") || // Contractions
      /\d/.test(word) // Contains numbers
    );
  }

  /**
   * Get translation display configuration based on preferences
   */
  static async getDisplayConfig(action: TranslationAction): Promise<{
    showWord: boolean;
    showSentence: boolean;
    showDefinitions: boolean;
    showExamples: boolean;
    showPronunciation: boolean;
  }> {
    const prefs = await this.getPreferences();
    
    let showWord = false;
    let showSentence = false;
    
    switch (action) {
      case 'word':
        showWord = true;
        break;
      case 'sentence':
        showSentence = true;
        break;
      case 'both':
        showWord = true;
        showSentence = true;
        break;
      case 'smart':
        showWord = prefs.showWordTranslation;
        showSentence = prefs.showSentenceTranslation;
        break;
    }

    return {
      showWord: showWord && prefs.showWordTranslation,
      showSentence: showSentence && prefs.showSentenceTranslation,
      showDefinitions: prefs.showDefinitions,
      showExamples: prefs.showExamples,
      showPronunciation: prefs.showPronunciation
    };
  }

  /**
   * Check if offline translation should be used
   */
  static async shouldUseOffline(): Promise<boolean> {
    const prefs = await this.getPreferences();
    return prefs.preferOffline;
  }

  /**
   * Check if offline-only mode is enabled
   */
  static async isOfflineOnly(): Promise<boolean> {
    const prefs = await this.getPreferences();
    return prefs.enableOfflineOnly;
  }

  /**
   * Get context configuration for translation
   */
  static async getContextConfig(): Promise<{
    includeContext: boolean;
    contextLength: number;
  }> {
    const prefs = await this.getPreferences();
    return {
      includeContext: prefs.includeContext,
      contextLength: prefs.contextLength
    };
  }

  /**
   * Get animation preferences
   */
  static async getAnimationConfig(): Promise<{
    enabled: boolean;
    duration: number;
  }> {
    const prefs = await this.getPreferences();
    return {
      enabled: prefs.enableAnimations,
      duration: prefs.animationDuration
    };
  }

  /**
   * Get accessibility preferences
   */
  static async getAccessibilityConfig(): Promise<{
    voiceOver: boolean;
    hapticFeedback: boolean;
    largeText: boolean;
  }> {
    const prefs = await this.getPreferences();
    return {
      voiceOver: prefs.enableVoiceOver,
      hapticFeedback: prefs.enableHapticFeedback,
      largeText: prefs.largeTextMode
    };
  }

  /**
   * Clear cached preferences (useful for testing or forced refresh)
   */
  static clearCache(): void {
    this.cachedPreferences = null;
  }
}