import { 
  BilingualWordDefinition, 
  UserLanguageProfile, 
  DictionaryLookupRequest, 
  DictionaryLookupResponse 
} from '@polybook/shared/src/types';

// Wiktextract entry structure (matches our build script output)
interface WiktextractEntry {
  id: string;
  headword: string;
  displayHeadword: string;
  sourceLang: string;
  targetLang: string;
  pos: string;
  translations: string[];
  definitions: string[];
  examples: string[];
  synonyms: string[];
  pairCode: string;
  frequency: number;
  etymology?: string;
}

interface WiktextractData {
  metadata: {
    version: string;
    generatedAt: string;
    totalEntries: number;
    languagePairs: string[];
    source: string;
    originalSources: string;
    coverage: {
      spanish_entries: number;
      english_translations: number;
    };
  };
  entries: WiktextractEntry[];
}

/**
 * Wiktextract Dictionary Service
 * 
 * Provides offline dictionary lookup using Wiktextract data (857K+ entries)
 * Supports rich linguistic information: definitions, etymology, synonyms, examples
 */
export class WiktextractService {
  private static dictionaryData: WiktextractData | null = null;
  private static indexByHeadword: Map<string, WiktextractEntry[]> = new Map();
  private static indexByLang: Map<string, WiktextractEntry[]> = new Map();
  private static initialized = false;

  /**
   * Initialize the Wiktextract service
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('📚 WiktextractService: Initializing...');
      
      // Load Wiktextract data
      await this.loadWiktextractData();
      
      // Build search indices
      this.buildIndices();
      
      this.initialized = true;
      console.log(`📚 WiktextractService: Initialized with ${this.dictionaryData?.metadata.totalEntries || 0} entries`);
      
    } catch (error) {
      console.error('📚 WiktextractService: Initialization error:', error);
      
      // Fallback to basic data for development
      this.dictionaryData = this.createFallbackData();
      this.buildIndices();
      this.initialized = true;
      
      console.log('📚 WiktextractService: Using fallback data (run build script for full dictionary)');
    }
  }

  /**
   * Look up a word using Wiktextract data
   */
  static async lookupWord(request: DictionaryLookupRequest): Promise<DictionaryLookupResponse> {
    try {
      await this.initialize();

      const { word, userProfile } = request;
      const normalizedWord = this.normalizeWord(word);
      
      console.log(`📚 WiktextractService: Looking up "${word}" (normalized: "${normalizedWord}") for ${userProfile.nativeLanguage} user`);

      // Find matching entries based on user's language configuration
      const entries = this.findEntries(normalizedWord, userProfile);
      
      if (entries.length === 0) {
        // Try cross-language lookup if word is not in user's native language
        return await this.attemptCrossLanguageLookup(word, normalizedWord, userProfile);
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
      console.error(`📚 WiktextractService: Lookup error for "${request.word}":`, error);
      
      return {
        success: false,
        word: request.word,
        sourceLanguage: 'unknown',
        error: `Lookup failed: ${error}`
      };
    }
  }

  /**
   * Load Wiktextract data from bundled JSON
   */
  private static async loadWiktextractData(): Promise<void> {
    try {
      // Try to load the built dictionary data (default Spanish-English pack)
      const wiktextractData = await import('../assets/dictionaries/wiktextract-es-en.json').then(m => m.default) as WiktextractData;
      this.dictionaryData = wiktextractData;
      
      console.log(`📚 WiktextractService: Loaded ${wiktextractData.metadata.totalEntries} entries from Wiktextract`);
      console.log(`📚 WiktextractService: Coverage - ${wiktextractData.metadata.coverage.spanish_entries} Spanish entries`);
      
    } catch (error) {
      console.log('📚 WiktextractService: No built dictionary found, using fallback');
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

      // Index by language
      const langKey = entry.sourceLang;
      if (!this.indexByLang.has(langKey)) {
        this.indexByLang.set(langKey, []);
      }
      this.indexByLang.get(langKey)!.push(entry);
    }

    console.log(`📚 WiktextractService: Built indices for ${this.indexByHeadword.size} unique headwords`);
  }

  /**
   * Find entries for a word based on user's language profile
   */
  private static findEntries(normalizedWord: string, userProfile: UserLanguageProfile): WiktextractEntry[] {
    const entries: WiktextractEntry[] = [];

    // Direct headword match
    const directMatches = this.indexByHeadword.get(normalizedWord) || [];
    
    // Filter by user's language preferences
    for (const entry of directMatches) {
      const isRelevant = this.isEntryRelevant(entry, userProfile);
      if (isRelevant) {
        entries.push(entry);
      }
    }

    // Sort by frequency (higher first) and part of speech preference
    entries.sort((a, b) => {
      // Prefer common parts of speech (noun, verb, adj)
      const posOrder = { 'noun': 3, 'verb': 2, 'adj': 1 };
      const aPos = posOrder[a.pos as keyof typeof posOrder] || 0;
      const bPos = posOrder[b.pos as keyof typeof posOrder] || 0;
      
      if (aPos !== bPos) {
        return bPos - aPos;
      }
      
      // Then by frequency
      return b.frequency - a.frequency;
    });

    return entries;
  }

  /**
   * Check if an entry is relevant for the user's language profile
   */
  private static isEntryRelevant(entry: WiktextractEntry, userProfile: UserLanguageProfile): boolean {
    const { nativeLanguage } = userProfile;
    
    // For Spanish users: show Spanish entries (Spanish definitions for Spanish words)
    // For English users: show English entries (English definitions for English words)
    // Currently we only have Spanish entries, so only relevant for Spanish users
    return entry.sourceLang === nativeLanguage;
  }

  /**
   * Convert Wiktextract entry to our BilingualWordDefinition format
   */
  private static convertToDefinition(entry: WiktextractEntry, userProfile: UserLanguageProfile): BilingualWordDefinition {    
    return {
      word: entry.displayHeadword,
      language: entry.sourceLang,
      
      // For now, use definitions as "translations" until we implement cross-language lookup
      translations: entry.definitions.slice(0, 3).map(definition => ({
        word: definition,
        language: entry.sourceLang,
        confidence: 0.95,
        frequency: this.estimateTranslationFrequency(definition)
      })),
      
      definitions: entry.definitions.map(definition => ({
        partOfSpeech: entry.pos,
        definition,
        definitionLanguage: entry.sourceLang,
        example: entry.examples[0], // Use first example if available
        synonyms: entry.synonyms.slice(0, 3) // Limit synonyms
      })),
      
      frequency: entry.frequency,
      difficulty: this.estimateDifficulty(entry.frequency),
      
      etymology: entry.etymology ? {
        text: entry.etymology,
        language: entry.sourceLang
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
  private static createFallbackData(): WiktextractData {
    const fallbackEntries: WiktextractEntry[] = [
      {
        id: 'casa_es',
        headword: 'casa',
        displayHeadword: 'casa',
        sourceLang: 'es',
        targetLang: 'en',
        pos: 'noun',
        translations: [],
        definitions: ['Edificio para habitar', 'Lugar donde uno vive'],
        examples: ['Voy a casa', 'Mi casa es tu casa'],
        synonyms: ['hogar', 'vivienda'],
        pairCode: 'es-en',
        frequency: 8000,
        etymology: 'Del latín casa'
      },
      {
        id: 'lugar_es',
        headword: 'lugar',
        displayHeadword: 'lugar',
        sourceLang: 'es',
        targetLang: 'en',
        pos: 'noun',
        translations: [],
        definitions: ['Porción de espacio', 'Sitio o paraje'],
        examples: ['un lugar hermoso', 'en primer lugar'],
        synonyms: ['sitio', 'ubicación'],
        pairCode: 'es-en',
        frequency: 6000,
        etymology: 'Del latín locus'
      },
      {
        id: 'book_en',
        headword: 'book',
        displayHeadword: 'book',
        sourceLang: 'en',
        targetLang: 'es',
        pos: 'noun',
        translations: [],
        definitions: ['A written or printed work consisting of pages'],
        examples: ['I read a book', 'This book is interesting'],
        synonyms: ['volume', 'text'],
        pairCode: 'en-es',
        frequency: 7000
      }
    ];

    return {
      metadata: {
        version: '1.0.0-fallback',
        generatedAt: new Date().toISOString(),
        totalEntries: fallbackEntries.length,
        languagePairs: ['es-en', 'en-es'],
        source: 'Fallback data for development',
        originalSources: 'Development data',
        coverage: {
          spanish_entries: 2,
          english_translations: 0
        }
      },
      entries: fallbackEntries
    };
  }

  /**
   * Attempt cross-language lookup using ML Kit translation + native dictionary
   * 
   * For Spanish speaker reading English book:
   * 1. Translate English word to Spanish 
   * 2. Get English synonyms from source
   * 3. Get Spanish synonyms from Spanish dictionary
   * 4. Get English etymology
   */
  private static async attemptCrossLanguageLookup(
    originalWord: string, 
    normalizedWord: string, 
    userProfile: UserLanguageProfile
  ): Promise<DictionaryLookupResponse> {
    try {
      console.log(`📚 WiktextractService: Cross-language lookup for "${originalWord}" (${userProfile.nativeLanguage} speaker)`);
      
      // TODO: Implement this complete flow:
      
      // 1. ML Kit: Translate English word to Spanish
      // const spanishTranslation = await MLKitTranslate(originalWord, 'en', 'es');
      
      // 2. Look up Spanish translation in Spanish dictionary for Spanish synonyms
      // const spanishEntry = await this.findEntries(spanishTranslation, userProfile);
      
      // 3. TODO: Get English synonyms + etymology from English source
      // This requires the filtered English extraction we discussed
      
      // For now, return structured placeholder showing what we'll provide
      return {
        success: false,
        word: originalWord,
        sourceLanguage: 'en',
        error: `Cross-language lookup coming soon! Will provide:
• Spanish translation of "${originalWord}"
• English synonyms (home, dwelling, etc.)  
• Spanish synonyms (hogar, vivienda, etc.)
• English etymology and definition`,
        suggestions: this.getSuggestions(normalizedWord),
        // This will be the actual structure:
        futureFormat: {
          primaryTranslation: "casa", // ML Kit
          englishSynonyms: ["home", "dwelling", "residence"], // English dictionary
          spanishSynonyms: ["hogar", "vivienda", "domicilio"], // Spanish dictionary  
          englishEtymology: "From Old English hūs", // English dictionary
          englishDefinition: "A building for human habitation" // English dictionary
        }
      };
      
    } catch (error) {
      console.error(`📚 WiktextractService: Cross-language lookup failed:`, error);
      return {
        success: false,
        word: originalWord,
        sourceLanguage: 'unknown',
        error: `Translation lookup failed: ${error}`,
        suggestions: []
      };
    }
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

export default WiktextractService;