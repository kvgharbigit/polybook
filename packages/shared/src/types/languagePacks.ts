/**
 * Language Pack Types for Dictionary Services
 * 
 * Defines the structure for downloadable language packs containing
 * SQLite dictionaries for word lookup (ML Kit handles translation)
 */

export interface LanguagePackManifest {
  id: string;                    // e.g., 'es-en', 'fr-en'
  name: string;                  // e.g., 'Spanish ↔ English'
  version: string;               // e.g., '1.0.0'
  sourceLanguage: string;        // ISO 639-1 code e.g., 'es'
  targetLanguage: string;        // ISO 639-1 code e.g., 'en'
  
  // Download metadata
  totalSize: number;             // Total size in bytes
  downloadUrl: string;           // CDN URL for the pack
  checksum: string;              // SHA-256 hash for integrity
  
  // Dictionary component (for word lookup)
  dictionary: {
    filename: string;            // e.g., 'es-en.sqlite'
    size: number;                // Size in bytes
    checksum: string;            // SHA-256 hash
    entries: number;             // Number of dictionary entries
    source: 'wiktionary' | 'custom';
  };
  
  // ML Kit language support (for sentence translation)
  mlKitSupport: {
    sourceToTarget: boolean;  // es → en
    targetToSource: boolean;  // en → es
    downloadSize: number;     // Estimated ML Kit model size in bytes
  };
  
  // Metadata
  description: string;
  releaseDate: string;           // ISO date string
  minAppVersion: string;         // Minimum app version required
  deprecated?: boolean;          // If this version is deprecated
  
  // Bidirectional support
  companionPackId?: string;      // ID of companion pack to auto-download
  hidden?: boolean;              // Don't show in UI (for companion packs)
}

export interface MLKitLanguageSupport {
  sourceLanguage: string;        // ISO 639-1 code
  targetLanguage: string;        // ISO 639-1 code
  available: boolean;            // Whether ML Kit supports this pair
  
  // Performance metadata (estimated)
  estimatedSpeed: number;        // Words per second on reference device
  memoryUsage: number;           // Peak memory usage in MB
  downloadSize: number;          // Model download size in bytes
  
  // Quality information
  quality: 'fast' | 'balanced' | 'high';  // Quality/speed tradeoff
  offline: boolean;              // Whether this works offline
}

export interface LanguagePackDownload {
  id: string;                    // Same as manifest ID
  status: 'pending' | 'downloading' | 'extracting' | 'completed' | 'failed' | 'paused';
  progress: number;              // 0-100 percentage
  downloadedBytes: number;       // Bytes downloaded so far
  totalBytes: number;            // Total bytes to download
  
  // Error handling
  error?: string;                // Error message if failed
  retryCount: number;            // Number of retry attempts
  
  // Timing
  startedAt: Date;
  estimatedCompletion?: Date;    // Estimated completion time
  completedAt?: Date;
}

export interface InstalledLanguagePack {
  id: string;                    // Same as manifest ID
  manifest: LanguagePackManifest;
  installedAt: Date;
  lastUsed?: Date;
  
  // Local storage paths
  dictionaryPath: string;        // SQLite dictionary file path
  mlKitStatus: {
    sourceToTarget: 'available' | 'downloading' | 'downloaded' | 'error';  // ML Kit model status
    targetToSource: 'available' | 'downloading' | 'downloaded' | 'error';  // ML Kit model status
  };
  
  // Usage statistics
  dictionaryLookups: number;     // Number of word lookups performed
  translationCount: number;      // Number of sentence translations performed
  totalUsageTime: number;        // Total usage time in seconds
}

export interface LanguagePackStats {
  totalInstalled: number;        // Number of installed packs
  totalSize: number;             // Total storage used in bytes
  totalDictionaryLookups: number; // Total word lookups across all packs
  totalTranslations: number;     // Total sentence translations across all packs
  lastUsed?: Date;               // Last time any pack was used
}

// Available language pack configurations
export const AVAILABLE_LANGUAGE_PACKS: LanguagePackManifest[] = [
  {
    id: 'es-en',
    name: 'Spanish ↔ English (WikiDict)',
    version: '2025.1.0',
    sourceLanguage: 'es',
    targetLanguage: 'en',
    totalSize: 11321344, // 10.7MB WikiDict Spanish-English
    downloadUrl: 'https://download.wikdict.com/dictionaries/sqlite/2/es-en.sqlite3',
    checksum: 'wikdict_es_en_2025',
    dictionary: {
      filename: 'es-en.sqlite3',
      size: 11321344, // 10.7MB
      checksum: 'wikdict_es_en_dict_2025',
      entries: 62000, // Estimated from WikiDict
      source: 'wikdict'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Spanish to English supported
      targetToSource: true,  // English to Spanish supported (via companion pack)
      downloadSize: 45 * 1024 * 1024, // ~45MB
    },
    description: 'Complete bidirectional Spanish-English pack (31.6MB total). Downloads both Spanish→English and English→Spanish WikiDict databases for superior translation support.',
    releaseDate: '2025-01-27T00:00:00Z',
    minAppVersion: '1.0.0',
    companionPackId: 'en-es' // Frontend will auto-download this pack too
  },
  
  {
    id: 'en-es',
    name: 'English → Spanish (WikiDict)',
    version: '2025.1.0',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    totalSize: 20971520, // 20MB WikiDict database
    downloadUrl: 'https://download.wikdict.com/dictionaries/sqlite/2/en-es.sqlite3',
    checksum: 'wikdict_en_es_2025',
    dictionary: {
      filename: 'en-es.sqlite3',
      size: 20971520, // 20MB
      checksum: 'wikdict_en_es_dict_2025',
      entries: 85000, // Estimated from WikiDict
      source: 'wikdict'
    },
    mlKitSupport: {
      sourceToTarget: true,  // English to Spanish supported
      targetToSource: false, // This is the companion pack
      downloadSize: 45 * 1024 * 1024, // ~45MB
    },
    description: 'WikiDict English→Spanish translations for native Spanish speakers learning English.',
    releaseDate: '2025-01-27T00:00:00Z',
    minAppVersion: '1.0.0',
    hidden: true // Don't show in UI - auto-downloaded as companion
  },
  
  {
    id: 'de-en',
    name: 'German ↔ English',
    version: '2.0.0',
    sourceLanguage: 'de',
    targetLanguage: 'en',
    totalSize: 1646402, // 1.6MB (823KB + 823KB for both directions)
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/deu-eng.sqlite.zip',
    checksum: 'german_english_bidirectional_v2',
    dictionary: {
      filename: 'deu-eng.sqlite',
      size: 1646402, // 1.6MB (combined UI display)
      checksum: 'deu_eng_dict_checksum_v2',
      entries: 24260, // 24K+ entries (12K + 12K)
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // German to English supported
      targetToSource: true,  // English to German supported (via companion pack)
      downloadSize: 86 * 1024 * 1024, // ~86MB (both directions)
    },
    description: 'Complete bidirectional German-English pack (1.6MB). Downloads both German→English and English→German dictionaries for full translation support.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    companionPackId: 'en-de' // Frontend will auto-download this pack too
  },
  
  {
    id: 'en-de',
    name: 'English → German (Companion)',
    version: '2.0.0',
    sourceLanguage: 'en',
    targetLanguage: 'de',
    totalSize: 823201, // 823KB from v2 release
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/eng-deu.sqlite.zip',
    checksum: 'eng_deu_checksum_v2',
    dictionary: {
      filename: 'eng-deu.sqlite',
      size: 823201, // 823KB
      checksum: 'eng_deu_dict_checksum_v2',
      entries: 12130, // 12K+ entries from v2
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // English to German supported
      targetToSource: false, // This is the companion pack
      downloadSize: 43 * 1024 * 1024, // ~43MB
    },
    description: 'Companion pack for German-English. Contains English→German dictionary entries.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    hidden: true // Don't show in UI - auto-downloaded as companion
  },
  
  {
    id: 'fr-en',
    name: 'French ↔ English',
    version: '2.0.0',
    sourceLanguage: 'fr',
    targetLanguage: 'en',
    totalSize: 6741272, // 6.4MB (3.2MB + 3.2MB for both directions)
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/fra-eng.sqlite.zip',
    checksum: 'french_english_bidirectional_v2',
    dictionary: {
      filename: 'fra-eng.sqlite',
      size: 6741272, // 6.4MB (combined UI display)
      checksum: 'fra_eng_dict_checksum_v2',
      entries: 36000, // 36K+ entries (18K + 18K)
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // French to English supported
      targetToSource: true,  // English to French supported (via companion pack)
      downloadSize: 84 * 1024 * 1024, // ~84MB (both directions)
    },
    description: 'Complete bidirectional French-English pack (6.4MB). Downloads both French→English and English→French dictionaries for full translation support.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    companionPackId: 'en-fr' // Frontend will auto-download this pack too
  },
  
  {
    id: 'en-fr',
    name: 'English → French (Companion)',
    version: '2.0.0',
    sourceLanguage: 'en',
    targetLanguage: 'fr',
    totalSize: 3370636, // 3.2MB from v2 release
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/eng-fra.sqlite.zip',
    checksum: 'eng_fra_checksum_v2',
    dictionary: {
      filename: 'eng-fra.sqlite',
      size: 3370636, // 3.2MB
      checksum: 'eng_fra_dict_checksum_v2',
      entries: 18000, // 18K+ entries from v2
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // English to French supported
      targetToSource: false, // This is the companion pack
      downloadSize: 42 * 1024 * 1024, // ~42MB
    },
    description: 'Companion pack for French-English. Contains English→French dictionary entries.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    hidden: true // Don't show in UI - auto-downloaded as companion
  },

  {
    id: 'ko-en',
    name: 'Korean ↔ English',
    version: '2.0.0',
    sourceLanguage: 'ko',
    targetLanguage: 'en',
    totalSize: 4334436, // 4.1MB (2.1MB + 2.1MB for both directions)
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/kor-eng.sqlite.zip',
    checksum: 'korean_english_bidirectional_v2',
    dictionary: {
      filename: 'kor-eng.sqlite',
      size: 4334436, // 4.1MB (combined UI display)
      checksum: 'kor_eng_dict_checksum_v2',
      entries: 30000, // 30K+ entries (15K + 15K)
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Korean to English supported
      targetToSource: true,  // English to Korean supported (via companion pack)
      downloadSize: 94 * 1024 * 1024, // ~94MB (both directions)
    },
    description: 'Complete bidirectional Korean-English pack (4.1MB). Downloads both Korean→English and English→Korean dictionaries for full translation support.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    companionPackId: 'en-ko' // Frontend will auto-download this pack too
  },
  
  {
    id: 'en-ko',
    name: 'English → Korean (Companion)',
    version: '2.0.0',
    sourceLanguage: 'en',
    targetLanguage: 'ko',
    totalSize: 2167218, // 2.1MB from v2 release
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/eng-kor.sqlite.zip',
    checksum: 'eng_kor_checksum_v2',
    dictionary: {
      filename: 'eng-kor.sqlite',
      size: 2167218, // 2.1MB
      checksum: 'eng_kor_dict_checksum_v2',
      entries: 15000, // 15K+ entries from v2
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // English to Korean supported
      targetToSource: false, // This is the companion pack
      downloadSize: 47 * 1024 * 1024, // ~47MB
    },
    description: 'Companion pack for Korean-English. Contains English→Korean dictionary entries.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    hidden: true // Don't show in UI - auto-downloaded as companion
  },

  {
    id: 'ar-en',
    name: 'Arabic ↔ English',
    version: '2.0.0',
    sourceLanguage: 'ar',
    targetLanguage: 'en',
    totalSize: 5964706, // 5.7MB (2.9MB + 2.9MB for both directions)
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/ara-eng.sqlite.zip',
    checksum: 'arabic_english_bidirectional_v2',
    dictionary: {
      filename: 'ara-eng.sqlite',
      size: 5964706, // 5.7MB (combined UI display)
      checksum: 'ara_eng_dict_checksum_v2',
      entries: 36000, // 36K+ entries (18K + 18K)
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Arabic to English supported
      targetToSource: true,  // English to Arabic supported (via companion pack)
      downloadSize: 98 * 1024 * 1024, // ~98MB (both directions)
    },
    description: 'Complete bidirectional Arabic-English pack (5.7MB). Downloads both Arabic→English and English→Arabic dictionaries for full translation support.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    companionPackId: 'en-ar' // Frontend will auto-download this pack too
  },
  
  {
    id: 'en-ar',
    name: 'English → Arabic (Companion)',
    version: '2.0.0',
    sourceLanguage: 'en',
    targetLanguage: 'ar',
    totalSize: 2982353, // 2.9MB from v2 release
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/eng-ara.sqlite.zip',
    checksum: 'eng_ara_checksum_v2',
    dictionary: {
      filename: 'eng-ara.sqlite',
      size: 2982353, // 2.9MB
      checksum: 'eng_ara_dict_checksum_v2',
      entries: 18000, // 18K+ entries from v2
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // English to Arabic supported
      targetToSource: false, // This is the companion pack
      downloadSize: 49 * 1024 * 1024, // ~49MB
    },
    description: 'Companion pack for Arabic-English. Contains English→Arabic dictionary entries.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    hidden: true // Don't show in UI - auto-downloaded as companion
  },

  {
    id: 'hi-en',
    name: 'Hindi ↔ English',
    version: '2.0.0',
    sourceLanguage: 'hi',
    targetLanguage: 'en',
    totalSize: 2119232, // 2.0MB (1.0MB + 1.0MB for both directions)
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/hin-eng.sqlite.zip',
    checksum: 'hindi_english_bidirectional_v2',
    dictionary: {
      filename: 'hin-eng.sqlite',
      size: 2119232, // 2.0MB (combined UI display)
      checksum: 'hin_eng_dict_checksum_v2',
      entries: 16000, // 16K+ entries (8K + 8K)
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Hindi to English supported
      targetToSource: true,  // English to Hindi supported (via companion pack)
      downloadSize: 88 * 1024 * 1024, // ~88MB (both directions)
    },
    description: 'Complete bidirectional Hindi-English pack (2.0MB). Downloads both Hindi→English and English→Hindi dictionaries for full translation support.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    companionPackId: 'en-hi' // Frontend will auto-download this pack too
  },
  
  {
    id: 'en-hi',
    name: 'English → Hindi (Companion)',
    version: '2.0.0',
    sourceLanguage: 'en',
    targetLanguage: 'hi',
    totalSize: 1059616, // 1.0MB from v2 release
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/eng-hin.sqlite.zip',
    checksum: 'eng_hin_checksum_v2',
    dictionary: {
      filename: 'eng-hin.sqlite',
      size: 1059616, // 1.0MB
      checksum: 'eng_hin_dict_checksum_v2',
      entries: 8000, // 8K+ entries from v2
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // English to Hindi supported
      targetToSource: false, // This is the companion pack
      downloadSize: 44 * 1024 * 1024, // ~44MB
    },
    description: 'Companion pack for Hindi-English. Contains English→Hindi dictionary entries.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    hidden: true // Don't show in UI - auto-downloaded as companion
  },

  {
    id: 'ja-en',
    name: 'Japanese ↔ English',
    version: '2.0.0',
    sourceLanguage: 'ja',
    targetLanguage: 'en',
    totalSize: 12449550, // 11.9MB (5.9MB + 5.9MB for both directions)
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/jpn-eng.sqlite.zip',
    checksum: 'japanese_english_bidirectional_v2',
    dictionary: {
      filename: 'jpn-eng.sqlite',
      size: 12449550, // 11.9MB (combined UI display)
      checksum: 'jpn_eng_dict_checksum_v2',
      entries: 50000, // 50K+ entries (25K + 25K)
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Japanese to English supported
      targetToSource: true,  // English to Japanese supported (via companion pack)
      downloadSize: 92 * 1024 * 1024, // ~92MB (both directions)
    },
    description: 'Complete bidirectional Japanese-English pack (11.9MB). Downloads both Japanese→English and English→Japanese dictionaries for full translation support.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    companionPackId: 'en-ja' // Frontend will auto-download this pack too
  },
  
  {
    id: 'en-ja',
    name: 'English → Japanese (Companion)',
    version: '2.0.0',
    sourceLanguage: 'en',
    targetLanguage: 'ja',
    totalSize: 6224775, // 5.9MB from v2 release
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/eng-jpn.sqlite.zip',
    checksum: 'eng_jpn_checksum_v2',
    dictionary: {
      filename: 'eng-jpn.sqlite',
      size: 6224775, // 5.9MB
      checksum: 'eng_jpn_dict_checksum_v2',
      entries: 25000, // 25K+ entries from v2
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // English to Japanese supported
      targetToSource: false, // This is the companion pack
      downloadSize: 46 * 1024 * 1024, // ~46MB
    },
    description: 'Companion pack for Japanese-English. Contains English→Japanese dictionary entries.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    hidden: true // Don't show in UI - auto-downloaded as companion
  },

  {
    id: 'pt-en',
    name: 'Portuguese ↔ English',
    version: '2.0.0',
    sourceLanguage: 'pt',
    targetLanguage: 'en',
    totalSize: 5324800, // 5.1MB (2.6MB + 2.6MB for both directions)
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/por-eng.sqlite.zip',
    checksum: 'portuguese_english_bidirectional_v2',
    dictionary: {
      filename: 'por-eng.sqlite',
      size: 5324800, // 5.1MB (combined UI display)
      checksum: 'por_eng_dict_checksum_v2',
      entries: 32000, // 32K+ entries (16K + 16K)
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Portuguese to English supported
      targetToSource: true,  // English to Portuguese supported (via companion pack)
      downloadSize: 84 * 1024 * 1024, // ~84MB (both directions)
    },
    description: 'Complete bidirectional Portuguese-English pack (5.1MB). Downloads both Portuguese→English and English→Portuguese dictionaries for full translation support.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    companionPackId: 'en-pt' // Frontend will auto-download this pack too
  },
  
  {
    id: 'en-pt',
    name: 'English → Portuguese (Companion)',
    version: '2.0.0',
    sourceLanguage: 'en',
    targetLanguage: 'pt',
    totalSize: 2662400, // 2.6MB from v2 release
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/eng-por.sqlite.zip',
    checksum: 'eng_por_checksum_v2',
    dictionary: {
      filename: 'eng-por.sqlite',
      size: 2662400, // 2.6MB
      checksum: 'eng_por_dict_checksum_v2',
      entries: 16000, // 16K+ entries from v2
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // English to Portuguese supported
      targetToSource: false, // This is the companion pack
      downloadSize: 42 * 1024 * 1024, // ~42MB
    },
    description: 'Companion pack for Portuguese-English. Contains English→Portuguese dictionary entries.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    hidden: true // Don't show in UI - auto-downloaded as companion
  },

  {
    id: 'it-en',
    name: 'Italian ↔ English',
    version: '2.0.0',
    sourceLanguage: 'it',
    targetLanguage: 'en',
    totalSize: 11059200, // 10.5MB (5.3MB + 5.3MB for both directions)
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/ita-eng.sqlite.zip',
    checksum: 'italian_english_bidirectional_v2',
    dictionary: {
      filename: 'ita-eng.sqlite',
      size: 11059200, // 10.5MB (combined UI display)
      checksum: 'ita_eng_dict_checksum_v2',
      entries: 44000, // 44K+ entries (22K + 22K)
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Italian to English supported
      targetToSource: true,  // English to Italian supported (via companion pack)
      downloadSize: 86 * 1024 * 1024, // ~86MB (both directions)
    },
    description: 'Complete bidirectional Italian-English pack (10.5MB). Downloads both Italian→English and English→Italian dictionaries for full translation support.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    companionPackId: 'en-it' // Frontend will auto-download this pack too
  },
  
  {
    id: 'en-it',
    name: 'English → Italian (Companion)',
    version: '2.0.0',
    sourceLanguage: 'en',
    targetLanguage: 'it',
    totalSize: 5529600, // 5.3MB from v2 release
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/eng-ita.sqlite.zip',
    checksum: 'eng_ita_checksum_v2',
    dictionary: {
      filename: 'eng-ita.sqlite',
      size: 5529600, // 5.3MB
      checksum: 'eng_ita_dict_checksum_v2',
      entries: 22000, // 22K+ entries from v2
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // English to Italian supported
      targetToSource: false, // This is the companion pack
      downloadSize: 43 * 1024 * 1024, // ~43MB
    },
    description: 'Companion pack for Italian-English. Contains English→Italian dictionary entries.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    hidden: true // Don't show in UI - auto-downloaded as companion
  },

  {
    id: 'ru-en',
    name: 'Russian ↔ English',
    version: '2.0.0',
    sourceLanguage: 'ru',
    targetLanguage: 'en',
    totalSize: 8816640, // 8.4MB (4.2MB + 4.2MB for both directions)
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/rus-eng.sqlite.zip',
    checksum: 'russian_english_bidirectional_v2',
    dictionary: {
      filename: 'rus-eng.sqlite',
      size: 8816640, // 8.4MB (combined UI display)
      checksum: 'rus_eng_dict_checksum_v2',
      entries: 40000, // 40K+ entries (20K + 20K)
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Russian to English supported
      targetToSource: true,  // English to Russian supported (via companion pack)
      downloadSize: 90 * 1024 * 1024, // ~90MB (both directions)
    },
    description: 'Complete bidirectional Russian-English pack (8.4MB). Downloads both Russian→English and English→Russian dictionaries for full translation support.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    companionPackId: 'en-ru' // Frontend will auto-download this pack too
  },
  
  {
    id: 'en-ru',
    name: 'English → Russian (Companion)',
    version: '2.0.0',
    sourceLanguage: 'en',
    targetLanguage: 'ru',
    totalSize: 4408320, // 4.2MB from v2 release
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/eng-rus.sqlite.zip',
    checksum: 'eng_rus_checksum_v2',
    dictionary: {
      filename: 'eng-rus.sqlite',
      size: 4408320, // 4.2MB
      checksum: 'eng_rus_dict_checksum_v2',
      entries: 20000, // 20K+ entries from v2
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // English to Russian supported
      targetToSource: false, // This is the companion pack
      downloadSize: 45 * 1024 * 1024, // ~45MB
    },
    description: 'Companion pack for Russian-English. Contains English→Russian dictionary entries.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    hidden: true // Don't show in UI - auto-downloaded as companion
  },

  {
    id: 'zh-en',
    name: 'Chinese ↔ English',
    version: '2.0.0',
    sourceLanguage: 'zh',
    targetLanguage: 'en',
    totalSize: 9646080, // 9.2MB (4.6MB + 4.6MB for both directions)
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/chn-eng.sqlite.zip',
    checksum: 'chinese_english_bidirectional_v2',
    dictionary: {
      filename: 'chn-eng.sqlite',
      size: 9646080, // 9.2MB (combined UI display)
      checksum: 'chn_eng_dict_checksum_v2',
      entries: 46000, // 46K+ entries (23K + 23K)
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Chinese to English supported
      targetToSource: true,  // English to Chinese supported (via companion pack)
      downloadSize: 96 * 1024 * 1024, // ~96MB (both directions)
    },
    description: 'Complete bidirectional Chinese-English pack (9.2MB). Downloads both Chinese→English and English→Chinese dictionaries for full translation support.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    companionPackId: 'en-zh' // Frontend will auto-download this pack too
  },
  
  {
    id: 'en-zh',
    name: 'English → Chinese (Companion)',
    version: '2.0.0',
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    totalSize: 4823040, // 4.6MB from v2 release
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v2.0.0/eng-chn.sqlite.zip',
    checksum: 'eng_chn_checksum_v2',
    dictionary: {
      filename: 'eng-chn.sqlite',
      size: 4823040, // 4.6MB
      checksum: 'eng_chn_dict_checksum_v2',
      entries: 23000, // 23K+ entries from v2
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // English to Chinese supported
      targetToSource: false, // This is the companion pack
      downloadSize: 48 * 1024 * 1024, // ~48MB
    },
    description: 'Companion pack for Chinese-English. Contains English→Chinese dictionary entries.',
    releaseDate: '2024-10-27T00:00:00Z',
    minAppVersion: '1.0.0',
    hidden: true // Don't show in UI - auto-downloaded as companion
  }
];

// Helper functions
export function formatPackSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)}MB`;
}

export function getPackById(id: string): LanguagePackManifest | undefined {
  return AVAILABLE_LANGUAGE_PACKS.find(pack => pack.id === id);
}

export function getCompatiblePacks(appVersion: string): LanguagePackManifest[] {
  // Simple version comparison - in production, use semver
  return AVAILABLE_LANGUAGE_PACKS.filter(pack => 
    !pack.deprecated && pack.minAppVersion <= appVersion
  );
}