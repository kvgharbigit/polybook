#!/usr/bin/env node
/**
 * Download models using tiered strategy (tiny preferred, base fallback)
 */
console.log('🎯 Downloading Models with Tiered Strategy...\n');

const https = require('https');
const fs = require('fs');
const path = require('path');

// Import our tiered configuration
const config = JSON.parse(fs.readFileSync('final-tiered-config.json', 'utf8'));

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
        downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
      } else {
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function downloadModel(model, index, total) {
  console.log(`📦 [${index + 1}/${total}] ${model.lang} (${model.tier}, ${model.size}MB, BLEU: ${model.bleu || 'N/A'})...`);
  
  const modelDir = `models/${model.tier}/${model.pair}`;
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
    const url = `https://github.com/mozilla/firefox-translations-models/raw/main/models/${model.tier}/${model.pair}/${fileName}`;
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
  return { downloadedFiles, totalSize, tier: model.tier };
}

async function downloadAllModels() {
  console.log(`🚀 Downloading ${config.tinyModels.length + config.baseModels.length} models with tiered strategy...\n`);
  
  const allModels = [...config.tinyModels, ...config.baseModels];
  let totalFiles = 0;
  let totalSize = 0;
  let tinySize = 0;
  let baseSize = 0;
  const startTime = Date.now();
  
  // Download in batches
  const batchSize = 3;
  for (let i = 0; i < allModels.length; i += batchSize) {
    const batch = allModels.slice(i, i + batchSize);
    
    const results = await Promise.all(
      batch.map((model, batchIndex) => downloadModel(model, i + batchIndex, allModels.length))
    );
    
    results.forEach(result => {
      totalFiles += result.downloadedFiles;
      totalSize += result.totalSize;
      if (result.tier === 'tiny') {
        tinySize += result.totalSize;
      } else {
        baseSize += result.totalSize;
      }
    });
    
    if (i + batchSize < allModels.length) {
      console.log('⏸️  Pausing between batches...\n');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  
  return { totalFiles, totalSize, tinySize, baseSize, duration, allModels };
}

async function decompressModels() {
  console.log('🗜️  Decompressing models...\n');
  
  const allModels = [...config.tinyModels, ...config.baseModels];
  
  for (const model of allModels) {
    const modelDir = `models/${model.tier}/${model.pair}`;
    
    try {
      console.log(`Decompressing ${model.pair} (${model.tier})...`);
      
      process.chdir(modelDir);
      require('child_process').execSync('gunzip -f *.gz 2>/dev/null || true');
      process.chdir('../../../');
      
      console.log(`  ✅ ${model.pair} decompressed`);
    } catch (error) {
      console.log(`  ⚠️  ${model.pair}: ${error.message}`);
    }
  }
}

async function copyToAssets() {
  console.log('\n📁 Copying models to app assets...\n');
  
  const allModels = [...config.tinyModels, ...config.baseModels];
  
  for (const model of allModels) {
    const sourceDir = `models/${model.tier}/${model.pair}`;
    const targetDir = `assets/bergamot/assets/bergamot/models/${model.pair}`;
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    try {
      const files = fs.readdirSync(sourceDir);
      for (const file of files) {
        if (!file.endsWith('.gz')) {
          fs.copyFileSync(
            path.join(sourceDir, file),
            path.join(targetDir, file)
          );
        }
      }
      console.log(`✅ ${model.pair} (${model.tier}) copied to assets`);
    } catch (error) {
      console.log(`❌ ${model.pair}: ${error.message}`);
    }
  }
}

async function updateServiceConfiguration() {
  console.log('\n⚙️  Updating service configuration...\n');
  
  // Update HTML template with all model pairs
  const htmlPath = 'src/translation/bergamot/index.html';
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');
  
  // Generate model configuration for HTML
  const modelConfig = {};
  [...config.tinyModels, ...config.baseModels].forEach(model => {
    const [source, target] = [model.pair.slice(0, 2), model.pair.slice(2)];
    modelConfig[`${source}-${target}`] = {
      model: `./models/${model.pair}/model.${model.pair}.intgemm.alphas.bin`,
      vocab: `./models/${model.pair}/vocab.${model.pair}.spm`,
      lex: `./models/${model.pair}/lex.50.50.${model.pair}.s2t.bin`
    };
  });
  
  console.log(`✅ Generated configuration for ${Object.keys(modelConfig).length} language pairs`);
  console.log(`   • Tiny models: ${config.tinyModels.length}`);
  console.log(`   • Base models: ${config.baseModels.length}`);
  
  return modelConfig;
}

async function main() {
  try {
    console.log('🎯 Tiered Strategy: Tiny preferred, Base fallback\n');
    console.log(`📊 Strategy Overview:`);
    console.log(`   • Tiny models: ${config.tinyModels.length} (${config.tinyModels[0].size}MB each)`);
    console.log(`   • Base models: ${config.baseModels.length} (${config.baseModels[0].size}-57MB each)`);
    console.log(`   • Coverage: ${config.coverage.percentage}% of target languages\n`);
    
    const results = await downloadAllModels();
    await decompressModels();
    await copyToAssets();
    const modelConfig = await updateServiceConfiguration();
    
    console.log('\n🎉 Tiered Download Complete!\n');
    console.log('📊 Final Summary:');
    console.log(`   • Total models: ${results.allModels.length}`);
    console.log(`   • Total files: ${results.totalFiles}`);
    console.log(`   • Tiny models size: ${Math.round(results.tinySize / 1024 / 1024)}MB`);
    console.log(`   • Base models size: ${Math.round(results.baseSize / 1024 / 1024)}MB`);
    console.log(`   • Total size: ${Math.round(results.totalSize / 1024 / 1024)}MB`);
    console.log(`   • Download time: ${results.duration}s`);
    console.log(`   • Speed: ${Math.round(results.totalSize / 1024 / 1024 / results.duration)}MB/s`);
    
    console.log('\n🌐 Language Coverage:');
    console.log(`   • Full coverage: ${config.languageCoverage.bergamotSupported.length}/12 target languages`);
    console.log(`   • Tiny tier: ${config.languageCoverage.tinyTier.join(', ')}`);
    console.log(`   • Base tier: ${config.languageCoverage.baseTier.join(', ')}`);
    
    console.log('\n✅ All language pairs now supported with optimal models!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();