import { 
  BilingualWordDefinition, 
  UserLanguageProfile, 
  DictionaryLookupRequest, 
  DictionaryLookupResponse 
} from '@polybook/shared/src/types';

// FreeDict entry structure
interface FreeDictEntry {
  id: string;
  headword: string;
  displayHeadword: string;
  sourceLang: string;
  targetLang: string;
  pos: string;
  gender?: string;
  translations: string[];
  definitions: string[];
  examples: string[];
  synonyms: string[];
  pairCode: string;
  frequency: number;
}

interface FreeDictData {
  metadata: {
    version: string;
    generatedAt: string;
    totalEntries: number;
    languagePairs: string[];
    source: string;
  };
  entries: FreeDictEntry[];
}

/**
 * FreeDict Dictionary Service
 * 
 * Provides offline bilingual dictionary lookup using FreeDict data
 * Supports rich linguistic information: POS, gender, synonyms, examples
 */
export class FreeDictService {
  private static dictionaryData: FreeDictData | null = null;
  private static indexByHeadword: Map<string, FreeDictEntry[]> = new Map();
  private static indexByLang: Map<string, FreeDictEntry[]> = new Map();
  private static initialized = false;

  /**
   * Initialize the FreeDict service
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('📚 FreeDictService: Initializing...');
      
      // Load FreeDict data
      await this.loadFreeDictData();
      
      // Build search indices
      this.buildIndices();
      
      this.initialized = true;
      console.log(`📚 FreeDictService: Initialized with ${this.dictionaryData?.metadata.totalEntries || 0} entries`);
      
    } catch (error) {
      console.error('📚 FreeDictService: Initialization error:', error);
      
      // Fallback to basic data for development
      this.dictionaryData = this.createFallbackData();
      this.buildIndices();
      this.initialized = true;
      
      console.log('📚 FreeDictService: Using fallback data (run build script for full dictionary)');
    }
  }

  /**
   * Look up a word using FreeDict data
   */
  static async lookupWord(request: DictionaryLookupRequest): Promise<DictionaryLookupResponse> {
    try {
      await this.initialize();

      const { word, userProfile } = request;
      const normalizedWord = this.normalizeWord(word);
      
      console.log(`📚 FreeDictService: Looking up "${word}" (normalized: "${normalizedWord}") for ${userProfile.nativeLanguage} user`);

      // Find matching entries
      const entries = this.findEntries(normalizedWord, userProfile);
      
      if (entries.length === 0) {
        return {
          success: false,
          word,
          sourceLanguage: 'unknown',
          error: `No definition found for "${word}"`,
          suggestions: this.getSuggestions(normalizedWord)
        };
      }

      // Convert best entry to our format
      const primaryEntry = entries[0];
      const primaryDefinition = this.convertToDefinition(primaryEntry, userProfile);
      
      // Get alternatives
      const alternatives = entries.slice(1, 3).map(entry => 
        this.convertToDefinition(entry, userProfile)
      );

      return {
        success: true,
        word,
        sourceLanguage: primaryEntry.sourceLang,
        primaryDefinition,
        alternatives: alternatives.length > 0 ? alternatives : undefined
      };

    } catch (error) {
      console.error(`📚 FreeDictService: Lookup error for "${request.word}":`, error);
      
      return {
        success: false,
        word: request.word,
        sourceLanguage: 'unknown',
        error: `Lookup failed: ${error}`
      };
    }
  }

  /**
   * Load FreeDict data from bundled JSON
   */
  private static async loadFreeDictData(): Promise<void> {
    try {
      // Try to load the built dictionary data
      const freeDictData = require('../assets/dictionaries/wiktextract-data.json') as FreeDictData;
      this.dictionaryData = freeDictData;
      
      console.log(`📚 FreeDictService: Loaded ${freeDictData.metadata.totalEntries} entries from FreeDict`);
      
    } catch (error) {
      console.log('📚 FreeDictService: No built dictionary found, using fallback');
      throw error;
    }
  }

  /**
   * Build search indices for fast lookup
   */
  private static buildIndices(): void {
    if (!this.dictionaryData) return;

    this.indexByHeadword.clear();
    this.indexByLang.clear();

    for (const entry of this.dictionaryData.entries) {
      // Index by headword
      const normalizedHeadword = this.normalizeWord(entry.headword);
      if (!this.indexByHeadword.has(normalizedHeadword)) {
        this.indexByHeadword.set(normalizedHeadword, []);
      }
      this.indexByHeadword.get(normalizedHeadword)!.push(entry);

      // Index by language pair
      const langKey = `${entry.sourceLang}-${entry.targetLang}`;
      if (!this.indexByLang.has(langKey)) {
        this.indexByLang.set(langKey, []);
      }
      this.indexByLang.get(langKey)!.push(entry);
    }

    console.log(`📚 FreeDictService: Built indices for ${this.indexByHeadword.size} unique headwords`);
  }

  /**
   * Find entries for a word based on user's language profile
   */
  private static findEntries(normalizedWord: string, userProfile: UserLanguageProfile): FreeDictEntry[] {
    const entries: FreeDictEntry[] = [];

    // Direct headword match
    const directMatches = this.indexByHeadword.get(normalizedWord) || [];
    
    // Filter by user's language preferences
    for (const entry of directMatches) {
      const isRelevant = this.isEntryRelevant(entry, userProfile);
      if (isRelevant) {
        entries.push(entry);
      }
    }

    // Sort by frequency (higher first) and relevance
    entries.sort((a, b) => {
      // Prefer entries that translate TO user's native language
      const aToNative = a.targetLang === userProfile.nativeLanguage ? 1 : 0;
      const bToNative = b.targetLang === userProfile.nativeLanguage ? 1 : 0;
      
      if (aToNative !== bToNative) {
        return bToNative - aToNative;
      }
      
      // Then by frequency
      return b.frequency - a.frequency;
    });

    return entries;
  }

  /**
   * Check if an entry is relevant for the user's language profile
   */
  private static isEntryRelevant(entry: FreeDictEntry, userProfile: UserLanguageProfile): boolean {
    const { nativeLanguage, targetLanguages } = userProfile;
    
    // User native language should be either source or target
    // User target languages should be either source or target
    const allUserLanguages = [nativeLanguage, ...targetLanguages];
    
    return allUserLanguages.includes(entry.sourceLang) && 
           allUserLanguages.includes(entry.targetLang);
  }

  /**
   * Convert FreeDict entry to our BilingualWordDefinition format
   */
  private static convertToDefinition(entry: FreeDictEntry, userProfile: UserLanguageProfile): BilingualWordDefinition {
    const isTranslatingToNative = entry.targetLang === userProfile.nativeLanguage;
    
    return {
      word: entry.displayHeadword,
      language: entry.sourceLang,
      
      translations: entry.translations.map(translation => ({
        word: translation,
        language: entry.targetLang,
        confidence: 0.95, // High confidence for FreeDict data
        frequency: this.estimateTranslationFrequency(translation)
      })),
      
      definitions: entry.definitions.map(definition => ({
        partOfSpeech: entry.pos,
        definition,
        definitionLanguage: isTranslatingToNative ? userProfile.nativeLanguage : entry.sourceLang,
        example: entry.examples[0], // Use first example if available
        synonyms: entry.synonyms.slice(0, 3) // Limit synonyms
      })),
      
      frequency: entry.frequency,
      difficulty: this.estimateDifficulty(entry.frequency),
      
      pronunciation: entry.pos === 'noun' && entry.gender ? {
        ipa: `/${entry.displayHeadword}/`, // Placeholder IPA
      } : undefined
    };
  }

  /**
   * Normalize word for consistent lookup
   */
  private static normalizeWord(word: string): string {
    return word.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\w]/g, '') // Remove punctuation
      .trim();
  }

  /**
   * Get word suggestions for failed lookups
   */
  private static getSuggestions(word: string): string[] {
    const suggestions: string[] = [];
    const maxSuggestions = 5;
    
    // Find words with similar start
    for (const [headword] of this.indexByHeadword) {
      if (headword.startsWith(word.substring(0, 3)) && headword !== word) {
        suggestions.push(headword);
        if (suggestions.length >= maxSuggestions) break;
      }
    }
    
    return suggestions;
  }

  /**
   * Estimate difficulty based on frequency
   */
  private static estimateDifficulty(frequency: number): 'beginner' | 'intermediate' | 'advanced' {
    if (frequency >= 5000) return 'beginner';
    if (frequency >= 1000) return 'intermediate';
    return 'advanced';
  }

  /**
   * Estimate translation frequency
   */
  private static estimateTranslationFrequency(translation: string): number {
    if (translation.length <= 4) return 8000;
    if (translation.length <= 6) return 5000;
    return 2000;
  }

  /**
   * Create fallback data for development
   */
  private static createFallbackData(): FreeDictData {
    const fallbackEntries: FreeDictEntry[] = [
      {
        id: 'casa_spa_eng',
        headword: 'casa',
        displayHeadword: 'casa',
        sourceLang: 'es',
        targetLang: 'en',
        pos: 'noun',
        gender: 'f',
        translations: ['house', 'home'],
        definitions: ['A building for human habitation'],
        examples: ['Voy a casa', 'Mi casa es tu casa'],
        synonyms: ['hogar', 'vivienda'],
        pairCode: 'spa-eng',
        frequency: 8000
      },
      {
        id: 'book_eng_spa',
        headword: 'book',
        displayHeadword: 'book',
        sourceLang: 'en',
        targetLang: 'es',
        pos: 'noun',
        translations: ['libro'],
        definitions: ['A written or printed work consisting of pages'],
        examples: ['I read a book', 'This book is interesting'],
        synonyms: ['volume', 'text'],
        pairCode: 'eng-spa',
        frequency: 7000
      },
      {
        id: 'lugar_spa_eng',
        headword: 'lugar',
        displayHeadword: 'lugar',
        sourceLang: 'es',
        targetLang: 'en',
        pos: 'noun',
        gender: 'm',
        translations: ['place', 'location', 'spot'],
        definitions: ['A particular position, point, or area in space'],
        examples: ['un lugar hermoso', 'en primer lugar'],
        synonyms: ['sitio', 'ubicación'],
        pairCode: 'spa-eng',
        frequency: 6000
      }
    ];

    return {
      metadata: {
        version: '1.0.0-fallback',
        generatedAt: new Date().toISOString(),
        totalEntries: fallbackEntries.length,
        languagePairs: ['spa-eng', 'eng-spa'],
        source: 'Fallback data for development'
      },
      entries: fallbackEntries
    };
  }

  /**
   * Get statistics about the loaded dictionary
   */
  static getStats(): { totalEntries: number; languagePairs: string[]; version: string } {
    return {
      totalEntries: this.dictionaryData?.metadata.totalEntries || 0,
      languagePairs: this.dictionaryData?.metadata.languagePairs || [],
      version: this.dictionaryData?.metadata.version || 'unknown'
    };
  }
}

export default FreeDictService;