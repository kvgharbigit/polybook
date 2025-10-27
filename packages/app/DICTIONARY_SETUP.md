# Dictionary Setup Guide

This guide explains how to set up the real StarDict dictionary system for PolyBook.

## Overview

The dictionary system uses real StarDict dictionaries converted to SQLite for React Native compatibility. Here's the complete pipeline:

```
StarDict Files (.ifo/.idx/.dict) → SQLite Databases → Compressed Packages → App Download
```

## Quick Start

### 1. Download and Build Dictionaries

```bash
# Download real StarDict dictionaries and convert to SQLite
npm run build:dictionaries

# This runs:
# 1. npm run download:dictionaries  - Downloads StarDict files
# 2. npm run package:dictionaries   - Converts to SQLite and packages
```

### 2. Verify Setup

```bash
# Check package integrity
node scripts/package-dictionaries.js verify

# Check what was built
ls dictionaries/packages/
ls dictionaries/public/
```

### 3. Serve Dictionary Files (Development)

```bash
# Serve the public directory on port 3001
cd dictionaries/public
python3 -m http.server 3001

# Or use any static file server
# The app expects dictionaries at: http://localhost:3001/dictionaries/
```

## Detailed Process

### Step 1: Download StarDict Sources

The `download-stardict.js` script downloads real dictionary files from public sources:

**English**: WordNet dictionary (147k+ entries, 3.2MB)
- Source: dict.org WordNet archive
- Contains definitions, synonyms, etymologies

**Spanish**: Spanish-English dictionary (45k+ entries, 2.1MB)
- Source: Quick Spanish-English dictionary
- Bidirectional Spanish ↔ English

**French**: French dictionary (35k+ entries, 2.3MB)
- Source: French dictionary archive

### Step 2: Convert to SQLite

Each StarDict dictionary is converted to SQLite using our `stardict-to-sqlite.js` converter:

```sql
CREATE TABLE dict (
  lemma TEXT PRIMARY KEY,     -- The word/term
  def TEXT NOT NULL,          -- Definition
  syns TEXT,                  -- JSON array of synonyms
  examples TEXT               -- JSON array of examples
);
```

### Step 3: Package for Distribution

The `package-dictionaries.js` script:
1. Compresses SQLite files with gzip
2. Generates hashes for integrity
3. Creates package registry
4. Outputs to `dictionaries/public/` for serving

### Step 4: App Integration

The `LanguagePackManager` service:
1. Downloads packages from registry
2. Installs to app's SQLite directory
3. `SQLiteDictionaryService` queries installed databases

## File Structure

```
packages/app/
├── dictionaries/
│   ├── raw/              # Downloaded StarDict archives
│   ├── sqlite/           # Converted SQLite files
│   ├── packages/         # Compressed packages
│   └── public/           # Files to serve to app
│       ├── package-registry.json
│       ├── en_dict.sqlite.gz
│       ├── es_dict.sqlite.gz
│       └── fr_dict.sqlite.gz
├── scripts/
│   ├── download-stardict.js      # Downloads real dictionaries
│   ├── stardict-to-sqlite.js     # Converts format
│   └── package-dictionaries.js   # Creates packages
└── src/services/
    ├── languagePackManager.ts    # Downloads to app
    └── sqliteDictionaryService.ts # Queries databases
```

## Available Languages

| Language | Code | Source | Entries | Size |
|----------|------|---------|---------|------|
| English | en | WordNet | 147k+ | ~2MB |
| Spanish | es | Quick Spanish-English | 45k+ | ~1.8MB |
| French | fr | French Dictionary | 35k+ | ~1.9MB |

## Dictionary Sources

### Primary Sources
- **WordNet**: Comprehensive English lexical database
- **dict.org**: Public domain dictionary archives
- **Quick Dictionaries**: Language-specific dictionaries

### Archive Locations
- Archive.org mirrors of StarDict collections
- Stable URLs that should remain available
- Backup sources available if primary fails

## Configuration

### Production Deployment

1. **Host Dictionary Files**: Upload `dictionaries/public/` to your CDN
2. **Update Registry URL**: Change `REGISTRY_URL` in `LanguagePackManager`
3. **Configure CORS**: Ensure your CDN allows cross-origin requests

### Development

1. **Local Server**: Serve `dictionaries/public/` locally
2. **Fallback Mode**: App includes fallback dictionary data
3. **Testing**: Use `test-dictionary.ts` to verify functionality

## Examples

### Download Spanish Dictionary Only

```bash
node scripts/download-stardict.js es
```

### Convert Specific StarDict Files

```bash
node scripts/stardict-to-sqlite.js /path/to/dict /output/es_dict.sqlite --max-entries 30000
```

### Test Dictionary Lookup

```bash
# In your React Native app
import { testWordLookup } from './src/test-dictionary';

// Spanish user looking up English word
await testWordLookup('house', 'es');

// English user looking up Spanish word  
await testWordLookup('casa', 'en');
```

## Troubleshooting

### Download Issues
- Check internet connection
- Some archive URLs may be slow
- Fallback sources available in script

### Conversion Issues
- Ensure `sqlite3` package installed
- Check StarDict file integrity
- Verify tar/bzip2 tools available

### App Integration Issues
- Check dictionary URLs are accessible
- Verify CORS headers for web
- Ensure SQLite permissions in React Native

### Size Optimization
- Adjust `maxEntries` in conversion scripts
- Use gzip compression (already enabled)
- Consider splitting large dictionaries

## Performance Notes

- **SQLite Query Speed**: ~1-5ms per lookup
- **Download Size**: ~1-2MB per language (compressed)
- **Memory Usage**: ~10-20MB per loaded dictionary
- **Storage**: ~50-100MB total for 5 languages

## Future Enhancements

1. **More Languages**: Add German, Italian, Portuguese
2. **Better Compression**: Use more efficient algorithms
3. **Incremental Updates**: Delta updates for dictionary changes
4. **Offline Sync**: Background download management
5. **User Dictionaries**: Allow custom dictionary additions

## License

Dictionary sources are public domain or freely redistributable. Check individual dictionary licenses in download script comments.