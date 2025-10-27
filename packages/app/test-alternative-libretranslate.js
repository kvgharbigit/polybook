// Test alternative LibreTranslate endpoints that might still be free
console.log('🧪 Testing alternative LibreTranslate endpoints...');

async function testFreeEndpoints() {
  const freeEndpoints = [
    'https://libretranslate.de/translate',
    'https://translate.argosopentech.com/translate',
    'https://translate.fortytwo-it.com/translate',
    'https://lt.vern.cc/translate',
    'https://translate.terraprint.co/translate'
  ];

  const testPayload = {
    q: 'Hello world',
    source: 'en',
    target: 'es'
  };

  console.log('🔍 Testing payload:', testPayload);

  for (const endpoint of freeEndpoints) {
    console.log(`\n🌐 Testing: ${endpoint}`);
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'PolyBook/1.0.0'
        },
        body: JSON.stringify(testPayload),
      });

      console.log(`📡 Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        try {
          const result = await response.json();
          console.log(`✅ SUCCESS! Working endpoint: ${endpoint}`);
          console.log(`🎉 Result:`, result);
          
          if (result.translatedText) {
            console.log(`🎯 Translation: "${testPayload.q}" → "${result.translatedText}"`);
            return endpoint; // Return the working endpoint
          }
        } catch (jsonError) {
          console.log(`❌ JSON parse error:`, jsonError.message);
          const text = await response.text();
          console.log(`📄 Response text preview:`, text.substring(0, 200));
        }
      } else {
        const errorText = await response.text();
        console.log(`❌ Error:`, errorText.substring(0, 200));
      }

    } catch (error) {
      console.log(`💥 Network error:`, error.message);
    }
  }
  
  return null; // No working endpoint found
}

// Test with different request formats
async function testRequestFormats(endpoint) {
  console.log(`\n🔧 Testing different request formats for: ${endpoint}`);
  
  const formats = [
    // Standard format
    {
      name: 'Standard JSON',
      body: JSON.stringify({ q: 'Hello world', source: 'en', target: 'es' }),
      headers: { 'Content-Type': 'application/json' }
    },
    // Form data format
    {
      name: 'Form Data',
      body: 'q=Hello%20world&source=en&target=es',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    },
    // With format parameter
    {
      name: 'With format param',
      body: JSON.stringify({ q: 'Hello world', source: 'en', target: 'es', format: 'text' }),
      headers: { 'Content-Type': 'application/json' }
    }
  ];

  for (const format of formats) {
    console.log(`\n🧪 Testing ${format.name}...`);
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...format.headers,
          'User-Agent': 'PolyBook/1.0.0'
        },
        body: format.body,
      });

      console.log(`📡 ${format.name}: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ ${format.name} works!`, result);
        return format;
      } else {
        const errorText = await response.text();
        console.log(`❌ ${format.name} failed:`, errorText.substring(0, 100));
      }

    } catch (error) {
      console.log(`💥 ${format.name} error:`, error.message);
    }
  }
  
  return null;
}

async function runAlternativeTests() {
  console.log('🚀 Starting comprehensive LibreTranslate testing...\n');
  
  // First, find a working endpoint
  const workingEndpoint = await testFreeEndpoints();
  
  if (workingEndpoint) {
    console.log(`\n🎉 Found working endpoint: ${workingEndpoint}`);
    
    // Test different request formats
    const workingFormat = await testRequestFormats(workingEndpoint);
    
    if (workingFormat) {
      console.log(`\n🎯 SOLUTION FOUND:`);
      console.log(`   Endpoint: ${workingEndpoint}`);
      console.log(`   Format: ${workingFormat.name}`);
      console.log(`   Headers:`, workingFormat.headers);
      console.log(`   Body example:`, workingFormat.body);
    }
  } else {
    console.log('\n❌ No working free endpoints found');
    console.log('💡 Recommendation: Use mock translation for development');
  }
  
  console.log('\n🏁 Alternative LibreTranslate testing completed!');
}

runAlternativeTests().catch(console.error);