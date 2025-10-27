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
    name: 'Spanish ↔ English',
    version: '1.0.0',
    sourceLanguage: 'es',
    targetLanguage: 'en',
    totalSize: 5090394, // Real database ZIP size (5MB)
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/latest/download/spa-eng.sqlite.zip',
    checksum: 'real_database_checksum_here',
    dictionary: {
      filename: 'es-en.sqlite',
      size: 14680064, // Real SQLite database size  
      checksum: 'real_database_checksum_here',
      entries: 43638, // Full dictionary entries from natural build
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Spanish to English supported
      targetToSource: true,  // English to Spanish supported
      downloadSize: 45 * 1024 * 1024, // ~45MB per direction
    },
    description: 'Complete language pack with Wiktionary dictionary (43k entries) for word lookup and ML Kit support for sentence translation.',
    releaseDate: '2024-01-15T00:00:00Z',
    minAppVersion: '1.0.0'
  },
  
  {
    id: 'de-en',
    name: 'German ↔ English',
    version: '1.0.0',
    sourceLanguage: 'de',
    targetLanguage: 'en',
    totalSize: 823201, // 823KB (actual German dictionary size)
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/latest/download/deu-eng.sqlite.zip',
    checksum: 'c7241f107434212228c9304c422c1378deff34370e79748aaef2649e122a6f9f',
    dictionary: {
      filename: 'de-en.sqlite',
      size: 823201, // 823KB compressed
      checksum: 'c7241f107434212228c9304c422c1378deff34370e79748aaef2649e122a6f9f',
      entries: 12130, // Actual entries from build
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // German to English supported
      targetToSource: true,  // English to German supported
      downloadSize: 43 * 1024 * 1024, // ~43MB per direction
    },
    description: 'German-English language pack with comprehensive Wiktionary dictionary and ML Kit translation support.',
    releaseDate: '2024-01-15T00:00:00Z',
    minAppVersion: '1.0.0'
  },
  
  {
    id: 'fr-en',
    name: 'French ↔ English',
    version: '1.0.0',
    sourceLanguage: 'fr',
    targetLanguage: 'en',
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/latest/download/fra-eng.sqlite.zip',
    checksum: 'placeholder_checksum_fr_en',
    totalSize: 173 * 1024 * 1024, // ~173MB
    dictionary: {
      filename: 'fr-en.sqlite',
      size: 3370636, // 3.2MB from our data
      checksum: 'placeholder_checksum_fr_en_dict',
      entries: 18000, // Estimated
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // French to English supported
      targetToSource: true,  // English to French supported
      downloadSize: 42 * 1024 * 1024, // ~42MB per direction
    },
    description: 'French-English language pack with Wiktionary dictionary and ML Kit translation support.',
    releaseDate: '2024-01-15T00:00:00Z',
    minAppVersion: '1.0.0'
  },

  {
    id: 'ko-en',
    name: 'Korean ↔ English',
    version: '1.0.0',
    sourceLanguage: 'ko',
    targetLanguage: 'en',
    totalSize: 2167218, // 2.1MB
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/latest/download/kor-eng.sqlite.zip',
    checksum: 'korean_database_checksum_here',
    dictionary: {
      filename: 'ko-en.sqlite',
      size: 2167218, // 2.1MB
      checksum: 'korean_database_checksum_here',
      entries: 15000, // Estimated
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Korean to English supported
      targetToSource: true,  // English to Korean supported
      downloadSize: 47 * 1024 * 1024, // ~47MB per direction
    },
    description: 'Korean-English language pack with Wiktionary dictionary and ML Kit translation support.',
    releaseDate: '2024-01-15T00:00:00Z',
    minAppVersion: '1.0.0'
  },

  {
    id: 'ar-en',
    name: 'Arabic ↔ English',
    version: '1.0.0',
    sourceLanguage: 'ar',
    targetLanguage: 'en',
    totalSize: 2982353, // 2.9MB
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/latest/download/ara-eng.sqlite.zip',
    checksum: 'arabic_database_checksum_here',
    dictionary: {
      filename: 'ar-en.sqlite',
      size: 2982353, // 2.9MB
      checksum: 'arabic_database_checksum_here',
      entries: 18000, // Estimated
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Arabic to English supported
      targetToSource: true,  // English to Arabic supported
      downloadSize: 49 * 1024 * 1024, // ~49MB per direction
    },
    description: 'Arabic-English language pack with Wiktionary dictionary and ML Kit translation support.',
    releaseDate: '2024-01-15T00:00:00Z',
    minAppVersion: '1.0.0'
  },

  {
    id: 'hi-en',
    name: 'Hindi ↔ English',
    version: '1.0.0',
    sourceLanguage: 'hi',
    targetLanguage: 'en',
    totalSize: 1059616, // 1.0MB
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/latest/download/hin-eng.sqlite.zip',
    checksum: 'hindi_database_checksum_here',
    dictionary: {
      filename: 'hi-en.sqlite',
      size: 1059616, // 1.0MB
      checksum: 'hindi_database_checksum_here',
      entries: 8000, // Estimated
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Hindi to English supported
      targetToSource: true,  // English to Hindi supported
      downloadSize: 44 * 1024 * 1024, // ~44MB per direction
    },
    description: 'Hindi-English language pack with Wiktionary dictionary and ML Kit translation support.',
    releaseDate: '2024-01-15T00:00:00Z',
    minAppVersion: '1.0.0'
  },

  {
    id: 'ja-en',
    name: 'Japanese ↔ English',
    version: '1.0.0',
    sourceLanguage: 'ja',
    targetLanguage: 'en',
    totalSize: 185 * 1024 * 1024, // ~185MB
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/latest/download/jpn-eng.sqlite.zip',
    checksum: 'placeholder_checksum_ja_en',
    dictionary: {
      filename: 'ja-en.sqlite',
      size: 6224775, // 5.9MB from our data
      checksum: 'placeholder_checksum_ja_en_dict',
      entries: 25000, // Estimated
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Japanese to English supported
      targetToSource: true,  // English to Japanese supported
      downloadSize: 46 * 1024 * 1024, // ~46MB per direction
    },
    description: 'Japanese-English language pack with Wiktionary dictionary and ML Kit translation support.',
    releaseDate: '2024-01-15T00:00:00Z',
    minAppVersion: '1.0.0'
  },

  {
    id: 'pt-en',
    name: 'Portuguese ↔ English',
    version: '1.0.0',
    sourceLanguage: 'pt',
    targetLanguage: 'en',
    totalSize: 2662400, // 2.6MB
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/latest/download/por-eng.sqlite.zip',
    checksum: 'portuguese_database_checksum_here',
    dictionary: {
      filename: 'pt-en.sqlite',
      size: 2662400, // 2.6MB
      checksum: 'portuguese_database_checksum_here',
      entries: 16000, // Estimated
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Portuguese to English supported
      targetToSource: true,  // English to Portuguese supported
      downloadSize: 42 * 1024 * 1024, // ~42MB per direction
    },
    description: 'Portuguese-English language pack with Wiktionary dictionary and ML Kit translation support.',
    releaseDate: '2024-01-15T00:00:00Z',
    minAppVersion: '1.0.0'
  },

  {
    id: 'it-en',
    name: 'Italian ↔ English',
    version: '1.0.0',
    sourceLanguage: 'it',
    targetLanguage: 'en',
    totalSize: 5529600, // 5.3MB
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/latest/download/ita-eng.sqlite.zip',
    checksum: 'italian_database_checksum_here',
    dictionary: {
      filename: 'it-en.sqlite',
      size: 5529600, // 5.3MB
      checksum: 'italian_database_checksum_here',
      entries: 22000, // Estimated
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Italian to English supported
      targetToSource: true,  // English to Italian supported
      downloadSize: 43 * 1024 * 1024, // ~43MB per direction
    },
    description: 'Italian-English language pack with Wiktionary dictionary and ML Kit translation support.',
    releaseDate: '2024-01-15T00:00:00Z',
    minAppVersion: '1.0.0'
  },

  {
    id: 'ru-en',
    name: 'Russian ↔ English',
    version: '1.0.0',
    sourceLanguage: 'ru',
    targetLanguage: 'en',
    totalSize: 4408320, // 4.2MB
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/latest/download/rus-eng.sqlite.zip',
    checksum: 'russian_database_checksum_here',
    dictionary: {
      filename: 'ru-en.sqlite',
      size: 4408320, // 4.2MB
      checksum: 'russian_database_checksum_here',
      entries: 20000, // Estimated
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Russian to English supported
      targetToSource: true,  // English to Russian supported
      downloadSize: 45 * 1024 * 1024, // ~45MB per direction
    },
    description: 'Russian-English language pack with Wiktionary dictionary and ML Kit translation support.',
    releaseDate: '2024-01-15T00:00:00Z',
    minAppVersion: '1.0.0'
  },

  {
    id: 'zh-en',
    name: 'Chinese ↔ English',
    version: '1.0.0',
    sourceLanguage: 'zh',
    targetLanguage: 'en',
    totalSize: 4823040, // 4.6MB
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/latest/download/chn-eng.sqlite.zip',
    checksum: 'chinese_database_checksum_here',
    dictionary: {
      filename: 'zh-en.sqlite',
      size: 4823040, // 4.6MB
      checksum: 'chinese_database_checksum_here',
      entries: 23000, // Estimated
      source: 'wiktionary'
    },
    mlKitSupport: {
      sourceToTarget: true,  // Chinese to English supported
      targetToSource: true,  // English to Chinese supported
      downloadSize: 48 * 1024 * 1024, // ~48MB per direction
    },
    description: 'Chinese-English language pack with Wiktionary dictionary and ML Kit translation support.',
    releaseDate: '2024-01-15T00:00:00Z',
    minAppVersion: '1.0.0'
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