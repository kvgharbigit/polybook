# WikiDict/Wiktionary Data Structure Documentation

## 📚 Overview

This document provides comprehensive documentation of how WikiDict/Wiktionary data is structured, stored, and processed in the PolyBook application. The app uses multiple database formats to support rich bilingual dictionary functionality with advanced features like synonym cycling and semantic meaning differentiation.

## 🗄️ Database Schemas

### Primary WikiDict Format

The main WikiDict database uses a sophisticated schema optimized for bilingual dictionaries:

```sql
-- Primary translation table
CREATE TABLE translation (
    id INTEGER PRIMARY KEY,
    written_rep TEXT NOT NULL,          -- Word/headword (e.g., "cold")
    lexentry TEXT,                      -- Lexical entry with part of speech info
    sense TEXT,                         -- Definition/meaning description
    trans_list TEXT,                    -- Pipe-separated translations
    pos TEXT,                           -- Part of speech
    domain TEXT,                        -- Semantic domain
    lang_code TEXT,                     -- Language code
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_translation_written_rep ON translation(written_rep);
CREATE INDEX idx_translation_pos ON translation(pos);
CREATE INDEX idx_translation_lang ON translation(lang_code);
```

### StarDict Fallback Format

For compatibility with legacy StarDict dictionaries:

```sql
-- StarDict-compatible table
CREATE TABLE dict (
    lemma TEXT PRIMARY KEY,             -- Word/headword
    def TEXT NOT NULL,                  -- HTML definition
    syns TEXT,                          -- JSON array of synonyms
    examples TEXT                       -- JSON array of examples
);

-- Performance index
CREATE INDEX idx_dict_lemma ON dict(lemma);
```

### PyGlossary Legacy Format

Some dictionaries use the simple PyGlossary format:

```sql
-- Simple word-meaning table
CREATE TABLE word (
    id INTEGER PRIMARY KEY,
    w TEXT NOT NULL,                    -- Word
    m TEXT NOT NULL                     -- Meaning/translation
);

CREATE INDEX idx_word_w ON word(w);
```

## 📊 Data Structure Examples

### WikiDict Translation Entry

```json
{
    "written_rep": "cold",
    "lexentry": "cold_ADJ_01",
    "sense": "having a low temperature; not warm",
    "trans_list": "frío | helado | gélido | frígido",
    "pos": "adjective",
    "domain": "temperature",
    "lang_code": "en"
}
```

### Multiple Meanings for Same Word

```json
[
    {
        "written_rep": "cold",
        "lexentry": "cold_ADJ_01",
        "sense": "having a low temperature",
        "trans_list": "frío | helado | gélido",
        "pos": "adjective"
    },
    {
        "written_rep": "cold",
        "lexentry": "cold_NOUN_01", 
        "sense": "illness with runny nose",
        "trans_list": "resfriado | catarro | gripe",
        "pos": "noun"
    },
    {
        "written_rep": "cold",
        "lexentry": "cold_ADV_01",
        "sense": "without preparation",
        "trans_list": "en frío | sin preparación",
        "pos": "adverb"
    }
]
```

## 🔄 Synonym Storage and Processing

### Storage Format

Synonyms are stored differently depending on the database format:

1. **WikiDict Format**: Pipe-separated in `trans_list` field
   ```
   trans_list: "frío | helado | gélido | frígido | algente"
   ```

2. **StarDict Format**: JSON array in `syns` field
   ```json
   syns: "[\"cold\", \"chilly\", \"frigid\", \"icy\"]"
   ```

### Processing Logic

The app processes synonyms through a sophisticated system in `sqliteDictionaryService.ts`:

```typescript
// Extract translations from WikiDict format
const allTranslations = rows[0].trans_list ? 
    rows[0].trans_list.split(' | ') : [];

// Build meaning groups for each semantic sense
wikiResponse.primaryDefinition.definitions.forEach((def, index) => {
    const partOfSpeech = def.partOfSpeech || 'general';
    
    // Each meaning gets main translation + definition-specific synonyms
    let meaningSynonyms = [];
    if (mainTranslations.length > 0) {
        meaningSynonyms.push(mainTranslations[0]); // Primary translation
    }
    
    // Add definition-specific synonyms
    if (def.synonyms && Array.isArray(def.synonyms)) {
        meaningSynonyms.push(...def.synonyms);
    }
    
    // Create meaning group for UI cycling
    meaningGroups.push({
        partOfSpeech: partOfSpeech,
        definitions: [{
            synonyms: meaningSynonyms,
            definition: def.definition,
            example: def.example
        }],
        emoji: getPartOfSpeechIcon(partOfSpeech)
    });
});
```

## 🎯 Two-Level Cycling System

The app implements a sophisticated two-level cycling system for navigating word meanings and synonyms:

### Level 1: Meaning/Part-of-Speech Cycling (Emoji)
- **Trigger**: Tap on emoji (🏷️, ⚡, 🎨)
- **Function**: Cycles through different semantic meanings of the same word
- **Example**: "cold" → adjective (frío) → noun (resfriado) → adverb (en frío)

### Level 2: Synonym Cycling (Word)
- **Trigger**: Tap on translated word
- **Function**: Cycles through synonyms within the current meaning
- **Example**: Within adjective meaning: "frío" → "helado" → "gélido" → "frígido"

### Implementation in WordPopup.tsx

```typescript
const cyclePartOfSpeech = () => {
    if (wordDefinitions.length <= 1) return;
    
    const nextPosIndex = (currentPartOfSpeechIndex + 1) % wordDefinitions.length;
    setCurrentPartOfSpeechIndex(nextPosIndex);
    setCurrentSynonymIndex(0); // Reset to first synonym
    
    // Update with first synonym of new meaning
    const newTranslation = wordDefinitions[nextPosIndex]?.definitions[0]?.synonyms[0];
    setLookupResult({...lookupResult, translation: newTranslation});
};

const cycleSynonym = () => {
    const currentDefinition = wordDefinitions[currentPartOfSpeechIndex];
    const synonyms = currentDefinition.definitions[0].synonyms;
    
    if (synonyms.length <= 1) return;
    
    const nextSynIndex = (currentSynonymIndex + 1) % synonyms.length;
    setCurrentSynonymIndex(nextSynIndex);
    
    // Update with new synonym
    const newTranslation = synonyms[nextSynIndex];
    setLookupResult({...lookupResult, translation: newTranslation});
};
```

## 📋 Data Processing Pipeline

### 1. Dictionary Lookup Process

```typescript
// 1. Detect source language
const sourceLanguage = await this.detectLanguage(word);

// 2. Determine database key
const directionalKey = `${sourceLanguage}-${userProfile.nativeLanguage}`;

// 3. Query WikiDict database
const rows = await db.getAllAsync(
    'SELECT lexentry, sense, trans_list FROM translation WHERE written_rep = ? COLLATE NOCASE',
    [word]
);

// 4. Process multiple meanings
const meaningGroups = rows.map(row => ({
    partOfSpeech: this.extractPartOfSpeech(row.lexentry),
    translations: row.trans_list.split(' | '),
    definition: row.sense,
    emoji: getPartOfSpeechIcon(partOfSpeech)
}));
```

### 2. Deduplication Logic

The app removes duplicate meanings that would show identical UI content:

```typescript
// Remove meanings with identical translations and synonyms
const deduplicatedMeanings = meaningGroups.filter((meaning, index) => {
    for (let i = 0; i < index; i++) {
        const prevMeaning = meaningGroups[i];
        
        // Compare primary translations and synonym sets
        const currentPrimary = meaning.definitions[0].synonyms[0];
        const prevPrimary = prevMeaning.definitions[0].synonyms[0];
        const currentSynonyms = meaning.definitions[0].synonyms.sort().join(',');
        const prevSynonyms = prevMeaning.definitions[0].synonyms.sort().join(',');
        
        // Remove if identical
        if (currentPrimary === prevPrimary && currentSynonyms === prevSynonyms) {
            return false;
        }
    }
    return true;
});
```

## 🔧 Database Management

### Directional Database System

The app uses directional databases for optimal lookup performance:

- **en-es**: English headwords → Spanish translations
- **es-en**: Spanish headwords → English translations
- **en-fr**: English headwords → French translations

### Database Selection Logic

```typescript
// Select correct directional database
const directionalKey = `${sourceLanguage}-${targetLanguage}`;
const db = this.databases.get(directionalKey);

if (!db) {
    // Fallback to individual language database if available
    const fallbackDb = this.databases.get(sourceLanguage);
    if (fallbackDb) {
        return await this.performFallbackLookup(word, fallbackDb);
    }
}
```

## 🎨 UI Integration

### Visual Indicators

- **Emoji Icons**: Indicate part of speech (🏷️ noun, ⚡ verb, 🎨 adjective)
- **Cycle Indicators**: Show current position (1/3, 2/4, etc.)
- **Interactive Elements**: Clickable words and emojis for cycling

### Fallback Handling

For words not found in WikiDict (ML translation fallback):

```typescript
// No fake cycling for ML translations
if (!wordLookupSuccess) {
    setWordDefinitions([]); // Empty array disables cycling UI
    setLookupResult({
        success: true,
        translation: mlTranslation, // Direct ML translation
        confidence: 0.95
    });
}
```

## 📚 Data Sources

### Primary Sources
- **FreeDict Project**: GPL-licensed bilingual dictionaries
- **Wiktionary Dumps**: CC-BY-SA licensed community-maintained data
- **StarDict Format**: Industry-standard dictionary format

### Quality Metrics
- **Entry Counts**: 4,500 to 120,000+ entries per language pair
- **Accuracy**: Professional-grade translations from established sources
- **Coverage**: Focus on high-frequency vocabulary for language learners

## 🚀 Performance Optimizations

### Database Indexing
```sql
-- Critical indexes for fast lookups
CREATE INDEX idx_translation_written_rep ON translation(written_rep);
CREATE INDEX idx_translation_pos ON translation(pos);
CREATE UNIQUE INDEX idx_dict_lemma ON dict(lemma);
```

### Caching Strategy
- **In-memory database connections**: Persistent connections for fast access
- **Result caching**: Cache lookup results to avoid repeated database queries
- **Lazy loading**: Load databases only when needed for specific language pairs

This comprehensive data structure supports PolyBook's advanced dictionary features while maintaining excellent performance and user experience.