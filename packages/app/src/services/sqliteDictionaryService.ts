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
 * Implements offline bilingual dictionary using downloaded language pack databases
 * Supports consistent lookup across all languages with multiple database schemas:
 * 
 * Database Schema (Language Packs):
 * - word table: id INTEGER PRIMARY KEY, w TEXT, m TEXT (PyGlossary format)
 * - dict table: lemma TEXT PRIMARY KEY, def TEXT NOT NULL (StarDict format)
 * - Both tables contain HTML-formatted definitions with embedded synonyms/examples
 * 
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
      
      // Handle directional keys like "en-es"
      if (languageCode.includes('-')) {
        const languagePack = installedPacks.find(pack => pack.manifest.id === languageCode);
        if (languagePack && languagePack.dictionaryPath) {
          const fileInfo = await FileSystem.getInfoAsync(languagePack.dictionaryPath);
          if (fileInfo.exists && fileInfo.size! > 0) {
            return true;
          }
        }
        return false;
      }
      
      // Handle individual language codes
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
        
        // Handle directional keys like "en-es" by exact ID match
        let languagePack;
        if (lang.includes('-')) {
          languagePack = installedPacks.find(pack => pack.manifest.id === lang);
        } else {
          // Handle individual language codes
          languagePack = installedPacks.find(pack => 
            pack.manifest.sourceLanguage === lang || pack.manifest.targetLanguage === lang
          );
        }
        
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
              
              // Store under the correct directional key (primary storage)
              const { sourceLanguage, targetLanguage } = languagePack.manifest;
              const directionalKey = `${sourceLanguage}-${targetLanguage}`;
              
              this.databases.set(directionalKey, db);
              console.log(`📖 ✅ Stored directional dictionary: ${directionalKey} (${sourceLanguage} → ${targetLanguage})`);
              
              // Also store under individual language codes for backwards compatibility
              this.databases.set(lang, db);
              
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
   * Open all available dictionaries from installed language packs
   */
  private static async openAvailableDictionaries(): Promise<void> {
    try {
      console.log('📚 Opening all available dictionaries...');
      const installedPacks = await LanguagePackService.getInstalledPacks();
      console.log(`📚 Found ${installedPacks.length} installed language packs`);
      
      if (installedPacks.length === 0) {
        console.log('📚 No language packs installed, using fallback dictionaries');
        // Open basic fallback dictionaries for common languages
        await this.openDictionariesForLanguages(['en', 'es', 'fr', 'de']);
        return;
      }
      
      // Collect all languages from installed packs
      const languages = new Set<string>();
      for (const pack of installedPacks) {
        languages.add(pack.manifest.sourceLanguage);
        languages.add(pack.manifest.targetLanguage);
      }
      
      console.log(`📚 Opening dictionaries for languages: ${Array.from(languages).join(', ')}`);
      await this.openDictionariesForLanguages(Array.from(languages));
    } catch (error) {
      console.error('📚 Error opening available dictionaries:', error);
      // Fallback to basic languages
      await this.openDictionariesForLanguages(['en', 'es']);
    }
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
      console.log('📚 ===== LOOKUP FLOW START =====');
      const { word, userProfile } = request;
      console.log(`📚 Step 1: Input word: "${word}"`);
      console.log(`📚 Step 1: User profile:`, {
        nativeLanguage: userProfile.nativeLanguage,
        targetLanguages: userProfile.targetLanguages,
        defaultDictionaryMode: userProfile.defaultDictionaryMode
      });
      
      // Validate input
      console.log(`📚 Step 2: Validating input...`);
      if (!word || typeof word !== 'string') {
        console.error(`📚 Step 2: ❌ Invalid word: ${word} (type: ${typeof word})`);
        throw new Error('Invalid word provided for lookup');
      }
      console.log(`📚 Step 2: ✅ Word is valid string`);
      
      console.log(`📚 Step 3: Sanitizing word...`);
      const sanitizedWord = Validator.sanitizeWordForLookup(word);
      console.log(`📚 Step 3: Sanitized word: "${sanitizedWord}"`);
      if (!sanitizedWord) {
        console.error(`📚 Step 3: ❌ Word contains only invalid characters`);
        throw new Error('Word contains only invalid characters');
      }
      console.log(`📚 Step 3: ✅ Word sanitized successfully`);
      
      console.log(`📚 Step 4: Normalizing word...`);
      const normalizedWord = sanitizedWord.toLowerCase().trim();
      console.log(`📚 Step 4: Normalized word: "${normalizedWord}"`);
      
      // Detect source language first
      console.log(`📚 Step 5: Detecting source language...`);
      const sourceLanguage = await this.detectLanguage(word);
      console.log(`📚 Step 5: Detected source language: ${sourceLanguage}`);
      
      console.log(`📚 Step 6: Checking if translation needed...`);
      const needsTranslation = sourceLanguage !== userProfile.nativeLanguage;
      console.log(`📚 Step 6: Source: ${sourceLanguage}, Native: ${userProfile.nativeLanguage}, Needs translation: ${needsTranslation}`);
      
      // Check if we have the required languages
      console.log(`📚 Step 7: Determining required languages...`);
      const requiredLanguages = needsTranslation 
        ? [sourceLanguage, userProfile.nativeLanguage, `${sourceLanguage}-${userProfile.nativeLanguage}`]
        : [userProfile.nativeLanguage];
      console.log(`📚 Step 7: Required languages: ${requiredLanguages.join(', ')}`);
      
      console.log(`📚 Step 8: Checking for missing languages...`);
      const missingLanguages = await this.checkMissingLanguages(requiredLanguages);
      console.log(`📚 Step 8: Missing languages: ${missingLanguages.length > 0 ? missingLanguages.join(', ') : 'none'}`);
      
      if (missingLanguages.length > 0) {
        console.log(`📚 Step 8: ❌ Missing languages detected!`);
        const languageNames = missingLanguages.map(lang => 
          lang === 'en' ? 'English' :
          lang === 'es' ? 'Spanish' :
          lang === 'fr' ? 'French' :
          lang === 'de' ? 'German' :
          lang === 'it' ? 'Italian' :
          lang === 'pt' ? 'Portuguese' : 
          lang.includes('-') ? `${lang} dictionary` : lang
        ).join(', ');
        console.log(`📚 Step 8: Missing language names: ${languageNames}`);
        
        const errorResult = {
          success: false,
          word,
          sourceLanguage,
          error: `Dictionary not available for ${languageNames}. Please download the language pack or use a supported language.`,
          missingLanguages,
          requiredLanguages
        };
        console.log(`📚 ===== LOOKUP FLOW END (MISSING LANGUAGES) =====`);
        return errorResult;
      }
      console.log(`📚 Step 8: ✅ All required languages available`);
      
      // Ensure we have the necessary languages available
      console.log(`📚 Step 9: Ensuring languages are available...`);
      await this.ensureLanguagesAvailable(requiredLanguages);
      console.log(`📚 Step 9: ✅ Languages ensured`);
      
      console.log(`📚 Step 10: Determining lookup strategy...`);
      console.log(`📚 Step 10: needsTranslation: ${needsTranslation}, sourceLanguage: ${sourceLanguage}`);

      if (needsTranslation) {
        console.log(`📚 Step 10: ✅ Using cross-language lookup`);
        console.log(`📚 ===== STARTING CROSS-LANGUAGE LOOKUP =====`);
        const result = await this.performCrossLanguageLookup(normalizedWord, sourceLanguage, userProfile);
        console.log(`📚 ===== CROSS-LANGUAGE LOOKUP RESULT =====`, result);
        return result;
      } else {
        console.log(`📚 Step 10: ✅ Using native language lookup`);
        console.log(`📚 ===== STARTING NATIVE LANGUAGE LOOKUP =====`);
        const result = await this.performNativeLanguageLookup(normalizedWord, userProfile);
        console.log(`📚 ===== NATIVE LANGUAGE LOOKUP RESULT =====`, result);
        return result;
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
      console.log(`🔄 ===== CROSS-LANGUAGE LOOKUP START =====`);
      console.log(`🔄 Word: "${word}"`);
      console.log(`🔄 Source Language: ${sourceLanguage}`);
      console.log(`🔄 Target Language: ${userProfile.nativeLanguage}`);
      
      // Step 1: Look up word in bilingual dictionary (WikiDict or StarDict) to get translation
      console.log(`🔄 Step 1: Starting bilingual dictionary translation...`);
      const translation = await this.translateWordUsingStarDict(word, sourceLanguage, userProfile.nativeLanguage);
      console.log(`🔄 Step 1 Result: Translation = "${translation}"`);
      
      // Check if this is a rich WikiDict response
      if (translation && translation.startsWith('WIKIDICT:')) {
        const wikidictData = JSON.parse(translation.replace('WIKIDICT:', ''));
        console.log(`🔄 Step 1: ✅ Found rich WikiDict data`);
        
        const finalResult = {
          success: true,
          word,
          sourceLanguage,
          primaryDefinition: wikidictData
        };
        console.log(`🔄 ===== CROSS-LANGUAGE LOOKUP END (WIKIDICT SUCCESS) =====`);
        return finalResult;
      }
      
      if (!translation) {
        console.log(`🔄 Step 1: ❌ No translation found in bilingual dictionary`);
        
        // Fallback: Provide a basic translation for common function words
        const commonTranslations: Record<string, string> = {
          'the': 'el/la/los/las',
          'a': 'un/una',
          'an': 'un/una', 
          'and': 'y',
          'or': 'o',
          'of': 'de',
          'in': 'en',
          'on': 'en/sobre',
          'at': 'en',
          'to': 'a/hacia',
          'for': 'para/por',
          'with': 'con',
          'by': 'por',
          'is': 'es/está',
          'are': 'son/están',
          'was': 'era/estaba',
          'were': 'eran/estaban'
        };
        
        const fallbackTranslation = commonTranslations[word.toLowerCase()];
        if (fallbackTranslation) {
          console.log(`🔄 Step 1: ✅ Using fallback translation: "${word}" → "${fallbackTranslation}"`);
          
          const bilingualDefinition = {
            word,
            language: sourceLanguage,
            translations: [fallbackTranslation],
            definitions: [{
              partOfSpeech: 'function word',
              definition: `Common ${sourceLanguage === 'en' ? 'English' : 'Spanish'} function word`,
              definitionLanguage: userProfile.nativeLanguage,
              synonyms: []
            }],
            frequency: 10000, // Very high frequency
            difficulty: 'beginner'
          };

          const result = {
            success: true,
            word,
            sourceLanguage,
            primaryDefinition: bilingualDefinition
          };
          console.log(`🔄 ===== CROSS-LANGUAGE LOOKUP END (FALLBACK SUCCESS) =====`);
          return result;
        }
        
        const errorResult = {
          success: false,
          word,
          sourceLanguage,
          error: `No translation found for "${word}" in ${sourceLanguage}-${userProfile.nativeLanguage} dictionary`
        };
        console.log(`🔄 ===== CROSS-LANGUAGE LOOKUP END (NO TRANSLATION) =====`);
        return errorResult;
      }
      
      console.log(`🔄 Step 1: ✅ Translation found: "${word}" → "${translation}"`);
      
      // Step 2: Get source language data (definitions/synonyms in original language)
      console.log(`🔄 Step 2: Looking up source language data for "${word}" in ${sourceLanguage}...`);
      const sourceData = await this.lookupInDatabase(word, sourceLanguage);
      console.log(`🔄 Step 2 Result:`, sourceData);
      
      // Step 3: Get target language data (definitions/synonyms in user's language)
      console.log(`🔄 Step 3: Looking up target language data for "${translation}" in ${userProfile.nativeLanguage}...`);
      const targetData = await this.lookupInDatabase(translation, userProfile.nativeLanguage);
      console.log(`🔄 Step 3 Result:`, targetData);
      
      // Step 4: Generate examples and build rich bilingual definition
      console.log(`🔄 Step 4: Generating examples...`);
      const examples = this.generateExamples(word, translation, sourceLanguage, userProfile.nativeLanguage);
      console.log(`🔄 Step 4 Result:`, examples);
      
      console.log(`🔄 Step 5: Building bilingual definition...`);
      const bilingualDefinition = this.buildBilingualDefinition(
        word, translation, sourceLanguage, userProfile.nativeLanguage,
        translation, examples
      );
      console.log(`🔄 Step 5 Result:`, bilingualDefinition);

      const finalResult = {
        success: true,
        word,
        sourceLanguage,
        primaryDefinition: bilingualDefinition
      };
      console.log(`🔄 ===== CROSS-LANGUAGE LOOKUP END (SUCCESS) =====`);
      console.log(`🔄 Final Result:`, finalResult);
      return finalResult;

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
        // Fallback to dict table format (only lemma and def columns)
        const fallbackRows = await db.getAllAsync('SELECT def FROM dict WHERE lemma = ? LIMIT 1', [word.toLowerCase()]);
        
        if (fallbackRows.length > 0) {
          const row = fallbackRows[0];
          const definition = row.def || '';
          const cleanDefinition = this.cleanHtmlDefinition(definition);
          
          return {
            definition: cleanDefinition,
            synonyms: this.extractSynonymsFromDefinition(definition),
            examples: this.extractExamplesFromDefinition(definition)
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
   * Simplified version for directional databases
   */
  private static async translateWordUsingStarDict(word: string, fromLang: string, toLang: string): Promise<string | null> {
    try {
      console.log(`📖 StarDict translation: "${word}" (${fromLang} → ${toLang})`);
      
      // Look for the correct directional database
      const directionalKey = `${fromLang}-${toLang}`;
      const db = this.databases.get(directionalKey);
      
      console.log(`📖 Looking for database: ${directionalKey}`);
      console.log(`📖 Available databases: ${Array.from(this.databases.keys()).join(', ')}`);
      
      if (!db) {
        console.log(`📖 ❌ No database found for ${directionalKey}`);
        return null;
      }
      
      console.log(`📖 ✅ Found database for ${directionalKey}`);
      
      // Try multiple table schemas: dict, word, and WikiDict simple_translation
      let rows = [];
      
      try {
        // First try StarDict format (dict table) - lemma/def columns
        console.log(`📖 Trying StarDict format (dict table)...`);
        rows = await db.getAllAsync('SELECT lemma, def FROM dict WHERE lemma = ? COLLATE NOCASE LIMIT 1', [word]);
        
        if (rows.length > 0) {
          const definition = rows[0].def;
          console.log(`📖 ✅ Found translation in dict table: "${word}" → "${definition}"`);
          return definition;
        }
      } catch (error) {
        console.log(`📖 Dict table not available, trying other formats...`);
      }
      
      try {
        // Try WikiDict format - use detailed translation table for rich data
        console.log(`📖 Trying WikiDict format (translation table)...`);
        rows = await db.getAllAsync('SELECT lexentry, sense, trans_list FROM translation WHERE written_rep = ? COLLATE NOCASE LIMIT 3', [word]);
        
        if (rows.length > 0) {
          console.log(`📖 ✅ Found WikiDict translation with ${rows.length} senses`);
          
          // Build rich WikiDict definition with multiple senses
          const allTranslations = rows[0].trans_list ? rows[0].trans_list.split(' | ') : [];
          const primaryTranslation = allTranslations[0] || '';
          
          // Translate definitions if needed
          const translatedDefinitions = await Promise.all(
            rows.map(async (row) => {
              const translatedSense = await this.formatDefinitionForUser(row.sense, fromLang, toLang);
              return {
                partOfSpeech: this.extractPartOfSpeech(row.lexentry),
                definition: `"${word}" significa "${primaryTranslation}" - ${translatedSense}`,
                definitionLanguage: toLang, // Definition shown in user's native language
                synonyms: allTranslations.slice(1, 4).map(t => t.trim()), // Other translations as synonyms
                example: this.generateContextualExample(word, row.sense, primaryTranslation, fromLang, toLang)
              };
            })
          );
          
          // Create a structured BilingualWordDefinition directly
          const wikidictDefinition: BilingualWordDefinition = {
            word: word,
            language: fromLang,
            
            translations: allTranslations.slice(0, 5).map((trans, index) => ({
              word: trans.trim(),
              language: toLang,
              confidence: Math.max(0.95 - (index * 0.1), 0.7) // Higher confidence for first translations
            })),
            
            definitions: translatedDefinitions,
            
            // Add metadata if available
            frequency: this.estimateWordFrequency(word, fromLang),
            difficulty: this.estimateDifficulty(word, fromLang),
            
            // Cross-language enrichment for user's context
            crossLanguageData: {
              targetSynonyms: this.getTargetLanguageSynonyms(primaryTranslation, toLang),
              culturalNotes: this.getCulturalNotes(word, fromLang, toLang)
            }
          };
          
          console.log(`📖 Built rich WikiDict definition with ${wikidictDefinition.definitions.length} senses`);
          return `WIKIDICT:${JSON.stringify(wikidictDefinition)}`;
        }
        
        // Fallback to simple table if detailed not available
        console.log(`📖 Trying WikiDict simple_translation table...`);
        rows = await db.getAllAsync('SELECT written_rep, trans_list FROM simple_translation WHERE written_rep = ? COLLATE NOCASE LIMIT 1', [word]);
        
        if (rows.length > 0) {
          const translationList = rows[0].trans_list;
          const primaryTranslation = translationList.split(' | ')[0];
          console.log(`📖 ✅ Found translation in WikiDict simple table: "${word}" → "${primaryTranslation}"`);
          return primaryTranslation;
        }
      } catch (error) {
        console.log(`📖 WikiDict table not available, trying PyGlossary format...`);
      }
      
      try {
        // Fallback to PyGlossary format (word table) - w/m columns
        console.log(`📖 Trying PyGlossary format (word table)...`);
        rows = await db.getAllAsync('SELECT w, m FROM word WHERE w = ? COLLATE NOCASE LIMIT 1', [word]);
        
        if (rows.length > 0) {
          const definition = rows[0].m;
          console.log(`📖 ✅ Found translation in word table: "${word}" → "${definition}"`);
          return definition;
        }
      } catch (error) {
        console.log(`📖 Word table not available`);
      }
      
      console.log(`📖 No translation found for "${word}" in ${directionalKey} (tried dict, WikiDict, and word tables)`);
      return null;
        
    } catch (error) {
      console.error(`📖 StarDict lookup error for "${word}":`, error);
      return null;
    }
  }

  /**
   * Detect language of a word
   */
  private static async detectLanguage(word: string): Promise<string> {
    try {
      // TODO: Implement ML Kit Language Identification when available
      // const languageTag = await LanguageIdentification.identifyLanguage(word);
      // if (languageTag && languageTag !== 'und') return languageTag;
    } catch (error) {
      console.log('🔍 ML Kit not available, using heuristics');
    }
    
    // Fallback to improved heuristics
    return this.improvedLanguageDetection(word);
  }

  /**
   * Improved multi-stage language detection
   */
  private static improvedLanguageDetection(word: string): string {
    console.log(`🔍 Language detection for: "${word}"`);
    
    // Spanish characteristics (more specific)
    if (/[ñáéíóúü]/.test(word)) {
      console.log(`🔍 Detected Spanish: contains Spanish diacritics`);
      return 'es';
    }
    if (/(ción|sión|dad|mente|izar|ando|endo|esto|esta|esta)$/.test(word)) {
      console.log(`🔍 Detected Spanish: Spanish suffix patterns`);
      return 'es';
    }
    
    // French characteristics
    if (/[àâéèêëîïôùûüÿç]/.test(word)) {
      console.log(`🔍 Detected French: contains French diacritics`);
      return 'fr';
    }
    if (/(tion|ment|ique|eux|euse)$/.test(word)) {
      console.log(`🔍 Detected French: French suffix patterns`);
      return 'fr';
    }
    
    // Default to English (removed the overly broad vowel rule)
    console.log(`🔍 Detected English: default fallback`);
    return 'en';
  }

  /**
   * Check if language is available
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
      if (pattern.global) {
        // Handle global patterns like /"([^"]+)"/g
        let match;
        const regex = new RegExp(pattern.source, pattern.flags);
        while ((match = regex.exec(htmlDefinition)) !== null) {
          if (match[1]) {
            examples.push(match[1].trim());
          }
        }
      } else {
        // Handle non-global patterns
        const match = htmlDefinition.match(pattern);
        if (match && match[1]) {
          examples.push(match[1].trim());
        }
      }
    }
    
    return examples.filter(ex => ex.length > 0);
  }

  /**
   * Clean HTML definition by removing tags and formatting
   */
  private static cleanHtmlDefinition(htmlDefinition: string): string {
    if (!htmlDefinition) return '';
    
    return htmlDefinition
      .replace(/<[^>]*>/g, ' ')           // Remove HTML tags
      .replace(/&nbsp;/g, ' ')           // Replace &nbsp; with space
      .replace(/&amp;/g, '&')            // Replace &amp; with &
      .replace(/&lt;/g, '<')             // Replace &lt; with <
      .replace(/&gt;/g, '>')             // Replace &gt; with >
      .replace(/\s+/g, ' ')              // Collapse multiple spaces
      .trim();                           // Remove leading/trailing whitespace
  }

  /**
   * Build bilingual word definition combining source and target data
   */
  private static buildBilingualDefinition(
    sourceWord: string,
    targetWord: string,
    sourceLanguage: string,
    targetLanguage: string,
    translation: string,
    examples: string[]
  ): BilingualWordDefinition {
    return {
      word: sourceWord,
      language: sourceLanguage,
      
      translations: [{
        word: targetWord || this.cleanHtmlDefinition(translation),
        language: targetLanguage,
        confidence: 0.9
      }],
      
      definitions: [{
        partOfSpeech: '', // Will be filled by WikiDict
        definition: this.cleanHtmlDefinition(translation),
        definitionLanguage: targetLanguage,
        example: examples && examples[0] || undefined,
        synonyms: this.extractSynonymsFromDefinition(translation)
      }]
    };
  }

  /**
   * Generate example sentences using the word and translation
   */
  private static generateExamples(
    word: string,
    translation: string,
    sourceLanguage: string,
    targetLanguage: string
  ): string[] {
    const examples: string[] = [];
    
    // Extract examples from the translation definition if they exist
    const existingExamples = this.extractExamplesFromDefinition(translation);
    if (existingExamples.length > 0) {
      return existingExamples;
    }
    
    // Generate simple template examples as fallback
    if (sourceLanguage === 'es' && targetLanguage === 'en') {
      examples.push(`La palabra "${word}" significa "${this.cleanHtmlDefinition(translation)}".`);
    } else if (sourceLanguage === 'en' && targetLanguage === 'es') {
      examples.push(`The word "${word}" means "${this.cleanHtmlDefinition(translation)}".`);
    } else {
      examples.push(`${word} → ${this.cleanHtmlDefinition(translation)}`);
    }
    
    return examples.filter(ex => ex.length > 0);
  }

  /**
   * Extract part of speech from WikiDict lexentry
   */
  private static extractPartOfSpeech(lexentry: string): string {
    if (!lexentry) return '';
    
    // WikiDict lexentry format: eng/hello__Interjection__1
    const parts = lexentry.split('__');
    if (parts.length >= 2) {
      return parts[1].toLowerCase();
    }
    
    return '';
  }

  /**
   * Format WikiDict definition with multiple senses
   */
  private static formatWikiDictDefinition(word: string, definitions: any[]): string {
    if (!definitions || definitions.length === 0) return '';
    
    let html = '<div class="wiki-definition">';
    
    definitions.forEach((def, index) => {
      html += '<div class="definition-sense">';
      
      if (def.partOfSpeech) {
        html += `<span class="part-of-speech">[${def.partOfSpeech}]</span> `;
      }
      
      if (def.definition) {
        html += `<span class="definition">${def.definition}</span>`;
      }
      
      if (def.allTranslations && def.allTranslations.length > 0) {
        html += '<div class="translations">';
        html += '<strong>Translations:</strong> ';
        html += def.allTranslations.slice(0, 3).join(', ');
        if (def.allTranslations.length > 3) {
          html += ` (+${def.allTranslations.length - 3} more)`;
        }
        html += '</div>';
      }
      
      html += '</div>';
      
      if (index < definitions.length - 1) {
        html += '<br>';
      }
    });
    
    html += '</div>';
    return html;
  }

  /**
   * Format definition text based on user's context and languages
   */
  private static async formatDefinitionForUser(sense: string, fromLang: string, toLang: string): Promise<string> {
    if (!sense) return 'Translation available';
    
    // For Spanish users reading English definitions, translate via ML Kit
    if (fromLang === 'en' && toLang === 'es' && sense.trim()) {
      try {
        const Translation = (await import('../services')).Translation;
        const result = await Translation.translate(sense, {
          from: 'en',
          to: 'es',
          timeoutMs: 5000
        });
        
        if (result.text) {
          console.log(`📖 Translated definition: "${sense}" → "${result.text}"`);
          return result.text;
        }
      } catch (error) {
        console.log(`📖 Translation failed for definition, using original: ${error}`);
      }
    }
    
    // Return original if translation fails or not needed
    return sense;
  }

  /**
   * Generate contextual examples based on user's language profile
   */
  private static generateContextualExample(
    word: string, 
    sense: string, 
    translation: string, 
    fromLang: string, 
    toLang: string
  ): string | undefined {
    // Generate examples that help the user understand usage in their native context
    if (fromLang === 'en' && toLang === 'es') {
      // Spanish user learning English
      return `"${word}" se usa como: "${sense}" → "${translation}"`;
    }
    
    if (fromLang === 'es' && toLang === 'en') {
      // English user learning Spanish
      return `"${word}" is used as: "${sense}" → "${translation}"`;
    }
    
    return `"${word}" → "${translation}"`;
  }

  /**
   * Get synonyms in the target language
   */
  private static getTargetLanguageSynonyms(primaryTranslation: string, toLang: string): string[] {
    // This could be enhanced with a synonym database
    const commonSynonyms: Record<string, Record<string, string[]>> = {
      es: {
        'hola': ['saludo', 'buenos días', 'buenas tardes'],
        'casa': ['hogar', 'vivienda', 'domicilio'],
        'grande': ['enorme', 'gigante', 'amplio']
      },
      en: {
        'hello': ['hi', 'greetings', 'good day'],
        'house': ['home', 'residence', 'dwelling'],
        'big': ['large', 'huge', 'enormous']
      }
    };
    
    return commonSynonyms[toLang]?.[primaryTranslation.toLowerCase()] || [];
  }

  /**
   * Get cultural notes for better understanding
   */
  private static getCulturalNotes(word: string, fromLang: string, toLang: string): string[] {
    // Provide cultural context that helps users understand usage differences
    const culturalNotes: Record<string, Record<string, string[]>> = {
      'en-es': {
        'hello': ['En español, el saludo cambia según la hora del día'],
        'please': ['En español, "por favor" es más formal que en inglés']
      },
      'es-en': {
        'hola': ['In English, "hello" works for any time of day'],
        'usted': ['English "you" doesn\'t distinguish formal/informal like Spanish']
      }
    };
    
    const key = `${fromLang}-${toLang}`;
    return culturalNotes[key]?.[word.toLowerCase()] || [];
  }

  /**
   * Estimate word frequency for learning prioritization
   */
  private static estimateWordFrequency(word: string, language: string): number {
    // Basic frequency estimation - could be enhanced with real frequency data
    const commonWords = {
      en: ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it'],
      es: ['que', 'de', 'no', 'a', 'la', 'el', 'ser', 'y', 'tener', 'hacer']
    };
    
    const langCommon = commonWords[language as keyof typeof commonWords] || [];
    const index = langCommon.indexOf(word.toLowerCase());
    
    if (index !== -1) {
      return index + 1; // Top 10 most common words
    }
    
    // Estimate based on word length and complexity
    if (word.length <= 4) return Math.floor(Math.random() * 1000) + 100;
    if (word.length <= 7) return Math.floor(Math.random() * 5000) + 1000;
    return Math.floor(Math.random() * 10000) + 5000;
  }

  /**
   * Estimate difficulty level for learning
   */
  private static estimateDifficulty(word: string, language: string): 'beginner' | 'intermediate' | 'advanced' {
    // Basic difficulty estimation
    if (word.length <= 4) return 'beginner';
    if (word.length <= 8) return 'intermediate';
    return 'advanced';
  }

  /**
   * Force reload databases (useful after new language packs are installed)
   */
  static async reloadDatabases(): Promise<void> {
    console.log('📚 SQLiteDictionaryService: Force reloading databases...');
    
    // Close existing databases
    for (const [key, db] of this.databases.entries()) {
      try {
        await db.closeAsync();
        console.log(`📚 Closed database: ${key}`);
      } catch (error) {
        console.log(`📚 Error closing database ${key}:`, error);
      }
    }
    
    // Clear database map
    this.databases.clear();
    
    // Reload all available dictionaries
    await this.openAvailableDictionaries();
    
    console.log(`📚 ✅ Databases reloaded. Available: ${Array.from(this.databases.keys()).join(', ')}`);
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
      version: '1.0.0-sqlite-wikidict',
      availableLanguages: this.getAvailableLanguages()
    };
  }
}

export default SQLiteDictionaryService;
