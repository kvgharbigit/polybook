export interface Book {
  id: string;
  title: string;
  author: string;
  language: string;
  targetLanguage: string;
  format: BookFormat;
  filePath: string;
  coverPath?: string;
  lastPosition?: Position;
  addedAt: Date;
  lastOpenedAt: Date;
}

export type BookFormat = 'epub' | 'pdf' | 'txt' | 'html';

export interface Position {
  bookId: string;
  spineIndex: number;        // For EPUB chapters
  cfi?: string;             // EPUB CFI for precise positioning
  page?: number;            // For PDF
  yOffset: number;          // Scroll position
  updatedAt: Date;
}

export interface VocabularyCard {
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

// Enhanced vocabulary card with bilingual support
export interface BilingualVocabularyCard {
  id: string;
  userId?: string;
  
  // Core word information
  word: string;
  sourceLanguage: string;
  definition: BilingualWordDefinition;
  
  // Learning context
  context: string; // Sentence where word was found
  bookId: string;
  bookTitle: string;
  chapterTitle?: string;
  
  // Learning progress
  reviewCount: number;
  correctCount: number;
  lastReviewed?: Date;
  nextReview?: Date;
  
  // Spaced repetition data
  easeFactor: number; // SuperMemo algorithm
  interval: number; // Days until next review
  
  // Metadata
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  notes?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export type SRSState = 'new' | 'learning' | 'review' | 'mature';

export interface TranslationCache {
  id: string;
  sourceText: string;
  sourceHash: string;      // For quick lookup
  sourceLanguage: string;
  targetLanguage: string;
  translation: string;
  modelVersion: string;
  createdAt: Date;
}

export interface LanguagePack {
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

export interface WordTranslation {
  original: string;
  lemma: string;
  definitions: Definition[];
  phonetic?: string;
  frequency?: number;
}

export interface Definition {
  meaning: string;
  partOfSpeech?: string;
  examples?: string[];
  frequency?: number;
}

// Enhanced bilingual dictionary types
export interface BilingualWordDefinition {
  word: string;
  language: string; // ISO 639-1 code (e.g., 'en', 'es')
  
  // Translation information
  translations: Array<{
    word: string;
    language: string;
    confidence: number; // 0-1 confidence score
    frequency?: number;
  }>;
  
  // Rich dictionary information
  definitions: Array<{
    partOfSpeech: string;
    definition: string;
    definitionLanguage: string; // Language of the definition
    example?: string;
    exampleTranslation?: string;
    synonyms?: string[];
    antonyms?: string[];
  }>;
  
  // Metadata
  frequency?: number; // Word frequency in source language
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  commonMistakes?: string[];
  etymology?: {
    text: string;
    language: string; // Language of the etymology
  };
  
  // Audio
  pronunciation?: {
    ipa?: string; // International Phonetic Alphabet
    audioUrl?: string;
  };
  
  // Cross-language enrichment (for Spanish speakers reading English, etc.)
  crossLanguageData?: {
    // Synonyms in the source language (e.g., English synonyms for "house")
    sourceSynonyms?: string[];
    
    // Synonyms in the target language (e.g., Spanish synonyms for "casa") 
    targetSynonyms?: string[];
    
    // Etymology in the source language
    sourceEtymology?: string;
    
    // Definition in the source language
    sourceDefinition?: string;
  };
}

// User language profile for personalized dictionary
export interface UserLanguageProfile {
  id: string;
  userId?: string; // For authenticated users
  
  // Language preferences
  nativeLanguage: string; // ISO 639-1 code
  targetLanguages: string[]; // Languages user is learning
  preferredDefinitionLanguage: string; // Language for definitions
  
  // Reading preferences
  defaultDictionaryMode: 'translation' | 'definition' | 'both';
  showPronunciation: boolean;
  showExamples: boolean;
  showEtymology: boolean;
  
  // Learning level
  proficiencyLevels: Record<string, 'beginner' | 'intermediate' | 'advanced'>;
  
  // Usage statistics
  totalLookups: number;
  languageLookupCounts: Record<string, number>;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Dictionary lookup request
export interface DictionaryLookupRequest {
  word: string;
  sourceLanguage?: string; // Auto-detect if not provided
  userProfile: UserLanguageProfile;
  context?: string; // Surrounding sentence for context
}

// Dictionary lookup response
export interface DictionaryLookupResponse {
  success: boolean;
  word: string;
  sourceLanguage: string;
  
  // Main definition in user's preferred language
  primaryDefinition?: BilingualWordDefinition;
  
  // Alternative definitions/translations
  alternatives?: BilingualWordDefinition[];
  
  // Context-specific information
  contextualMeaning?: string;
  
  // Error information
  error?: string;
  suggestions?: string[]; // Did you mean?
  
  // Missing language pack information
  missingLanguages?: string[]; // Language codes that need to be downloaded
  requiredLanguages?: string[]; // All languages needed for this lookup
}

export interface SentenceTranslation {
  original: string;
  translation: string;
  confidence: number;
  model: string;
}

export interface BookContent {
  id: string;
  bookId: string;
  content: string;
  wordCount: number;
  estimatedReadingTime: number;
  parsedAt: Date;
  contentVersion: string;
}

export type ReadingMode = 'normal' | 'toggle' | 'sidebyside' | 'overlay';

export type Theme = 'light' | 'dark' | 'sepia';

export interface UserSettings {
  theme: Theme;
  fontSize: number;
  lineHeight: number;
  translationSpeed: 'fast' | 'quality';
  ttsVoice?: string;
  ttsRate: number;
}

export interface AppState {
  currentBook: Book | null;
  currentPosition: Position | null;
  readingMode: ReadingMode;
  sourceLanguage: string;
  targetLanguage: string;
  installedLanguagePacks: LanguagePack[];
  userSettings: UserSettings;
  isOfflineMode: boolean;
  isSubscribed: boolean;
  trialExpiresAt: Date | null;
}