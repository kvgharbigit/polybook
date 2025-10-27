#!/usr/bin/env node

/**
 * ML Kit Integration Pre-Flight Test
 * 
 * This script verifies that ML Kit integration is properly configured
 * before testing in dev client. It checks:
 * - Native module files exist
 * - Dependencies are configured
 * - Translation service is properly set up
 * - Environment detection works
 */

const fs = require('fs');
const path = require('path');

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

async function runTests() {
  console.log(`${BLUE}🧪 ML Kit Integration Pre-Flight Test${RESET}\n`);
  
  let totalTests = 0;
  let passedTests = 0;
  
  function test(name, condition, failMessage) {
    totalTests++;
    if (condition) {
      success(name);
      passedTests++;
      return true;
    } else {
      error(`${name} - ${failMessage}`);
      return false;
    }
  }
  
  // Test 1: Check native module files exist
  info('Checking native module files...');
  
  const iosModuleSwift = 'ios-template/MlkitTranslateModule.swift';
  const iosModuleObjC = 'ios-template/MlkitTranslateModule.m';
  
  test(
    'iOS Swift module exists',
    fs.existsSync(iosModuleSwift),
    `Missing ${iosModuleSwift}`
  );
  
  test(
    'iOS Objective-C bridge exists', 
    fs.existsSync(iosModuleObjC),
    `Missing ${iosModuleObjC}`
  );
  
  // Test 2: Check if TypeScript service files exist
  info('\nChecking TypeScript service files...');
  
  const mlkitService = 'src/services/mlkit.ts';
  const onlineService = 'src/services/online.ts';
  const indexService = 'src/services/index.ts';
  const typesFile = 'src/services/types.ts';
  
  test(
    'ML Kit service exists',
    fs.existsSync(mlkitService),
    `Missing ${mlkitService}`
  );
  
  test(
    'Online service exists',
    fs.existsSync(onlineService), 
    `Missing ${onlineService}`
  );
  
  test(
    'Service index exists',
    fs.existsSync(indexService),
    `Missing ${indexService}`
  );
  
  test(
    'Types file exists',
    fs.existsSync(typesFile),
    `Missing ${typesFile}`
  );
  
  // Test 3: Check service content for correct exports
  info('\nChecking service implementations...');
  
  if (fs.existsSync(indexService)) {
    const indexContent = fs.readFileSync(indexService, 'utf8');
    
    test(
      'Dual-engine architecture configured',
      indexContent.includes('isExpoGo') && indexContent.includes('OnlineService') && indexContent.includes('MlkitService'),
      'Missing dual-engine setup in index.ts'
    );
    
    test(
      'Translation export exists',
      indexContent.includes('export const Translation'),
      'Missing Translation export'
    );
  }
  
  if (fs.existsSync(mlkitService)) {
    const mlkitContent = fs.readFileSync(mlkitService, 'utf8');
    
    test(
      'ML Kit native module import',
      mlkitContent.includes('NativeModules') && mlkitContent.includes('MlkitTranslate'),
      'Missing native module imports'
    );
    
    test(
      'ML Kit service implements correct interface',
      mlkitContent.includes('TranslationService') && mlkitContent.includes('translate'),
      'ML Kit service missing required methods'
    );
    
    test(
      'ML Kit error handling for missing module',
      mlkitContent.includes('native module not available'),
      'Missing error handling for unavailable native module'
    );
  }
  
  if (fs.existsSync(onlineService)) {
    const onlineContent = fs.readFileSync(onlineService, 'utf8');
    
    test(
      'Online service configured',
      onlineContent.includes('TranslationService') && (onlineContent.includes('libretranslate') || onlineContent.includes('translate.googleapis.com') || onlineContent.includes('Google Translate')),
      'Online service not properly configured'
    );
  }
  
  // Test 4: Check package.json dependencies
  info('\nChecking dependencies...');
  
  const packageJsonPath = 'package.json';
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    test(
      'expo-dev-client dependency',
      deps['expo-dev-client'],
      'Missing expo-dev-client dependency for native modules'
    );
    
    test(
      'React Native version compatible',
      deps['react-native'] && !deps['react-native'].includes('0.68'),
      'React Native version may be incompatible with ML Kit'
    );
  }
  
  // Test 5: Check EAS configuration
  info('\nChecking EAS build configuration...');
  
  const easJsonPath = '../../eas.json';
  if (fs.existsSync(easJsonPath)) {
    const easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
    
    test(
      'Development profile exists',
      easJson.build && easJson.build.development,
      'Missing development profile in eas.json'
    );
    
    if (easJson.build && easJson.build.development) {
      const devProfile = easJson.build.development;
      test(
        'Development build type configured',
        devProfile.developmentClient === true,
        'Development profile not configured for dev client'
      );
    }
  } else {
    warning('eas.json not found - may need EAS configuration');
  }
  
  // Test 6: Check app.json configuration
  info('\nChecking app.json configuration...');
  
  const appJsonPath = 'app.json';
  if (fs.existsSync(appJsonPath)) {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    
    test(
      'expo-dev-client plugin configured',
      appJson.expo && appJson.expo.plugins && 
      appJson.expo.plugins.some(p => p === 'expo-dev-client' || (Array.isArray(p) && p[0] === 'expo-dev-client')),
      'expo-dev-client plugin not configured in app.json'
    );
  }
  
  // Test 7: Simulate translation service usage
  info('\nTesting translation service API...');
  
  try {
    // We can't actually test the native modules without a device,
    // but we can test the TypeScript interface
    if (fs.existsSync(mlkitService) && fs.existsSync(onlineService)) {
      const mlkitServiceContent = fs.readFileSync(mlkitService, 'utf8');
      const onlineServiceContent = fs.readFileSync(onlineService, 'utf8');
      
      // Check if both services implement the same interface
      const mlkitHasTranslate = mlkitServiceContent.includes('async translate(');
      const onlineHasTranslate = onlineServiceContent.includes('async translate(');
      
      test(
        'Both services implement translate method',
        mlkitHasTranslate && onlineHasTranslate,
        'Services have mismatched APIs'
      );
      
      // Check parameter compatibility - look for the service method, not native method
      const mlkitServiceParams = mlkitServiceContent.match(/async translate\([^)]+\)/);
      const onlineServiceParams = onlineServiceContent.match(/async translate\([^)]+\)/);
      
      if (mlkitServiceParams && onlineServiceParams) {
        // Both should have similar parameter structure (text, options object)
        const mlkitHasOpts = mlkitServiceParams[0].includes('TranslateOpts') || mlkitServiceParams[0].includes('{ from, to');
        const onlineHasOpts = onlineServiceParams[0].includes('TranslateOpts') || onlineServiceParams[0].includes('{ from, to');
        
        test(
          'Service APIs are compatible',
          mlkitHasOpts && onlineHasOpts,
          `Both services should use same API signature`
        );
      }
    }
  } catch (error) {
    warning(`API compatibility test failed: ${error.message}`);
  }
  
  // Test 8: Check for Bergamot cleanup
  info('\nChecking Bergamot cleanup...');
  
  const searchBergamot = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        if (searchBergamot(filePath)) return true;
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.toLowerCase().includes('bergamot')) {
          return true;
        }
      }
    }
    return false;
  };
  
  test(
    'No Bergamot references in source code',
    !searchBergamot('src/'),
    'Found Bergamot references in source code'
  );
  
  // Test 9: Check Performance Harness
  info('\nChecking performance test setup...');
  
  const perfHarnessPath = 'src/screens/TranslationPerfHarness.tsx';
  if (fs.existsSync(perfHarnessPath)) {
    const perfContent = fs.readFileSync(perfHarnessPath, 'utf8');
    
    test(
      'Performance harness uses new Translation service',
      perfContent.includes('Translation.translate'),
      'Performance harness not updated for new service'
    );
    
    test(
      'Performance test shows language pairs',
      perfContent.includes('sourceLanguage') && perfContent.includes('targetLanguage'),
      'Performance test missing language pair logging'
    );
  }
  
  // Summary
  console.log(`\n${BLUE}📊 Test Results${RESET}`);
  console.log(`Passed: ${GREEN}${passedTests}${RESET}/${totalTests}`);
  
  if (passedTests === totalTests) {
    success('All tests passed! ✨ ML Kit integration looks ready for dev client testing');
    console.log(`\n${GREEN}🚀 Next steps:${RESET}`);
    console.log('1. Run: npx expo prebuild');
    console.log('2. Build dev client: eas build --profile development');
    console.log('3. Test with: npx expo start --dev-client');
  } else {
    error(`${totalTests - passedTests} tests failed. Please fix issues before testing.`);
    process.exit(1);
  }
}

// Additional utility functions for manual testing
function generateTestScript() {
  const testScript = `
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
`;
  
  fs.writeFileSync('test-mlkit-manual.js', testScript);
  info('Created test-mlkit-manual.js for manual testing in dev client');
}

if (require.main === module) {
  runTests().then(() => {
    generateTestScript();
  }).catch(console.error);
}

module.exports = { runTests };