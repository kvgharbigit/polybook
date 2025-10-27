#!/usr/bin/env node
/**
 * Verify tiered model availability (tiny preferred, base fallback)
 */
console.log('🎯 Verifying Tiered Model Strategy...\n');

const https = require('https');
const fs = require('fs');

// Language pairs we need to support
const targetPairs = [
  'enes', 'enfr', 'ende', 'enit', 'enpt', 'enru', 'enhi', 'enar', 'enja', 'enko', 'enzh',
  'esen', 'fren', 'deen', 'iten', 'pten', 'ruen', 'hien', 'aren', 'jaen', 'koen', 'zhen'
];

async function checkModelExists(tier, pair) {
  return new Promise((resolve) => {
    const url = `https://raw.githubusercontent.com/mozilla/firefox-translations-models/main/models/${tier}/${pair}/metadata.json`;
    
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const metadata = JSON.parse(data);
            resolve({ exists: true, metadata });
          } catch (e) {
            resolve({ exists: false });
          }
        });
      } else {
        resolve({ exists: false });
      }
    }).on('error', () => {
      resolve({ exists: false });
    });
  });
}

async function verifyTieredStrategy() {
  console.log('📊 Checking model availability by tier...\n');
  
  const results = {
    tinyOnly: [],    // Use tiny, no base option
    baseOnly: [],    // No tiny, use base
    missing: []      // Neither available
  };
  
  for (const pair of targetPairs) {
    console.log(`Checking ${pair}...`);
    
    // Check tiny first (preferred)
    const tinyResult = await checkModelExists('tiny', pair);
    
    if (tinyResult.exists) {
      // Tiny exists - use only tiny (no base option)
      results.tinyOnly.push({
        pair,
        tier: 'tiny',
        bleu: tinyResult.metadata.flores?.bleu,
        size: Math.round(tinyResult.metadata.byteSize / 1024 / 1024)
      });
      console.log(`  ✅ Tiny only (${tinyResult.metadata.flores?.bleu} BLEU, ${Math.round(tinyResult.metadata.byteSize / 1024 / 1024)}MB)`);
    } else {
      // No tiny - check base
      const baseResult = await checkModelExists('base', pair);
      
      if (baseResult.exists) {
        // No tiny but base exists - use base only
        results.baseOnly.push({
          pair,
          tier: 'base',
          bleu: baseResult.metadata.flores?.bleu,
          size: Math.round(baseResult.metadata.byteSize / 1024 / 1024)
        });
        console.log(`  ✅ Base only (${baseResult.metadata.flores?.bleu} BLEU, ${Math.round(baseResult.metadata.byteSize / 1024 / 1024)}MB)`);
      } else {
        // Neither tiny nor base available
        results.missing.push(pair);
        console.log(`  ❌ Not available`);
      }
    }
  }
  
  return results;
}

async function generateTieredStrategy(results) {
  console.log('\n📋 Tiered Strategy Results:\n');
  
  console.log(`🔸 Tiny Models (${results.tinyOnly.length}): Fast, small downloads`);
  results.tinyOnly.forEach(model => {
    const [source, target] = [model.pair.slice(0, 2), model.pair.slice(2)];
    console.log(`   ${source}→${target}: ${model.size}MB, BLEU ${model.bleu}`);
  });
  
  console.log(`\n🔹 Base Models (${results.baseOnly.length}): Higher quality, larger downloads`);
  results.baseOnly.forEach(model => {
    const [source, target] = [model.pair.slice(0, 2), model.pair.slice(2)];
    console.log(`   ${source}→${target}: ${model.size}MB, BLEU ${model.bleu}`);
  });
  
  if (results.missing.length > 0) {
    console.log(`\n❌ Missing Models (${results.missing.length}):`);
    results.missing.forEach(pair => {
      const [source, target] = [pair.slice(0, 2), pair.slice(2)];
      console.log(`   ${source}→${target}: No Bergamot support`);
    });
  }
  
  console.log('\n🎯 Implementation Strategy:');
  console.log('   • NEVER offer base when tiny exists');
  console.log('   • Use base ONLY when tiny unavailable');
  console.log('   • Single tier per language pair');
  console.log('   • Automatic tier selection');
  
  const totalSupported = results.tinyOnly.length + results.baseOnly.length;
  const coverage = Math.round((totalSupported / targetPairs.length) * 100);
  
  console.log(`\n📊 Coverage: ${totalSupported}/${targetPairs.length} pairs (${coverage}%)`);
  
  return {
    strategy: {
      tinyModels: results.tinyOnly,
      baseModels: results.baseOnly,
      unsupported: results.missing
    },
    coverage: {
      supported: totalSupported,
      total: targetPairs.length,
      percentage: coverage
    }
  };
}

async function createDownloadConfig(strategy) {
  console.log('\n📦 Generating download configuration...\n');
  
  const config = {
    version: '2.0.0-tiered',
    strategy: 'tiny-preferred-base-fallback',
    generated: new Date().toISOString(),
    models: [
      ...strategy.tinyModels.map(m => ({ ...m, url: `https://github.com/mozilla/firefox-translations-models/tree/main/models/tiny/${m.pair}` })),
      ...strategy.baseModels.map(m => ({ ...m, url: `https://github.com/mozilla/firefox-translations-models/tree/main/models/base/${m.pair}` }))
    ],
    coverage: strategy.coverage,
    rules: {
      tinyPreferred: true,
      noBaseWhenTinyExists: true,
      autoTierSelection: true
    }
  };
  
  fs.writeFileSync('tiered-model-config.json', JSON.stringify(config, null, 2));
  console.log('✅ Created tiered-model-config.json');
  
  return config;
}

async function main() {
  try {
    console.log('🚀 Starting tiered model verification...\n');
    
    const results = await verifyTieredStrategy();
    const strategy = await generateTieredStrategy(results);
    const config = await createDownloadConfig(strategy);
    
    console.log('\n🎉 Tiered Strategy Complete!');
    console.log(`   • ${config.models.length} models identified`);
    console.log(`   • ${config.coverage.percentage}% language coverage`);
    console.log(`   • Optimal tier selected for each pair`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();