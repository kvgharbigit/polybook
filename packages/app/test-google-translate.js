// Test unofficial Google Translate endpoint
console.log('🧪 Testing unofficial Google Translate endpoint...');

async function testGoogleTranslate() {
  const testCases = [
    { text: 'Hello world', from: 'en', to: 'es' },
    { text: 'How are you?', from: 'en', to: 'fr' },
    { text: 'Good morning', from: 'en', to: 'de' },
    { text: 'This is a longer sentence to test the translation quality.', from: 'en', to: 'es' },
  ];

  for (const testCase of testCases) {
    console.log(`\n🔄 Testing: "${testCase.text}" (${testCase.from} → ${testCase.to})`);
    
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${testCase.from}&tl=${testCase.to}&dt=t&q=${encodeURIComponent(testCase.text)}`;
      console.log(`📡 URL: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PolyBook/1.0.0)',
        }
      });

      console.log(`📡 Status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ Error response:`, errorText.substring(0, 200));
        continue;
      }

      const result = await response.json();
      console.log(`📊 Raw response:`, JSON.stringify(result).substring(0, 300));
      
      // Google's response format: [[[translated_text, original_text, null, null, score], ...], ...]
      if (result && result[0] && result[0][0] && result[0][0][0]) {
        const translatedText = result[0][0][0];
        console.log(`✅ SUCCESS: "${testCase.text}" → "${translatedText}"`);
        console.log(`🎯 Translation quality looks good!`);
      } else {
        console.log(`⚠️ Unexpected response format:`, result);
      }

    } catch (error) {
      console.log(`💥 Request failed:`, error.message);
    }
  }
}

// Test different language pairs
async function testLanguagePairs() {
  console.log('\n🌍 Testing various language pairs...');
  
  const pairs = [
    { from: 'en', to: 'es', text: 'Hello' },
    { from: 'en', to: 'fr', text: 'Hello' },
    { from: 'en', to: 'de', text: 'Hello' },
    { from: 'en', to: 'it', text: 'Hello' },
    { from: 'en', to: 'pt', text: 'Hello' },
    { from: 'en', to: 'ru', text: 'Hello' },
    { from: 'en', to: 'ja', text: 'Hello' },
    { from: 'en', to: 'ko', text: 'Hello' },
    { from: 'en', to: 'zh', text: 'Hello' },
    { from: 'en', to: 'ar', text: 'Hello' },
  ];

  for (const pair of pairs) {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${pair.from}&tl=${pair.to}&dt=t&q=${encodeURIComponent(pair.text)}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PolyBook/1.0.0)' }
      });

      if (response.ok) {
        const result = await response.json();
        const translatedText = result?.[0]?.[0]?.[0] || 'No translation';
        console.log(`✅ ${pair.from}→${pair.to}: "${pair.text}" → "${translatedText}"`);
      } else {
        console.log(`❌ ${pair.from}→${pair.to}: Failed (${response.status})`);
      }

    } catch (error) {
      console.log(`💥 ${pair.from}→${pair.to}: Error - ${error.message}`);
    }
  }
}

async function runGoogleTests() {
  await testGoogleTranslate();
  await testLanguagePairs();
  console.log('\n🏁 Google Translate testing completed!');
}

runGoogleTests().catch(console.error);