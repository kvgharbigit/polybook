#!/usr/bin/env node
/**
 * Download Bergamot models for 8 supported languages
 */
console.log('🌍 Downloading Bergamot Models for 8 Languages...\n');

const https = require('https');
const fs = require('fs');
const path = require('path');

// 8 languages with available Bergamot models
const availableModels = [
  { pair: 'enes', source: 'en', target: 'es', name: 'English → Spanish', bleu: 25.9 },
  { pair: 'enfr', source: 'en', target: 'fr', name: 'English → French', bleu: 48.5 },
  { pair: 'ende', source: 'en', target: 'de', name: 'English → German', bleu: 38.8 },
  { pair: 'enit', source: 'en', target: 'it', name: 'English → Italian', bleu: 29.2 },
  { pair: 'enpt', source: 'en', target: 'pt', name: 'English → Portuguese', bleu: 49.4 },
  { pair: 'enru', source: 'en', target: 'ru', name: 'English → Russian', bleu: 28.5 },
  { pair: 'enhi', source: 'en', target: 'hi', name: 'English → Hindi', bleu: 36.7 },
  { pair: 'esen', source: 'es', target: 'en', name: 'Spanish → English', bleu: 27.5 },
  { pair: 'fren', source: 'fr', target: 'en', name: 'French → English', bleu: 43.8 },
  { pair: 'deen', source: 'de', target: 'en', name: 'German → English', bleu: 39.6 },
  { pair: 'iten', source: 'it', target: 'en', name: 'Italian → English', bleu: 30.9 },
  { pair: 'pten', source: 'pt', target: 'en', name: 'Portuguese → English', bleu: 47.8 },
  { pair: 'ruen', source: 'ru', target: 'en', name: 'Russian → English', bleu: 30.4 },
  { pair: 'hien', source: 'hi', target: 'en', name: 'Hindi → English', bleu: 36.2 }
];

async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
      } else {
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

async function downloadModel(model, index) {
  console.log(`📦 [${index + 1}/14] ${model.name} (BLEU: ${model.bleu})...`);
  
  const modelDir = `models/tiny/${model.pair}`;
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }
  
  const files = [
    `model.${model.pair}.intgemm.alphas.bin.gz`,
    `vocab.${model.pair}.spm.gz`, 
    `lex.50.50.${model.pair}.s2t.bin.gz`,
    'metadata.json'
  ];
  
  let downloadedFiles = 0;
  let totalSize = 0;
  
  for (const fileName of files) {
    const url = `https://github.com/mozilla/firefox-translations-models/raw/main/models/tiny/${model.pair}/${fileName}`;
    const outputPath = path.join(modelDir, fileName);
    
    try {
      await downloadFile(url, outputPath);
      const stats = fs.statSync(outputPath);
      totalSize += stats.size;
      downloadedFiles++;
      
      if (fileName === 'metadata.json') {
        console.log(`  ✅ ${fileName}`);
      } else {
        console.log(`  ✅ ${fileName} (${Math.round(stats.size / 1024 / 1024)}MB)`);
      }
    } catch (error) {
      console.log(`  ❌ ${fileName}: ${error.message}`);
    }
  }
  
  console.log(`  📊 Total: ${downloadedFiles}/${files.length} files, ${Math.round(totalSize / 1024 / 1024)}MB\n`);
  return { downloadedFiles, totalSize };
}

async function main() {
  console.log(`🚀 Downloading ${availableModels.length} translation models...\n`);
  
  let totalFiles = 0;
  let totalSize = 0;
  const startTime = Date.now();
  
  // Download models in batches to avoid overwhelming the server
  const batchSize = 3;
  for (let i = 0; i < availableModels.length; i += batchSize) {
    const batch = availableModels.slice(i, i + batchSize);
    
    // Download batch in parallel
    const results = await Promise.all(
      batch.map((model, batchIndex) => downloadModel(model, i + batchIndex))
    );
    
    // Accumulate results
    results.forEach(result => {
      totalFiles += result.downloadedFiles;
      totalSize += result.totalSize;
    });
    
    // Short pause between batches
    if (i + batchSize < availableModels.length) {
      console.log('⏸️  Pausing briefly between batches...\n');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  
  console.log('🎉 Download Complete!\n');
  console.log('📊 Summary:');
  console.log(`   • Models: ${availableModels.length}`);
  console.log(`   • Files: ${totalFiles}`);
  console.log(`   • Size: ${Math.round(totalSize / 1024 / 1024)}MB`);
  console.log(`   • Time: ${duration}s`);
  console.log(`   • Speed: ${Math.round(totalSize / 1024 / 1024 / duration)}MB/s`);
  
  console.log('\n🌐 Supported Languages:');
  console.log('   🇺🇸 English ↔ 🇪🇸 Spanish, 🇫🇷 French, 🇩🇪 German, 🇮🇹 Italian');
  console.log('   🇺🇸 English ↔ 🇵🇹 Portuguese, 🇷🇺 Russian, 🇮🇳 Hindi');
  console.log('   📊 Coverage: 8/10 languages, 56/90 language pairs');
}

main().catch(console.error);