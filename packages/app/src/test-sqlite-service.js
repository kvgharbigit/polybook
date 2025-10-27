#!/usr/bin/env node

/**
 * Test SQLite Dictionary Service Integration
 * 
 * Simulates the React Native environment to test our dictionary service
 */

const sqlite3 = require('better-sqlite3');
const fs = require('fs');

// Mock the React Native SQLite interface
const mockDatabase = (dbPath) => {
  const db = new sqlite3(dbPath, { readonly: true });
  
  return {
    transaction: (callback) => {
      const mockTx = {
        executeSql: (sql, params, success, error) => {
          try {
            const stmt = db.prepare(sql);
            const result = params ? stmt.all(...params) : stmt.all();
            
            const mockResult = {
              rows: {
                length: result.length,
                item: (index) => result[index]
              }
            };
            
            if (success) success(null, mockResult);
          } catch (err) {
            console.error('SQL Error:', err);
            if (error) error(null, err);
          }
        }
      };
      
      callback(mockTx);
    }
  };
};

// Test our HTML parsing functions (simulated)
function cleanHtmlDefinition(htmlDefinition) {
  if (!htmlDefinition) return '';
  
  let cleaned = htmlDefinition
    .replace(/<div[^>]*>/g, ' ')
    .replace(/<\/div>/g, ' ')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<font[^>]*>/g, '')
    .replace(/<\/font>/g, '')
    .replace(/<[^>]+>/g, '') // Remove any remaining HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  return cleaned;
}

function extractTranslationFromDefinition(htmlDefinition) {
  if (!htmlDefinition) return null;
  
  // Look for content in <div> tags (often the translation)
  const divMatch = htmlDefinition.match(/<div[^>]*>([^<]+)<\/div>/);
  if (divMatch) {
    return divMatch[1].trim();
  }
  
  // Clean and extract first meaningful text
  const cleaned = cleanHtmlDefinition(htmlDefinition);
  const parts = cleaned.split(/[,;]/);
  
  if (parts.length > 0) {
    return parts[0].trim();
  }
  
  return null;
}

async function testDictionaryLookup() {
  console.log('🧪 Testing SQLite Dictionary Service Integration\n');
  
  const dbPath = '/Users/kayvangharbi/PycharmProjects/PolyBook/dist/packs/eng-spa.sqlite';
  
  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found:', dbPath);
    return;
  }
  
  console.log('✅ Database found:', dbPath);
  
  const mockDb = mockDatabase(dbPath);
  const testWords = ['house', 'book', 'love', 'time', 'water'];
  
  console.log('\n📚 Testing word lookups...\n');
  
  for (const word of testWords) {
    console.log(`🔍 Looking up: "${word}"`);
    
    await new Promise((resolve) => {
      mockDb.transaction(tx => {
        tx.executeSql(
          'SELECT m FROM word WHERE w = ? COLLATE NOCASE LIMIT 1',
          [word.trim()],
          (_, { rows }) => {
            if (rows.length > 0) {
              const definition = rows.item(0).m;
              const cleanDefinition = cleanHtmlDefinition(definition);
              const translation = extractTranslationFromDefinition(definition);
              
              console.log(`  ✅ Found definition (${definition.length} chars)`);
              console.log(`  📝 Clean: ${cleanDefinition.substring(0, 80)}...`);
              console.log(`  🔄 Translation: ${translation}`);
            } else {
              console.log(`  ❌ Word "${word}" not found`);
            }
            resolve();
          },
          (_, error) => {
            console.log(`  ❌ Lookup error: ${error}`);
            resolve();
          }
        );
      });
    });
    
    console.log('');
  }
  
  console.log('🎯 Dictionary service integration test completed!');
}

// Run the test
testDictionaryLookup().catch(console.error);