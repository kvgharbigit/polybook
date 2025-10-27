#!/usr/bin/env node

/**
 * Dev Deployment Readiness Check
 * 
 * Comprehensive verification that both frontend and backend are ready
 * for development deployment and testing
 */

const fs = require('fs');
const path = require('path');

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
function section(message) { log(MAGENTA, '🔸', message); }

async function runComprehensiveCheck() {
  console.log(`${BLUE}🚀 Dev Deployment Readiness Check${RESET}\n`);
  
  let totalChecks = 0;
  let passedChecks = 0;
  let criticalIssues = [];
  let warnings = [];
  
  function check(name, condition, failMessage, isCritical = true) {
    totalChecks++;
    if (condition) {
      success(name);
      passedChecks++;
      return true;
    } else {
      if (isCritical) {
        error(`${name} - ${failMessage}`);
        criticalIssues.push({ name, message: failMessage });
      } else {
        warning(`${name} - ${failMessage}`);
        warnings.push({ name, message: failMessage });
      }
      return false;
    }
  }

  // ==================== FRONTEND CHECKS ====================
  section('Frontend Development Readiness');

  // 1. Core App Structure
  info('Checking core app structure...');
  
  check(
    'App.tsx exists',
    fs.existsSync('App.tsx'),
    'Main app entry point missing'
  );

  check(
    'app.json configuration',
    fs.existsSync('app.json'),
    'Expo configuration missing'
  );

  check(
    'package.json exists',
    fs.existsSync('package.json'),
    'Package configuration missing'
  );

  // 2. Translation Services
  info('Checking translation services...');
  
  const serviceFiles = [
    'src/services/index.ts',
    'src/services/mlkit.ts', 
    'src/services/online.ts',
    'src/services/types.ts'
  ];

  serviceFiles.forEach(file => {
    check(
      `${file} exists`,
      fs.existsSync(file),
      `Missing service file: ${file}`
    );
  });

  // Check service implementations
  if (fs.existsSync('src/services/index.ts')) {
    const indexContent = fs.readFileSync('src/services/index.ts', 'utf8');
    
    check(
      'Dual-engine architecture configured',
      indexContent.includes('isExpoGo') && indexContent.includes('Translation'),
      'Environment detection not configured'
    );

    check(
      'Service exports correct',
      indexContent.includes('export const Translation') && indexContent.includes('MlkitUtils'),
      'Missing required service exports'
    );
  }

  // 3. Native Module Integration
  info('Checking native module integration...');
  
  const nativeFiles = [
    'ios-template/MlkitTranslateModule.swift',
    'ios-template/MlkitTranslateModule.m',
    'android-template/app/build.gradle'
  ];

  nativeFiles.forEach(file => {
    check(
      `${file} exists`,
      fs.existsSync(file),
      `Missing native module: ${file}`,
      false // Not critical for initial dev testing
    );
  });

  // 4. Testing Infrastructure
  info('Checking testing infrastructure...');
  
  const testFiles = [
    'src/screens/TranslationPerfHarness.tsx',
    'src/screens/MLKitTestScreen.tsx',
    'test-mlkit-integration.js',
    'test-online-translation.js'
  ];

  testFiles.forEach(file => {
    check(
      `${file} exists`,
      fs.existsSync(file),
      `Missing test file: ${file}`
    );
  });

  // 5. Build Configuration
  info('Checking build configuration...');
  
  if (fs.existsSync('../../eas.json')) {
    const easJson = JSON.parse(fs.readFileSync('../../eas.json', 'utf8'));
    
    check(
      'EAS development profile configured',
      easJson.build && easJson.build.development && easJson.build.development.developmentClient,
      'EAS development profile not configured'
    );
  } else {
    check(
      'EAS configuration exists',
      false,
      'Missing eas.json for native builds'
    );
  }

  if (fs.existsSync('app.json')) {
    const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
    
    check(
      'expo-dev-client plugin configured',
      appJson.expo && appJson.expo.plugins && 
      appJson.expo.plugins.some(p => p === 'expo-dev-client' || (Array.isArray(p) && p[0] === 'expo-dev-client')),
      'expo-dev-client plugin not configured'
    );
  }

  // 6. Dependencies
  info('Checking dependencies...');
  
  if (fs.existsSync('package.json')) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const requiredDeps = [
      'expo-dev-client',
      'react-native',
      'expo-sqlite'
    ];

    requiredDeps.forEach(dep => {
      check(
        `${dep} dependency`,
        deps[dep],
        `Missing required dependency: ${dep}`
      );
    });
  }

  // ==================== BACKEND/SERVICES CHECKS ====================
  section('Backend/Services Readiness');

  // 1. Dictionary Services
  info('Checking dictionary services...');
  
  const dictionaryFiles = [
    'src/services/sqliteDictionaryService.ts',
    'src/services/languagePackService.ts',
    'src/services/userLanguageProfileService.ts'
  ];

  dictionaryFiles.forEach(file => {
    check(
      `${file} exists`,
      fs.existsSync(file),
      `Missing dictionary service: ${file}`
    );
  });

  // 2. Dictionary Assets
  info('Checking dictionary assets...');
  
  if (fs.existsSync('assets/dictionaries/')) {
    const dictFiles = fs.readdirSync('assets/dictionaries/');
    const sqliteFiles = dictFiles.filter(f => f.endsWith('.sqlite'));
    
    check(
      'SQLite dictionaries available',
      sqliteFiles.length > 0,
      'No SQLite dictionary files found'
    );

    if (sqliteFiles.length > 0) {
      console.log(`    Found ${sqliteFiles.length} dictionary files: ${sqliteFiles.join(', ')}`);
    }
  } else {
    check(
      'Dictionary assets directory exists',
      false,
      'Dictionary assets directory missing'
    );
  }

  // 3. Language Pack Types
  info('Checking language pack types...');
  
  if (fs.existsSync('../shared/src/types/languagePacks.ts')) {
    const langPackContent = fs.readFileSync('../shared/src/types/languagePacks.ts', 'utf8');
    
    check(
      'Language pack types updated for ML Kit',
      langPackContent.includes('mlKitSupport') && !langPackContent.includes('bergamot'),
      'Language pack types not updated for ML Kit'
    );

    check(
      'Available language packs defined',
      langPackContent.includes('AVAILABLE_LANGUAGE_PACKS'),
      'Language pack manifest missing'
    );
  }

  // 4. Database Interface
  info('Checking database interface...');
  
  const dbFiles = [
    'src/services/database.ts',
    'src/services/databaseInterface.ts'
  ];

  dbFiles.forEach(file => {
    check(
      `${file} exists`,
      fs.existsSync(file),
      `Missing database file: ${file}`
    );
  });

  // ==================== DEPLOYMENT CHECKS ====================
  section('Deployment Configuration');

  // 1. Environment Configuration
  info('Checking environment configuration...');
  
  // Check for environment detection
  if (fs.existsSync('src/services/index.ts')) {
    const indexContent = fs.readFileSync('src/services/index.ts', 'utf8');
    
    check(
      'Environment detection implemented',
      indexContent.includes('Constants.appOwnership') || indexContent.includes('isExpoGo'),
      'Environment detection not implemented'
    );
  }

  // 2. Build Scripts
  info('Checking build scripts...');
  
  if (fs.existsSync('package.json')) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const scripts = packageJson.scripts || {};
    
    check(
      'Start script available',
      scripts.start,
      'Missing start script',
      false
    );

    check(
      'Development script available',
      scripts.dev || scripts.start,
      'Missing development script',
      false
    );
  }

  // 3. Git Configuration
  info('Checking git configuration...');
  
  check(
    '.gitignore configured',
    fs.existsSync('../../.gitignore'),
    'Missing .gitignore file'
  );

  if (fs.existsSync('../../.gitignore')) {
    const gitignoreContent = fs.readFileSync('../../.gitignore', 'utf8');
    
    check(
      'Large files ignored',
      gitignoreContent.includes('*.jsonl') && gitignoreContent.includes('node_modules'),
      'Large files not properly ignored'
    );
  }

  // ==================== TESTING READINESS ====================
  section('Testing Readiness');

  // 1. Test Scripts
  info('Checking test scripts...');
  
  const testScripts = [
    'test-mlkit-integration.js',
    'test-online-translation.js',
    'dev-deployment-readiness.js'
  ];

  testScripts.forEach(script => {
    check(
      `${script} executable`,
      fs.existsSync(script),
      `Missing test script: ${script}`
    );
  });

  // 2. Test Screens in App
  info('Checking test screens in app...');
  
  if (fs.existsSync('src/screens/SettingsScreen.tsx')) {
    const settingsContent = fs.readFileSync('src/screens/SettingsScreen.tsx', 'utf8');
    
    check(
      'ML Kit test screen integrated',
      settingsContent.includes('MLKitTestScreen'),
      'ML Kit test screen not integrated in settings'
    );

    check(
      'Performance test integrated',
      settingsContent.includes('TranslationPerfHarness'),
      'Performance test not integrated in settings'
    );
  }

  // ==================== DEPLOYMENT COMMANDS ====================
  section('Deployment Commands Check');

  // Check if required tools are mentioned in documentation
  const deploymentCommands = [
    'npx expo prebuild',
    'eas build --profile development',
    'npx expo start --dev-client'
  ];

  // This would need to be checked in documentation or README
  // For now, we'll just inform about the required commands

  // ==================== SUMMARY ====================
  console.log(`\n${BLUE}📊 Deployment Readiness Summary${RESET}`);
  console.log(`Total Checks: ${totalChecks}`);
  console.log(`Passed: ${GREEN}${passedChecks}${RESET}`);
  console.log(`Failed: ${RED}${criticalIssues.length}${RESET}`);
  console.log(`Warnings: ${YELLOW}${warnings.length}${RESET}`);

  if (criticalIssues.length > 0) {
    console.log(`\n${RED}🚨 Critical Issues:${RESET}`);
    criticalIssues.forEach(issue => {
      console.log(`  • ${issue.name}: ${issue.message}`);
    });
  }

  if (warnings.length > 0) {
    console.log(`\n${YELLOW}⚠️ Warnings:${RESET}`);
    warnings.forEach(warning => {
      console.log(`  • ${warning.name}: ${warning.message}`);
    });
  }

  // Success criteria
  const readinessScore = (passedChecks / totalChecks) * 100;
  
  console.log(`\n${BLUE}🎯 Readiness Score: ${readinessScore.toFixed(1)}%${RESET}`);

  if (criticalIssues.length === 0) {
    success('✨ READY FOR DEV DEPLOYMENT!');
    
    console.log(`\n${GREEN}🚀 Next Steps:${RESET}`);
    console.log('1. Frontend Dev Testing:');
    console.log('   npx expo start (Test online translation in Expo Go)');
    console.log('');
    console.log('2. Native Dev Client:');
    console.log('   npx expo prebuild');
    console.log('   eas build --profile development --platform ios');
    console.log('   npx expo start --dev-client');
    console.log('');
    console.log('3. Test ML Kit Integration:');
    console.log('   Settings → "ML Kit Translation Test"');
    console.log('   Settings → "Translation Performance Test"');
    console.log('');
    console.log('4. Backend Services:');
    console.log('   Dictionary services auto-initialize');
    console.log('   Language packs download on-demand');
    
    return true;
  } else {
    error('❌ CRITICAL ISSUES MUST BE RESOLVED BEFORE DEPLOYMENT');
    return false;
  }
}

// Additional utility functions
function generateDeploymentGuide() {
  const guide = `
# Development Deployment Guide

## Frontend Testing

### 1. Expo Go (Online Translation)
\`\`\`bash
npx expo start
# Scan QR code with Expo Go app
# Tests online Google Translate service
\`\`\`

### 2. Development Client (ML Kit)
\`\`\`bash
# One-time setup
npx expo prebuild

# Build development client
eas build --profile development --platform ios
# Install the built .ipa on your device

# Start development server
npx expo start --dev-client
# Open the dev client app
\`\`\`

## Testing Checklist

### Online Service (Expo Go)
- [ ] Translation service loads correctly
- [ ] Google Translate API works
- [ ] Performance test shows ~150ms average
- [ ] Fallback to mock works if API fails

### ML Kit Service (Dev Client)
- [ ] ML Kit native module detected
- [ ] Models download successfully
- [ ] Translation works offline
- [ ] Performance test shows ~50-100ms average

### Dictionary Services
- [ ] SQLite dictionaries load
- [ ] Word lookup works
- [ ] Language packs initialize
- [ ] User language profiles work

### UI Integration
- [ ] Settings screen loads all test options
- [ ] Translation test screens accessible
- [ ] Reader screen word tapping works
- [ ] Language switcher functions

## Debugging

### Common Issues
1. **ML Kit not available**: Ensure using dev client, not Expo Go
2. **Translation fails**: Check network for online, model download for ML Kit
3. **Dictionary lookup fails**: Verify SQLite files in assets/dictionaries/
4. **Build fails**: Check EAS configuration and native module setup

### Debug Tools
- Console logs for translation services
- Performance harness for speed testing
- ML Kit test screen for model verification
- Network tab for online service debugging
`;

  fs.writeFileSync('DEPLOYMENT_GUIDE.md', guide);
  info('Created DEPLOYMENT_GUIDE.md with detailed instructions');
}

if (require.main === module) {
  runComprehensiveCheck()
    .then(success => {
      generateDeploymentGuide();
      if (!success) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Readiness check failed:', error);
      process.exit(1);
    });
}

module.exports = { runComprehensiveCheck };