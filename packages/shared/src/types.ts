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