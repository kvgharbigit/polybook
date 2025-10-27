
// ML Kit Manual Test Script
// Run this in your dev client to test ML Kit integration

import { Translation, MlkitUtils } from './src/services';

export async function testMLKitIntegration() {
  console.log('🧪 Testing ML Kit Integration...');
  
  try {
    // Test 1: Check if ML Kit is available
    const isAvailable = MlkitUtils.isAvailable();
    console.log('ML Kit available:', isAvailable);
    
    if (!isAvailable) {
      console.log('❌ ML Kit not available - ensure you are using dev client');
      return;
    }
    
    // Test 2: Test simple translation
    console.log('Testing simple translation...');
    const result = await Translation.translate('Hello world', { from: 'en', to: 'es' });
    console.log('Translation result:', result);
    
    // Test 3: Test model download
    console.log('Testing model download...');
    await Translation.ensureModel('es');
    console.log('Spanish model ensured');
    
    // Test 4: Check installed models
    const models = await MlkitUtils.getInstalledModels();
    console.log('Installed models:', models);
    
    console.log('✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}
