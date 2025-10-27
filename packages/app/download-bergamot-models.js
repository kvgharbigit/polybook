#!/usr/bin/env node

/**
 * Download basic Bergamot models for testing
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const baseUrl = 'https://raw.githubusercontent.com/mozilla/firefox-translations-models/main/models/prod';

const models = [
  {
    pair: 'enes',
    files: [
      'vocab.enes.spm',
      'lex.50.50.enes.s2t.bin'
    ]
  },
  {
    pair: 'esen', 
    files: [
      'vocab.esen.spm',
      'lex.50.50.esen.s2t.bin'
    ]
  }
];

async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✅ Downloaded: ${path.basename(outputPath)}`);
          resolve();
        });
      } else {
        console.log(`❌ Failed to download ${url}: HTTP ${response.statusCode}`);
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

async function main() {
  console.log('📦 Downloading Bergamot models for basic testing...\n');
  
  for (const model of models) {
    console.log(`Downloading ${model.pair} model files...`);
    const modelDir = `assets/bergamot/models/${model.pair}`;
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    
    for (const file of model.files) {
      const url = `${baseUrl}/${model.pair}/${file}`;
      const outputPath = path.join(modelDir, file);
      
      try {
        await downloadFile(url, outputPath);
      } catch (error) {
        console.log(`❌ Failed to download ${file}: ${error.message}`);
      }
    }
    console.log('');
  }
  
  console.log('🎉 Model download completed!');
  console.log('Note: Full model.*.bin files are very large (80+ MB each)');
  console.log('For now, we have vocabulary and lexical files for basic testing');
}

main().catch(console.error);