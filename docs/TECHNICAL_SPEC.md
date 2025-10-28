# PolyBook Technical Specification

## Architecture Overview

### Core Design Principles
- **Offline-first**: All core functionality works without internet
- **Privacy-focused**: Minimal data collection, on-device processing
- **Performance-optimized**: <500MB memory, <300ms translation latency
- **Modular**: Language packs downloaded separately

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                     │
├─────────────────┬─────────────────┬─────────────────────────┤
│   iOS Native    │  Android Native │      Web PWA            │
│                 │                 │                         │
│ React Native + Expo (Bare Workflow)                        │
├─────────────────────────────────────────────────────────────┤
│                  Translation Pipeline                      │
│ • WikiDict (Primary) • ML Kit (Fallback) • Two-level UI   │
├─────────────────────────────────────────────────────────────┤
│                  Shared Business Logic                     │
│ • Book parsing   • Dictionary services • Vocab management  │
├─────────────────────────────────────────────────────────────┤
│                    Local Storage                           │
│ • SQLite (books, positions, vocabulary, dictionaries)     │
│ • File system (EPUB/PDF files, language packs)            │
├─────────────────────────────────────────────────────────────┤
│                  Dictionary Components                     │
│ • WikiDict databases • StarDict format • Synonym cycling  │
│ • ML Kit translation • Language detection • FTS search    │
└─────────────────────────────────────────────────────────────┘
                               │
                               │ (Optional sync & auth)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Services                          │
│ • Supabase Auth  • Language pack CDN • Sync storage       │
└─────────────────────────────────────────────────────────────┘
```

## Data Models

### Core Entities

```typescript
interface Book {
  id: string;
  title: string;
  author: string;
  language: string;
  targetLanguage: string;
  format: 'epub' | 'pdf' | 'txt' | 'html';
  filePath: string;
  coverPath?: string;
  lastPosition?: Position;
  addedAt: Date;
  lastOpenedAt: Date;
}

interface Position {
  bookId: string;
  spineIndex: number;        // For EPUB chapters
  cfi?: string;             // EPUB CFI for precise positioning
  page?: number;            // For PDF
  yOffset: number;          // Scroll position
  updatedAt: Date;
}

interface VocabularyCard {
  id: string;
  bookId: string;
  headword: string;
  lemma: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceContext: string;    // Original sentence
  translation: string;
  definition?: string;
  examples?: string[];
  frequency?: number;
  srsState: SRSState;      // Spaced repetition
  createdAt: Date;
  lastReviewedAt?: Date;
}

interface TranslationCache {
  id: string;
  sourceText: string;
  sourceHash: string;      // For quick lookup
  sourceLanguage: string;
  targetLanguage: string;
  translation: string;
  modelVersion: string;
  createdAt: Date;
}

interface LanguagePack {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
  version: string;
  size: number;
  downloadUrl: string;
  checksum: string;
  components: {
    dictionary: boolean;
    translationModel: boolean;
    lemmatizer: boolean;
    tokenizer: boolean;
  };
}
```

### Database Schema (SQLite)

```sql
-- Core application tables
CREATE TABLE books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  language TEXT NOT NULL,
  target_language TEXT,
  format TEXT NOT NULL,
  file_path TEXT NOT NULL,
  cover_path TEXT,
  added_at INTEGER NOT NULL,
  last_opened_at INTEGER
);

CREATE TABLE positions (
  book_id TEXT PRIMARY KEY,
  spine_index INTEGER,
  cfi TEXT,
  page INTEGER,
  y_offset REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE TABLE vocabulary_cards (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  headword TEXT NOT NULL,
  lemma TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  source_context TEXT NOT NULL,
  translation TEXT NOT NULL,
  definition TEXT,
  examples TEXT, -- JSON array
  frequency INTEGER,
  srs_state TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL,
  last_reviewed_at INTEGER,
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- Translation cache for performance
CREATE TABLE translation_cache (
  source_hash TEXT PRIMARY KEY,
  source_text TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  translation TEXT NOT NULL,
  model_version TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Language pack metadata
CREATE TABLE language_packs (
  id TEXT PRIMARY KEY,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  version TEXT NOT NULL,
  size INTEGER NOT NULL,
  download_path TEXT,
  installed_at INTEGER,
  checksum TEXT NOT NULL
);

-- Dictionary database schemas (Language Packs)
-- WikiDict primary format
CREATE TABLE translation (
  id INTEGER PRIMARY KEY,
  written_rep TEXT NOT NULL,     -- Word/headword
  lexentry TEXT,                 -- Lexical entry with POS
  sense TEXT,                    -- Definition/meaning 
  trans_list TEXT,               -- Pipe-separated translations
  pos TEXT,                      -- Part of speech
  domain TEXT,                   -- Semantic domain
  lang_code TEXT,                -- Language code
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- StarDict fallback format
CREATE TABLE dict (
  lemma TEXT PRIMARY KEY,        -- Word/headword
  def TEXT NOT NULL,             -- HTML definition
  syns TEXT,                     -- JSON array of synonyms
  examples TEXT                  -- JSON array of examples
);

-- PyGlossary simple format
CREATE TABLE word (
  id INTEGER PRIMARY KEY,
  w TEXT NOT NULL,               -- Word
  m TEXT NOT NULL                -- Meaning/translation
);

-- Performance indexes
CREATE INDEX idx_translation_written_rep ON translation(written_rep);
CREATE INDEX idx_translation_pos ON translation(pos);
CREATE INDEX idx_dict_lemma ON dict(lemma);
CREATE INDEX idx_word_w ON word(w);

-- Application indexes
CREATE INDEX idx_cards_book_language ON vocabulary_cards(book_id, source_language, target_language);
CREATE INDEX idx_cache_languages ON translation_cache(source_language, target_language);
CREATE INDEX idx_positions_updated ON positions(updated_at);
```

## Translation Pipeline

### Enhanced Word Translation Flow

```typescript
async function translateWord(word: string, context: string): Promise<WordTranslation> {
  // 1. Language detection
  const sourceLanguage = await detectLanguage(word);
  
  // 2. Dictionary database selection
  const directionalKey = `${sourceLanguage}-${targetLanguage}`;
  const db = databases.get(directionalKey);
  
  // 3. WikiDict lookup (primary)
  const wikiResults = await db.getAllAsync(
    'SELECT lexentry, sense, trans_list FROM translation WHERE written_rep = ? COLLATE NOCASE',
    [word]
  );
  
  if (wikiResults.length > 0) {
    // 4. Process multiple meanings
    const meaningGroups = wikiResults.map(row => ({
      partOfSpeech: extractPartOfSpeech(row.lexentry),
      translations: row.trans_list.split(' | '),
      definition: row.sense,
      synonyms: row.trans_list.split(' | '),
      emoji: getPartOfSpeechIcon(row.pos)
    }));
    
    // 5. Deduplication
    const uniqueMeanings = deduplicateIdenticalMeanings(meaningGroups);
    
    return {
      success: true,
      wordDefinitions: uniqueMeanings,
      cyclingEnabled: uniqueMeanings.length > 1
    };
  }
  
  // 6. ML Kit fallback
  const mlTranslation = await MLKit.translate(word, {
    from: sourceLanguage,
    to: targetLanguage
  });
  
  return {
    success: true,
    translation: mlTranslation.text,
    cyclingEnabled: false // No cycling for ML fallback
  };
}
```

### Two-Level Cycling System

```typescript
// Level 1: Meaning/Part-of-Speech Cycling (Emoji)
const cyclePartOfSpeech = () => {
  if (wordDefinitions.length <= 1) return;
  
  const nextPosIndex = (currentPartOfSpeechIndex + 1) % wordDefinitions.length;
  setCurrentPartOfSpeechIndex(nextPosIndex);
  setCurrentSynonymIndex(0); // Reset to first synonym
  
  // Update with first synonym of new meaning
  const newTranslation = wordDefinitions[nextPosIndex]?.definitions[0]?.synonyms[0];
  setLookupResult({...lookupResult, translation: newTranslation});
};

// Level 2: Synonym Cycling (Word)
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

### Dictionary Database Management

```typescript
// Directional database system for optimal lookup
const directionalDatabases = new Map([
  ['en-es', englishToSpanishDB],    // English headwords → Spanish translations
  ['es-en', spanishToEnglishDB],    // Spanish headwords → English translations
  ['en-fr', englishToFrenchDB],     // English headwords → French translations
  // ... additional language pairs
]);

// Database selection logic
function selectDatabase(sourceLanguage: string, targetLanguage: string) {
  const directionalKey = `${sourceLanguage}-${targetLanguage}`;
  const db = directionalDatabases.get(directionalKey);
  
  if (!db) {
    throw new Error(`No dictionary available for ${directionalKey}`);
  }
  
  return db;
}

### Sentence Translation Flow

```typescript
async function translateSentence(sentence: string): Promise<SentenceTranslation> {
  // 1. Check cache first
  const cacheKey = hashSentence(sentence, languagePair);
  const cached = await database.getTranslationCache(cacheKey);
  if (cached) return cached;
  
  // 2. Sentence boundary detection
  const cleanSentence = preprocessSentence(sentence);
  
  // 3. Model inference
  const translation = await translationModel.translate(cleanSentence, {
    sourceLanguage,
    targetLanguage,
    beam: fastMode ? 1 : 4,
    maxLength: 512
  });
  
  // 4. Cache result
  await database.cacheTranslation(cacheKey, translation);
  
  return {
    original: sentence,
    translation: translation.text,
    confidence: translation.score,
    model: translation.modelVersion
  };
}
```

## Reading Engine

### Book Format Handlers

#### EPUB Handler
```typescript
class EPUBReader {
  private webView: WebView;
  private spine: SpineItem[];
  
  async loadBook(filePath: string): Promise<void> {
    // 1. Extract EPUB (ZIP format)
    const extracted = await RNFS.unzip(filePath, tempDir);
    
    // 2. Parse OPF manifest
    const manifest = await this.parseManifest(extracted);
    this.spine = manifest.spine;
    
    // 3. Load first chapter
    await this.loadChapter(0);
  }
  
  async loadChapter(index: number): Promise<void> {
    const chapter = this.spine[index];
    let html = await RNFS.readFile(chapter.href);
    
    // 4. Inject interaction layer
    html = this.injectTapHandlers(html);
    
    // 5. Load in WebView
    this.webView.injectJavaScript(`
      document.body.innerHTML = \`${html}\`;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'chapter_loaded',
        index: ${index}
      }));
    `);
  }
  
  private injectTapHandlers(html: string): string {
    // Wrap sentences in spans with tap handlers
    return html.replace(
      /([.!?]+\s*)/g,
      '</span>$1<span class="sentence" data-sentence-id="$SENTENCE_ID">'
    );
  }
}
```

#### PDF Handler
```typescript
class PDFReader {
  async loadBook(filePath: string): Promise<void> {
    // Use react-native-pdf for display
    // Text extraction for translation via pdf-lib or similar
  }
  
  async extractTextForTranslation(page: number, x: number, y: number): Promise<string> {
    // Extract text at touch coordinates
    // Return sentence containing the touched point
  }
}
```

### Text Interaction Layer

```typescript
class TextInteractionManager {
  private webView: WebView;
  
  setupWebViewHandlers(): void {
    this.webView.onMessage = (event) => {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'word_tap':
          this.handleWordTap(message.word, message.context);
          break;
        case 'sentence_tap':
          this.handleSentenceTap(message.sentence);
          break;
      }
    };
  }
  
  private async handleWordTap(word: string, context: string): Promise<void> {
    const translation = await this.translateWord(word, context);
    
    // Show popup
    this.showTranslationPopup({
      type: 'word',
      original: word,
      translation,
      actions: ['save_to_library', 'hear_pronunciation']
    });
  }
  
  private async handleSentenceTap(sentence: string): Promise<void> {
    const translation = await this.translateSentence(sentence);
    
    // Show popup or toggle mode
    if (this.readingMode === 'toggle') {
      this.toggleSentenceDisplay(sentence, translation);
    } else {
      this.showTranslationPopup({
        type: 'sentence',
        original: sentence,
        translation
      });
    }
  }
}
```

## ML Integration

### Model Loading and Management

```typescript
class TranslationModelManager {
  private models: Map<string, TranslationModel> = new Map();
  
  async loadLanguagePack(packId: string): Promise<void> {
    const pack = await database.getLanguagePack(packId);
    
    if (Platform.OS === 'web') {
      // Load Bergamot WASM
      const model = await BergamotTranslator.load({
        modelPath: `${pack.downloadPath}/model.bin`,
        vocabPath: `${pack.downloadPath}/vocab.spm`,
        configPath: `${pack.downloadPath}/config.yml`
      });
      this.models.set(packId, model);
    } else {
      // Load TFLite model
      const model = await TFLiteModel.load(`${pack.downloadPath}/model.tflite`);
      this.models.set(packId, model);
    }
  }
  
  async translate(text: string, languagePair: string): Promise<TranslationResult> {
    const model = this.models.get(languagePair);
    if (!model) throw new Error(`Model not loaded: ${languagePair}`);
    
    return await model.translate(text);
  }
}
```

### Performance Optimization

```typescript
class PerformanceManager {
  private preloadQueue: string[] = [];
  
  // Pre-translate upcoming sentences in background
  async preTranslateNext(sentences: string[]): Promise<void> {
    // Only when device is idle and battery > 20%
    if (this.deviceIdle && this.batteryLevel > 0.2) {
      for (const sentence of sentences.slice(0, 5)) {
        if (!await this.isCached(sentence)) {
          this.preloadQueue.push(sentence);
        }
      }
      this.processPreloadQueue();
    }
  }
  
  private async processPreloadQueue(): Promise<void> {
    while (this.preloadQueue.length > 0 && this.deviceIdle) {
      const sentence = this.preloadQueue.shift();
      await this.translateSentence(sentence!);
      
      // Yield to prevent blocking UI
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
```

## State Management

### Zustand Store Structure

```typescript
interface AppState {
  // Current reading state
  currentBook: Book | null;
  currentPosition: Position | null;
  readingMode: 'normal' | 'toggle' | 'sidebyside' | 'overlay';
  
  // Language settings
  sourceLanguage: string;
  targetLanguage: string;
  installedLanguagePacks: LanguagePack[];
  
  // User preferences
  theme: 'light' | 'dark' | 'sepia';
  fontSize: number;
  lineHeight: number;
  translationSpeed: 'fast' | 'quality';
  
  // App state
  isOfflineMode: boolean;
  isSubscribed: boolean;
  trialExpiresAt: Date | null;
  
  // Actions
  actions: {
    setCurrentBook: (book: Book) => void;
    updatePosition: (position: Position) => void;
    setReadingMode: (mode: ReadingMode) => void;
    installLanguagePack: (pack: LanguagePack) => Promise<void>;
    saveVocabularyCard: (card: VocabularyCard) => Promise<void>;
  };
}
```

## Security & Privacy

### Data Encryption
- **Sync data**: AES-256 encryption with user-derived keys
- **Local storage**: SQLite encryption (SQLCipher) for sensitive data
- **API communications**: TLS 1.3 with certificate pinning

### Privacy Measures
- **No telemetry by default**: User opt-in for anonymous usage stats
- **Local processing**: Translation models run entirely on-device
- **Minimal cloud storage**: Only sync metadata, never book content
- **Data retention**: Clear policies on what's stored and for how long

## Deployment Strategy

### Build Configuration

```typescript
// expo.json configuration
{
  "expo": {
    "name": "PolyBook",
    "slug": "polybook",
    "platforms": ["ios", "android", "web"],
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "updates": {
      "fallbackToCacheTimeout": 0,
      "url": "https://u.expo.dev/[project-id]"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.polybook.app",
      "buildNumber": "1.0.0"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "package": "com.polybook.app",
      "versionCode": 1
    },
    "web": {
      "favicon": "./assets/favicon.png",
      "bundler": "metro"
    },
    "plugins": [
      "expo-secure-store",
      "expo-sqlite",
      "expo-document-picker",
      "expo-file-system"
    ]
  }
}
```

### Environment Configuration

```typescript
interface Config {
  environment: 'development' | 'staging' | 'production';
  supabaseUrl: string;
  supabaseAnonKey: string;
  revenueCatApiKey: string;
  stripePublishableKey: string;
  languagePacksCdnUrl: string;
  
  // Feature flags
  enableBetaFeatures: boolean;
  enableAnalytics: boolean;
  enableCrashReporting: boolean;
  
  // Performance settings
  maxCacheSize: number;
  translationTimeout: number;
  backgroundSyncInterval: number;
}
```

This technical specification provides the foundation for implementation. Each component is designed to be modular, testable, and performant while maintaining the offline-first architecture and privacy focus.