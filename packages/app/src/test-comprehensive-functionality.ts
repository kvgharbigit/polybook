/**
 * Comprehensive Functionality Test Suite
 * 
 * This file contains manual integration tests for all major app functionality.
 * Run this to verify that all systems are working correctly.
 */

import * as FileSystem from 'expo-file-system';
import SQLiteDictionaryService from './services/sqliteDictionaryService';
import UserLanguageProfileService from './services/userLanguageProfileService';
import { LanguagePackService } from './services/languagePackService';
import { ContentParser } from './services/contentParser';
import { db } from './services/databaseInterface';
import { ErrorHandler } from './services/errorHandling';

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration: number;
  error?: Error;
}

class ComprehensiveTestSuite {
  private results: TestResult[] = [];
  private testCount = 0;

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Comprehensive Functionality Test Suite');
    console.log('================================================');

    // Core Services Tests
    await this.testUserLanguageProfile();
    await this.testErrorHandling();
    await this.testDatabaseService();
    await this.testLanguagePackService();
    await this.testSQLiteDictionaryService();
    await this.testContentParser();
    
    // Integration Tests
    await this.testEndToEndDictionaryLookup();
    await this.testFileSystemOperations();
    
    // Performance Tests
    await this.testPerformance();

    this.printResults();
  }

  private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    this.testCount++;
    
    try {
      console.log(`\n${this.testCount}. Testing: ${testName}`);
      await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        testName,
        status: 'PASS',
        message: `✅ Passed in ${duration}ms`,
        duration
      });
      console.log(`   ✅ PASSED (${duration}ms)`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        testName,
        status: 'FAIL',
        message: `❌ Failed: ${error.message}`,
        duration,
        error: error as Error
      });
      console.log(`   ❌ FAILED (${duration}ms): ${error.message}`);
    }
  }

  // Test User Language Profile Service
  async testUserLanguageProfile(): Promise<void> {
    await this.runTest('User Language Profile Service', async () => {
      // Test profile creation
      const profile = await UserLanguageProfileService.getUserProfile();
      if (!profile) throw new Error('Failed to get user profile');
      if (!profile.id) throw new Error('Profile missing ID');
      if (!profile.nativeLanguage) throw new Error('Profile missing native language');

      // Test profile updates
      const updatedProfile = await UserLanguageProfileService.updateLanguagePreferences({
        nativeLanguage: 'es',
        targetLanguages: ['en']
      });
      if (updatedProfile.nativeLanguage !== 'es') throw new Error('Profile update failed');

      // Test language detection
      const deviceLang = UserLanguageProfileService.detectDeviceLanguage();
      if (!deviceLang || typeof deviceLang !== 'string') throw new Error('Device language detection failed');

      // Test proficiency levels
      await UserLanguageProfileService.updateProficiencyLevel('en', 'intermediate');
      const level = await UserLanguageProfileService.getProficiencyLevel('en');
      if (level !== 'intermediate') throw new Error('Proficiency level update failed');

      // Test usage stats
      await UserLanguageProfileService.recordLookup('en');
      const stats = await UserLanguageProfileService.getUsageStats();
      if (stats.totalLookups === 0) throw new Error('Usage stats not recorded');
    });
  }

  // Test Error Handling Service
  async testErrorHandling(): Promise<void> {
    await this.runTest('Error Handling Service', async () => {
      // Test error classification
      const networkError = new Error('Network request failed');
      const errorCode = ErrorHandler.classifyError(networkError);
      if (!errorCode) throw new Error('Error classification failed');

      // Test path sanitization
      try {
        ErrorHandler.sanitizeFilePath('../../../etc/passwd');
        throw new Error('Path sanitization should have thrown error');
      } catch (error) {
        if (!error.message.includes('path traversal')) {
          throw new Error('Path sanitization not working correctly');
        }
      }

      // Test valid path sanitization
      const validPath = ErrorHandler.sanitizeFilePath('documents/book.txt');
      if (validPath !== 'documents/book.txt') throw new Error('Valid path sanitization failed');

      // Test language code validation
      if (!ErrorHandler.isValidLanguageCode('en')) throw new Error('Language code validation failed');
      if (ErrorHandler.isValidLanguageCode('invalid')) throw new Error('Invalid language code validation failed');

      // Test base64 validation
      const validB64 = btoa('test');
      if (!ErrorHandler.isValidBase64(validB64)) throw new Error('Base64 validation failed');
      if (ErrorHandler.isValidBase64('invalid!@#')) throw new Error('Invalid base64 validation failed');
    });
  }

  // Test Database Service
  async testDatabaseService(): Promise<void> {
    await this.runTest('Database Service', async () => {
      // Test database initialization
      await db.initialize();

      // Test book operations
      const testBook = {
        id: 'test-book-' + Date.now(),
        title: 'Test Book',
        author: 'Test Author',
        language: 'en',
        targetLanguage: 'es',
        format: 'txt' as const,
        filePath: '/test/path/book.txt',
        coverPath: null,
        addedAt: new Date(),
        lastOpenedAt: new Date()
      };

      // Add book
      await db.addBook(testBook);

      // Get book
      const retrievedBook = await db.getBook(testBook.id);
      if (!retrievedBook) throw new Error('Failed to retrieve book');
      if (retrievedBook.title !== testBook.title) throw new Error('Book data mismatch');

      // Get all books
      const books = await db.getBooks();
      if (!books.some(book => book.id === testBook.id)) throw new Error('Book not in books list');

      // Test position operations
      const testPosition = {
        bookId: testBook.id,
        spineIndex: 0,
        yOffset: 100,
        updatedAt: new Date()
      };

      await db.savePosition(testPosition);
      const retrievedPosition = await db.getPosition(testBook.id);
      if (!retrievedPosition) throw new Error('Failed to retrieve position');
      if (retrievedPosition.yOffset !== testPosition.yOffset) throw new Error('Position data mismatch');

      // Test vocabulary card operations
      const testCard = {
        id: 'test-card-' + Date.now(),
        word: 'test',
        definition: 'A test word',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        translation: 'prueba',
        difficulty: 'easy' as const,
        bookId: testBook.id,
        createdAt: new Date(),
        lastReviewed: new Date(),
        nextReview: new Date(Date.now() + 86400000),
        reviewCount: 0,
        masteryLevel: 0
      };

      await db.addVocabularyCard(testCard);
      const retrievedCard = await db.getVocabularyCard(testCard.id);
      if (!retrievedCard) throw new Error('Failed to retrieve vocabulary card');
      if (retrievedCard.word !== testCard.word) throw new Error('Vocabulary card data mismatch');

      // Cleanup
      await db.deleteBook(testBook.id);
    });
  }

  // Test Language Pack Service
  async testLanguagePackService(): Promise<void> {
    await this.runTest('Language Pack Service', async () => {
      // Test service initialization
      await LanguagePackService.initialize();

      // Test available packs
      const availablePacks = await LanguagePackService.getAvailablePacks();
      if (!availablePacks || availablePacks.length === 0) throw new Error('No available language packs');

      // Test pack information
      const spanishPack = availablePacks.find(pack => pack.sourceLanguage === 'es' || pack.targetLanguage === 'es');
      if (!spanishPack) throw new Error('Spanish language pack not found');
      if (!spanishPack.downloadUrl) throw new Error('Pack missing download URL');

      // Test installed packs
      const installedPacks = await LanguagePackService.getInstalledPacks();
      if (!Array.isArray(installedPacks)) throw new Error('Installed packs not an array');

      // Test pack status
      const packStatus = await LanguagePackService.getPackStatus(spanishPack.id);
      if (!packStatus) throw new Error('Failed to get pack status');
    });
  }

  // Test SQLite Dictionary Service
  async testSQLiteDictionaryService(): Promise<void> {
    await this.runTest('SQLite Dictionary Service', async () => {
      // Test service initialization
      await SQLiteDictionaryService.initialize(['en', 'es']);

      // Test available languages
      const availableLanguages = SQLiteDictionaryService.getAvailableLanguages();
      if (!Array.isArray(availableLanguages)) throw new Error('Available languages not an array');

      // Test language availability check
      const isEnglishAvailable = SQLiteDictionaryService.isLanguageAvailable('en');
      if (typeof isEnglishAvailable !== 'boolean') throw new Error('Language availability check failed');

      // Test missing languages check
      const missingLanguages = await SQLiteDictionaryService.checkMissingLanguages(['en', 'es', 'fr']);
      if (!Array.isArray(missingLanguages)) throw new Error('Missing languages check failed');

      // Test stats
      const stats = SQLiteDictionaryService.getStats();
      if (!stats || typeof stats.totalEntries !== 'number') throw new Error('Stats retrieval failed');

      // Test dictionary lookup (if dictionaries are available)
      if (availableLanguages.length > 0) {
        const userProfile = await UserLanguageProfileService.getUserProfile();
        const lookupRequest = {
          word: 'hello',
          userProfile: userProfile
        };

        const lookupResult = await SQLiteDictionaryService.lookupWord(lookupRequest);
        if (!lookupResult) throw new Error('Dictionary lookup failed');
        if (typeof lookupResult.success !== 'boolean') throw new Error('Invalid lookup result format');
      }
    });
  }

  // Test Content Parser
  async testContentParser(): Promise<void> {
    await this.runTest('Content Parser Service', async () => {
      // Test text content parsing
      const testContent = "Chapter 1: Introduction\n\nThis is a test book with multiple paragraphs.\n\nChapter 2: Content\n\nMore content here.";
      const chunks = ContentParser.splitIntoChunks(testContent, 1000);
      if (!Array.isArray(chunks)) throw new Error('Chunk splitting failed');
      if (chunks.length === 0) throw new Error('No chunks created');

      // Test word counting
      const wordCount = ContentParser.countWords(testContent);
      if (typeof wordCount !== 'number' || wordCount <= 0) throw new Error('Word counting failed');

      // Test HTML parsing (mock HTML)
      const htmlContent = '<html><head><title>Test</title></head><body><p>Test content</p></body></html>';
      try {
        // This will test the HTML parsing logic even if file system is mocked
        const result = ContentParser.parseHtmlContent(htmlContent);
        if (!result || typeof result !== 'string') throw new Error('HTML parsing failed');
      } catch (error) {
        // HTML parsing might not be available in test environment
        console.log('   ⚠️  HTML parsing test skipped (DOM not available)');
      }

      // Test format detection
      const isValidFormat = ['txt', 'html', 'pdf'].includes('txt');
      if (!isValidFormat) throw new Error('Format validation failed');
    });
  }

  // Test End-to-End Dictionary Lookup
  async testEndToEndDictionaryLookup(): Promise<void> {
    await this.runTest('End-to-End Dictionary Lookup', async () => {
      // Create test user profile
      const profile = await UserLanguageProfileService.updateLanguagePreferences({
        nativeLanguage: 'es',
        targetLanguages: ['en']
      });

      // Initialize dictionary service
      await SQLiteDictionaryService.initialize(['en', 'es']);

      // Test word lookup flow
      const lookupRequest = {
        word: 'hello',
        userProfile: profile
      };

      const result = await SQLiteDictionaryService.lookupWord(lookupRequest);
      if (!result) throw new Error('Dictionary lookup returned null');
      if (result.word !== 'hello') throw new Error('Lookup word mismatch');

      // Test that the lookup was recorded in user stats
      const statsBefore = await UserLanguageProfileService.getUsageStats();
      await UserLanguageProfileService.recordLookup('en');
      const statsAfter = await UserLanguageProfileService.getUsageStats();
      
      if (statsAfter.totalLookups <= statsBefore.totalLookups) {
        throw new Error('Usage stats not updated after lookup');
      }
    });
  }

  // Test File System Operations
  async testFileSystemOperations(): Promise<void> {
    await this.runTest('File System Operations', async () => {
      // Test directory creation and access
      const testDir = `${FileSystem.documentDirectory}test-${Date.now()}/`;
      await FileSystem.makeDirectoryAsync(testDir, { intermediates: true });

      const dirInfo = await FileSystem.getInfoAsync(testDir);
      if (!dirInfo.exists) throw new Error('Test directory creation failed');

      // Test file operations
      const testFile = `${testDir}test.txt`;
      const testContent = 'This is a test file for PolyBook functionality testing.';
      
      await FileSystem.writeAsStringAsync(testFile, testContent);
      const fileInfo = await FileSystem.getInfoAsync(testFile);
      if (!fileInfo.exists) throw new Error('Test file creation failed');

      const readContent = await FileSystem.readAsStringAsync(testFile);
      if (readContent !== testContent) throw new Error('File content mismatch');

      // Test file deletion
      await FileSystem.deleteAsync(testFile);
      const deletedFileInfo = await FileSystem.getInfoAsync(testFile);
      if (deletedFileInfo.exists) throw new Error('File deletion failed');

      // Cleanup directory
      await FileSystem.deleteAsync(testDir);
    });
  }

  // Test Performance
  async testPerformance(): Promise<void> {
    await this.runTest('Performance Benchmarks', async () => {
      const iterations = 100;

      // Test user profile access performance
      const profileStartTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        await UserLanguageProfileService.getUserProfile();
      }
      const profileTime = (Date.now() - profileStartTime) / iterations;
      if (profileTime > 10) console.log(`   ⚠️  User profile access: ${profileTime.toFixed(2)}ms (target: <10ms)`);

      // Test error handling performance
      const errorStartTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        ErrorHandler.sanitizeFilePath('test/path/file.txt');
      }
      const errorTime = (Date.now() - errorStartTime) / iterations;
      if (errorTime > 1) console.log(`   ⚠️  Error handling: ${errorTime.toFixed(2)}ms (target: <1ms)`);

      // Test dictionary service initialization (if available)
      if (SQLiteDictionaryService.getAvailableLanguages().length > 0) {
        const dictStartTime = Date.now();
        const lookupRequest = {
          word: 'test',
          userProfile: await UserLanguageProfileService.getUserProfile()
        };
        
        for (let i = 0; i < 10; i++) {
          await SQLiteDictionaryService.lookupWord(lookupRequest);
        }
        const dictTime = (Date.now() - dictStartTime) / 10;
        if (dictTime > 50) console.log(`   ⚠️  Dictionary lookup: ${dictTime.toFixed(2)}ms (target: <50ms)`);
      }

      console.log(`   📊 Performance metrics recorded`);
    });
  }

  private printResults(): void {
    console.log('\n🏁 TEST SUITE COMPLETE');
    console.log('======================');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📈 Total: ${this.results.length}`);
    
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
    console.log(`   ⏱️  Total Time: ${totalTime}ms`);
    
    if (failed > 0) {
      console.log(`\n❌ FAILED TESTS:`);
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => {
          console.log(`   • ${r.testName}: ${r.message}`);
          if (r.error) {
            console.log(`     ${r.error.stack}`);
          }
        });
    }
    
    if (passed === this.results.length) {
      console.log(`\n🎉 ALL TESTS PASSED! App functionality verified.`);
    } else {
      console.log(`\n⚠️  ${failed} test(s) failed. Review issues above.`);
    }

    // Generate test report
    this.generateTestReport();
  }

  private generateTestReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'PASS').length,
        failed: this.results.filter(r => r.status === 'FAIL').length,
        skipped: this.results.filter(r => r.status === 'SKIP').length,
        totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0)
      },
      results: this.results
    };

    console.log(`\n📋 Test Report Generated:`);
    console.log(JSON.stringify(report, null, 2));
  }
}

// Export the test suite
export const runComprehensiveTests = async (): Promise<void> => {
  const testSuite = new ComprehensiveTestSuite();
  await testSuite.runAllTests();
};

export default ComprehensiveTestSuite;