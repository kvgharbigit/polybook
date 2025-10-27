// Quick translation service test
const { Translation, getServiceInfo } = require('./src/services');

async function testTranslation() {
  console.log('🧪 Testing Translation Service...');
  
  try {
    // Check service info
    const serviceInfo = getServiceInfo();
    console.log(`✅ Engine: ${serviceInfo.engine}`);
    console.log(`✅ Description: ${serviceInfo.description}`);
    console.log(`✅ Is Expo Go: ${serviceInfo.isExpoGo}`);
    
    // Test translation
    console.log('\n🔄 Testing translation...');
    const startTime = Date.now();
    
    const result = await Translation.translate('Hello world', {
      from: 'en',
      to: 'es',
      timeoutMs: 8000
    });
    
    const duration = Date.now() - startTime;
    
    if (result.text) {
      console.log(`✅ Translation successful: "${result.text}"`);
      console.log(`✅ Duration: ${duration}ms`);
      console.log(`✅ Engine: ${serviceInfo.engine.toUpperCase()}`);
    } else {
      console.log('❌ Translation failed - no result text');
    }
    
  } catch (error) {
    console.error('❌ Translation test failed:', error.message);
  }
}

testTranslation();