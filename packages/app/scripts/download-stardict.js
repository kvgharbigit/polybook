#!/usr/bin/env node

/**
 * StarDict Dictionary Downloader
 * 
 * Downloads real StarDict dictionaries from public sources
 * and converts them to SQLite for our app
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Working StarDict dictionary sources from FreeDict
 * These are confirmed working URLs with real StarDict files
 */
const STARDICT_SOURCES = {
  // English → Spanish from FreeDict (confirmed working)
  'en-es': {
    name: 'English-Spanish Dictionary (FreeDict)',
    url: 'https://download.freedict.org/dictionaries/eng-spa/2024.10.10/freedict-eng-spa-2024.10.10.stardict.tar.xz',
    filename: 'freedict-eng-spa-2024.10.10.stardict.tar.xz',
    size: '3.1MB',
    entries: '60,000+',
    format: 'tar.xz'
  },
  
  // Spanish → English from FreeDict (confirmed working)
  'es-en': {
    name: 'Spanish-English Dictionary (FreeDict)', 
    url: 'https://download.freedict.org/dictionaries/spa-eng/0.3.1/freedict-spa-eng-0.3.1.stardict.tar.xz',
    filename: 'freedict-spa-eng-0.3.1.stardict.tar.xz',
    size: '2.5MB',
    entries: '50,000+',
    format: 'tar.xz'
  },

  // English → French from FreeDict
  'en-fr': {
    name: 'English-French Dictionary (FreeDict)',
    url: 'https://download.freedict.org/dictionaries/eng-fra/2024.10.10/freedict-eng-fra-2024.10.10.stardict.tar.xz',
    filename: 'freedict-eng-fra-2024.10.10.stardict.tar.xz',
    size: '4.2MB', 
    entries: '70,000+',
    format: 'tar.xz'
  },

  // French → English from FreeDict
  'fr-en': {
    name: 'French-English Dictionary (FreeDict)',
    url: 'https://download.freedict.org/dictionaries/fra-eng/2024.10.10/freedict-fra-eng-2024.10.10.stardict.tar.xz',
    filename: 'freedict-fra-eng-2024.10.10.stardict.tar.xz',
    size: '5.1MB',
    entries: '80,000+',
    format: 'tar.xz'
  },

  // German → English from FreeDict
  'de-en': {
    name: 'German-English Dictionary (FreeDict)',
    url: 'https://download.freedict.org/dictionaries/deu-eng/2024.10.10/freedict-deu-eng-2024.10.10.stardict.tar.xz',
    filename: 'freedict-deu-eng-2024.10.10.stardict.tar.xz',
    size: '5.8MB',
    entries: '120,000+',
    format: 'tar.xz'
  }
};

/**
 * Alternative dictionary sources (if primary fails)
 */
const ALTERNATIVE_SOURCES = {
  // FreeDict project
  'en-freedict': 'https://download.freedict.org/dictionaries/',
  
  // Wiktionary dumps
  'wiktionary': 'https://dumps.wikimedia.org/enwiktionary/latest/',
  
  // GCIDE (GNU Collaborative International Dictionary of English)
  'gcide': 'https://ftp.gnu.org/gnu/gcide/'
};

class StarDictDownloader {
  constructor() {
    this.downloadDir = path.join(__dirname, '../dictionaries/raw');
    this.outputDir = path.join(__dirname, '../dictionaries/sqlite');
    this.tempDir = path.join(__dirname, '../dictionaries/temp');
  }

  /**
   * Initialize directories
   */
  async initialize() {
    const dirs = [this.downloadDir, this.outputDir, this.tempDir];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    }
  }

  /**
   * Download a file from URL
   */
  async downloadFile(url, outputPath, onProgress) {
    return new Promise((resolve, reject) => {
      console.log(`📥 Downloading: ${url}`);
      
      const file = fs.createWriteStream(outputPath);
      
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          return this.downloadFile(response.headers.location, outputPath, onProgress)
            .then(resolve)
            .catch(reject);
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length']) || 0;
        let downloadedSize = 0;

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (onProgress && totalSize > 0) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            onProgress(progress);
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log(`✅ Downloaded: ${path.basename(outputPath)}`);
          resolve(outputPath);
        });

        file.on('error', (err) => {
          fs.unlink(outputPath, () => {}); // Delete partial file
          reject(err);
        });

      }).on('error', reject);
    });
  }

  /**
   * Extract tar.gz or tar.bz2 file
   */
  async extractArchive(archivePath, extractDir) {
    try {
      console.log(`📦 Extracting: ${path.basename(archivePath)}`);
      
      // Create extraction directory
      if (!fs.existsSync(extractDir)) {
        fs.mkdirSync(extractDir, { recursive: true });
      }

      // Determine extraction command based on file extension
      let command;
      if (archivePath.endsWith('.tar.gz')) {
        command = `tar -xzf "${archivePath}" -C "${extractDir}"`;
      } else if (archivePath.endsWith('.tar.bz2')) {
        command = `tar -xjf "${archivePath}" -C "${extractDir}"`;
      } else if (archivePath.endsWith('.tar.xz')) {
        command = `tar -xJf "${archivePath}" -C "${extractDir}"`;
      } else {
        throw new Error(`Unsupported archive format: ${archivePath}`);
      }

      await execAsync(command);
      
      console.log(`✅ Extracted: ${path.basename(archivePath)}`);
      return extractDir;

    } catch (error) {
      console.error(`❌ Extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find StarDict files in extracted directory
   */
  findStarDictFiles(dir) {
    const files = fs.readdirSync(dir, { recursive: true });
    
    // Look for StarDict files (including compressed versions)
    const starDictFiles = files.filter(file => 
      file.endsWith('.ifo') || 
      file.endsWith('.idx') || file.endsWith('.idx.gz') ||
      file.endsWith('.dict') || file.endsWith('.dict.dz')
    );

    console.log(`🔍 Found StarDict files: ${starDictFiles.join(', ')}`);

    // Group by base name
    const groups = {};
    starDictFiles.forEach(file => {
      const fullPath = path.join(dir, file);
      let baseName = path.basename(file);
      
      // Handle compressed extensions
      if (baseName.endsWith('.idx.gz')) {
        baseName = baseName.replace('.idx.gz', '');
      } else if (baseName.endsWith('.dict.dz')) {
        baseName = baseName.replace('.dict.dz', '');
      } else {
        baseName = path.basename(file, path.extname(file));
      }
      
      if (!groups[baseName]) {
        groups[baseName] = {};
      }
      
      // Determine file type
      let fileType;
      if (file.endsWith('.ifo')) {
        fileType = '.ifo';
      } else if (file.endsWith('.idx') || file.endsWith('.idx.gz')) {
        fileType = '.idx';
      } else if (file.endsWith('.dict') || file.endsWith('.dict.dz')) {
        fileType = '.dict';
      }
      
      groups[baseName][fileType] = fullPath;
    });

    // Find complete sets (having .ifo, .idx, and .dict)
    const completeSets = Object.entries(groups)
      .filter(([baseName, files]) => 
        files['.ifo'] && files['.idx'] && files['.dict']
      )
      .map(([baseName, files]) => ({
        baseName,
        basePath: path.join(path.dirname(files['.ifo']), baseName),
        files
      }));

    console.log(`📚 Found ${completeSets.length} complete StarDict sets`);
    completeSets.forEach(set => {
      console.log(`  • ${set.baseName}: ${Object.keys(set.files).join(', ')}`);
    });

    return completeSets;
  }

  /**
   * Decompress StarDict files if needed
   */
  async decompressStarDictFiles(starDictSets, tempDir) {
    const results = [];
    
    for (const set of starDictSets) {
      console.log(`🔄 Processing: ${set.baseName}`);
      
      const decompressedFiles = { ...set.files };
      
      // Decompress .idx.gz file
      if (set.files['.idx'].endsWith('.gz')) {
        const gzPath = set.files['.idx'];
        const decompressedPath = gzPath.replace('.gz', '');
        
        console.log(`📦 Decompressing: ${path.basename(gzPath)}`);
        await execAsync(`gunzip -c "${gzPath}" > "${decompressedPath}"`);
        decompressedFiles['.idx'] = decompressedPath;
      }
      
      // Decompress .dict.dz file
      if (set.files['.dict'].endsWith('.dz')) {
        const dzPath = set.files['.dict'];
        const decompressedPath = dzPath.replace('.dz', '');
        
        console.log(`📦 Decompressing: ${path.basename(dzPath)}`);
        // Use dictzip to decompress .dz files, or gzip as fallback
        try {
          await execAsync(`dictzip -d -c "${dzPath}" > "${decompressedPath}"`);
        } catch (error) {
          console.log(`⚠️  dictzip not found, trying gzip...`);
          await execAsync(`gunzip -c "${dzPath}" > "${decompressedPath}"`);
        }
        decompressedFiles['.dict'] = decompressedPath;
      }
      
      results.push({
        ...set,
        files: decompressedFiles,
        basePath: path.join(path.dirname(set.files['.ifo']), set.baseName)
      });
    }
    
    return results;
  }

  /**
   * Download and process a dictionary
   */
  async downloadDictionary(langCode) {
    const source = STARDICT_SOURCES[langCode];
    
    if (!source) {
      throw new Error(`No source found for language: ${langCode}`);
    }

    console.log(`🌍 Processing ${source.name} (${source.size}, ${source.entries} entries)`);

    try {
      // Download archive
      const archivePath = path.join(this.downloadDir, source.filename);
      
      if (!fs.existsSync(archivePath)) {
        await this.downloadFile(source.url, archivePath, (progress) => {
          process.stdout.write(`\r📥 Downloading ${source.name}: ${progress}%`);
        });
        console.log(''); // New line after progress
      } else {
        console.log(`📋 Archive already exists: ${source.filename}`);
      }

      // Extract archive
      const extractDir = path.join(this.tempDir, langCode);
      await this.extractArchive(archivePath, extractDir);

      // Find StarDict files
      const starDictSets = this.findStarDictFiles(extractDir);
      
      if (starDictSets.length === 0) {
        throw new Error(`No complete StarDict sets found in ${extractDir}`);
      }

      console.log(`📚 Found ${starDictSets.length} dictionary set(s)`);

      // Decompress files if needed
      const decompressedSets = await this.decompressStarDictFiles(starDictSets, extractDir);

      // Convert each set to SQLite
      const results = [];
      for (const set of decompressedSets) {
        console.log(`🔄 Converting: ${set.baseName}`);
        
        const sqlitePath = path.join(this.outputDir, `${langCode}_${set.baseName}.sqlite`);
        
        // Use our stardict-to-sqlite converter
        const { convertStarDictToSQLite } = require('./stardict-to-sqlite.js');
        
        const result = await convertStarDictToSQLite(set.basePath, sqlitePath, {
          maxEntries: 30000 // Limit for mobile app
        });

        results.push({
          language: langCode,
          name: set.baseName,
          sqlitePath,
          ...result
        });
      }

      // Clean up temp files
      fs.rmSync(extractDir, { recursive: true, force: true });

      return results;

    } catch (error) {
      console.error(`❌ Failed to process ${langCode}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Download all dictionaries
   */
  async downloadAllDictionaries() {
    await this.initialize();

    console.log('🚀 Starting StarDict dictionary downloads...\n');

    const results = [];
    const languages = Object.keys(STARDICT_SOURCES);

    for (const langCode of languages) {
      try {
        console.log(`\n📖 Processing language: ${langCode.toUpperCase()}`);
        console.log('━'.repeat(50));
        
        const langResults = await this.downloadDictionary(langCode);
        results.push(...langResults);
        
        console.log(`✅ Completed: ${langCode.toUpperCase()}\n`);

      } catch (error) {
        console.error(`❌ Failed to process ${langCode}: ${error.message}\n`);
        // Continue with other languages
      }
    }

    // Generate summary
    console.log('\n📊 DOWNLOAD SUMMARY');
    console.log('━'.repeat(50));
    console.log(`Total dictionaries processed: ${results.length}`);
    
    results.forEach(result => {
      console.log(`📚 ${result.language}: ${result.name} (${result.entriesProcessed} entries, ${result.outputSizeKB}KB)`);
    });

    // Generate registry file
    const registry = {};
    results.forEach(result => {
      if (!registry[result.language]) {
        registry[result.language] = [];
      }
      registry[result.language].push({
        name: result.name,
        path: path.relative(this.outputDir, result.sqlitePath),
        entries: result.entriesProcessed,
        sizeKB: result.outputSizeKB
      });
    });

    const registryPath = path.join(this.outputDir, 'dictionary-registry.json');
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    
    console.log(`📋 Registry saved: ${registryPath}`);
    console.log('\n🎉 All downloads completed!');

    return results;
  }
}

/**
 * CLI interface
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const downloader = new StarDictDownloader();

  if (args.length === 0) {
    // Download all dictionaries
    downloader.downloadAllDictionaries()
      .then(() => {
        console.log('✅ Success!');
        process.exit(0);
      })
      .catch(error => {
        console.error('❌ Failed:', error.message);
        process.exit(1);
      });
  } else {
    // Download specific language
    const langCode = args[0];
    downloader.downloadDictionary(langCode)
      .then(() => {
        console.log(`✅ Success: ${langCode}`);
        process.exit(0);
      })
      .catch(error => {
        console.error(`❌ Failed: ${error.message}`);
        process.exit(1);
      });
  }
}

module.exports = { StarDictDownloader, STARDICT_SOURCES };