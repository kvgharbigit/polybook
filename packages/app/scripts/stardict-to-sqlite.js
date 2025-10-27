#!/usr/bin/env node

/**
 * StarDict to SQLite Converter
 * 
 * Converts StarDict dictionaries (.dict/.idx/.ifo files) to SQLite for React Native
 * Creates consistent schema for all languages compatible with expo-sqlite
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

/**
 * StarDict file parser
 */
class StarDictParser {
  constructor(basePath) {
    this.basePath = basePath;
    this.info = null;
    this.index = null;
    this.dict = null;
  }

  /**
   * Parse .ifo file for dictionary metadata
   */
  parseIfo() {
    const ifoPath = `${this.basePath}.ifo`;
    if (!fs.existsSync(ifoPath)) {
      throw new Error(`IFO file not found: ${ifoPath}`);
    }

    const content = fs.readFileSync(ifoPath, 'utf8');
    const lines = content.split('\n');
    
    this.info = {};
    lines.forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        this.info[key.trim()] = value.trim();
      }
    });

    console.log(`📖 Dictionary: ${this.info.bookname || 'Unknown'}`);
    console.log(`📊 Word count: ${this.info.wordcount || 'Unknown'}`);
  }

  /**
   * Parse .idx file for word index
   */
  parseIdx() {
    const idxPath = `${this.basePath}.idx`;
    if (!fs.existsSync(idxPath)) {
      throw new Error(`IDX file not found: ${idxPath}`);
    }

    const buffer = fs.readFileSync(idxPath);
    this.index = [];
    
    let offset = 0;
    let wordCount = 0;
    
    while (offset < buffer.length && wordCount < 50000) { // Limit to prevent memory issues
      // Read null-terminated string (word)
      let wordEnd = offset;
      while (wordEnd < buffer.length && buffer[wordEnd] !== 0) {
        wordEnd++;
      }
      
      if (wordEnd >= buffer.length) break;
      
      const word = buffer.slice(offset, wordEnd).toString('utf8');
      offset = wordEnd + 1;
      
      // Read offset (4 bytes, big endian)
      if (offset + 4 > buffer.length) break;
      const dictOffset = buffer.readUInt32BE(offset);
      offset += 4;
      
      // Read size (4 bytes, big endian)  
      if (offset + 4 > buffer.length) break;
      const size = buffer.readUInt32BE(offset);
      offset += 4;
      
      // Clean and validate word
      const cleanWord = word.toLowerCase().trim();
      if (cleanWord && cleanWord.length > 0 && cleanWord.length < 100) {
        this.index.push({
          word: cleanWord,
          offset: dictOffset,
          size: size
        });
        wordCount++;
      }
    }

    console.log(`📝 Indexed ${this.index.length} words`);
  }

  /**
   * Load .dict file content
   */
  loadDict() {
    const dictPath = `${this.basePath}.dict`;
    if (!fs.existsSync(dictPath)) {
      throw new Error(`DICT file not found: ${dictPath}`);
    }

    this.dict = fs.readFileSync(dictPath);
    console.log(`💾 Dictionary data loaded: ${(this.dict.length / 1024 / 1024).toFixed(1)}MB`);
  }

  /**
   * Extract definition for a word
   */
  getDefinition(wordEntry) {
    const { offset, size } = wordEntry;
    
    if (offset + size > this.dict.length) {
      return null;
    }
    
    const content = this.dict.slice(offset, offset + size).toString('utf8');
    return this.parseDefinitionContent(content);
  }

  /**
   * Parse definition content and extract components
   */
  parseDefinitionContent(content) {
    // Clean up content
    let cleaned = content
      .replace(/\\n/g, '\n')
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')
      .trim();

    // Try to extract synonyms (words in parentheses or after "see also")
    const synonyms = [];
    const synPattern = /\(([^)]+)\)|see also:?\s*([^.\n]+)/gi;
    let match;
    while ((match = synPattern.exec(cleaned)) !== null) {
      const synText = match[1] || match[2];
      if (synText) {
        synonyms.push(...synText.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0));
      }
    }

    // Clean definition (remove synonym references)
    const definition = cleaned
      .replace(synPattern, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      definition: definition || content,
      synonyms: synonyms.slice(0, 8) // Limit synonyms
    };
  }

  /**
   * Parse all entries
   */
  parseAll() {
    this.parseIfo();
    this.parseIdx();
    this.loadDict();
    
    return this.index.map(entry => {
      const def = this.getDefinition(entry);
      return {
        lemma: entry.word,
        definition: def?.definition || '',
        synonyms: def?.synonyms || []
      };
    }).filter(entry => entry.definition.length > 0);
  }
}

/**
 * SQLite database creator
 */
class SQLiteCreator {
  constructor(outputPath) {
    this.outputPath = outputPath;
    this.db = null;
  }

  /**
   * Initialize SQLite database with schema
   */
  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.outputPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`📂 Connected to SQLite: ${this.outputPath}`);

        // Create schema with error handling
        this.db.serialize(() => {
          this.db.run(`
            CREATE TABLE IF NOT EXISTS dict (
              lemma TEXT PRIMARY KEY,
              def TEXT NOT NULL,
              syns TEXT,
              examples TEXT
            )
          `, (err) => {
            if (err) {
              reject(err);
              return;
            }

            this.db.run(`
              CREATE INDEX IF NOT EXISTS idx_dict_lemma ON dict(lemma)
            `, (err) => {
              if (err) {
                reject(err);
                return;
              }
              
              console.log(`✅ Database schema created`);
              resolve();
            });
          });
        });
      });
    });
  }

  /**
   * Insert entries into database
   */
  async insertEntries(entries) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            reject(err);
            return;
          }

          const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO dict (lemma, def, syns, examples) 
            VALUES (?, ?, ?, ?)
          `);

          let processed = 0;
          let hasErrors = false;

          const processEntry = (index) => {
            if (index >= entries.length) {
              stmt.finalize((err) => {
                if (err) {
                  this.db.run('ROLLBACK');
                  reject(err);
                  return;
                }

                if (hasErrors) {
                  this.db.run('ROLLBACK');
                  reject(new Error('Some entries failed to insert'));
                  return;
                }

                this.db.run('COMMIT', (err) => {
                  if (err) {
                    this.db.run('ROLLBACK');
                    reject(err);
                  } else {
                    console.log(`✅ Successfully inserted ${processed} entries`);
                    resolve();
                  }
                });
              });
              return;
            }

            const entry = entries[index];
            const synsJson = entry.synonyms.length > 0 ? JSON.stringify(entry.synonyms) : null;
            
            stmt.run([
              entry.lemma,
              entry.definition,
              synsJson,
              null // examples - will be added later
            ], (err) => {
              if (err) {
                console.error(`Error inserting ${entry.lemma}:`, err);
                hasErrors = true;
              }
              
              processed++;
              if (processed % 1000 === 0) {
                console.log(`📝 Processed ${processed}/${entries.length} entries`);
              }
              
              // Process next entry
              setImmediate(() => processEntry(index + 1));
            });
          };

          // Start processing
          processEntry(0);
        });
      });
    });
  }

  /**
   * Close database
   */
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

/**
 * Main conversion function
 */
async function convertStarDictToSQLite(stardictBasePath, outputPath, options = {}) {
  console.log(`🔄 Converting StarDict to SQLite...`);
  console.log(`📂 Input: ${stardictBasePath}`);
  console.log(`💾 Output: ${outputPath}`);

  try {
    // Parse StarDict files
    const parser = new StarDictParser(stardictBasePath);
    const entries = parser.parseAll();
    
    console.log(`📊 Total entries parsed: ${entries.length}`);

    // Filter top entries if requested
    let filteredEntries = entries;
    if (options.maxEntries && entries.length > options.maxEntries) {
      console.log(`🔽 Limiting to top ${options.maxEntries} entries`);
      filteredEntries = entries.slice(0, options.maxEntries);
    }

    // Create SQLite database
    const dbCreator = new SQLiteCreator(outputPath);
    await dbCreator.init();
    await dbCreator.insertEntries(filteredEntries);
    dbCreator.close();

    const sizeKB = Math.round(fs.statSync(outputPath).size / 1024);
    console.log(`✅ Conversion complete! Database size: ${sizeKB}KB`);
    
    return {
      success: true,
      entriesProcessed: filteredEntries.length,
      outputSizeKB: sizeKB
    };

  } catch (error) {
    console.error(`❌ Conversion failed:`, error);
    throw error;
  }
}

/**
 * CLI interface
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
Usage: node stardict-to-sqlite.js <input-base-path> <output-sqlite-path> [options]

Arguments:
  input-base-path   Path to StarDict files without extension (e.g., /path/to/dict)
  output-sqlite-path Output SQLite file path (e.g., /path/to/dict.sqlite)

Options:
  --max-entries N   Limit to top N entries (default: all)
  --compress        Compress output (TODO: implement)

Example:
  node stardict-to-sqlite.js ./dicts/stardict-english ./output/en_dict.sqlite --max-entries 30000
`);
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1];
  
  // Parse options
  const options = {};
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--max-entries' && i + 1 < args.length) {
      options.maxEntries = parseInt(args[i + 1]);
      i++;
    }
  }

  convertStarDictToSQLite(inputPath, outputPath, options)
    .then(result => {
      console.log(`🎉 Success! Processed ${result.entriesProcessed} entries`);
      process.exit(0);
    })
    .catch(error => {
      console.error(`💥 Failed:`, error.message);
      process.exit(1);
    });
}

module.exports = { convertStarDictToSQLite, StarDictParser, SQLiteCreator };