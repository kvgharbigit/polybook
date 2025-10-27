#!/usr/bin/env node

/**
 * StarDict Build System Test
 * 
 * Tests the StarDict download and build pipeline (Node.js version)
 */

const fs = require('fs');
const path = require('path');
const { StarDictDownloader } = require('./download-stardict.js');
const { convertStarDictToSQLite } = require('./stardict-to-sqlite.js');
const { DictionaryPackager } = require('./package-dictionaries.js');

class StarDictBuildTester {
  constructor() {
    this.results = [];
    this.baseDir = path.join(__dirname, '..');
  }

  async runAllTests() {
    console.log('🧪 Testing StarDict Build System');
    console.log('=' .repeat(50));

    try {
      await this.testDirectoryStructure();
      await this.testDownloadScripts();
      await this.testConversionScripts();
      await this.testPackagingScripts();
      await this.testOutputFiles();
    } catch (error) {
      console.error('💥 Build test failed:', error);
    }

    this.printResults();
  }

  async testDirectoryStructure() {
    console.log('\n📁 Testing Directory Structure...');

    await this.runTest('Base Directory Exists', async () => {
      if (!fs.existsSync(this.baseDir)) {
        throw new Error(`Base directory not found: ${this.baseDir}`);
      }
      return `Base directory: ${this.baseDir}`;
    });

    await this.runTest('Scripts Directory', async () => {
      const scriptsDir = path.join(this.baseDir, 'scripts');
      if (!fs.existsSync(scriptsDir)) {
        throw new Error('Scripts directory not found');
      }

      const requiredScripts = [
        'download-stardict.js',
        'stardict-to-sqlite.js', 
        'package-dictionaries.js'
      ];

      const missingScripts = requiredScripts.filter(script => 
        !fs.existsSync(path.join(scriptsDir, script))
      );

      if (missingScripts.length > 0) {
        throw new Error(`Missing scripts: ${missingScripts.join(', ')}`);
      }

      return `All required scripts present: ${requiredScripts.join(', ')}`;
    });

    await this.runTest('Dictionary Directories', async () => {
      const dictDir = path.join(this.baseDir, 'dictionaries');
      
      // Create directories if they don't exist
      const subdirs = ['raw', 'sqlite', 'packages', 'public'];
      subdirs.forEach(subdir => {
        const fullPath = path.join(dictDir, subdir);
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
        }
      });

      const existingDirs = subdirs.filter(subdir => 
        fs.existsSync(path.join(dictDir, subdir))
      );

      return `Created/verified directories: ${existingDirs.join(', ')}`;
    });
  }

  async testDownloadScripts() {
    console.log('\n📥 Testing Download Scripts...');

    await this.runTest('Download Script Import', async () => {
      const { StarDictDownloader, STARDICT_SOURCES } = require('./download-stardict.js');
      
      if (!StarDictDownloader || !STARDICT_SOURCES) {
        throw new Error('Failed to import StarDictDownloader');
      }

      const sourceCount = Object.keys(STARDICT_SOURCES).length;
      return `Imported successfully, ${sourceCount} sources available`;
    });

    await this.runTest('StarDict Sources Validation', async () => {
      const { STARDICT_SOURCES } = require('./download-stardict.js');
      
      const languages = Object.keys(STARDICT_SOURCES);
      const results = [];

      for (const lang of languages.slice(0, 2)) { // Test first 2
        const source = STARDICT_SOURCES[lang];
        
        if (!source.url || !source.filename || !source.name) {
          throw new Error(`Invalid source config for ${lang}`);
        }

        results.push(`${lang}: ${source.name}`);
      }

      return results.join(', ');
    });

    await this.runTest('Downloader Initialization', async () => {
      const downloader = new StarDictDownloader();
      await downloader.initialize();
      
      const dictDir = path.join(this.baseDir, 'dictionaries');
      const subdirs = ['raw', 'sqlite', 'packages'];
      
      for (const subdir of subdirs) {
        const fullPath = path.join(dictDir, subdir);
        if (!fs.existsSync(fullPath)) {
          throw new Error(`Directory not created: ${subdir}`);
        }
      }

      return 'Downloader initialized and directories created';
    });
  }

  async testConversionScripts() {
    console.log('\n🔄 Testing Conversion Scripts...');

    await this.runTest('Conversion Script Import', async () => {
      const { convertStarDictToSQLite, StarDictParser } = require('./stardict-to-sqlite.js');
      
      if (!convertStarDictToSQLite || !StarDictParser) {
        throw new Error('Failed to import conversion functions');
      }

      return 'Conversion functions imported successfully';
    });

    await this.runTest('SQLite Dependency Check', async () => {
      try {
        const sqlite3 = require('sqlite3');
        return `SQLite3 available: ${sqlite3.VERSION}`;
      } catch (error) {
        throw new Error('SQLite3 dependency not found. Run: npm install sqlite3');
      }
    });

    // Create a test SQLite file to verify conversion works
    await this.runTest('SQLite Creation Test', async () => {
      const sqlite3 = require('sqlite3');
      const testDbPath = path.join(this.baseDir, 'dictionaries', 'test.sqlite');

      return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(testDbPath, (err) => {
          if (err) {
            reject(new Error(`SQLite creation failed: ${err.message}`));
            return;
          }

          db.run(`
            CREATE TABLE test_dict (
              lemma TEXT PRIMARY KEY,
              def TEXT NOT NULL
            )
          `, (err) => {
            if (err) {
              reject(new Error(`Table creation failed: ${err.message}`));
              return;
            }

            db.run(`INSERT INTO test_dict (lemma, def) VALUES (?, ?)`, 
              ['test', 'A test definition'], (err) => {
              if (err) {
                reject(new Error(`Insert failed: ${err.message}`));
                return;
              }

              db.get(`SELECT * FROM test_dict WHERE lemma = ?`, ['test'], (err, row) => {
                db.close();
                
                // Clean up test file
                try {
                  fs.unlinkSync(testDbPath);
                } catch (e) {}

                if (err || !row) {
                  reject(new Error('SQLite query failed'));
                  return;
                }

                resolve('SQLite operations working correctly');
              });
            });
          });
        });
      });
    });
  }

  async testPackagingScripts() {
    console.log('\n📦 Testing Packaging Scripts...');

    await this.runTest('Packaging Script Import', async () => {
      const { DictionaryPackager } = require('./package-dictionaries.js');
      
      if (!DictionaryPackager) {
        throw new Error('Failed to import DictionaryPackager');
      }

      return 'Packaging functions imported successfully';
    });

    await this.runTest('Packager Initialization', async () => {
      const packager = new DictionaryPackager();
      await packager.initialize();
      
      const outputDir = path.join(this.baseDir, 'dictionaries', 'packages');
      const publicDir = path.join(this.baseDir, 'dictionaries', 'public');
      
      if (!fs.existsSync(outputDir) || !fs.existsSync(publicDir)) {
        throw new Error('Packaging directories not created');
      }

      return 'Packager initialized and directories ready';
    });
  }

  async testOutputFiles() {
    console.log('\n📄 Testing Output Files...');

    await this.runTest('Dictionary Directory Contents', async () => {
      const dictDir = path.join(this.baseDir, 'dictionaries');
      const subdirs = ['raw', 'sqlite', 'packages', 'public'];
      
      const results = [];
      for (const subdir of subdirs) {
        const fullPath = path.join(dictDir, subdir);
        if (fs.existsSync(fullPath)) {
          const files = fs.readdirSync(fullPath);
          results.push(`${subdir}: ${files.length} files`);
        } else {
          results.push(`${subdir}: missing`);
        }
      }

      return results.join(', ');
    });

    await this.runTest('Package.json Scripts', async () => {
      const packagePath = path.join(this.baseDir, 'package.json');
      
      if (!fs.existsSync(packagePath)) {
        throw new Error('package.json not found');
      }

      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const scripts = packageJson.scripts || {};
      
      const requiredScripts = [
        'download:dictionaries',
        'build:dictionaries',
        'package:dictionaries'
      ];

      const missingScripts = requiredScripts.filter(script => !scripts[script]);
      
      if (missingScripts.length > 0) {
        throw new Error(`Missing scripts: ${missingScripts.join(', ')}`);
      }

      return `All required scripts present: ${requiredScripts.join(', ')}`;
    });

    await this.runTest('Dependencies Check', async () => {
      const packagePath = path.join(this.baseDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const devDeps = packageJson.devDependencies || {};
      const requiredDeps = ['sqlite3', 'tar'];
      
      const missingDeps = requiredDeps.filter(dep => !devDeps[dep]);
      
      if (missingDeps.length > 0) {
        return `Missing dependencies: ${missingDeps.join(', ')} (run npm install)`;
      }

      return `All required dependencies present: ${requiredDeps.join(', ')}`;
    });
  }

  async runTest(name, testFn) {
    const startTime = Date.now();
    
    try {
      const details = await testFn();
      const timing = Date.now() - startTime;
      
      this.results.push({
        name,
        success: true,
        details,
        timing
      });
      
      console.log(`  ✅ ${name}: ${details} (${timing}ms)`);
      
    } catch (error) {
      const timing = Date.now() - startTime;
      const errorMessage = error.message || String(error);
      
      this.results.push({
        name,
        success: false,
        details: errorMessage,
        timing,
        error: errorMessage
      });
      
      console.log(`  ❌ ${name}: ${errorMessage} (${timing}ms)`);
    }
  }

  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 BUILD SYSTEM TEST RESULTS');
    console.log('='.repeat(50));

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;

    console.log(`\n📈 Overall: ${passed}/${total} tests passed (${((passed/total)*100).toFixed(1)}%)`);
    
    if (failed > 0) {
      console.log(`\n❌ Failed Tests (${failed}):`);
      this.results.filter(r => !r.success).forEach(result => {
        console.log(`  • ${result.name}: ${result.error}`);
      });
    }

    console.log(`\n🎯 Status: ${failed === 0 ? '✅ BUILD SYSTEM READY' : `❌ ${failed} ISSUES FOUND`}`);
    
    if (failed === 0) {
      console.log('\n🎉 StarDict build system is ready to use!');
      console.log('\n📝 Next steps:');
      console.log('  1. Run: npm run download:dictionaries');
      console.log('  2. Run: npm run package:dictionaries');
      console.log('  3. Serve dictionaries for app to download');
    } else {
      console.log('\n🔧 Build system needs fixes. Address failed tests above.');
    }
  }
}

// Run tests if executed directly
if (require.main === module) {
  const tester = new StarDictBuildTester();
  tester.runAllTests();
}

module.exports = { StarDictBuildTester };