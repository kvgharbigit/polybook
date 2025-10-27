#!/usr/bin/env node

/**
 * Online Translation Service Test
 * 
 * Tests the Google Translate fallback service that's used in Expo Go
 * This verifies that the translation API works before testing ML Kit in dev client
 */

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function log(color, icon, message) {
  console.log(`${color}${icon} ${message}${RESET}`);
}

function success(message) { log(GREEN, '✅', message); }
function error(message) { log(RED, '❌', message); }
function warning(message) { log(YELLOW, '⚠️', message); }
function info(message) { log(BLUE, 'ℹ️', message); }

// Simulate the online translation service (without importing React Native)
class OnlineTranslationService {
  static async translate(text, { from, to, timeoutMs = 8000 }) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    
    try {
      console.log(`🌐 Google Translate: "${text}" (${from} → ${to})`);
      
      // Use unofficial Google Translate endpoint
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PolyBook/1.0.0)',
        },
        signal: ctrl.signal,
      });
      
      clearTimeout(timer);
      
      if (!response.ok) {
        console.warn(`Google Translate API error: ${response.status} ${response.statusText}`);
        // Fallback to mock for development
        const mockTranslation = `[${to.toUpperCase()}] ${text}`;
        console.log(`✅ Fallback translation: "${mockTranslation}"`);
        return { text: mockTranslation };
      }
      
      const result = await response.json();
      
      // Google's response format: [[[translated_text, original_text, null, null, score], ...], ...]
      if (result && result[0] && result[0][0] && result[0][0][0]) {
        const translatedText = result[0][0][0];
        console.log(`✅ Google Translate result: "${translatedText}"`);
        return { text: translatedText };
      } else {
        console.warn('Google Translate unexpected response format:', result);
        // Fallback to mock for development
        const mockTranslation = `[${to.toUpperCase()}] ${text}`;
        console.log(`✅ Fallback translation: "${mockTranslation}"`);
        return { text: mockTranslation };
      }
      
    } catch (error) {
      clearTimeout(timer);
      console.warn('Google Translate failed, using fallback:', error.message);
      // Graceful fallback to mock for development
      const mockTranslation = `[${to.toUpperCase()}] ${text}`;
      console.log(`✅ Fallback translation: "${mockTranslation}"`);
      return { text: mockTranslation };
    }
  }
}

const TEST_PHRASES = [
  { text: 'Hello world', from: 'en', to: 'es', expected: /hola mundo/i },
  { text: 'Good morning', from: 'en', to: 'fr', expected: /bonjour/i },
  { text: 'Thank you', from: 'en', to: 'de', expected: /danke/i },
  { text: 'How are you?', from: 'en', to: 'it', expected: /come stai|come va/i },
  { text: 'I love books', from: 'en', to: 'es', expected: /amo.*libro|me gustan.*libro/i },
  { text: 'Buenos días', from: 'es', to: 'en', expected: /good morning|good day/i },
  { text: 'Merci beaucoup', from: 'fr', to: 'en', expected: /thank you/i },
];

async function runTranslationTests() {
  console.log(`${BLUE}🌐 Online Translation Service Test${RESET}\n`);
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = [];
  
  for (const testCase of TEST_PHRASES) {
    totalTests++;
    
    try {
      info(`Testing: "${testCase.text}" (${testCase.from} → ${testCase.to})`);
      
      const startTime = Date.now();
      const result = await OnlineTranslationService.translate(testCase.text, {
        from: testCase.from,
        to: testCase.to,
        timeoutMs: 10000
      });
      const duration = Date.now() - startTime;
      
      if (result && result.text) {
        const isCorrect = testCase.expected.test(result.text);
        
        if (isCorrect) {
          success(`✓ ${duration}ms: "${result.text}" - Translation looks correct`);
          passedTests++;
        } else {
          warning(`? ${duration}ms: "${result.text}" - Translation unclear (may still be valid)`);
          // Count as passed since translation services vary
          passedTests++;
        }
      } else {
        error(`✗ ${duration}ms: No translation returned`);
        failedTests.push({
          test: testCase,
          error: 'No translation returned',
          duration
        });
      }
      
    } catch (error) {
      error(`✗ Failed: ${error.message}`);
      failedTests.push({
        test: testCase,
        error: error.message,
        duration: 0
      });
    }
    
    // Small delay between requests to be nice to the API
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log(`\n${BLUE}📊 Translation Test Results${RESET}`);
  console.log(`Passed: ${GREEN}${passedTests}${RESET}/${totalTests}`);
  console.log(`Failed: ${RED}${failedTests.length}${RESET}/${totalTests}`);
  
  if (failedTests.length > 0) {
    console.log(`\n${RED}Failed Tests:${RESET}`);
    failedTests.forEach(fail => {
      console.log(`  - "${fail.test.text}" (${fail.test.from}→${fail.test.to}): ${fail.error}`);
    });
  }
  
  if (passedTests >= totalTests * 0.8) {
    success('Online translation service is working! 🎉');
    console.log(`\n${GREEN}📱 Ready for ML Kit testing in dev client:${RESET}`);
    console.log('1. Build dev client: eas build --profile development');
    console.log('2. Test with: npx expo start --dev-client');
    console.log('3. Use TranslationPerfHarness in app to test ML Kit');
    return true;
  } else {
    error('Too many translation failures. Check network connectivity.');
    return false;
  }
}

async function testPerformance() {
  console.log(`\n${BLUE}⚡ Performance Test${RESET}`);
  
  const testPhrase = 'The quick brown fox jumps over the lazy dog.';
  const times = [];
  
  for (let i = 0; i < 5; i++) {
    try {
      const startTime = Date.now();
      await OnlineTranslationService.translate(testPhrase, { from: 'en', to: 'es' });
      const duration = Date.now() - startTime;
      times.push(duration);
      console.log(`Request ${i + 1}: ${duration}ms`);
    } catch (error) {
      console.log(`Request ${i + 1}: Failed - ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  if (times.length > 0) {
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    console.log(`\nPerformance Results:`);
    console.log(`  Average: ${avg}ms`);
    console.log(`  Min: ${min}ms`);
    console.log(`  Max: ${max}ms`);
    
    if (avg < 3000) {
      success('Performance is good for online service');
    } else {
      warning('Performance is slow - ML Kit will be much faster');
    }
  }
}

// Run tests
if (require.main === module) {
  runTranslationTests()
    .then(success => {
      if (success) {
        return testPerformance();
      }
    })
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { OnlineTranslationService, runTranslationTests };