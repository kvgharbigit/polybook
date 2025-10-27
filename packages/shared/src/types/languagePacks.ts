/**
 * Language Pack Types for Offline Translation
 * 
 * Defines the structure for downloadable language packs containing
 * Bergamot/Marian neural machine translation models
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
    source: 'wiktionary' | 'freedict' | 'custom';
  };
  
  // Translation models (for sentence translation)
  models: {
    sourceToTarget: LanguageModel;  // es → en
    targetToSource: LanguageModel;  // en → es
  };
  
  // Metadata
  description: string;
  releaseDate: string;           // ISO date string
  minAppVersion: string;         // Minimum app version required
  deprecated?: boolean;          // If this version is deprecated
}

export interface LanguageModel {
  filename: string;              // e.g., 'es-en.bergamot'
  size: number;                  // Size in bytes
  checksum: string;              // SHA-256 hash
  quality: 'fast' | 'balanced' | 'high';  // Quality/speed tradeoff
  
  // Performance metadata
  estimatedSpeed: number;        // Words per second on reference device
  memoryUsage: number;           // Peak memory usage in MB
  
  // Model-specific settings
  beamSize: number;              // Default beam size for translation
  maxInputLength: number;        // Maximum input sentence length
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
  modelPaths: {
    sourceToTarget: string;      // Bergamot model file path
    targetToSource: string;      // Bergamot model file path
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
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/latest/download/es-en.sqlite.zip',
    checksum: 'real_database_checksum_here',
    dictionary: {
      filename: 'es-en.sqlite',
      size: 14680064, // Real SQLite database size  
      checksum: 'real_database_checksum_here',
      entries: 10000, // Real dictionary entries
      source: 'wiktionary'
    },
    models: {
      sourceToTarget: {
        filename: 'es-en.bergamot',
        size: 90 * 1024 * 1024, // ~90MB
        checksum: 'placeholder_checksum_es_en_model',
        quality: 'balanced',
        estimatedSpeed: 150, // words per second
        memoryUsage: 200, // MB
        beamSize: 4,
        maxInputLength: 512
      },
      targetToSource: {
        filename: 'en-es.bergamot',
        size: 90 * 1024 * 1024, // ~90MB
        checksum: 'placeholder_checksum_en_es_model',
        quality: 'balanced',
        estimatedSpeed: 150, // words per second
        memoryUsage: 200, // MB
        beamSize: 4,
        maxInputLength: 512
      }
    },
    description: 'Complete language pack with Wiktionary dictionary (14k entries) for word lookup and Bergamot models for sentence translation.',
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
    downloadUrl: 'https://github.com/kvgharbigit/polybook/releases/download/v1.0.0/de-en.sqlite.zip',
    checksum: 'c7241f107434212228c9304c422c1378deff34370e79748aaef2649e122a6f9f',
    dictionary: {
      filename: 'de-en.sqlite',
      size: 823201, // 823KB compressed
      checksum: 'c7241f107434212228c9304c422c1378deff34370e79748aaef2649e122a6f9f',
      entries: 12130, // Actual entries from build
      source: 'wiktionary'
    },
    models: {
      sourceToTarget: {
        filename: 'de-en.bergamot',
        size: 89 * 1024 * 1024,
        checksum: 'placeholder_checksum_de_en_model',
        quality: 'balanced',
        estimatedSpeed: 140,
        memoryUsage: 190,
        beamSize: 4,
        maxInputLength: 512
      },
      targetToSource: {
        filename: 'en-de.bergamot',
        size: 89 * 1024 * 1024,
        checksum: 'placeholder_checksum_en_de_model',
        quality: 'balanced',
        estimatedSpeed: 140,
        memoryUsage: 190,
        beamSize: 4,
        maxInputLength: 512
      }
    },
    description: 'German-English language pack with comprehensive Wiktionary dictionary and neural translation models.',
    releaseDate: '2024-01-15T00:00:00Z',
    minAppVersion: '1.0.0'
  },
  
  {
    id: 'fr-en',
    name: 'French ↔ English',
    version: '1.0.0',
    sourceLanguage: 'fr',
    targetLanguage: 'en',
    downloadUrl: 'https://cdn.polybook.app/packs/fr-en-v1.0.0.pack',
    checksum: 'placeholder_checksum_fr_en',
    totalSize: 173 * 1024 * 1024, // ~173MB
    dictionary: {
      filename: 'fr-en.sqlite',
      size: 3370636, // 3.2MB from our data
      checksum: 'placeholder_checksum_fr_en_dict',
      entries: 18000, // Estimated
      source: 'wiktionary'
    },
    models: {
      sourceToTarget: {
        filename: 'fr-en.bergamot',
        size: 85 * 1024 * 1024,
        checksum: 'placeholder_checksum_fr_en_model',
        quality: 'balanced',
        estimatedSpeed: 140,
        memoryUsage: 190,
        beamSize: 4,
        maxInputLength: 512
      },
      targetToSource: {
        filename: 'en-fr.bergamot',
        size: 85 * 1024 * 1024,
        checksum: 'placeholder_checksum_en_fr_model',
        quality: 'balanced',
        estimatedSpeed: 140,
        memoryUsage: 190,
        beamSize: 4,
        maxInputLength: 512
      }
    },
    description: 'French-English language pack with Wiktionary dictionary and neural translation models.',
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
    downloadUrl: 'https://cdn.polybook.app/packs/ja-en-v1.0.0.pack',
    checksum: 'placeholder_checksum_ja_en',
    dictionary: {
      filename: 'ja-en.sqlite',
      size: 6224775, // 5.9MB from our data
      checksum: 'placeholder_checksum_ja_en_dict',
      entries: 25000, // Estimated
      source: 'wiktionary'
    },
    models: {
      sourceToTarget: {
        filename: 'ja-en.bergamot',
        size: 90 * 1024 * 1024,
        checksum: 'placeholder_checksum_ja_en_model',
        quality: 'balanced',
        estimatedSpeed: 120, // Slower for Japanese
        memoryUsage: 220,
        beamSize: 6, // Larger beam for Japanese
        maxInputLength: 256
      },
      targetToSource: {
        filename: 'en-ja.bergamot',
        size: 89 * 1024 * 1024,
        checksum: 'placeholder_checksum_en_ja_model',
        quality: 'balanced',
        estimatedSpeed: 120,
        memoryUsage: 220,
        beamSize: 6,
        maxInputLength: 256
      }
    },
    description: 'Japanese-English language pack with Wiktionary dictionary and specialized neural translation models.',
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