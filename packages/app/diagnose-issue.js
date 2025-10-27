#!/usr/bin/env node

/**
 * Interactive Issue Diagnosis Tool
 * 
 * Helps identify and resolve common issues with the translation system
 */

const fs = require('fs');
const readline = require('readline');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const RESET = '\x1b[0m';

function log(color, icon, message) {
  console.log(`${color}${icon} ${message}${RESET}`);
}

function success(message) { log(GREEN, '✅', message); }
function error(message) { log(RED, '❌', message); }
function warning(message) { log(YELLOW, '⚠️', message); }
function info(message) { log(BLUE, 'ℹ️', message); }
function question(message) { log(MAGENTA, '❓', message); }

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function diagnoseIssue() {
  console.log(`${BLUE}🔍 PolyBook Issue Diagnosis Tool${RESET}\n`);
  
  info('This tool will help identify and resolve common issues.');
  info('Please answer the following questions to get targeted help.\n');
  
  // Step 1: Identify the issue category
  question('What type of issue are you experiencing?');
  console.log('1. Translation not working');
  console.log('2. App won\'t start/build');
  console.log('3. Performance issues');
  console.log('4. Dictionary lookup problems');
  console.log('5. ML Kit not available');
  console.log('6. Other/General debugging\n');
  
  const issueType = await ask('Enter number (1-6): ');
  console.log('');
  
  switch(issueType.trim()) {
    case '1':
      await diagnoseTranslation();
      break;
    case '2':
      await diagnoseBuild();
      break;
    case '3':
      await diagnosePerformance();
      break;
    case '4':
      await diagnoseDictionary();
      break;
    case '5':
      await diagnoseMLKit();
      break;
    case '6':
      await diagnoseGeneral();
      break;
    default:
      error('Invalid option. Please run the tool again.');
  }
  
  rl.close();
}

async function diagnoseTranslation() {
  info('🔍 Diagnosing Translation Issues\n');
  
  // Environment check
  question('What environment are you using?');
  console.log('1. Expo Go app');
  console.log('2. Development Client (custom build)');
  console.log('3. Not sure');
  
  const env = await ask('Enter number (1-3): ');
  console.log('');
  
  if (env === '1') {
    info('Expo Go should use online Google Translate service.');
    await checkOnlineService();
  } else if (env === '2') {
    info('Development Client should use ML Kit native service.');
    await checkMLKitService();
  } else {
    warning('Environment detection needed.');
    await checkEnvironment();
  }
  
  // Symptom check
  question('What exactly happens when you try to translate?');
  console.log('1. Nothing happens');
  console.log('2. Error message appears');
  console.log('3. Very slow response');
  console.log('4. Wrong translation');
  
  const symptom = await ask('Enter number (1-4): ');
  console.log('');
  
  await provideSolution(env, symptom);
}

async function checkOnlineService() {
  info('Testing online translation service...');
  
  try {
    // Test network connectivity
    const https = require('https');
    const testUrl = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=test';
    
    const response = await new Promise((resolve, reject) => {
      const req = https.get(testUrl, resolve);
      req.on('error', reject);
      req.setTimeout(5000, () => reject(new Error('Timeout')));
    });
    
    if (response.statusCode === 200) {
      success('Online service is accessible');
    } else {
      warning(`Online service returned status: ${response.statusCode}`);
    }
  } catch (error) {
    error(`Network issue: ${error.message}`);
    console.log('\nSolutions:');
    console.log('- Check internet connection');
    console.log('- Try using a VPN if blocked');
    console.log('- Check firewall settings');
  }
}

async function checkMLKitService() {
  info('Checking ML Kit service requirements...');
  
  // Check if native modules exist
  const nativeFiles = [
    'ios-template/MlkitTranslateModule.swift',
    'android-template/app/build.gradle'
  ];
  
  let hasNativeFiles = true;
  for (const file of nativeFiles) {
    if (!fs.existsSync(file)) {
      error(`Missing native module: ${file}`);
      hasNativeFiles = false;
    }
  }
  
  if (hasNativeFiles) {
    success('Native module files found');
  } else {
    console.log('\nSolutions:');
    console.log('- Copy native module files from templates');
    console.log('- Follow ML Kit setup guide');
    console.log('- Rebuild development client');
  }
  
  // Check EAS configuration
  if (fs.existsSync('../../eas.json')) {
    success('EAS configuration found');
  } else {
    warning('EAS configuration missing');
    console.log('Solution: Create eas.json with development profile');
  }
}

async function checkEnvironment() {
  info('Checking environment detection...');
  
  if (fs.existsSync('src/services/index.ts')) {
    const content = fs.readFileSync('src/services/index.ts', 'utf8');
    if (content.includes('isExpoGo') || content.includes('Constants.appOwnership')) {
      success('Environment detection configured');
    } else {
      error('Environment detection not implemented');
    }
  } else {
    error('Service index file missing');
  }
}

async function provideSolution(env, symptom) {
  console.log('\n🔧 Recommended Solutions:\n');
  
  if (env === '1') { // Expo Go
    if (symptom === '1') {
      console.log('• Check network connection');
      console.log('• Verify service initialization in console logs');
      console.log('• Test with: node test-online-translation.js');
    } else if (symptom === '3') {
      console.log('• Normal for online service (~150ms)');
      console.log('• Check network speed');
      console.log('• Consider upgrading to Dev Client for faster ML Kit');
    }
  } else if (env === '2') { // Dev Client
    if (symptom === '1') {
      console.log('• Verify ML Kit native module is built');
      console.log('• Check console for "ML Kit not available" errors');
      console.log('• Rebuild dev client: eas build --profile development');
    } else if (symptom === '2') {
      console.log('• Download required language models');
      console.log('• Check device storage space');
      console.log('• Test model download in Settings → ML Kit Test');
    }
  }
  
  console.log('\n📋 Debug Commands:');
  console.log('node test-mlkit-integration.js  # Full integration check');
  console.log('node test-online-translation.js  # Online service test');
  console.log('npx expo start --clear          # Clear cache and restart');
}

async function diagnoseBuild() {
  info('🔍 Diagnosing Build Issues\n');
  
  question('What type of build issue?');
  console.log('1. npx expo start fails');
  console.log('2. eas build fails');
  console.log('3. App crashes on startup');
  console.log('4. Dependencies not found');
  
  const buildIssue = await ask('Enter number (1-4): ');
  console.log('');
  
  switch(buildIssue) {
    case '1':
      console.log('Solutions for expo start:');
      console.log('• Clear cache: npx expo start --clear');
      console.log('• Check package.json for start script');
      console.log('• Verify node_modules: rm -rf node_modules && npm install');
      break;
    case '2':
      console.log('Solutions for eas build:');
      console.log('• Check eas.json configuration');
      console.log('• Verify expo-dev-client plugin in app.json');
      console.log('• Check native module setup');
      break;
    case '3':
      console.log('Solutions for app crashes:');
      console.log('• Check expo logs for error details');
      console.log('• Verify all dependencies installed');
      console.log('• Test in Expo Go first');
      break;
    case '4':
      console.log('Solutions for dependency issues:');
      console.log('• npm install or yarn install');
      console.log('• Check package.json for missing deps');
      console.log('• Clear node_modules and reinstall');
      break;
  }
}

async function diagnosePerformance() {
  info('🔍 Diagnosing Performance Issues\n');
  
  console.log('Expected performance benchmarks:');
  console.log('• Expo Go (online): ~150ms average');
  console.log('• Dev Client (ML Kit): ~50-100ms average');
  console.log('');
  
  question('What are you experiencing?');
  const perfIssue = await ask('Describe the performance problem: ');
  
  console.log('\n🔧 Performance Solutions:');
  console.log('• Run: Settings → Translation Performance Test');
  console.log('• Check network speed for online service');
  console.log('• Ensure ML Kit models are downloaded');
  console.log('• Monitor console logs for bottlenecks');
  console.log('• Test with: node test-online-translation.js');
}

async function diagnoseDictionary() {
  info('🔍 Diagnosing Dictionary Issues\n');
  
  // Check dictionary files
  if (fs.existsSync('assets/dictionaries/')) {
    const files = fs.readdirSync('assets/dictionaries/');
    const sqliteFiles = files.filter(f => f.endsWith('.sqlite'));
    
    if (sqliteFiles.length > 0) {
      success(`Found ${sqliteFiles.length} dictionary files: ${sqliteFiles.join(', ')}`);
    } else {
      error('No SQLite dictionary files found');
      console.log('Solution: Download language packs or copy dictionary files');
    }
  } else {
    error('Dictionary assets directory missing');
    console.log('Solution: Create assets/dictionaries/ and add SQLite files');
  }
  
  // Check service files
  const serviceFiles = [
    'src/services/sqliteDictionaryService.ts',
    'src/services/languagePackService.ts'
  ];
  
  serviceFiles.forEach(file => {
    if (fs.existsSync(file)) {
      success(`${file} exists`);
    } else {
      error(`${file} missing`);
    }
  });
}

async function diagnoseMLKit() {
  info('🔍 Diagnosing ML Kit Issues\n');
  
  console.log('Common ML Kit issues and solutions:\n');
  
  console.log('❌ "ML Kit not available":');
  console.log('   → You\'re using Expo Go instead of Dev Client');
  console.log('   → Solution: Build dev client with eas build --profile development\n');
  
  console.log('❌ "Model download failed":');
  console.log('   → Check internet connection');
  console.log('   → Ensure sufficient storage space (~50MB per language)');
  console.log('   → Try downloading models individually\n');
  
  console.log('❌ "Translation timeout":');
  console.log('   → Model may not be downloaded');
  console.log('   → Check device performance');
  console.log('   → Increase timeout in settings\n');
  
  console.log('✅ Debug Steps:');
  console.log('1. Check if using Dev Client (not Expo Go)');
  console.log('2. Test with: Settings → ML Kit Translation Test');
  console.log('3. Download models for your target languages');
  console.log('4. Check console logs for detailed errors');
}

async function diagnoseGeneral() {
  info('🔍 General Debugging Help\n');
  
  console.log('🛠️ Diagnostic Tools Available:\n');
  
  console.log('📋 Automated Tests:');
  console.log('node test-mlkit-integration.js     # Full integration check');
  console.log('node test-online-translation.js    # Online service test');
  console.log('node dev-deployment-readiness.js   # Complete system check\n');
  
  console.log('📱 In-App Testing:');
  console.log('Settings → ML Kit Translation Test    # Live ML Kit testing');
  console.log('Settings → Translation Performance   # Speed benchmarking');
  console.log('Reader → Tap words                  # Dictionary integration\n');
  
  console.log('🔍 Console Debugging:');
  console.log('Look for these log prefixes:');
  console.log('🌐 Google Translate: ...           # Online service logs');
  console.log('📱 ML Kit: ...                     # ML Kit service logs');
  console.log('📚 SQLiteDictionaryService: ...    # Dictionary logs');
  console.log('🎯 Environment: ...               # Environment detection\n');
  
  console.log('🚨 Common Error Patterns:');
  console.log('"native module not available"      → Use Dev Client');
  console.log('"Translation timeout"             → Check network/models');
  console.log('"Dictionary not available"        → Download language packs');
  console.log('"No translation returned"         → Check API/service status');
}

if (require.main === module) {
  diagnoseIssue().catch(error => {
    console.error('Diagnosis tool error:', error);
    process.exit(1);
  });
}

module.exports = { diagnoseIssue };