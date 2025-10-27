import { 
  BilingualWordDefinition, 
  UserLanguageProfile, 
  DictionaryLookupRequest, 
  DictionaryLookupResponse 
} from '@polybook/shared/src/types';
import SQLiteDictionaryService from './sqliteDictionaryService';

/**
 * Dictionary Service
 * 
 * Provides dictionary lookup with translations to user's home language
 * Example: Spanish user reading English book gets Spanish translations
 */
export class DictionaryService {
  private static initialized = false;

  /**
   * Initialize the bilingual dictionary service
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('📚 DictionaryService: Initializing...');
      
      // Initialize SQLite Dictionary service (will use default languages for now)
      await SQLiteDictionaryService.initialize();
      
      this.initialized = true;
      const stats = SQLiteDictionaryService.getStats();
      console.log(`📚 DictionaryService: Initialized with SQLite Dictionaries (${stats.totalEntries} entries, ${stats.languagePairs.join(', ')})`);
    } catch (error) {
      console.error('📚 DictionaryService: Initialization error:', error);
      throw error;
    }
  }

  /**
   * Look up a word with full bilingual support
   */
  static async lookupWord(request: DictionaryLookupRequest): Promise<DictionaryLookupResponse> {
    try {
      console.log(`📚 DictionaryService: Looking up "${request.word}" for ${request.userProfile.nativeLanguage} user`);

      // Ensure service is initialized
      await this.initialize();

      // Use SQLite Dictionary service for lookup
      const response = await SQLiteDictionaryService.lookupWord(request);
      
      // Log the result
      if (response.success) {
        console.log(`📚 DictionaryService: Found definition for "${request.word}" (${response.sourceLanguage})`);
      } else {
        console.log(`📚 DictionaryService: No definition found for "${request.word}"`);
      }

      return response;

    } catch (error) {
      console.error(`📚 DictionaryService: Lookup error for "${request.word}":`, error);
      
      return {
        success: false,
        word: request.word,
        sourceLanguage: request.sourceLanguage || 'unknown',
        error: `Lookup failed: ${error}`
      };
    }
  }

  /**
   * Get statistics about the dictionary
   */
  static getStats(): { totalEntries: number; languagePairs: string[]; version: string } {
    return SQLiteDictionaryService.getStats();
  }


  /**
   * Create default user language profile
   */
  static createDefaultUserProfile(nativeLanguage: string = 'en'): UserLanguageProfile {
    return {
      id: `profile_${Date.now()}`,
      nativeLanguage,
      targetLanguages: nativeLanguage === 'en' ? ['es'] : ['en'],
      preferredDefinitionLanguage: nativeLanguage,
      defaultDictionaryMode: 'both',
      showPronunciation: true,
      showExamples: true,
      showEtymology: false,
      proficiencyLevels: {
        [nativeLanguage === 'en' ? 'es' : 'en']: 'beginner'
      },
      totalLookups: 0,
      languageLookupCounts: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Update user language profile usage statistics
   */
  static updateUserProfileStats(
    profile: UserLanguageProfile, 
    sourceLanguage: string
  ): UserLanguageProfile {
    return {
      ...profile,
      totalLookups: profile.totalLookups + 1,
      languageLookupCounts: {
        ...profile.languageLookupCounts,
        [sourceLanguage]: (profile.languageLookupCounts[sourceLanguage] || 0) + 1
      },
      updatedAt: new Date()
    };
  }
}

export default DictionaryService;