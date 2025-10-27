/**
 * Quick Dictionary Test
 * 
 * Simple test to verify the StarDict system is working
 */

import UserLanguageProfileService from './services/userLanguageProfileService';
import DictionaryService from './services/bilingualDictionaryService';

export async function quickDictionaryTest(): Promise<boolean> {
  try {
    console.log('🧪 Quick Dictionary Test Starting...');
    
    // 1. Set up Spanish user profile
    console.log('📱 Setting Spanish user profile...');
    const profile = await UserLanguageProfileService.updateLanguagePreferences({
      nativeLanguage: 'es',
      targetLanguages: ['en'],
      preferredDefinitionLanguage: 'es'
    });
    
    console.log(`✅ Profile: ${profile.nativeLanguage} → ${profile.targetLanguages.join(', ')}`);
    
    // 2. Test word lookup
    const testWord = 'house';
    console.log(`📚 Looking up: "${testWord}"`);
    
    const response = await DictionaryService.lookupWord({
      word: testWord,
      userProfile: profile
    });
    
    if (!response.success) {
      console.log(`❌ Lookup failed: ${response.error}`);
      if (response.error === 'missing_language_packs') {
        console.log('💡 This is expected - language packs need to be downloaded');
        console.log(`📦 Missing: ${response.missingLanguages?.join(', ')}`);
        return false; // Not a real failure, just missing data
      }
      return false;
    }
    
    // 3. Check results
    const def = response.primaryDefinition;
    if (!def) {
      console.log('❌ No definition returned');
      return false;
    }
    
    console.log(`✅ Word: ${def.word}`);
    console.log(`🔤 Translation: ${def.translations[0]?.word || 'N/A'}`);
    console.log(`📖 Definition: ${def.definitions[0]?.definition || 'N/A'}`);
    console.log(`🌍 Source Language: ${response.sourceLanguage}`);
    
    return true;
    
  } catch (error) {
    console.error('💥 Test failed:', error);
    return false;
  }
}

/**
 * Test Spanish user looking up English word
 */
export async function testSpanishUserEnglishWord(word: string = 'house'): Promise<void> {
  console.log(`🇪🇸→🇺🇸 Spanish user looking up "${word}"`);
  
  const profile = await UserLanguageProfileService.updateLanguagePreferences({
    nativeLanguage: 'es',
    targetLanguages: ['en'],
    preferredDefinitionLanguage: 'es'
  });
  
  const response = await DictionaryService.lookupWord({ word, userProfile: profile });
  
  if (response.success && response.primaryDefinition) {
    const def = response.primaryDefinition;
    console.log(`  ✅ ${word} → ${def.translations[0]?.word || 'N/A'}`);
    console.log(`  📖 ${def.definitions[0]?.definition?.substring(0, 100) || 'N/A'}...`);
  } else {
    console.log(`  ❌ ${response.error}`);
  }
}

/**
 * Test English user looking up Spanish word
 */
export async function testEnglishUserSpanishWord(word: string = 'casa'): Promise<void> {
  console.log(`🇺🇸→🇪🇸 English user looking up "${word}"`);
  
  const profile = await UserLanguageProfileService.updateLanguagePreferences({
    nativeLanguage: 'en',
    targetLanguages: ['es'],
    preferredDefinitionLanguage: 'en'
  });
  
  const response = await DictionaryService.lookupWord({ word, userProfile: profile });
  
  if (response.success && response.primaryDefinition) {
    const def = response.primaryDefinition;
    console.log(`  ✅ ${word} → ${def.translations[0]?.word || 'N/A'}`);
    console.log(`  📖 ${def.definitions[0]?.definition?.substring(0, 100) || 'N/A'}...`);
  } else {
    console.log(`  ❌ ${response.error}`);
  }
}

/**
 * Run comprehensive test
 */
export async function runComprehensiveTest(): Promise<void> {
  console.log('🎯 Running Comprehensive Dictionary Test');
  console.log('='.repeat(40));
  
  // Test Spanish user with English words
  await testSpanishUserEnglishWord('house');
  await testSpanishUserEnglishWord('book');
  await testSpanishUserEnglishWord('love');
  
  console.log('');
  
  // Test English user with Spanish words  
  await testEnglishUserSpanishWord('casa');
  await testEnglishUserSpanishWord('libro');
  await testEnglishUserSpanishWord('amor');
  
  console.log('✅ Comprehensive test completed');
}