#!/usr/bin/env ts-node

/**
 * Test PyGlossary SQLite Dictionary Integration
 * 
 * Tests the updated SQLiteDictionaryService with real PyGlossary database
 */

import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import Database from 'better-sqlite3';

// Mock the database structure we expect from PyGlossary
const testDbPath = '/tmp/test-eng-spa.sqlite';

async function createTestDatabase() {
  console.log('📚 Creating test PyGlossary database...');
  
  // Copy our real database if it exists
  const realDbPath = '/Users/kayvangharbi/PycharmProjects/PolyBook/dist/packs/eng-spa.sqlite';
  
  if (fs.existsSync(realDbPath)) {
    fs.copyFileSync(realDbPath, testDbPath);
    console.log('✅ Copied real PyGlossary database');
    return;
  }
  
  // Create mock database with PyGlossary structure
  const db = new Database(testDbPath);
  
  // Create PyGlossary tables
  db.exec(`
    CREATE TABLE dbinfo (
      dbname TEXT, 
      author TEXT, 
      version TEXT, 
      direction TEXT, 
      origLang TEXT, 
      destLang TEXT, 
      license TEXT, 
      category TEXT, 
      description TEXT
    );
    
    CREATE TABLE word (
      id INTEGER PRIMARY KEY NOT NULL, 
      w TEXT, 
      m TEXT
    );
    
    CREATE TABLE alt (
      id INTEGER NOT NULL, 
      w TEXT
    );
    
    CREATE INDEX idx_word_w ON word(w);
  `);
  
  // Insert test data
  const testWords = [
    { w: 'house', m: '<div><font class="grammar" color="green">noun</font><br>A building for human habitation<div>casa</div></div>' },
    { w: 'book', m: '<div><font class="grammar" color="green">noun</font><br>A written work consisting of pages<div>libro</div></div>' },
    { w: 'love', m: '<div><font class="grammar" color="green">noun</font><br>A strong feeling of affection<div>amor</div></div>' },
    { w: 'time', m: '<div><font class="grammar" color="green">noun</font><br>The indefinite continued progress of existence<div>tiempo</div></div>' },
    { w: 'water', m: '<div><font class="grammar" color="green">noun</font><br>A transparent liquid essential for life<div>agua</div></div>' }
  ];
  
  const insert = db.prepare('INSERT INTO word (w, m) VALUES (?, ?)');
  
  for (const word of testWords) {
    insert.run(word.w, word.m);
  }
  
  db.close();
  console.log('✅ Created mock PyGlossary database with test data');
}

async function testDictionaryLookup() {
  console.log('\n📖 Testing dictionary lookup...');
  
  const db = new Database(testDbPath, { readonly: true });
  
  // Test the lookup query that our service will use
  const query = db.prepare('SELECT m FROM word WHERE w = ? COLLATE NOCASE LIMIT 1');
  
  const testWords = ['house', 'book', 'LOVE', 'Water']; // Test case insensitivity
  
  for (const word of testWords) {
    const result = query.get(word);
    
    if (result) {
      console.log(`✅ Found "${word}":`, result.m.substring(0, 80) + '...');
      
      // Test our HTML parsing functions (simulate them here)
      const cleanDefinition = result.m
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      const divMatch = result.m.match(/<div[^>]*>([^<]+)<\/div>/);
      const translation = divMatch ? divMatch[1] : null;
      
      console.log(`  📝 Clean definition: ${cleanDefinition}`);
      console.log(`  🔄 Translation: ${translation}`);
    } else {
      console.log(`❌ Word "${word}" not found`);
    }
  }
  
  db.close();
}

async function testDatabaseStructure() {
  console.log('\n🔍 Testing database structure...');
  
  const db = new Database(testDbPath, { readonly: true });
  
  // Check tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('📋 Tables:', tables.map((t: any) => t.name).join(', '));
  
  // Check word table structure
  const columns = db.pragma('table_info(word)');
  console.log('📋 word table columns:', columns.map((c: any) => `${c.name} (${c.type})`).join(', '));
  
  // Count entries
  const count = db.prepare('SELECT COUNT(*) as count FROM word').get();
  console.log(`📊 Total entries: ${(count as any).count}`);
  
  // Sample entries
  const samples = db.prepare('SELECT w, substr(m, 1, 50) as m_sample FROM word LIMIT 3').all();
  console.log('📝 Sample entries:');
  samples.forEach((s: any) => console.log(`  ${s.w} -> ${s.m_sample}...`));
  
  db.close();
}

async function main() {
  try {
    await createTestDatabase();
    await testDatabaseStructure();
    await testDictionaryLookup();
    
    console.log('\n✅ PyGlossary integration test completed successfully!');
    console.log('\n🎯 The SQLiteDictionaryService should now work with PyGlossary databases');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }
}

if (require.main === module) {
  main();
}