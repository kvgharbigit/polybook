#!/usr/bin/env node

/**
 * Wiktextract Dictionary Builder
 * 
 * Downloads and processes Wiktextract JSONL files to create offline bilingual dictionaries.
 * Supports filtered extraction based on user's home and target languages.
 * 
 * Usage: 
 *   node build-wiktextract-db.js --home=es --target=en
 *   node build-wiktextract-db.js --home=en --target=es
 *   node build-wiktextract-db.js (defaults to Spanish home, English target)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const readline = require('readline');

// Wiktextract download URLs - comprehensive Wiktionary-derived data
const WIKTEXTRACT_URLS = {
  'es': 'https://kaikki.org/dictionary/downloads/es/es-extract.jsonl.gz', // 857K entries, 94.3MB compressed
  'en': 'https://kaikki.org/dictionary/downloads/en/en-extract.jsonl.gz'  // For English definitions
};

class WiktextractBuilder {
  constructor(homeLanguage = 'es', targetLanguage = 'en') {
    this.entries = [];
    this.processedCount = 0;
    this.totalLines = 0;
    this.homeLanguage = homeLanguage;
    this.targetLanguage = targetLanguage;
    this.packName = `${homeLanguage}-${targetLanguage}`;
    
    console.log(`🌍 Building dictionary pack for: ${homeLanguage} (home) → ${targetLanguage} (target)`);
  }

  async build() {
    console.log(`🏗️  Building ${this.packName} dictionary pack...`);
    console.log(`📊 Creating optimized dictionary for ${this.homeLanguage} users reading ${this.targetLanguage} books`);
    
    try {
      // Create output directory
      const outputDir = path.join(__dirname, '../assets/dictionaries');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Process Spanish dictionary
      console.log('📥 Processing Spanish dictionary...');
      
      const spanishPath = path.join(outputDir, 'es-extract.jsonl.gz');
      const spanishJsonlPath = path.join(outputDir, 'es-extract.jsonl');
      
      // Download if not exists
      if (!fs.existsSync(spanishJsonlPath)) {
        if (!fs.existsSync(spanishPath)) {
          console.log('📡 Downloading Spanish Wiktextract data (94MB compressed)...');
          await this.downloadFile(WIKTEXTRACT_URLS.es, spanishPath);
        }
        
        console.log('📦 Extracting Spanish dictionary...');
        await this.extractGzFile(spanishPath, spanishJsonlPath);
      } else {
        console.log('📄 Using cached es-extract.jsonl');
      }

      // Build language pack based on user configuration
      await this.buildLanguagePack(outputDir);

      // Generate JSON dictionary
      const jsonPath = path.join(outputDir, `wiktextract-${this.packName}.json`);
      console.log(`💾 Writing ${this.entries.length} entries to ${jsonPath}...`);
      
      const dictionaryData = {
        metadata: {
          version: '1.0.0',
          generatedAt: new Date().toISOString(),
          totalEntries: this.entries.length,
          languagePacks: [this.packName],
          homeLanguage: this.homeLanguage,
          targetLanguage: this.targetLanguage,
          source: 'Wiktextract (kaikki.org)',
          originalSources: 'Wiktionary CC-BY-SA and GFDL',
          coverage: {
            home_language_entries: this.entries.filter(e => e.sourceLang === this.homeLanguage).length,
            cross_language_entries: this.entries.filter(e => e.sourceLang === this.targetLanguage).length,
            with_translations: this.entries.filter(e => e.translations.length > 0).length
          }
        },
        entries: this.entries
      };

      fs.writeFileSync(jsonPath, JSON.stringify(dictionaryData, null, 2));
      
      console.log(`🎉 ${this.packName} dictionary pack built successfully!`);
      console.log(`📊 Total entries: ${this.entries.length}`);
      console.log(`📊 ${this.homeLanguage.toUpperCase()} entries: ${dictionaryData.metadata.coverage.home_language_entries}`);
      console.log(`📊 ${this.targetLanguage.toUpperCase()} entries: ${dictionaryData.metadata.coverage.cross_language_entries}`);
      console.log(`📊 With translations: ${dictionaryData.metadata.coverage.with_translations}`);
      console.log(`📁 Output: ${jsonPath}`);

    } catch (error) {
      console.error('❌ Error building Wiktextract dictionary:', error);
      process.exit(1);
    }
  }

  async downloadFile(url, outputPath) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);
      
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          const percent = Math.round((downloadedSize / totalSize) * 100);
          process.stdout.write(`\r📡 Downloading: ${percent}% (${Math.round(downloadedSize / 1024 / 1024)}MB)`);
        });

        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log('\n✅ Download complete');
          resolve();
        });
        
        file.on('error', reject);
      }).on('error', reject);
    });
  }

  async extractGzFile(gzPath, outputPath) {
    return new Promise((resolve, reject) => {
      // Check if gzip file exists and has content
      const stats = fs.statSync(gzPath);
      if (stats.size === 0) {
        reject(new Error('Downloaded file is empty (0 bytes)'));
        return;
      }
      
      console.log(`📦 Extracting ${Math.round(stats.size / 1024 / 1024)}MB file...`);
      
      const readStream = fs.createReadStream(gzPath);
      const writeStream = fs.createWriteStream(outputPath);
      const gunzip = zlib.createGunzip();

      readStream
        .pipe(gunzip)
        .pipe(writeStream)
        .on('finish', () => {
          const outputStats = fs.statSync(outputPath);
          console.log(`✅ Extraction complete: ${Math.round(outputStats.size / 1024 / 1024)}MB extracted`);
          resolve();
        })
        .on('error', (error) => {
          console.error('❌ Extraction failed:', error.message);
          reject(error);
        });
    });
  }

  async parseWiktextractJSONL(jsonlPath, language, maxEntries = null) {
    const entries = [];
    let lineCount = 0;
    let validEntries = 0;
    
    const fileStream = fs.createReadStream(jsonlPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      lineCount++;
      
      // Progress indicator
      if (lineCount % 10000 === 0) {
        process.stdout.write(`\r📖 Processing line ${lineCount}...`);
      }

      try {
        const wiktextractEntry = JSON.parse(line);
        const convertedEntry = this.convertWiktextractEntry(wiktextractEntry, language);
        
        if (convertedEntry) {
          entries.push(convertedEntry);
          validEntries++;
          
          // Stop if we've reached the limit
          if (maxEntries && validEntries >= maxEntries) {
            console.log(`\n📊 Reached limit of ${maxEntries} entries, stopping processing`);
            break;
          }
        }
      } catch (error) {
        // Skip malformed JSON lines
        if (lineCount % 50000 === 0) {
          console.warn(`\n⚠️  Skipped malformed entry at line ${lineCount}: ${error.message}`);
        }
      }
    }

    console.log(`\n✅ Processed ${lineCount} lines, extracted ${validEntries} valid entries`);
    return entries;
  }

  convertWiktextractEntry(wiktextractEntry, sourceLang) {
    try {
      // Extract basic word information
      const word = wiktextractEntry.word;
      if (!word || typeof word !== 'string') return null;

      // Extract part of speech
      const pos = wiktextractEntry.pos || 'unknown';
      
      // Extract translations based on source language
      const translations = this.extractTranslations(wiktextractEntry, sourceLang);
      
      // Extract definitions/glosses
      const definitions = this.extractDefinitions(wiktextractEntry);
      
      // Extract examples
      const examples = this.extractExamples(wiktextractEntry);
      
      // Extract synonyms
      const synonyms = this.extractSynonyms(wiktextractEntry);

      // Skip entries without translations or definitions
      if (translations.length === 0 && definitions.length === 0) {
        return null;
      }

      // Determine target language (for Spanish entries, target is English)
      const targetLang = sourceLang === 'es' ? 'en' : 'es';

      return {
        id: `${sourceLang}_${word}_${Date.now()}_${Math.random()}`,
        headword: word.toLowerCase(),
        displayHeadword: word,
        sourceLang,
        targetLang,
        pos,
        translations,
        definitions,
        examples: examples.slice(0, 3), // Limit examples
        synonyms: synonyms.slice(0, 5), // Limit synonyms
        pairCode: `${sourceLang}-${targetLang}`,
        frequency: this.estimateFrequency(word),
        etymology: wiktextractEntry.etymology_text || undefined
      };

    } catch (error) {
      return null;
    }
  }

  extractTranslations(entry, sourceLang) {
    const translations = [];
    
    if (entry.translations) {
      for (const translation of entry.translations) {
        // For Spanish entries, extract English translations
        // For English entries, extract Spanish translations
        const targetCode = sourceLang === 'es' ? 'en' : 'es';
        
        if (translation.code === targetCode && translation.word) {
          translations.push(translation.word);
        }
      }
    }

    return [...new Set(translations)]; // Remove duplicates
  }

  extractDefinitions(entry) {
    const definitions = [];
    
    if (entry.senses) {
      for (const sense of entry.senses) {
        if (sense.glosses) {
          for (const gloss of sense.glosses) {
            if (typeof gloss === 'string') {
              definitions.push(gloss);
            }
          }
        }
      }
    }

    return definitions;
  }

  extractExamples(entry) {
    const examples = [];
    
    if (entry.senses) {
      for (const sense of entry.senses) {
        if (sense.examples) {
          for (const example of sense.examples) {
            if (example.text) {
              examples.push(example.text);
            }
          }
        }
      }
    }

    return examples;
  }

  extractSynonyms(entry) {
    const synonyms = [];
    
    if (entry.synonyms) {
      for (const synonym of entry.synonyms) {
        if (synonym.word) {
          synonyms.push(synonym.word);
        }
      }
    }

    return synonyms;
  }

  estimateFrequency(word) {
    // Basic frequency estimation based on word length and common patterns
    const commonSpanish = ['el', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'una'];
    const commonEnglish = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at'];
    
    if (commonSpanish.includes(word.toLowerCase()) || commonEnglish.includes(word.toLowerCase())) {
      return 10000;
    }
    
    if (word.length <= 3) return 5000;
    if (word.length <= 5) return 3000;
    if (word.length <= 7) return 1000;
    return 500;
  }

  /**
   * Build language pack based on home and target language configuration
   */
  async buildLanguagePack(outputDir) {
    if (this.homeLanguage === 'es') {
      await this.buildSpanishHomePack(outputDir);
    } else if (this.homeLanguage === 'en') {
      await this.buildEnglishHomePack(outputDir);
    }
  }

  /**
   * Build pack for Spanish users (home=es, target=en)
   */
  async buildSpanishHomePack(outputDir) {
    console.log('📚 Building Spanish home language pack...');
    
    // 1. Get Spanish definitions from Spanish extract
    const spanishJsonlPath = path.join(outputDir, 'es-extract.jsonl');
    console.log('📖 Processing Spanish definitions...');
    const spanishEntries = await this.parseWiktextractJSONL(spanishJsonlPath, 'es', 25000);
    this.entries = this.entries.concat(spanishEntries);
    console.log(`✅ Added ${spanishEntries.length} Spanish definitions`);

    // 2. TODO: Get English→Spanish translations from filtered English extract
    console.log('📋 English→Spanish translations: Will use Google ML Kit for cross-language lookup');
    console.log('📋 This provides Spanish users with Spanish definitions + ML Kit translation bridge');
  }

  /**
   * Build pack for English users (home=en, target=es)  
   */
  async buildEnglishHomePack(outputDir) {
    console.log('📚 Building English home language pack...');
    
    // TODO: Implement English home pack
    // 1. Get English definitions from filtered English extract
    // 2. Get Spanish→English translations
    console.log('📋 English home pack: Not yet implemented');
    console.log('📋 Requires filtered extraction from 2.3GB English file');
    
    // For now, create minimal fallback
    this.entries = [{
      id: 'fallback_en',
      headword: 'fallback',
      displayHeadword: 'fallback',
      sourceLang: 'en',
      targetLang: 'es',
      pos: 'noun',
      translations: ['respaldo'],
      definitions: ['A fallback or backup plan'],
      examples: [],
      synonyms: [],
      pairCode: 'en-es',
      frequency: 1000
    }];
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let homeLanguage = 'es';  // Default to Spanish home
  let targetLanguage = 'en'; // Default to English target
  
  for (const arg of args) {
    if (arg.startsWith('--home=')) {
      homeLanguage = arg.split('=')[1];
    } else if (arg.startsWith('--target=')) {
      targetLanguage = arg.split('=')[1];
    } else if (arg === '--help') {
      console.log(`
Usage: node build-wiktextract-db.js [options]

Options:
  --home=<lang>    Home language (user's native language) [default: es]
  --target=<lang>  Target language (language being learned) [default: en]
  --help          Show this help message

Examples:
  node build-wiktextract-db.js                    # Spanish home, English target
  node build-wiktextract-db.js --home=es --target=en  # Spanish home, English target  
  node build-wiktextract-db.js --home=en --target=es  # English home, Spanish target

Supported languages: es (Spanish), en (English)
      `);
      process.exit(0);
    }
  }
  
  return { homeLanguage, targetLanguage };
}

// Main execution
if (require.main === module) {
  const { homeLanguage, targetLanguage } = parseArgs();
  const builder = new WiktextractBuilder(homeLanguage, targetLanguage);
  
  builder.build().catch(error => {
    console.error('❌ Build failed:', error);
    process.exit(1);
  });
}

module.exports = WiktextractBuilder;