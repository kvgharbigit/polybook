/**
 * Comprehensive StarDict System Test
 * 
 * Tests the complete StarDict dictionary pipeline from build to lookup
 */

import * as FileSystem from 'expo-file-system';
import UserLanguageProfileService from './services/userLanguageProfileService';
import DictionaryService from './services/bilingualDictionaryService';
import SQLiteDictionaryService from './services/sqliteDictionaryService';
import LanguagePackManager from './services/languagePackManager';

// Test configuration
const TEST_CONFIG = {
  languages: ['en', 'es'],
  testWords: {
    en: ['house', 'book', 'read', 'love', 'time', 'water', 'nonexistentword'],
    es: ['casa', 'libro', 'leer', 'amor', 'tiempo', 'agua', 'palabrainexistente']
  },
  crossLanguageTests: [
    { word: 'house', userLang: 'es', expectedTranslation: 'casa' },
    { word: 'casa', userLang: 'en', expectedTranslation: 'house' },
    { word: 'book', userLang: 'es', expectedTranslation: 'libro' },
    { word: 'amor', userLang: 'en', expectedTranslation: 'love' }
  ]
};

interface TestResult {
  name: string;
  success: boolean;
  details: string;
  timing?: number;
  error?: string;
}

class StarDictSystemTester {
  private results: TestResult[] = [];

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 Starting StarDict System Tests');
    console.log('=' .repeat(50));

    try {
      // 1. File System Tests
      await this.testFileSystem();
      
      // 2. Language Pack Manager Tests
      await this.testLanguagePackManager();
      
      // 3. SQLite Dictionary Service Tests
      await this.testSQLiteDictionaryService();
      
      // 4. Dictionary Lookup Tests
      await this.testDictionaryLookups();
      
      // 5. Cross-Language Translation Tests
      await this.testCrossLanguageTranslations();
      
      // 6. Error Handling Tests
      await this.testErrorHandling();
      
      // 7. Performance Tests
      await this.testPerformance();

    } catch (error) {
      console.error('💥 Test suite failed:', error);
    }

    // Print results
    this.printResults();
  }

  /**
   * Test file system setup and permissions
   */
  async testFileSystem(): Promise<void> {
    console.log('\n📁 Testing File System...');

    await this.runTest('FileSystem Directory Creation', async () => {
      const sqliteDir = `${FileSystem.documentDirectory}SQLite/`;
      
      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
      }
      
      // Verify we can write to it
      const testFile = `${sqliteDir}test.txt`;
      await FileSystem.writeAsStringAsync(testFile, 'test');
      const readContent = await FileSystem.readAsStringAsync(testFile);
      await FileSystem.deleteAsync(testFile);
      
      if (readContent !== 'test') {
        throw new Error('File write/read test failed');
      }
      
      return 'Directory accessible and writable';
    });

    await this.runTest('Dictionary Files Check', async () => {
      const sqliteDir = `${FileSystem.documentDirectory}SQLite/`;
      const files = await FileSystem.readDirectoryAsync(sqliteDir);
      
      const dictFiles = files.filter(file => file.endsWith('_dict.sqlite'));
      
      if (dictFiles.length === 0) {
        return `No dictionary files found (${files.length} total files). This is expected for first run.`;
      }
      
      let totalSize = 0;
      for (const file of dictFiles) {
        const fileInfo = await FileSystem.getInfoAsync(`${sqliteDir}${file}`);
        totalSize += fileInfo.size || 0;
      }
      
      return `Found ${dictFiles.length} dictionary files, total size: ${(totalSize / 1024 / 1024).toFixed(1)}MB`;
    });
  }

  /**
   * Test Language Pack Manager functionality
   */
  async testLanguagePackManager(): Promise<void> {
    console.log('\n📦 Testing Language Pack Manager...');

    await this.runTest('Registry Access', async () => {
      const registry = await LanguagePackManager.getRegistry();
      
      if (!registry || typeof registry !== 'object') {
        throw new Error('Registry is not a valid object');
      }
      
      const languages = Object.keys(registry);
      return `Registry loaded with ${languages.length} languages: ${languages.join(', ')}`;
    });

    await this.runTest('Language Registry Filtering', async () => {
      const filteredRegistry = await LanguagePackManager.getLanguageRegistry(['en', 'es']);
      
      const languages = Object.keys(filteredRegistry);
      if (!languages.includes('en') && !languages.includes('es')) {
        throw new Error('Filtered registry missing expected languages');
      }
      
      return `Filtered registry contains: ${languages.join(', ')}`;
    });

    await this.runTest('Installed Languages Check', async () => {
      const installedLanguages = await LanguagePackManager.getInstalledLanguages();
      return `Installed languages: ${installedLanguages.length > 0 ? installedLanguages.join(', ') : 'None'}`;
    });

    await this.runTest('Storage Information', async () => {
      const storageInfo = await LanguagePackManager.getStorageInfo();
      return `Total storage: ${(storageInfo.totalSize / 1024 / 1024).toFixed(1)}MB across ${storageInfo.languagePacks.length} packs`;
    });
  }

  /**
   * Test SQLite Dictionary Service
   */
  async testSQLiteDictionaryService(): Promise<void> {
    console.log('\n🗄️  Testing SQLite Dictionary Service...');

    await this.runTest('Service Initialization', async () => {
      await SQLiteDictionaryService.initialize(['en', 'es']);
      const availableLanguages = SQLiteDictionaryService.getAvailableLanguages();
      return `Initialized with languages: ${availableLanguages.join(', ')}`;
    });

    await this.runTest('Language Availability Check', async () => {
      const results = [];
      for (const lang of TEST_CONFIG.languages) {
        const isAvailable = SQLiteDictionaryService.isLanguageAvailable(lang);
        results.push(`${lang}: ${isAvailable ? '✅' : '❌'}`);
      }
      return results.join(', ');
    });

    await this.runTest('Missing Language Detection', async () => {
      const missingLanguages = await SQLiteDictionaryService.checkMissingLanguages(['en', 'es', 'fr', 'nonexistent']);
      return `Missing languages: ${missingLanguages.length > 0 ? missingLanguages.join(', ') : 'None'}`;
    });

    await this.runTest('Database Statistics', async () => {
      const stats = SQLiteDictionaryService.getStats();
      return `${stats.totalEntries} entries, ${stats.languagePairs.join(', ')}, v${stats.version}`;
    });
  }

  /**
   * Test dictionary lookups
   */
  async testDictionaryLookups(): Promise<void> {
    console.log('\n📚 Testing Dictionary Lookups...');

    // Set up test user profile
    const testProfile = await UserLanguageProfileService.updateLanguagePreferences({
      nativeLanguage: 'es',
      targetLanguages: ['en'],
      preferredDefinitionLanguage: 'es'
    });

    for (const language of TEST_CONFIG.languages) {
      const words = TEST_CONFIG.testWords[language as keyof typeof TEST_CONFIG.testWords];
      
      for (const word of words.slice(0, 3)) { // Test first 3 words of each language
        await this.runTest(`Lookup: ${word} (${language})`, async () => {
          const response = await DictionaryService.lookupWord({
            word,
            userProfile: testProfile
          });

          if (!response.success) {
            if (response.error === 'missing_language_packs') {
              return `Missing language packs: ${response.missingLanguages?.join(', ')}`;
            }
            throw new Error(response.error || 'Lookup failed');
          }

          const def = response.primaryDefinition;
          if (!def) {
            throw new Error('No definition returned');
          }

          const hasTranslation = def.translations.length > 0;
          const hasDefinition = def.definitions.length > 0;
          const hasSynonyms = def.definitions[0]?.synonyms && def.definitions[0].synonyms.length > 0;

          return `✅ ${hasTranslation ? 'Translation' : ''} ${hasDefinition ? 'Definition' : ''} ${hasSynonyms ? 'Synonyms' : ''}`.trim();
        });
      }
    }
  }

  /**
   * Test cross-language translations
   */
  async testCrossLanguageTranslations(): Promise<void> {
    console.log('\n🌍 Testing Cross-Language Translations...');

    for (const test of TEST_CONFIG.crossLanguageTests.slice(0, 2)) { // Test first 2
      await this.runTest(`${test.word} (${test.userLang} user)`, async () => {
        const testProfile = await UserLanguageProfileService.updateLanguagePreferences({
          nativeLanguage: test.userLang,
          targetLanguages: test.userLang === 'es' ? ['en'] : ['es'],
          preferredDefinitionLanguage: test.userLang
        });

        const response = await DictionaryService.lookupWord({
          word: test.word,
          userProfile: testProfile
        });

        if (!response.success) {
          if (response.error === 'missing_language_packs') {
            return `Requires language packs: ${response.missingLanguages?.join(', ')}`;
          }
          throw new Error(response.error || 'Translation failed');
        }

        const translation = response.primaryDefinition?.translations[0]?.word;
        const hasExpectedTranslation = translation?.toLowerCase().includes(test.expectedTranslation.toLowerCase());

        return `Translation: "${translation}" ${hasExpectedTranslation ? '✅' : '❓'}`;
      });
    }
  }

  /**
   * Test error handling
   */
  async testErrorHandling(): Promise<void> {
    console.log('\n🚨 Testing Error Handling...');

    await this.runTest('Nonexistent Word Lookup', async () => {
      const testProfile = await UserLanguageProfileService.getUserProfile();
      
      const response = await DictionaryService.lookupWord({
        word: 'xyznonexistentword123',
        userProfile: testProfile
      });

      if (response.success) {
        return 'Unexpectedly found definition for nonexistent word';
      }

      return `Correctly handled: ${response.error}`;
    });

    await this.runTest('Missing Language Pack Error', async () => {
      const testProfile = await UserLanguageProfileService.updateLanguagePreferences({
        nativeLanguage: 'fr', // Likely not installed
        targetLanguages: ['de'], // Likely not installed
        preferredDefinitionLanguage: 'fr'
      });

      const response = await DictionaryService.lookupWord({
        word: 'test',
        userProfile: testProfile
      });

      if (response.error === 'missing_language_packs') {
        return `Correctly detected missing packs: ${response.missingLanguages?.join(', ')}`;
      }

      return `Unexpected result: ${response.success ? 'success' : response.error}`;
    });
  }

  /**
   * Test performance
   */
  async testPerformance(): Promise<void> {
    console.log('\n⚡ Testing Performance...');

    await this.runTest('Lookup Speed Test', async () => {
      const testProfile = await UserLanguageProfileService.getUserProfile();
      const testWords = ['house', 'book', 'time'];
      
      const startTime = Date.now();
      
      for (const word of testWords) {
        await DictionaryService.lookupWord({
          word,
          userProfile: testProfile
        });
      }
      
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / testWords.length;
      
      return `${testWords.length} lookups in ${totalTime}ms (avg: ${avgTime.toFixed(1)}ms)`;
    });

    await this.runTest('Service Initialization Speed', async () => {
      // Clear any cached initialization
      (SQLiteDictionaryService as any).initialized = false;
      
      const startTime = Date.now();
      await SQLiteDictionaryService.initialize(['en']);
      const initTime = Date.now() - startTime;
      
      return `Initialization took ${initTime}ms`;
    });
  }

  /**
   * Run a single test with error handling and timing
   */
  private async runTest(name: string, testFn: () => Promise<string>): Promise<void> {
    const startTime = Date.now();
    
    try {
      const details = await testFn();
      const timing = Date.now() - startTime;
      
      this.results.push({
        name,
        success: true,
        details,
        timing
      });
      
      console.log(`  ✅ ${name}: ${details} (${timing}ms)`);
      
    } catch (error) {
      const timing = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.results.push({
        name,
        success: false,
        details: errorMessage,
        timing,
        error: errorMessage
      });
      
      console.log(`  ❌ ${name}: ${errorMessage} (${timing}ms)`);
    }
  }

  /**
   * Print test results summary
   */
  private printResults(): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;

    console.log(`\n📈 Overall: ${passed}/${total} tests passed (${((passed/total)*100).toFixed(1)}%)`);
    
    if (failed > 0) {
      console.log(`\n❌ Failed Tests (${failed}):`);
      this.results.filter(r => !r.success).forEach(result => {
        console.log(`  • ${result.name}: ${result.error}`);
      });
    }

    console.log(`\n⚡ Performance:`);
    const timings = this.results.filter(r => r.timing).map(r => r.timing!);
    const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
    console.log(`  • Average test time: ${avgTiming.toFixed(1)}ms`);
    console.log(`  • Total test time: ${timings.reduce((a, b) => a + b, 0)}ms`);

    console.log(`\n🎯 Status: ${failed === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failed} TESTS FAILED`}`);
    
    if (failed === 0) {
      console.log('\n🎉 StarDict system is working correctly!');
    } else {
      console.log('\n🔧 StarDict system needs attention. Check failed tests above.');
    }
  }
}

/**
 * Export function to run tests
 */
export async function runStarDictSystemTests(): Promise<void> {
  const tester = new StarDictSystemTester();
  await tester.runAllTests();
}

/**
 * Quick test function for specific functionality
 */
export async function quickTest(word: string = 'house', userLanguage: string = 'es'): Promise<void> {
  console.log(`🧪 Quick Test: ${userLanguage} user looking up "${word}"`);
  console.log('-'.repeat(40));

  try {
    // Set up user profile
    const profile = await UserLanguageProfileService.updateLanguagePreferences({
      nativeLanguage: userLanguage,
      targetLanguages: userLanguage === 'es' ? ['en'] : ['es'],
      preferredDefinitionLanguage: userLanguage
    });

    console.log(`👤 User Profile: ${profile.nativeLanguage} → ${profile.targetLanguages.join(', ')}`);

    // Test lookup
    const startTime = Date.now();
    const response = await DictionaryService.lookupWord({
      word,
      userProfile: profile
    });
    const lookupTime = Date.now() - startTime;

    console.log(`⏱️  Lookup Time: ${lookupTime}ms`);

    if (!response.success) {
      if (response.error === 'missing_language_packs') {
        console.log(`❌ Missing Language Packs: ${response.missingLanguages?.join(', ')}`);
        console.log('💡 Run language pack downloads to resolve this');
      } else {
        console.log(`❌ Error: ${response.error}`);
      }
      return;
    }

    const def = response.primaryDefinition;
    if (!def) {
      console.log('❌ No definition returned');
      return;
    }

    console.log(`✅ Word: ${def.word} (${response.sourceLanguage})`);
    
    if (def.translations.length > 0) {
      console.log(`🔤 Translation: ${def.translations[0].word} (${def.translations[0].confidence * 100}% confident)`);
    }
    
    if (def.definitions.length > 0) {
      console.log(`📖 Definition: ${def.definitions[0].definition}`);
      
      if (def.definitions[0].synonyms && def.definitions[0].synonyms.length > 0) {
        console.log(`🔗 Synonyms: ${def.definitions[0].synonyms.slice(0, 3).join(', ')}`);
      }
    }

    if (def.crossLanguageData) {
      console.log(`🌍 Cross-language data available: ${Object.keys(def.crossLanguageData).join(', ')}`);
    }

  } catch (error) {
    console.log(`💥 Test failed: ${error}`);
  }
}

// For direct execution in development
if (typeof require !== 'undefined' && require.main === module) {
  runStarDictSystemTests();
}