// Test UI component imports and basic functionality
console.log('🧪 Testing UI Component Imports...');

try {
  // Test core component imports
  const WordPopup = require('./src/components/WordPopup').default;
  console.log('✅ WordPopup component loads');
  
  const TranslationModelsTab = require('./src/components/TranslationModelsTab').default;
  console.log('✅ TranslationModelsTab component loads');
  
  const LanguagePackSettings = require('./src/components/LanguagePackSettings').default;
  console.log('✅ LanguagePackSettings component loads');
  
  // Test service imports
  const { Translation, getServiceInfo, MlkitUtils } = require('./src/services');
  console.log('✅ Translation services load');
  
  // Test service info
  const serviceInfo = getServiceInfo();
  console.log(`✅ Current engine: ${serviceInfo.engine}`);
  console.log(`✅ Service description: ${serviceInfo.description}`);
  
  console.log('\n🎉 All components and services load successfully!');
  
} catch (error) {
  console.error('❌ Component test failed:', error.message);
  console.error('Stack:', error.stack);
}