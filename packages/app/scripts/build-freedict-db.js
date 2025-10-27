#!/usr/bin/env node

/**
 * Wiktextract Dictionary Builder
 * 
 * Downloads and processes Wiktextract JSONL files to create offline bilingual dictionaries
 * Superior to FreeDict with 190x more entries and richer linguistic data.
 * 
 * Usage: node build-wiktextract-db.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

// Wiktextract download URLs - comprehensive Wiktionary-derived data
const WIKTEXTRACT_URLS = {
  'es': 'https://kaikki.org/dictionary/rawdata/es-extract.jsonl.gz', // 857K entries, 94MB compressed
  'en': 'https://kaikki.org/dictionary/rawdata/en-extract.jsonl.gz'  // For English definitions
};

class FreeDictBuilder {
  constructor() {
    this.entries = [];
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
  }

  async build() {
    console.log('🏗️  Building FreeDict database...');
    
    try {
      // Create output directory
      const outputDir = path.join(__dirname, '../assets/dictionaries');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Process each language pair
      for (const [pairCode, url] of Object.entries(FREEDICT_URLS)) {
        console.log(`📥 Processing ${pairCode}...`);
        
        const archivePath = path.join(outputDir, `${pairCode}.tar.xz`);
        const xmlPath = path.join(outputDir, `${pairCode}.tei`);
        
        // Download if not exists
        if (!fs.existsSync(xmlPath)) {
          if (!fs.existsSync(archivePath)) {
            console.log(`📡 Downloading ${pairCode} archive from FreeDict...`);
            await this.downloadFile(url, archivePath);
          }
          
          console.log(`📦 Extracting ${pairCode} archive...`);
          await this.extractTEI(archivePath, xmlPath, pairCode);
        } else {
          console.log(`📄 Using cached ${pairCode}.tei`);
        }

        // Parse TEI XML
        console.log(`📖 Parsing ${pairCode}.tei...`);
        const entries = await this.parseTEI(xmlPath, pairCode);
        this.entries.push(...entries);
        
        console.log(`✅ Processed ${entries.length} entries from ${pairCode}`);
      }

      // Generate JSON dictionary
      const jsonPath = path.join(outputDir, 'freedict-data.json');
      console.log(`💾 Writing ${this.entries.length} entries to ${jsonPath}...`);
      
      const dictionaryData = {
        metadata: {
          version: '1.0.0',
          generatedAt: new Date().toISOString(),
          totalEntries: this.entries.length,
          languagePairs: Object.keys(FREEDICT_URLS),
          source: 'FreeDict (freedict.org)'
        },
        entries: this.entries
      };

      fs.writeFileSync(jsonPath, JSON.stringify(dictionaryData, null, 2));
      
      console.log('🎉 FreeDict database built successfully!');
      console.log(`📊 Total entries: ${this.entries.length}`);
      console.log(`📁 Output: ${jsonPath}`);

    } catch (error) {
      console.error('❌ Error building FreeDict database:', error);
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

        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
        
        file.on('error', reject);
      }).on('error', reject);
    });
  }

  async parseTEI(xmlPath, pairCode) {
    const xmlContent = fs.readFileSync(xmlPath, 'utf8');
    const parsed = this.parser.parse(xmlContent);
    
    const entries = [];
    const teiEntries = this.extractEntries(parsed);
    
    for (const teiEntry of teiEntries) {
      try {
        const entry = this.parseEntry(teiEntry, pairCode);
        if (entry) {
          entries.push(entry);
        }
      } catch (error) {
        // Skip malformed entries
        console.warn(`⚠️  Skipped malformed entry: ${error.message}`);
      }
    }

    return entries;
  }

  extractEntries(parsed) {
    // Navigate TEI structure to find entries
    const body = parsed?.TEI?.text?.body;
    if (!body) return [];

    // Entries can be in different structures
    if (body.entry) {
      return Array.isArray(body.entry) ? body.entry : [body.entry];
    }
    
    if (body.div && body.div.entry) {
      return Array.isArray(body.div.entry) ? body.div.entry : [body.div.entry];
    }

    return [];
  }

  parseEntry(teiEntry, pairCode) {
    const id = teiEntry['@_id'] || teiEntry['@_xml:id'] || `${pairCode}_${Date.now()}_${Math.random()}`;
    
    // Extract headword
    const headword = this.extractHeadword(teiEntry);
    if (!headword) return null;

    // Extract part of speech
    const pos = this.extractPOS(teiEntry);
    
    // Extract gender (for Romance languages)
    const gender = this.extractGender(teiEntry);
    
    // Extract translations
    const translations = this.extractTranslations(teiEntry);
    
    // Extract definitions
    const definitions = this.extractDefinitions(teiEntry);
    
    // Extract examples
    const examples = this.extractExamples(teiEntry);
    
    // Extract synonyms
    const synonyms = this.extractSynonyms(teiEntry);

    // Determine source and target languages
    const [sourceLang, targetLang] = pairCode.split('-');

    return {
      id,
      headword: headword.toLowerCase(),
      displayHeadword: headword,
      sourceLang,
      targetLang,
      pos: pos || 'unknown',
      gender,
      translations: translations || [],
      definitions: definitions || [],
      examples: examples || [],
      synonyms: synonyms || [],
      pairCode,
      frequency: this.estimateFrequency(headword), // Basic frequency estimation
    };
  }

  extractHeadword(entry) {
    // Try different possible structures for headword
    if (entry.form?.orth) {
      return Array.isArray(entry.form.orth) ? entry.form.orth[0] : entry.form.orth;
    }
    
    if (entry.orth) {
      return Array.isArray(entry.orth) ? entry.orth[0] : entry.orth;
    }

    return null;
  }

  extractPOS(entry) {
    // Look for grammatical information
    if (entry.gramGrp?.pos) {
      const pos = Array.isArray(entry.gramGrp.pos) ? entry.gramGrp.pos[0] : entry.gramGrp.pos;
      return typeof pos === 'string' ? pos : pos['#text'] || pos;
    }

    if (entry.pos) {
      const pos = Array.isArray(entry.pos) ? entry.pos[0] : entry.pos;
      return typeof pos === 'string' ? pos : pos['#text'] || pos;
    }

    return null;
  }

  extractGender(entry) {
    if (entry.gramGrp?.gen) {
      const gender = Array.isArray(entry.gramGrp.gen) ? entry.gramGrp.gen[0] : entry.gramGrp.gen;
      return typeof gender === 'string' ? gender : gender['#text'] || gender;
    }

    return null;
  }

  extractTranslations(entry) {
    const translations = [];
    
    // Look for sense entries
    const senses = this.getSenses(entry);
    
    for (const sense of senses) {
      // Look for translation citations
      const cits = this.getCitations(sense);
      
      for (const cit of cits) {
        if (cit['@_type'] === 'translation' || !cit['@_type']) {
          const quote = cit.quote || cit['#text'];
          if (quote) {
            const translation = Array.isArray(quote) ? quote[0] : quote;
            if (typeof translation === 'string') {
              translations.push(translation.trim());
            } else if (translation['#text']) {
              translations.push(translation['#text'].trim());
            }
          }
        }
      }
    }

    return [...new Set(translations)]; // Remove duplicates
  }

  extractDefinitions(entry) {
    const definitions = [];
    const senses = this.getSenses(entry);
    
    for (const sense of senses) {
      if (sense.def) {
        const def = Array.isArray(sense.def) ? sense.def[0] : sense.def;
        const defText = typeof def === 'string' ? def : def['#text'];
        if (defText) {
          definitions.push(defText.trim());
        }
      }
    }

    return definitions;
  }

  extractExamples(entry) {
    const examples = [];
    const senses = this.getSenses(entry);
    
    for (const sense of senses) {
      const cits = this.getCitations(sense);
      
      for (const cit of cits) {
        if (cit['@_type'] === 'example') {
          const quote = cit.quote || cit['#text'];
          if (quote) {
            const example = Array.isArray(quote) ? quote[0] : quote;
            const exampleText = typeof example === 'string' ? example : example['#text'];
            if (exampleText) {
              examples.push(exampleText.trim());
            }
          }
        }
      }
    }

    return examples;
  }

  extractSynonyms(entry) {
    const synonyms = [];
    const senses = this.getSenses(entry);
    
    for (const sense of senses) {
      const cits = this.getCitations(sense);
      
      for (const cit of cits) {
        if (cit['@_type'] === 'synonym') {
          const quote = cit.quote || cit['#text'];
          if (quote) {
            const synonym = Array.isArray(quote) ? quote[0] : quote;
            const synonymText = typeof synonym === 'string' ? synonym : synonym['#text'];
            if (synonymText) {
              synonyms.push(synonymText.trim());
            }
          }
        }
      }
    }

    return synonyms;
  }

  getSenses(entry) {
    if (entry.sense) {
      return Array.isArray(entry.sense) ? entry.sense : [entry.sense];
    }
    return [entry]; // Sometimes the entry itself contains the sense data
  }

  getCitations(sense) {
    if (sense.cit) {
      return Array.isArray(sense.cit) ? sense.cit : [sense.cit];
    }
    return [];
  }

  estimateFrequency(word) {
    // Basic frequency estimation based on word length and common patterns
    const commonWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at'];
    const commonSpanish = ['el', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'una'];
    
    if (commonWords.includes(word.toLowerCase()) || commonSpanish.includes(word.toLowerCase())) {
      return 10000;
    }
    
    if (word.length <= 3) return 5000;
    if (word.length <= 5) return 3000;
    if (word.length <= 7) return 1000;
    return 500;
  }
}

// Install required dependencies if not present
function ensureDependencies() {
  try {
    require('fast-xml-parser');
  } catch (e) {
    console.log('📦 Installing fast-xml-parser...');
    require('child_process').execSync('npm install fast-xml-parser', { stdio: 'inherit' });
  }
}

// Main execution
if (require.main === module) {
  ensureDependencies();
  
  const builder = new FreeDictBuilder();
  builder.build().catch(error => {
    console.error('❌ Build failed:', error);
    process.exit(1);
  });
}

module.exports = FreeDictBuilder;