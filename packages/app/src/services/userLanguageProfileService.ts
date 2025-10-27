import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserLanguageProfile } from '@polybook/shared/src/types';

/**
 * User Language Profile Service
 * 
 * Manages user language preferences and learning profiles for personalized dictionary experience
 */
export class UserLanguageProfileService {
  private static readonly PROFILE_KEY = 'user_language_profile';
  private static cachedProfile: UserLanguageProfile | null = null;

  /**
   * Get current user language profile
   */
  static async getUserProfile(): Promise<UserLanguageProfile> {
    try {
      // Return cached profile if available and not stale
      if (this.cachedProfile) {
        const cacheAge = Date.now() - this.cachedProfile.updatedAt.getTime();
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        
        if (cacheAge < CACHE_TTL) {
          return this.cachedProfile;
        } else {
          console.log('🕐 User profile cache expired, reloading from storage');
        }
      }

      // Load from storage
      const stored = await AsyncStorage.getItem(this.PROFILE_KEY);
      
      if (stored) {
        const profile = JSON.parse(stored);
        
        // Convert date strings back to Date objects
        profile.createdAt = new Date(profile.createdAt);
        profile.updatedAt = new Date(profile.updatedAt);
        
        this.cachedProfile = profile;
        return profile;
      }

      // Create default profile if none exists
      const defaultProfile = this.createDefaultProfile();
      await this.saveUserProfile(defaultProfile);
      
      return defaultProfile;

    } catch (error) {
      console.error('UserLanguageProfileService: Error loading profile:', error);
      
      // Return default profile on error
      return this.createDefaultProfile();
    }
  }

  /**
   * Save user language profile
   */
  static async saveUserProfile(profile: UserLanguageProfile): Promise<void> {
    try {
      const updatedProfile = {
        ...profile,
        updatedAt: new Date()
      };

      await AsyncStorage.setItem(this.PROFILE_KEY, JSON.stringify(updatedProfile));
      this.cachedProfile = updatedProfile;
      
      console.log('UserLanguageProfileService: Profile saved successfully');
    } catch (error) {
      console.error('UserLanguageProfileService: Error saving profile:', error);
      throw error;
    }
  }

  /**
   * Update user language preferences
   */
  static async updateLanguagePreferences(updates: Partial<Pick<UserLanguageProfile, 
    'nativeLanguage' | 'targetLanguages' | 'preferredDefinitionLanguage'
  >>): Promise<UserLanguageProfile> {
    const currentProfile = await this.getUserProfile();
    
    const updatedProfile: UserLanguageProfile = {
      ...currentProfile,
      ...updates,
      updatedAt: new Date()
    };

    await this.saveUserProfile(updatedProfile);
    return updatedProfile;
  }

  /**
   * Update dictionary display preferences
   */
  static async updateDictionaryPreferences(updates: Partial<Pick<UserLanguageProfile,
    'defaultDictionaryMode' | 'showPronunciation' | 'showExamples' | 'showEtymology'
  >>): Promise<UserLanguageProfile> {
    const currentProfile = await this.getUserProfile();
    
    const updatedProfile: UserLanguageProfile = {
      ...currentProfile,
      ...updates,
      updatedAt: new Date()
    };

    await this.saveUserProfile(updatedProfile);
    return updatedProfile;
  }

  /**
   * Update proficiency level for a language
   */
  static async updateProficiencyLevel(
    language: string, 
    level: 'beginner' | 'intermediate' | 'advanced'
  ): Promise<UserLanguageProfile> {
    const currentProfile = await this.getUserProfile();
    
    const updatedProfile: UserLanguageProfile = {
      ...currentProfile,
      proficiencyLevels: {
        ...currentProfile.proficiencyLevels,
        [language]: level
      },
      updatedAt: new Date()
    };

    await this.saveUserProfile(updatedProfile);
    return updatedProfile;
  }

  /**
   * Record a dictionary lookup for statistics
   */
  static async recordLookup(sourceLanguage: string): Promise<UserLanguageProfile> {
    const currentProfile = await this.getUserProfile();
    
    const updatedProfile: UserLanguageProfile = {
      ...currentProfile,
      totalLookups: currentProfile.totalLookups + 1,
      languageLookupCounts: {
        ...currentProfile.languageLookupCounts,
        [sourceLanguage]: (currentProfile.languageLookupCounts[sourceLanguage] || 0) + 1
      },
      updatedAt: new Date()
    };

    await this.saveUserProfile(updatedProfile);
    return updatedProfile;
  }

  /**
   * Detect user's preferred language based on device settings
   */
  static detectDeviceLanguage(): string {
    // Try to get device language
    const deviceLanguage = 
      (global as any).navigator?.language || 
      (global as any).navigator?.languages?.[0] || 
      'en';

    // Extract language code (e.g., 'en-US' -> 'en')
    const languageCode = deviceLanguage.split('-')[0].toLowerCase();
    
    // Support common languages, default to English
    const supportedLanguages = ['en', 'es', 'fr', 'de'];
    
    return supportedLanguages.includes(languageCode) ? languageCode : 'en';
  }

  /**
   * Create default user profile based on device language
   */
  private static createDefaultProfile(): UserLanguageProfile {
    const deviceLanguage = this.detectDeviceLanguage();
    
    // Determine target languages based on native language
    const getTargetLanguages = (native: string): string[] => {
      switch (native) {
        case 'es': return ['en']; // Spanish users learn English
        case 'fr': return ['en']; // French users learn English
        case 'de': return ['en']; // German users learn English
        default: return ['es'];   // English users learn Spanish by default
      }
    };

    return {
      id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nativeLanguage: deviceLanguage,
      targetLanguages: getTargetLanguages(deviceLanguage),
      preferredDefinitionLanguage: deviceLanguage,
      defaultDictionaryMode: 'both',
      showPronunciation: true,
      showExamples: true,
      showEtymology: false, // Advanced feature, off by default
      proficiencyLevels: {
        [getTargetLanguages(deviceLanguage)[0]]: 'beginner'
      },
      totalLookups: 0,
      languageLookupCounts: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Get language display name
   */
  static getLanguageDisplayName(languageCode: string, displayInLanguage?: string): string {
    const names: Record<string, Record<string, string>> = {
      en: {
        en: 'English',
        es: 'Spanish',
        fr: 'French',
        de: 'German'
      },
      es: {
        en: 'Inglés',
        es: 'Español',
        fr: 'Francés',
        de: 'Alemán'
      },
      fr: {
        en: 'Anglais',
        es: 'Espagnol',
        fr: 'Français',
        de: 'Allemand'
      }
    };

    const targetLang = displayInLanguage || 'en';
    return names[targetLang]?.[languageCode] || languageCode.toUpperCase();
  }

  /**
   * Get user's reading direction preference
   */
  static async getReadingDirection(): Promise<'ltr' | 'rtl'> {
    const profile = await this.getUserProfile();
    
    // RTL languages
    const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
    
    return rtlLanguages.includes(profile.nativeLanguage) ? 'rtl' : 'ltr';
  }

  /**
   * Check if user is learning a specific language
   */
  static async isLearningLanguage(languageCode: string): Promise<boolean> {
    const profile = await this.getUserProfile();
    return profile.targetLanguages.includes(languageCode);
  }

  /**
   * Get user's proficiency level for a language
   */
  static async getProficiencyLevel(languageCode: string): Promise<'beginner' | 'intermediate' | 'advanced'> {
    const profile = await this.getUserProfile();
    return profile.proficiencyLevels[languageCode] || 'beginner';
  }

  /**
   * Get usage statistics
   */
  static async getUsageStats(): Promise<{
    totalLookups: number;
    languageBreakdown: Array<{ language: string; count: number; percentage: number }>;
    mostLookedUpLanguage: string | null;
  }> {
    const profile = await this.getUserProfile();
    
    const languageBreakdown = Object.entries(profile.languageLookupCounts)
      .map(([language, count]) => ({
        language,
        count,
        percentage: profile.totalLookups > 0 ? (count / profile.totalLookups) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    const mostLookedUpLanguage = languageBreakdown.length > 0 ? languageBreakdown[0].language : null;

    return {
      totalLookups: profile.totalLookups,
      languageBreakdown,
      mostLookedUpLanguage
    };
  }

  /**
   * Reset user profile to defaults
   */
  static async resetProfile(): Promise<UserLanguageProfile> {
    const defaultProfile = this.createDefaultProfile();
    await this.saveUserProfile(defaultProfile);
    return defaultProfile;
  }

  /**
   * Clear cached profile (useful for testing or user logout)
   */
  static clearCache(): void {
    this.cachedProfile = null;
  }
}

export default UserLanguageProfileService;