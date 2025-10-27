/**
 * Test script for bilingual dictionary system
 * 
 * Tests the complete flow: Spanish user reading English book
 */

import UserLanguageProfileService from './services/userLanguageProfileService';
import DictionaryService from './services/bilingualDictionaryService';

async function testBilingualLookup() {
  try {
    console.log('🧪 Testing Bilingual Dictionary System');
    console.log('====================================');

    // Create Spanish user profile
    console.log('\n1. Setting up Spanish user profile...');
    const spanishProfile = await UserLanguageProfileService.updateLanguagePreferences({
      nativeLanguage: 'es',
      targetLanguages: ['en'],
      preferredDefinitionLanguage: 'es'
    });
    
    console.log(`✅ User profile: ${spanishProfile.nativeLanguage} native, learning ${spanishProfile.targetLanguages.join(', ')}`);

    // Test English word lookup (cross-language)
    console.log('\n2. Testing English word lookup for Spanish user...');
    const englishWords = ['house', 'book', 'read', 'love', 'time'];
    
    for (const word of englishWords) {
      console.log(`\n📚 Looking up: "${word}"`);
      
      const response = await DictionaryService.lookupWord({
        word,
        userProfile: spanishProfile
      });

      if (response.success && response.primaryDefinition) {
        const def = response.primaryDefinition;
        console.log(`   ✅ Translation: ${word} → ${def.translations[0]?.word || 'N/A'}`);
        console.log(`   📖 Definition: ${def.definitions[0]?.definition}`);
        console.log(`   🔗 Synonyms: ${def.definitions[0]?.synonyms?.slice(0, 3).join(', ') || 'N/A'}`);
        
        // Show cross-language data if available
        if (def.crossLanguageData) {
          console.log(`   🌍 EN Synonyms: ${def.crossLanguageData.sourceSynonyms?.slice(0, 3).join(', ') || 'N/A'}`);
          console.log(`   🌍 ES Synonyms: ${def.crossLanguageData.targetSynonyms?.slice(0, 3).join(', ') || 'N/A'}`);
        }
      } else {
        console.log(`   ❌ Lookup failed: ${response.error}`);
      }
    }

    // Test Spanish word lookup (native language)
    console.log('\n3. Testing Spanish word lookup for Spanish user...');
    const spanishWords = ['casa', 'libro', 'lugar'];
    
    for (const word of spanishWords) {
      console.log(`\n📚 Looking up: "${word}"`);
      
      const response = await DictionaryService.lookupWord({
        word,
        userProfile: spanishProfile
      });

      if (response.success && response.primaryDefinition) {
        const def = response.primaryDefinition;
        console.log(`   ✅ Native lookup: ${word}`);
        console.log(`   📖 Definition: ${def.definitions[0]?.definition}`);
        console.log(`   🔗 Synonyms: ${def.definitions[0]?.synonyms?.slice(0, 3).join(', ') || 'N/A'}`);
      } else {
        console.log(`   ❌ Lookup failed: ${response.error}`);
      }
    }

    // Test English user profile  
    console.log('\n4. Testing English user profile...');
    const englishProfile = await UserLanguageProfileService.updateLanguagePreferences({
      nativeLanguage: 'en',
      targetLanguages: ['es'],
      preferredDefinitionLanguage: 'en'
    });

    console.log(`✅ User profile: ${englishProfile.nativeLanguage} native, learning ${englishProfile.targetLanguages.join(', ')}`);

    // Test Spanish word lookup for English user
    const testWord = 'casa';
    console.log(`\n📚 English user looking up Spanish word: "${testWord}"`);
    
    const response = await DictionaryService.lookupWord({
      word: testWord,
      userProfile: englishProfile
    });

    if (response.success && response.primaryDefinition) {
      const def = response.primaryDefinition;
      console.log(`   ✅ Translation: ${testWord} → ${def.translations[0]?.word || 'N/A'}`);
      console.log(`   📖 Definition: ${def.definitions[0]?.definition}`);
      console.log(`   🔗 Synonyms: ${def.definitions[0]?.synonyms?.slice(0, 3).join(', ') || 'N/A'}`);
    } else {
      console.log(`   ❌ Lookup failed: ${response.error}`);
    }

    // Show statistics
    console.log('\n5. Dictionary Statistics:');
    const stats = DictionaryService.getStats();
    console.log(`   📊 Total entries: ${stats.totalEntries}`);
    console.log(`   🌍 Language pairs: ${stats.languagePairs.join(', ')}`);
    console.log(`   📦 Version: ${stats.version}`);

    console.log('\n🎉 Bilingual dictionary test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Example usage function that could be called from a component
export async function testWordLookup(word: string, userLanguage: string = 'es'): Promise<void> {
  try {
    console.log(`🧪 Quick test: ${userLanguage} user looking up "${word}"`);
    
    // Get or create user profile
    const profile = await UserLanguageProfileService.updateLanguagePreferences({
      nativeLanguage: userLanguage,
      targetLanguages: userLanguage === 'es' ? ['en'] : ['es'],
      preferredDefinitionLanguage: userLanguage
    });

    // Perform lookup
    const response = await DictionaryService.lookupWord({
      word,
      userProfile: profile
    });

    if (response.success && response.primaryDefinition) {
      const def = response.primaryDefinition;
      console.log('📖 Lookup Result:');
      console.log(`   Word: ${word}`);
      console.log(`   Translation: ${def.translations[0]?.word || 'N/A'}`);
      console.log(`   Definition: ${def.definitions[0]?.definition}`);
      console.log(`   Source Language: ${response.sourceLanguage}`);
    } else {
      console.log(`❌ Lookup failed: ${response.error}`);
    }

  } catch (error) {
    console.error('❌ Quick test failed:', error);
  }
}

// Export the test function
export default testBilingualLookup;

// Run test if executed directly (for Node.js testing)
if (typeof require !== 'undefined' && require.main === module) {
  testBilingualLookup();
}