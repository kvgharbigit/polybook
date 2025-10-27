#!/usr/bin/env node

/**
 * Dictionary Packaging Script
 * 
 * Packages SQLite dictionaries for deployment and creates downloadable packs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class DictionaryPackager {
  constructor() {
    this.inputDir = path.join(__dirname, '../dictionaries/sqlite');
    this.outputDir = path.join(__dirname, '../dictionaries/packages');
    this.publicDir = path.join(__dirname, '../../../public/dictionaries'); // For web hosting
  }

  /**
   * Initialize directories
   */
  async initialize() {
    const dirs = [this.outputDir, this.publicDir];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    }
  }

  /**
   * Calculate file hash
   */
  calculateHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  /**
   * Compress SQLite file
   */
  async compressFile(inputPath, outputPath) {
    try {
      console.log(`🗜️  Compressing: ${path.basename(inputPath)}`);
      
      // Use gzip compression (better React Native support than bz2)
      const command = `gzip -c "${inputPath}" > "${outputPath}"`;
      await execAsync(command);
      
      const originalSize = fs.statSync(inputPath).size;
      const compressedSize = fs.statSync(outputPath).size;
      const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
      
      console.log(`  📊 Original: ${(originalSize / 1024).toFixed(1)}KB`);
      console.log(`  📊 Compressed: ${(compressedSize / 1024).toFixed(1)}KB (${ratio}% reduction)`);
      
      return {
        originalSize,
        compressedSize,
        compressionRatio: ratio
      };

    } catch (error) {
      console.error(`❌ Compression failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Package dictionary files by language
   */
  async packageDictionaries() {
    await this.initialize();

    console.log('📦 Starting dictionary packaging...\n');

    // Read SQLite files
    const sqliteFiles = fs.readdirSync(this.inputDir)
      .filter(file => file.endsWith('.sqlite'))
      .map(file => ({
        filename: file,
        fullPath: path.join(this.inputDir, file),
        language: file.split('_')[0], // Extract language code
        name: file.replace('.sqlite', '')
      }));

    if (sqliteFiles.length === 0) {
      console.log('⚠️  No SQLite files found. Run download:dictionaries first.');
      return;
    }

    console.log(`📚 Found ${sqliteFiles.length} dictionary files:`);
    sqliteFiles.forEach(file => {
      console.log(`  - ${file.filename} (${file.language})`);
    });
    console.log('');

    // Group by language
    const languageGroups = {};
    sqliteFiles.forEach(file => {
      if (!languageGroups[file.language]) {
        languageGroups[file.language] = [];
      }
      languageGroups[file.language].push(file);
    });

    // Package each language
    const packages = [];
    
    for (const [language, files] of Object.entries(languageGroups)) {
      console.log(`📖 Packaging language: ${language.toUpperCase()}`);
      console.log('━'.repeat(40));

      // For now, take the first (usually best) dictionary for each language
      const primaryDict = files[0];
      
      try {
        // Compress the SQLite file
        const compressedPath = path.join(this.outputDir, `${language}_dict.sqlite.gz`);
        const compressionResult = await this.compressFile(primaryDict.fullPath, compressedPath);

        // Calculate hash
        const hash = this.calculateHash(compressedPath);

        // Copy to public directory for serving
        const publicPath = path.join(this.publicDir, `${language}_dict.sqlite.gz`);
        fs.copyFileSync(compressedPath, publicPath);

        const packageInfo = {
          language,
          filename: `${language}_dict.sqlite.gz`,
          originalName: primaryDict.name,
          url: `/dictionaries/${language}_dict.sqlite.gz`, // Relative URL for serving
          hash,
          size: compressionResult.compressedSize,
          originalSize: compressionResult.originalSize,
          compressionRatio: compressionResult.compressionRatio,
          format: 'sqlite',
          encoding: 'gzip',
          created: new Date().toISOString()
        };

        packages.push(packageInfo);
        console.log(`✅ Packaged: ${language} (${(packageInfo.size / 1024).toFixed(1)}KB)`);

      } catch (error) {
        console.error(`❌ Failed to package ${language}: ${error.message}`);
      }
      
      console.log('');
    }

    // Generate package registry
    const registry = {
      version: '1.0.0',
      generated: new Date().toISOString(),
      packages: packages.reduce((acc, pkg) => {
        acc[pkg.language] = {
          url: pkg.url,
          hash: pkg.hash,
          size: pkg.size,
          originalSize: pkg.originalSize,
          compressionRatio: pkg.compressionRatio,
          format: pkg.format,
          encoding: pkg.encoding,
          created: pkg.created,
          description: `${pkg.language.toUpperCase()} Dictionary`
        };
        return acc;
      }, {})
    };

    // Save registry
    const registryPath = path.join(this.outputDir, 'package-registry.json');
    const publicRegistryPath = path.join(this.publicDir, 'package-registry.json');
    
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    fs.writeFileSync(publicRegistryPath, JSON.stringify(registry, null, 2));

    // Generate summary
    console.log('📊 PACKAGING SUMMARY');
    console.log('━'.repeat(50));
    console.log(`Total packages created: ${packages.length}`);
    console.log(`Total compressed size: ${(packages.reduce((sum, pkg) => sum + pkg.size, 0) / 1024).toFixed(1)}KB`);
    console.log(`Registry saved: ${registryPath}`);
    console.log(`Public files: ${this.publicDir}`);
    console.log('');

    packages.forEach(pkg => {
      console.log(`📚 ${pkg.language.toUpperCase()}: ${(pkg.size / 1024).toFixed(1)}KB (${pkg.compressionRatio}% compression)`);
    });

    console.log('\n🎉 Packaging completed!');
    console.log(`\n📋 To serve dictionaries, host the contents of: ${this.publicDir}`);

    return packages;
  }

  /**
   * Verify package integrity
   */
  async verifyPackages() {
    console.log('🔍 Verifying package integrity...\n');

    const registryPath = path.join(this.outputDir, 'package-registry.json');
    
    if (!fs.existsSync(registryPath)) {
      console.log('❌ No package registry found. Run package:dictionaries first.');
      return false;
    }

    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    let allValid = true;

    for (const [language, packageInfo] of Object.entries(registry.packages)) {
      const packagePath = path.join(this.publicDir, `${language}_dict.sqlite.gz`);
      
      if (!fs.existsSync(packagePath)) {
        console.log(`❌ Missing package: ${language}`);
        allValid = false;
        continue;
      }

      const actualHash = this.calculateHash(packagePath);
      const actualSize = fs.statSync(packagePath).size;

      if (actualHash !== packageInfo.hash) {
        console.log(`❌ Hash mismatch: ${language}`);
        console.log(`  Expected: ${packageInfo.hash}`);
        console.log(`  Actual: ${actualHash}`);
        allValid = false;
        continue;
      }

      if (actualSize !== packageInfo.size) {
        console.log(`❌ Size mismatch: ${language}`);
        console.log(`  Expected: ${packageInfo.size} bytes`);
        console.log(`  Actual: ${actualSize} bytes`);
        allValid = false;
        continue;
      }

      console.log(`✅ ${language}: Valid (${(actualSize / 1024).toFixed(1)}KB)`);
    }

    console.log(allValid ? '\n🎉 All packages verified!' : '\n❌ Some packages failed verification');
    return allValid;
  }
}

/**
 * CLI interface
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const packager = new DictionaryPackager();

  const command = args[0] || 'package';

  switch (command) {
    case 'package':
      packager.packageDictionaries()
        .then(() => {
          console.log('✅ Packaging completed!');
          process.exit(0);
        })
        .catch(error => {
          console.error('❌ Packaging failed:', error.message);
          process.exit(1);
        });
      break;

    case 'verify':
      packager.verifyPackages()
        .then((success) => {
          process.exit(success ? 0 : 1);
        })
        .catch(error => {
          console.error('❌ Verification failed:', error.message);
          process.exit(1);
        });
      break;

    default:
      console.log(`
Usage: node package-dictionaries.js [command]

Commands:
  package   Package SQLite dictionaries (default)
  verify    Verify package integrity

Examples:
  node package-dictionaries.js
  node package-dictionaries.js verify
`);
      process.exit(1);
  }
}

module.exports = { DictionaryPackager };