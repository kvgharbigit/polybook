// Test LibreTranslate API directly
console.log('🧪 Testing LibreTranslate API...');

async function testLibreTranslate() {
  const testCases = [
    { text: 'Hello', from: 'en', to: 'es' },
    { text: 'Hello world', from: 'en', to: 'es' },
    { text: 'How are you?', from: 'en', to: 'fr' },
  ];

  for (const testCase of testCases) {
    console.log(`\n🔄 Testing: "${testCase.text}" (${testCase.from} → ${testCase.to})`);
    
    try {
      const response = await fetch('https://libretranslate.com/translate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'PolyBook/1.0.0'
        },
        body: JSON.stringify({
          q: testCase.text,
          source: testCase.from,
          target: testCase.to
        }),
      });

      console.log(`📡 Response status: ${response.status} ${response.statusText}`);
      console.log(`📡 Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ Error response body:`, errorText);
        continue;
      }

      const result = await response.json();
      console.log(`✅ Success:`, result);
      
      if (result.translatedText) {
        console.log(`🎉 Translation: "${testCase.text}" → "${result.translatedText}"`);
      } else {
        console.log(`⚠️ No translatedText in response:`, result);
      }

    } catch (error) {
      console.log(`💥 Request failed:`, error.message);
    }
  }
}

// Test different API endpoints
async function testAlternativeEndpoints() {
  console.log('\n🔍 Testing alternative LibreTranslate endpoints...');
  
  const endpoints = [
    'https://libretranslate.com/translate',
    'https://libretranslate.de/translate',
    'https://translate.argosopentech.com/translate',
  ];

  const testPayload = {
    q: 'Hello world',
    source: 'en',
    target: 'es'
  };

  for (const endpoint of endpoints) {
    console.log(`\n🌐 Testing endpoint: ${endpoint}`);
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'PolyBook/1.0.0'
        },
        body: JSON.stringify(testPayload),
      });

      console.log(`📡 ${endpoint}: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Working endpoint found: ${endpoint}`);
        console.log(`🎉 Result:`, result);
        break;
      } else {
        const errorText = await response.text();
        console.log(`❌ Failed: ${errorText.substring(0, 200)}`);
      }

    } catch (error) {
      console.log(`💥 ${endpoint} failed:`, error.message);
    }
  }
}

// Test supported languages
async function testSupportedLanguages() {
  console.log('\n🌍 Testing supported languages...');
  
  try {
    const response = await fetch('https://libretranslate.com/languages', {
      method: 'GET',
      headers: { 
        'User-Agent': 'PolyBook/1.0.0'
      }
    });

    if (response.ok) {
      const languages = await response.json();
      console.log(`✅ Supported languages (${languages.length}):`, languages);
    } else {
      console.log(`❌ Languages endpoint failed: ${response.status}`);
    }

  } catch (error) {
    console.log(`💥 Languages request failed:`, error.message);
  }
}

// Run all tests
async function runAllTests() {
  await testLibreTranslate();
  await testAlternativeEndpoints();
  await testSupportedLanguages();
  console.log('\n🏁 LibreTranslate testing completed!');
}

runAllTests().catch(console.error);