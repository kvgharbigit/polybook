import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { 
  BilingualWordDefinition, 
  UserLanguageProfile, 
  DictionaryLookupRequest, 
  DictionaryLookupResponse 
} from '@polybook/shared/src/types';
import { LanguagePackService } from './languagePackService';
import { ErrorHandler, ErrorCode, Validator } from './errorHandling';

/**
 * SQLite Dictionary Service
 * 
 * Implements offline bilingual dictionary using StarDict → SQLite databases
 * Supports consistent lookup across all languages with StarDict bilingual dictionaries
 */
export class SQLiteDictionaryService {
  private static initialized = false;
  private static initializationError: any = null;
  private static initializationPromise: Promise<void> | null = null;
  private static databases: Map<string, any> = new Map();

  /**
   * Initialize the SQLite dictionary service
   */
  static async initialize(userLanguages?: string[]): Promise<void> {
    console.debug('📚 SQLiteDictionaryService: initialize() called with languages:', userLanguages);
    
    if (this.initialized) {
      console.debug('📚 SQLiteDictionaryService: Already initialized, skipping');
      return;
    }

    // Check if initialization is already in progress
    if (this.initializationPromise) {
      console.debug('📚 SQLiteDictionaryService: Initialization in progress, waiting...');
      return this.initializationPromise;
    }

    // Start initialization
    this.initializationPromise = this._doInitialize(userLanguages);
    
    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  private static async _doInitialize(userLanguages?: string[]): Promise<void> {
    try {
      console.log('📚 SQLiteDictionaryService: Starting initialization...');
      
      // Initialize Language Pack Service first
      console.debug('📚 SQLiteDictionaryService: Initializing LanguagePackService...');
      await LanguagePackService.initialize();
      console.log('📚 SQLiteDictionaryService: LanguagePackService initialized successfully');
      
      // Open dictionary databases for user's languages
      if (userLanguages && userLanguages.length > 0) {
        console.log('📚 SQLiteDictionaryService: Opening dictionaries for user languages:', userLanguages);
        await this.openDictionariesForLanguages(userLanguages);
      } else {
        console.log('📚 SQLiteDictionaryService: No user languages provided, using default languages');
        // Fallback to default languages
        await this.openAvailableDictionaries();
      }
      
      this.initialized = true;
      console.log('📚 SQLiteDictionaryService: ✅ Successfully initialized with', this.databases.size, 'databases');
      console.log('📚 SQLiteDictionaryService: Available languages:', Array.from(this.databases.keys()));
      
    } catch (error) {
      console.error('📚 SQLiteDictionaryService: ❌ Initialization failed:', error);
      console.error('📚 SQLiteDictionaryService: Error stack:', error.stack);
      this.initialized = false; // Mark as failed initialization
      this.initializationError = error;
      throw error; // Re-throw to let caller know initialization failed
    }
  }

  /**
   * Initialize or add languages to an already initialized service
   */
  static async ensureLanguagesAvailable(languages: string[]): Promise<void> {
    if (!this.initialized) {
      await this.initialize(languages);
      return;
    }

    // Add any missing languages
    const missingLanguages = languages.filter(lang => !this.databases.has(lang));
    if (missingLanguages.length > 0) {
      console.log(`📚 Adding missing languages: ${missingLanguages.join(', ')}`);
      await this.openDictionariesForLanguages(missingLanguages);
    }
  }

  /**
   * Check which languages are missing (not installed)
   */
  static async checkMissingLanguages(languages: string[]): Promise<string[]> {
    const missingLanguages: string[] = [];
    
    for (const lang of languages) {
      const isInstalled = await this.isLanguagePackInstalled(lang);
      if (!isInstalled) {
        missingLanguages.push(lang);
      }
    }
    
    return missingLanguages;
  }

  /**
   * Check if a language pack is actually installed
   */
  static async isLanguagePackInstalled(languageCode: string): Promise<boolean> {
    try {
      // First check Language Packs
      const installedPacks = await LanguagePackService.getInstalledPacks();
      const languagePack = installedPacks.find(pack => 
        pack.manifest.sourceLanguage === languageCode || pack.manifest.targetLanguage === languageCode
      );
      
      if (languagePack && languagePack.dictionaryPath) {
        const fileInfo = await FileSystem.getInfoAsync(languagePack.dictionaryPath);
        if (fileInfo.exists && fileInfo.size! > 0) {
          return true;
        }
      }
      
      // Fallback to legacy formats
      const starDictFiles = await this.getStarDictFileForLanguage(languageCode);
      if (starDictFiles.length > 0) {
        for (const filePath of starDictFiles) {
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          if (fileInfo.exists && fileInfo.size! > 0) {
            return true;
          }
        }
      }
      
      // Fallback to old format
      const dbPath = `${languageCode}_dict.sqlite`;
      const localPath = `${FileSystem.documentDirectory}SQLite/${dbPath}`;
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      return fileInfo.exists && fileInfo.size! > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get StarDict SQLite files for a language
   */
  static async getStarDictFileForLanguage(languageCode: string): Promise<string[]> {
    try {
      const sqliteDir = `${FileSystem.documentDirectory}SQLite/`;
      const files = await FileSystem.readDirectoryAsync(sqliteDir);
      
      // Look for files containing the language code
      const matchingFiles = files.filter(file => 
        file.includes(`${languageCode}-`) || 
        file.includes(`-${languageCode}_`) ||
        file.startsWith(`${languageCode}_`)
      );
      
      return matchingFiles.map(file => `${sqliteDir}${file}`);
    } catch (error) {
      console.error(`Error finding StarDict files for ${languageCode}:`, error);
      return [];
    }
  }


  /**
   * Open dictionary databases for specific languages using Language Packs
   */
  static async openDictionariesForLanguages(languages: string[]): Promise<void> {
    console.log(`📚 openDictionariesForLanguages called with: [${languages.join(', ')}]`);
    
    // Get installed language packs
    console.log('📚 Getting installed language packs...');
    const installedPacks = await LanguagePackService.getInstalledPacks();
    console.log(`📚 Found ${installedPacks.length} installed language packs:`, installedPacks.map(p => p.manifest.id));
    
    for (const lang of languages) {
      console.log(`📖 Processing language: ${lang}`);
      
      if (this.databases.has(lang)) {
        console.log(`📖 Dictionary already open for ${lang}, skipping`);
        continue;
      }
      
      try {
        // First, try to find in Language Packs
        console.log(`📖 Looking for language pack for ${lang}...`);
        const languagePack = installedPacks.find(pack => 
          pack.manifest.sourceLanguage === lang || pack.manifest.targetLanguage === lang
        );
        
        if (languagePack) {
          console.log(`📖 Found language pack: ${languagePack.manifest.id} for ${lang}`);
          console.log(`📖 Dictionary path: ${languagePack.dictionaryPath}`);
          
          if (languagePack.dictionaryPath) {
            // Use Language Pack dictionary
            const fileInfo = await FileSystem.getInfoAsync(languagePack.dictionaryPath);
            console.log(`📖 Dictionary file exists: ${fileInfo.exists}, size: ${fileInfo.size}`);
            
            if (fileInfo.exists) {
              const dbName = languagePack.manifest.dictionary.filename;
              console.log(`📖 Opening database: ${dbName}`);
              const db = await SQLite.openDatabaseAsync(dbName);
              
              // Store under the current language
              this.databases.set(lang, db);
              
              // Also store under bilingual keys for cross-language lookup
              const { sourceLanguage, targetLanguage } = languagePack.manifest;
              const bilingualKey = `${sourceLanguage}-${targetLanguage}`;
              const reverseKey = `${targetLanguage}-${sourceLanguage}`;
              
              if (!this.databases.has(bilingualKey)) {
                this.databases.set(bilingualKey, db);
                console.log(`📖 ✅ Stored bilingual dictionary: ${bilingualKey}`);
              }
              if (!this.databases.has(reverseKey)) {
                this.databases.set(reverseKey, db);
                console.log(`📖 ✅ Stored bilingual dictionary: ${reverseKey}`);
              }
              
              console.log(`📖 ✅ Opened Language Pack dictionary: ${lang} (${languagePack.manifest.dictionary.entries} entries)`);
              continue;
            } else {
              console.log(`📖 ❌ Dictionary file does not exist: ${languagePack.dictionaryPath}`);
            }
          } else {
            console.log(`📖 ❌ Language pack has no dictionary path`);
          }
        } else {
          console.log(`📖 No language pack found for ${lang}`);
        }
        
        // Fallback to legacy SQLite directory
        console.log(`📖 Trying legacy SQLite directory for ${lang}...`);
        const dbPath = `${lang}_dict.sqlite`;
        const localPath = `${FileSystem.documentDirectory}SQLite/${dbPath}`;
        console.log(`📖 Checking legacy path: ${localPath}`);
        
        const fileInfo = await FileSystem.getInfoAsync(localPath);
        console.log(`📖 Legacy file exists: ${fileInfo.exists}, size: ${fileInfo.size || 0}`);
        
        if (fileInfo.exists) {
          const db = await SQLite.openDatabaseAsync(dbPath);
          this.databases.set(lang, db);
          console.log(`📖 ✅ Opened legacy dictionary: ${lang}`);
        } else {
          // No dictionary available - don't create fallback
          console.log(`📖 ❌ No dictionary available for ${lang} - Language Pack needed`);
        }
      } catch (error) {
        console.error(`📖 ❌ Failed to open dictionary for ${lang}:`, error);
        console.error(`📖 Error stack:`, error.stack);
      }
    }

    console.log(`📚 Final result - Available dictionaries: [${Array.from(this.databases.keys()).join(', ')}]`);
    console.log(`📚 Total databases opened: ${this.databases.size}`);
  }


  /**
   * Create in-memory fallback database with basic dictionary data
   */
  private static async createFallbackDatabase(language: string): Promise<void> {
    try {
      const dbName = `${language}_dict_fallback.sqlite`;
      const db = await SQLite.openDatabaseAsync(dbName);
      
      // Create schema
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS dict (
          lemma TEXT PRIMARY KEY,
          def TEXT NOT NULL,
          syns TEXT,
          examples TEXT
        )
      `);

      // Insert basic data based on language
      const basicData = this.getBasicDictionaryData(language);
      
      for (const entry of basicData) {
        await db.runAsync(
          `INSERT OR REPLACE INTO dict (lemma, def, syns, examples) VALUES (?, ?, ?, ?)`,
          [
            entry.lemma,
            entry.def,
            entry.syns ? JSON.stringify(entry.syns) : null,
            entry.examples ? JSON.stringify(entry.examples) : null
          ]
        );
      }

      this.databases.set(language, db);
      console.log(`📖 Created fallback database for ${language} with ${basicData.length} entries`);

    } catch (error) {
      console.error(`Failed to create fallback database for ${language}:`, error);
    }
  }

  /**
   * Get basic dictionary data for testing
   */
  private static getBasicDictionaryData(language: string): Array<{
    lemma: string;
    def: string;
    syns?: string[];
    examples?: string[];
  }> {
    switch (language) {
      case 'en':
        return [
          {
            lemma: 'house',
            def: 'A building for human habitation',
            syns: ['home', 'dwelling', 'residence', 'abode'],
            examples: ['I live in a house', 'The house is beautiful']
          },
          {
            lemma: 'book',
            def: 'A written or printed work consisting of pages',
            syns: ['volume', 'text', 'publication', 'tome'],
            examples: ['I read a book', 'This book is interesting']
          },
          {
            lemma: 'read',
            def: 'To look at and comprehend written or printed matter',
            syns: ['study', 'peruse', 'examine', 'review'],
            examples: ['I read every day', 'She reads books']
          },
          {
            lemma: 'love',
            def: 'A strong feeling of affection',
            syns: ['affection', 'adoration', 'devotion', 'care'],
            examples: ['I love you', 'Love is important']
          },
          {
            lemma: 'time',
            def: 'The indefinite continued progress of existence',
            syns: ['moment', 'period', 'duration', 'era'],
            examples: ['Time flies', 'What time is it?']
          }
        ];
        
      case 'es':
        return [
          {
            lemma: 'casa',
            def: 'Edificio para habitar',
            syns: ['hogar', 'vivienda', 'domicilio', 'morada'],
            examples: ['Vivo en una casa', 'La casa es hermosa']
          },
          {
            lemma: 'libro',
            def: 'Conjunto de hojas escritas o impresas',
            syns: ['texto', 'volumen', 'obra', 'publicación'],
            examples: ['Leo un libro', 'Este libro es interesante']
          },
          {
            lemma: 'leer',
            def: 'Pasar la vista por lo escrito comprendiendo los signos',
            syns: ['estudiar', 'revisar', 'examinar', 'repasar'],
            examples: ['Leo todos los días', 'Ella lee libros']
          },
          {
            lemma: 'amor',
            def: 'Sentimiento intenso del ser humano',
            syns: ['cariño', 'afecto', 'ternura', 'pasión'],
            examples: ['Te amo', 'El amor es importante']
          },
          {
            lemma: 'tiempo',
            def: 'Duración de las cosas sujetas a mudanza',
            syns: ['momento', 'período', 'época', 'era'],
            examples: ['El tiempo vuela', '¿Qué hora es?']
          }
        ];
        
      default:
        return [
          {
            lemma: 'test',
            def: `Test word in ${language}`,
            syns: ['example', 'sample'],
            examples: [`This is a test in ${language}`]
          }
        ];
    }
  }

  /**
   * Look up a word with bilingual context
   */
  static async lookupWord(request: DictionaryLookupRequest): Promise<DictionaryLookupResponse> {
    console.log('📚 lookupWord called with request:', request);
    console.log('📚 Service initialized status:', this.initialized);
    console.log('📚 Number of databases available:', this.databases.size);
    console.log('📚 Available database languages:', Array.from(this.databases.keys()));
    
    // Check if service is properly initialized
    if (!this.initialized) {
      console.error('📚 ❌ Service not initialized!');
      console.error('📚 Initialization error:', this.initializationError);
      
      if (this.initializationError) {
        throw new Error(`SQLiteDictionaryService failed to initialize: ${this.initializationError.message}`);
      } else {
        throw new Error('SQLiteDictionaryService is not initialized');
      }
    }

    try {
      const { word, userProfile } = request;
      
      // Validate input
      if (!word || typeof word !== 'string') {
        throw new Error('Invalid word provided for lookup');
      }
      
      const sanitizedWord = Validator.sanitizeWordForLookup(word);
      if (!sanitizedWord) {
        throw new Error('Word contains only invalid characters');
      }
      
      const normalizedWord = sanitizedWord.toLowerCase().trim();
      
      // Detect source language first
      const sourceLanguage = await this.detectLanguage(word);
      const needsTranslation = sourceLanguage !== userProfile.nativeLanguage;
      
      // Check if we have the required languages
      const requiredLanguages = needsTranslation 
        ? [sourceLanguage, userProfile.nativeLanguage]
        : [userProfile.nativeLanguage];
      
      const missingLanguages = await this.checkMissingLanguages(requiredLanguages);
      
      if (missingLanguages.length > 0) {
        const languageNames = missingLanguages.map(lang => 
          lang === 'en' ? 'English' :
          lang === 'es' ? 'Spanish' :
          lang === 'fr' ? 'French' :
          lang === 'de' ? 'German' :
          lang === 'it' ? 'Italian' :
          lang === 'pt' ? 'Portuguese' : lang
        ).join(', ');
        
        return {
          success: false,
          word,
          sourceLanguage,
          error: `Dictionary not available for ${languageNames}. Please download the language pack or use a supported language.`,
          missingLanguages,
          requiredLanguages
        };
      }
      
      // Ensure we have the necessary languages available
      await this.ensureLanguagesAvailable(requiredLanguages);
      
      console.log(`📚 Looking up "${word}" for ${userProfile.nativeLanguage} user`);

      if (needsTranslation) {
        return await this.performCrossLanguageLookup(normalizedWord, sourceLanguage, userProfile);
      } else {
        return await this.performNativeLanguageLookup(normalizedWord, userProfile);
      }

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
   * Cross-language lookup using StarDict bilingual dictionaries
   */
  private static async performCrossLanguageLookup(
    word: string, 
    sourceLanguage: string, 
    userProfile: UserLanguageProfile
  ): Promise<DictionaryLookupResponse> {
    
    try {
      console.log(`🔄 Cross-language lookup: ${word} (${sourceLanguage} → ${userProfile.nativeLanguage})`);
      
      // Step 1: Look up word in bilingual StarDict dictionary to get translation
      const translation = await this.translateWordUsingStarDict(word, sourceLanguage, userProfile.nativeLanguage);
      
      if (!translation) {
        return {
          success: false,
          word,
          sourceLanguage,
          error: `No translation found for "${word}" in ${sourceLanguage}-${userProfile.nativeLanguage} dictionary`
        };
      }
      
      console.log(`📖 StarDict translation: "${word}" → "${translation}"`);
      
      // Step 2: Get source language data (definitions/synonyms in original language)
      const sourceData = await this.lookupInDatabase(word, sourceLanguage);
      
      // Step 3: Get target language data (definitions/synonyms in user's language)
      const targetData = await this.lookupInDatabase(translation, userProfile.nativeLanguage);
      
      // Step 4: Generate examples and build rich bilingual definition
      const examples = this.generateExamples(word, translation, sourceLanguage, userProfile.nativeLanguage);
      
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
        error: `StarDict lookup failed: ${error}`
      };
    }
  }

  /**
   * Native language lookup
   */
  private static async performNativeLanguageLookup(
    word: string,
    userProfile: UserLanguageProfile
  ): Promise<DictionaryLookupResponse> {
    
    try {
      const language = userProfile.nativeLanguage;
      const data = await this.lookupInDatabase(word, language);
      
      const definition: BilingualWordDefinition = {
        word,
        language,
        translations: [],
        definitions: [{
          partOfSpeech: 'unknown',
          definition: data.definition || `Definition for "${word}"`,
          definitionLanguage: language,
          synonyms: data.synonyms || []
        }],
        frequency: 5000,
        difficulty: 'intermediate'
      };

      return {
        success: true,
        word,
        sourceLanguage: language,
        primaryDefinition: definition
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
   * Look up word in specific language database (PyGlossary format)
   */
  private static async lookupInDatabase(word: string, language: string): Promise<{
    definition: string;
    synonyms: string[];
    examples: string[];
  }> {
    const db = this.databases.get(language);
    
    if (!db) {
      console.log(`📖 Database not available for language: ${language}`);
      return {
        definition: `Definition for "${word}" (database not available)`,
        synonyms: [],
        examples: []
      };
    }

    try {
      // First, try PyGlossary format (word table with w, m columns)
      const rows = await db.getAllAsync('SELECT def as m FROM dict WHERE lemma = ? COLLATE NOCASE LIMIT 1', [word.trim()]);
      
      if (rows.length > 0) {
        const definition = rows[0].m;
        const cleanDefinition = this.cleanHtmlDefinition(definition);
        
        return {
          definition: cleanDefinition,
          synonyms: this.extractSynonymsFromDefinition(definition),
          examples: this.extractExamplesFromDefinition(definition)
        };
      } else {
        // Fallback to original StarDict format if PyGlossary lookup fails
        const fallbackRows = await db.getAllAsync('SELECT def, syns, examples FROM dict WHERE lemma = ? LIMIT 1', [word.toLowerCase()]);
        
        if (fallbackRows.length > 0) {
          const row = fallbackRows[0];
          return {
            definition: row.def || '',
            synonyms: row.syns ? JSON.parse(row.syns) : [],
            examples: row.examples ? JSON.parse(row.examples) : []
          };
        } else {
          return {
            definition: `Definition for "${word}" (not found in ${language} dictionary)`,
            synonyms: [],
            examples: []
          };
        }
      }
    } catch (error) {
      console.error(`Database lookup error for "${word}" in ${language}:`, error);
      return {
        definition: `Definition for "${word}" (lookup error)`,
        synonyms: [],
        examples: []
      };
    }
  }

  /**
   * Translate word using StarDict bilingual dictionary (PyGlossary format)
   */
  private static async translateWordUsingStarDict(word: string, fromLang: string, toLang: string): Promise<string | null> {
    try {
      // Look for bilingual dictionary database
      const bilingualKey = `${fromLang}-${toLang}`;
      const reverseKey = `${toLang}-${fromLang}`;
      
      // Try to find bilingual database
      let bilingualDb = this.databases.get(bilingualKey) || this.databases.get(reverseKey);
      console.log(`📖 Looking for bilingual database: ${bilingualKey} or ${reverseKey}`);
      
      if (!bilingualDb) {
        console.log(`📖 No bilingual dictionary found for ${fromLang}-${toLang}`);
        return null;
      }

      try {
        // First, check what tables exist in the database
        const tables = await bilingualDb.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'");
        console.log(`📖 Available tables in bilingual database:`, tables.map(t => t.name));
        
        // If no tables, check if database is valid
        if (tables.length === 0) {
          console.error(`📖 ❌ Database has no tables! This indicates a corrupted or empty database.`);
          
          // Try to get database info
          const pragma = await bilingualDb.getAllAsync("PRAGMA database_list");
          console.log(`📖 Database info:`, pragma);
          
          return null;
        }
        
        // Try PyGlossary format first (word table with w, m columns)
        try {
          const rows = await bilingualDb.getAllAsync('SELECT m FROM word WHERE w = ? COLLATE NOCASE LIMIT 1', [word.trim()]);
          
          if (rows.length > 0) {
            const definition = rows[0].m;
            console.log(`📖 Found PyGlossary entry for "${word}":`, definition.substring(0, 100));
            // Extract translation from HTML definition
            const translation = this.extractTranslationFromDefinition(definition);
            return translation;
          }
        } catch (wordTableError) {
          console.log(`📖 No 'word' table found, trying 'dict' table...`);
        }
        
        // Fallback to original StarDict format
        try {
          const fallbackRows = await bilingualDb.getAllAsync('SELECT def FROM dict WHERE lemma = ? LIMIT 1', [word.toLowerCase()]);
          
          if (fallbackRows.length > 0) {
            const definition = fallbackRows[0].def;
            console.log(`📖 Found StarDict entry for "${word}":`, definition.substring(0, 100));
            // Extract first translation from definition
            const translation = definition.split(';')[0].split(',')[0].trim();
            return translation;
          }
        } catch (dictTableError) {
          console.log(`📖 No 'dict' table found either`);
        }
        
        return null;
      } catch (error) {
        console.error(`StarDict lookup error for "${word}":`, error);
        return null;
      }

    } catch (error) {
      console.error(`StarDict translation failed for "${word}":`, error);
      return null;
    }
  }

  /**
   * Detect language of a word
   */
  private static async detectLanguage(word: string): Promise<string> {
    return this.simpleLanguageDetection(word);
  }

  /**
   * Simple language detection fallback
   */
  private static simpleLanguageDetection(word: string): string {
    // Spanish characteristics
    if (/[ñáéíóúü]/.test(word) || /^[aeiou]/.test(word) || /(ción|dad|mente|izar)$/.test(word)) {
      return 'es';
    }
    
    // French characteristics
    if (/[àâéèêëîïôùûüÿç]/.test(word) || /(tion|ment|ique)$/.test(word)) {
      return 'fr';
    }
    
    // Default to English
    return 'en';
  }

  /**
   * Generate example sentences (using templates, no translation needed)
   */
  private static generateExamples(
    sourceWord: string, 
    translation: string, 
    sourceLang: string, 
    targetLang: string
  ): {source: string, target: string} {
    
    // Simple template examples based on language
    if (sourceLang === 'en') {
      return {
        source: `I use "${sourceWord}" every day.`,
        target: `Yo uso "${translation}" todos los días.`
      };
    } else if (sourceLang === 'es') {
      return {
        source: `Yo uso "${sourceWord}" todos los días.`,
        target: `I use "${translation}" every day.`
      };
    } else {
      return {
        source: `Example with "${sourceWord}"`,
        target: `Example with "${translation}"`
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
        partOfSpeech: 'unknown',
        definition: sourceData.definition,
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
        sourceDefinition: sourceData.definition
      }
    };
  }

  /**
   * Check if language dictionary is available
   */
  static isLanguageAvailable(languageCode: string): boolean {
    return this.databases.has(languageCode);
  }

  /**
   * Get available languages
   */
  static getAvailableLanguages(): string[] {
    return Array.from(this.databases.keys());
  }

  /**
   * Cleanup resources and close database connections
   */
  static async cleanup(): Promise<void> {
    try {
      console.log('📚 SQLiteDictionaryService: Cleaning up resources...');
      
      // Close all database connections
      const closePromises = Array.from(this.databases.values()).map(async (db) => {
        try {
          if (db && typeof db.closeAsync === 'function') {
            await db.closeAsync();
          }
        } catch (error) {
          console.warn('📚 SQLiteDictionaryService: Error closing database:', error);
        }
      });
      
      await Promise.all(closePromises);
      
      // Clear all references
      this.databases.clear();
      this.initialized = false;
      this.initializationPromise = null;
      this.initializationError = null;
      
      console.log('📚 SQLiteDictionaryService: Cleanup completed');
      
    } catch (error) {
      console.error('📚 SQLiteDictionaryService: Cleanup failed:', error);
    }
  }

  /**
   * Clean HTML definition (remove HTML tags, keep content)
   */
  private static cleanHtmlDefinition(htmlDefinition: string): string {
    if (!htmlDefinition) return '';
    
    // Remove HTML tags but preserve content
    let cleaned = htmlDefinition
      .replace(/<div[^>]*>/g, ' ')
      .replace(/<\/div>/g, ' ')
      .replace(/<br\s*\/?>/g, ' ')
      .replace(/<font[^>]*>/g, '')
      .replace(/<\/font>/g, '')
      .replace(/<[^>]+>/g, '') // Remove any remaining HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return cleaned;
  }

  /**
   * Extract translation from HTML definition (for bilingual dictionaries)
   */
  private static extractTranslationFromDefinition(htmlDefinition: string): string | null {
    if (!htmlDefinition) return null;
    
    // Look for content in <div> tags (often the translation)
    const divMatch = htmlDefinition.match(/<div[^>]*>([^<]+)<\/div>/);
    if (divMatch) {
      return divMatch[1].trim();
    }
    
    // Clean and extract first meaningful text
    const cleaned = this.cleanHtmlDefinition(htmlDefinition);
    const parts = cleaned.split(/[,;]/);
    
    if (parts.length > 0) {
      return parts[0].trim();
    }
    
    return null;
  }

  /**
   * Extract synonyms from HTML definition
   */
  private static extractSynonymsFromDefinition(htmlDefinition: string): string[] {
    if (!htmlDefinition) return [];
    
    // Look for patterns that might indicate synonyms
    const synonymPatterns = [
      /synonym[s]?[:\s]+([^<.]+)/i,
      /also[:\s]+([^<.]+)/i,
      /see also[:\s]+([^<.]+)/i
    ];
    
    for (const pattern of synonymPatterns) {
      const match = htmlDefinition.match(pattern);
      if (match) {
        return match[1].split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
      }
    }
    
    return [];
  }

  /**
   * Extract examples from HTML definition
   */
  private static extractExamplesFromDefinition(htmlDefinition: string): string[] {
    if (!htmlDefinition) return [];
    
    // Look for example patterns
    const examplePatterns = [
      /example[s]?[:\s]+([^<.]+)/i,
      /e\.g\.[:\s]+([^<.]+)/i,
      /"([^"]+)"/g // Quoted text might be examples
    ];
    
    const examples: string[] = [];
    
    for (const pattern of examplePatterns) {
      const matches = htmlDefinition.matchAll(new RegExp(pattern.source, pattern.flags));
      for (const match of matches) {
        examples.push(match[1].trim());
      }
    }
    
    return examples.filter(ex => ex.length > 0);
  }

  /**
   * Get statistics
   */
  static getStats(): { 
    totalEntries: number; 
    languagePairs: string[]; 
    version: string;
    availableLanguages: string[];
  } {
    return {
      totalEntries: this.databases.size * 30000, // Estimated
      languagePairs: ['en-es', 'es-en', 'en-fr', 'fr-en'],
      version: '1.0.0-sqlite',
      availableLanguages: this.getAvailableLanguages()
    };
  }
}

export default SQLiteDictionaryService;