import SQLiteDictionaryService from './sqliteDictionaryService';
import { 
  BilingualWordDefinition, 
  UserLanguageProfile, 
  DictionaryLookupRequest, 
  DictionaryLookupResponse 
} from '@polybook/shared/src/types';
import BergamotTranslationService from './bergamotTranslationService';

// Static English synonyms data (React Native compatible)
const ENGLISH_SYNONYMS: Record<string, string[]> = {
  'house': ['home', 'dwelling', 'residence', 'abode', 'building'],
  'book': ['volume', 'text', 'publication', 'tome', 'manual'],
  'read': ['study', 'peruse', 'examine', 'review', 'browse'],
  'good': ['excellent', 'great', 'fine', 'wonderful', 'nice'],
  'big': ['large', 'huge', 'enormous', 'massive', 'giant'],
  'small': ['little', 'tiny', 'minute', 'petite', 'compact'],
  'happy': ['joyful', 'cheerful', 'glad', 'delighted', 'pleased'],
  'sad': ['unhappy', 'sorrowful', 'melancholy', 'depressed', 'dejected'],
  'beautiful': ['lovely', 'gorgeous', 'stunning', 'attractive', 'pretty'],
  'car': ['automobile', 'vehicle', 'auto', 'motor', 'transport'],
  'food': ['meal', 'cuisine', 'nourishment', 'sustenance', 'fare'],
  'water': ['liquid', 'fluid', 'aqua', 'moisture', 'drink'],
  'love': ['affection', 'adoration', 'devotion', 'passion', 'care'],
  'work': ['job', 'employment', 'labor', 'occupation', 'career'],
  'time': ['moment', 'period', 'duration', 'era', 'interval'],
  'place': ['location', 'spot', 'site', 'position', 'area'],
  'person': ['individual', 'human', 'being', 'character', 'soul'],
  'world': ['earth', 'globe', 'planet', 'universe', 'cosmos'],
  'life': ['existence', 'being', 'living', 'vitality', 'biography'],
  'day': ['date', 'period', 'time', 'daylight', 'hours']
};

// Static English definitions (React Native compatible)
const ENGLISH_DEFINITIONS: Record<string, {pos: string, definition: string, etymology?: string}> = {
  'house': {
    pos: 'noun',
    definition: 'A building for human habitation',
    etymology: 'From Old English hūs'
  },
  'book': {
    pos: 'noun', 
    definition: 'A written or printed work consisting of pages',
    etymology: 'From Old English bōc'
  },
  'read': {
    pos: 'verb',
    definition: 'To look at and comprehend written or printed matter',
    etymology: 'From Old English rǣdan'
  },
  'good': {
    pos: 'adjective',
    definition: 'Having desirable or positive qualities',
    etymology: 'From Old English gōd'
  },
  'love': {
    pos: 'noun',
    definition: 'A strong feeling of affection',
    etymology: 'From Old English lufu'
  },
  'time': {
    pos: 'noun',
    definition: 'The indefinite continued progress of existence',
    etymology: 'From Old English tīma'
  },
  'place': {
    pos: 'noun',
    definition: 'A particular position, point, or area in space',
    etymology: 'From Old French place'
  },
  'water': {
    pos: 'noun',
    definition: 'A colorless, transparent liquid essential for life',
    etymology: 'From Old English wæter'
  },
  'world': {
    pos: 'noun',
    definition: 'The earth and all the people and things on it',
    etymology: 'From Old English woruld'
  },
  'life': {
    pos: 'noun',
    definition: 'The condition that distinguishes living beings',
    etymology: 'From Old English līf'
  }
};

/**
 * Lightweight Dictionary Service
 * 
 * Uses SQLite StarDict dictionaries for consistent offline bilingual lookup
 * Acts as a compatibility layer over SQLiteDictionaryService
 */
export class LightweightDictionaryService {
  private static initialized = false;

  /**
   * Initialize the lightweight dictionary service
   */
  static async initialize(userLanguages?: string[]): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('📚 LightweightDictionaryService: Initializing with SQLite StarDict...');
      
      // Initialize SQLite dictionary service (consistent approach)
      await SQLiteDictionaryService.initialize(userLanguages);
      
      this.initialized = true;
      console.log('📚 LightweightDictionaryService: Initialized with SQLite StarDict dictionaries');
      
    } catch (error) {
      console.error('📚 LightweightDictionaryService: Initialization error:', error);
      this.initialized = true; // Continue with limited functionality
    }
  }

  /**
   * Initialize ML Kit translation models
   */
  private static async initializeMLKit(): Promise<void> {
    try {
      console.log('🤖 Preparing ML Kit Spanish-English translation...');
      
      // Prepare Spanish to English model
      await FastTranslator.prepare({
        source: 'Spanish',
        target: 'English',
        downloadIfNeeded: true
      });

      // Prepare English to Spanish model  
      await FastTranslator.prepare({
        source: 'English',
        target: 'Spanish',
        downloadIfNeeded: true
      });

      this.mlKitReady = true;
      console.log('🤖 ML Kit translation models ready');
      
    } catch (error) {
      console.error('🤖 ML Kit initialization failed:', error);
      // Continue without ML Kit - will show error messages
    }
  }

  /**
   * Look up a word using SQLite StarDict dictionaries (consistent approach)
   */
  static async lookupWord(request: DictionaryLookupRequest): Promise<DictionaryLookupResponse> {
    try {
      await this.initialize();

      console.log(`📚 LightweightDictionaryService: Delegating lookup to SQLiteDictionaryService`);
      
      // Use SQLite service for consistent StarDict approach
      return await SQLiteDictionaryService.lookupWord(request);

    } catch (error) {
      console.error(`📚 Lookup error for "${request.word}":`, error);
      
      return {
        success: false,
        word: request.word,
        sourceLanguage: 'unknown',
        error: `Lookup failed: ${error}`
      };
    }
  }

  /**
   * Detect the language of a word
   */
  private static async detectLanguage(word: string): Promise<string> {
    if (!this.mlKitReady) {
      // Simple heuristic fallback
      return this.simpleLanguageDetection(word);
    }

    try {
      const detectedLang = await FastTranslator.identifyLanguage(word);
      return detectedLang || this.simpleLanguageDetection(word);
    } catch (error) {
      console.log('Language detection failed, using fallback');
      return this.simpleLanguageDetection(word);
    }
  }

  /**
   * Simple language detection fallback
   */
  private static simpleLanguageDetection(word: string): string {
    // Check if word exists in Spanish words dataset
    if (spanishWords[word] || this.hasSpanishCharacteristics(word)) {
      return 'es';
    }
    return 'en'; // Default to English
  }

  /**
   * Check for Spanish word characteristics
   */
  private static hasSpanishCharacteristics(word: string): boolean {
    // Spanish-specific patterns
    const spanishPatterns = /[ñáéíóúü]|^[aeiou]/i;
    const spanishEndings = /(ción|dad|mente|izar)$/i;
    
    return spanishPatterns.test(word) || spanishEndings.test(word);
  }

  /**
   * Cross-language lookup (e.g., Spanish user tapping English word)
   */
  private static async performCrossLanguageLookup(
    word: string, 
    sourceLanguage: string, 
    userProfile: UserLanguageProfile
  ): Promise<DictionaryLookupResponse> {
    
    if (!this.mlKitReady) {
      return {
        success: false,
        word,
        sourceLanguage,
        error: 'ML Kit translation not available. Please ensure offline models are downloaded.'
      };
    }

    try {
      // Step 1: Translate word to user's native language
      const translation = await this.translateWord(word, sourceLanguage, userProfile.nativeLanguage);
      
      // Step 2: Get source language data (English synonyms, etymology, etc.)
      const sourceData = await this.getSourceLanguageData(word, sourceLanguage);
      
      // Step 3: Get target language data (Spanish synonyms, definition, etc.)
      const targetData = await this.getTargetLanguageData(translation, userProfile.nativeLanguage);
      
      // Step 4: Create example sentences
      const examples = await this.generateExamples(word, translation, sourceLanguage, userProfile.nativeLanguage);

      // Step 5: Build rich bilingual definition
      const bilingualDefinition = this.buildBilingualDefinition(
        word, translation, sourceLanguage, userProfile.nativeLanguage,
        sourceData, targetData, examples
      );

      return {
        success: true,
        word,
        sourceLanguage,
        primaryDefinition: bilingualDefinition
      };

    } catch (error) {
      console.error(`Cross-language lookup failed for "${word}":`, error);
      
      return {
        success: false,
        word,
        sourceLanguage,
        error: `Translation lookup failed: ${error}`
      };
    }
  }

  /**
   * Native language lookup (e.g., Spanish user tapping Spanish word)
   */
  private static async performNativeLanguageLookup(
    word: string,
    userProfile: UserLanguageProfile
  ): Promise<DictionaryLookupResponse> {
    
    try {
      const language = userProfile.nativeLanguage;
      
      if (language === 'es') {
        return await this.spanishWordLookup(word);
      } else if (language === 'en') {
        return await this.englishWordLookup(word);
      }
      
      return {
        success: false,
        word,
        sourceLanguage: language,
        error: `Native language lookup not implemented for ${language}`
      };

    } catch (error) {
      return {
        success: false,
        word,
        sourceLanguage: userProfile.nativeLanguage,
        error: `Native lookup failed: ${error}`
      };
    }
  }

  /**
   * Translate word using ML Kit
   */
  private static async translateWord(word: string, fromLang: string, toLang: string): Promise<string> {
    try {
      const langMap: Record<string, string> = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German'
      };

      const sourceLang = langMap[fromLang];
      const targetLang = langMap[toLang];

      if (!sourceLang || !targetLang) {
        throw new Error(`Unsupported language pair: ${fromLang} → ${toLang}`);
      }

      // Ensure models are prepared
      await FastTranslator.prepare({
        source: sourceLang,
        target: targetLang,
        downloadIfNeeded: true
      });

      const translation = await FastTranslator.translate(word);
      return translation || word; // Fallback to original word

    } catch (error) {
      console.error(`Translation failed for "${word}":`, error);
      return word; // Fallback to original word
    }
  }

  /**
   * Get source language data (English synonyms, etymology, etc.)
   */
  private static async getSourceLanguageData(word: string, language: string): Promise<any> {
    if (language === 'en') {
      return await this.getEnglishWordData(word);
    }
    return {}; // TODO: Add other source language support
  }

  /**
   * Get target language data (Spanish synonyms, definition, etc.)
   */
  private static async getTargetLanguageData(word: string, language: string): Promise<any> {
    if (language === 'es') {
      return await this.getSpanishWordData(word);
    }
    return {}; // TODO: Add other target language support
  }

  /**
   * Get English word data using static React Native compatible data
   */
  private static async getEnglishWordData(word: string): Promise<any> {
    try {
      // Get from static data
      const staticData = ENGLISH_DEFINITIONS[word];
      const staticSynonyms = ENGLISH_SYNONYMS[word] || [];
      
      if (staticData) {
        return {
          synonyms: staticSynonyms.slice(0, 6),
          definition: staticData.definition,
          partOfSpeech: staticData.pos,
          etymology: staticData.etymology
        };
      }

      // Fallback for unknown words
      return {
        synonyms: [],
        definition: `Definition for "${word}" (limited static data)`,
        partOfSpeech: 'unknown'
      };

    } catch (error) {
      console.error(`Failed to get English data for "${word}":`, error);
      return {
        synonyms: [],
        definition: `Definition for "${word}"`,
        partOfSpeech: 'unknown'
      };
    }
  }

  /**
   * Get Spanish word data
   */
  private static async getSpanishWordData(word: string): Promise<any> {
    try {
      const wordData = spanishWords[word];
      
      return {
        gender: wordData?.gender || undefined,
        plural: wordData?.plural || undefined,
        definition: `Definición de "${word}"`, // TODO: Add real Spanish definitions
        synonyms: [], // TODO: Add Spanish synonyms
        examples: [`Ejemplo con "${word}"`] // TODO: Add real Spanish examples
      };

    } catch (error) {
      console.error(`Failed to get Spanish data for "${word}":`, error);
      return {
        definition: `Definición de "${word}"`,
        synonyms: [],
        examples: []
      };
    }
  }

  /**
   * Generate example sentences
   */
  private static async generateExamples(
    sourceWord: string, 
    translation: string, 
    sourceLang: string, 
    targetLang: string
  ): Promise<{source: string, target: string}> {
    
    try {
      // Create simple template examples
      const sourceExample = `I use ${sourceWord} every day.`;
      const targetExample = await this.translateWord(sourceExample, sourceLang, targetLang);
      
      return {
        source: sourceExample,
        target: targetExample
      };
      
    } catch (error) {
      return {
        source: `Example with "${sourceWord}"`,
        target: `Ejemplo con "${translation}"`
      };
    }
  }

  /**
   * Build rich bilingual definition
   */
  private static buildBilingualDefinition(
    sourceWord: string,
    translation: string,
    sourceLang: string,
    targetLang: string,
    sourceData: any,
    targetData: any,
    examples: any
  ): BilingualWordDefinition {
    
    return {
      word: sourceWord,
      language: sourceLang,
      
      translations: [{
        word: translation,
        language: targetLang,
        confidence: 0.95,
        frequency: 5000
      }],
      
      definitions: [{
        partOfSpeech: sourceData.partOfSpeech || 'unknown',
        definition: sourceData.definition || `Definition of ${sourceWord}`,
        definitionLanguage: sourceLang,
        example: examples.source,
        synonyms: sourceData.synonyms || []
      }],
      
      frequency: 5000,
      difficulty: 'intermediate',
      
      etymology: sourceData.etymology ? {
        text: sourceData.etymology,
        language: sourceLang
      } : undefined,
      
      crossLanguageData: {
        sourceSynonyms: sourceData.synonyms || [],
        targetSynonyms: targetData.synonyms || [],
        sourceEtymology: sourceData.etymology,
        sourceDefinition: sourceData.definition
      }
    };
  }

  /**
   * Spanish word lookup (native)
   */
  private static async spanishWordLookup(word: string): Promise<DictionaryLookupResponse> {
    const data = await this.getSpanishWordData(word);
    
    const definition: BilingualWordDefinition = {
      word,
      language: 'es',
      translations: [],
      definitions: [{
        partOfSpeech: 'unknown',
        definition: data.definition,
        definitionLanguage: 'es',
        synonyms: data.synonyms
      }],
      frequency: 5000,
      difficulty: 'intermediate'
    };

    return {
      success: true,
      word,
      sourceLanguage: 'es',
      primaryDefinition: definition
    };
  }

  /**
   * English word lookup (native)
   */
  private static async englishWordLookup(word: string): Promise<DictionaryLookupResponse> {
    const data = await this.getEnglishWordData(word);
    
    const definition: BilingualWordDefinition = {
      word,
      language: 'en',
      translations: [],
      definitions: [{
        partOfSpeech: data.partOfSpeech,
        definition: data.definition,
        definitionLanguage: 'en',
        synonyms: data.synonyms
      }],
      frequency: 5000,
      difficulty: 'intermediate'
    };

    return {
      success: true,
      word,
      sourceLanguage: 'en',
      primaryDefinition: definition
    };
  }

  /**
   * Get statistics about the dictionary (delegates to SQLite service)
   */
  static getStats(): { totalEntries: number; languagePairs: string[]; version: string; availableLanguages: string[] } {
    const sqliteStats = SQLiteDictionaryService.getStats();
    return {
      ...sqliteStats,
      version: '1.0.0-lightweight-sqlite'
    };
  }

  /**
   * Check if language is available (delegates to SQLite service)
   */
  static isLanguageAvailable(languageCode: string): boolean {
    return SQLiteDictionaryService.isLanguageAvailable(languageCode);
  }

  /**
   * Get available languages (delegates to SQLite service)
   */
  static getAvailableLanguages(): string[] {
    return SQLiteDictionaryService.getAvailableLanguages();
  }
}

export default LightweightDictionaryService;