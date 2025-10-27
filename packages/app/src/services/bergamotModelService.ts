import * as FileSystem from 'expo-file-system';
import { unzipSync } from 'fflate';
import { Buffer } from 'buffer';

export interface BergamotModel {
  id: string;
  pair: string; // e.g., 'enes', 'enfr'
  sourceLanguage: string;
  targetLanguage: string;
  tier: 'tiny' | 'base';
  size: number; // MB
  bleu?: number;
  displayName: string; // e.g., 'English → Spanish'
}

export interface BergamotLanguagePair {
  id: string; // e.g., 'en-es', 'en-fr'
  languages: [string, string]; // [source, target] e.g., ['en', 'es']
  displayName: string; // e.g., 'English ↔ Spanish'
  tier: 'tiny' | 'base';
  models: BergamotModel[]; // Both directions
  totalSize: number; // Combined size of both models
  averageBleu?: number;
  flags: string; // e.g., '🇺🇸🇪🇸'
}

export interface BergamotModelDownload {
  id: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number; // 0-100
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
}

export interface InstalledBergamotModel {
  id: string;
  pair: string;
  tier: 'tiny' | 'base';
  installedAt: string;
  size: number;
  version: string;
}

export interface BergamotModelStats {
  totalInstalled: number;
  totalSize: number;
  availableSpace: number;
  supportedPairs: number;
}

/**
 * Bergamot Translation Model Management Service
 * Extends the existing language pack system for translation models
 */
export class BergamotModelService {
  private static readonly MODELS_DIRECTORY = `${FileSystem.documentDirectory}bergamot-models/`;
  private static readonly DOWNLOADS_DIRECTORY = `${FileSystem.documentDirectory}bergamot-downloads/`;
  private static readonly METADATA_FILE = `${FileSystem.documentDirectory}bergamot-metadata.json`;
  
  // Active downloads tracking
  private static activeDownloads = new Map<string, BergamotModelDownload>();
  private static downloadCallbacks = new Map<string, (download: BergamotModelDownload) => void>();

  // Language flag mappings (using British flag for English)
  private static readonly LANGUAGE_FLAGS: Record<string, string> = {
    'en': '🇬🇧', // British flag for English
    'es': '🇪🇸',
    'fr': '🇫🇷',
    'de': '🇩🇪',
    'it': '🇮🇹',
    'pt': '🇵🇹',
    'ru': '🇷🇺',
    'hi': '🇮🇳',
    'ar': '🇸🇦',
    'ja': '🇯🇵',
    'ko': '🇰🇷',
    'zh': '🇨🇳'
  };

  private static readonly LANGUAGE_NAMES: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'hi': 'Hindi',
    'ar': 'Arabic',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese'
  };

  // Available models from our tiered configuration
  private static readonly AVAILABLE_MODELS: BergamotModel[] = [
    // Tiny models (16MB each)
    { id: 'enes-tiny', pair: 'enes', sourceLanguage: 'en', targetLanguage: 'es', tier: 'tiny', size: 16, bleu: 25.9, displayName: 'English → Spanish' },
    { id: 'enfr-tiny', pair: 'enfr', sourceLanguage: 'en', targetLanguage: 'fr', tier: 'tiny', size: 16, bleu: 48.5, displayName: 'English → French' },
    { id: 'ende-tiny', pair: 'ende', sourceLanguage: 'en', targetLanguage: 'de', tier: 'tiny', size: 16, bleu: 38.8, displayName: 'English → German' },
    { id: 'enit-tiny', pair: 'enit', sourceLanguage: 'en', targetLanguage: 'it', tier: 'tiny', size: 16, bleu: 29.2, displayName: 'English → Italian' },
    { id: 'enpt-tiny', pair: 'enpt', sourceLanguage: 'en', targetLanguage: 'pt', tier: 'tiny', size: 16, bleu: 49.4, displayName: 'English → Portuguese' },
    { id: 'enru-tiny', pair: 'enru', sourceLanguage: 'en', targetLanguage: 'ru', tier: 'tiny', size: 16, bleu: 28.5, displayName: 'English → Russian' },
    { id: 'enhi-tiny', pair: 'enhi', sourceLanguage: 'en', targetLanguage: 'hi', tier: 'tiny', size: 16, bleu: 36.7, displayName: 'English → Hindi' },
    { id: 'esen-tiny', pair: 'esen', sourceLanguage: 'es', targetLanguage: 'en', tier: 'tiny', size: 16, bleu: 27.5, displayName: 'Spanish → English' },
    { id: 'fren-tiny', pair: 'fren', sourceLanguage: 'fr', targetLanguage: 'en', tier: 'tiny', size: 16, bleu: 43.8, displayName: 'French → English' },
    { id: 'deen-tiny', pair: 'deen', sourceLanguage: 'de', targetLanguage: 'en', tier: 'tiny', size: 16, bleu: 39.6, displayName: 'German → English' },
    { id: 'iten-tiny', pair: 'iten', sourceLanguage: 'it', targetLanguage: 'en', tier: 'tiny', size: 16, bleu: 30.9, displayName: 'Italian → English' },
    { id: 'pten-tiny', pair: 'pten', sourceLanguage: 'pt', targetLanguage: 'en', tier: 'tiny', size: 16, bleu: 47.8, displayName: 'Portuguese → English' },
    { id: 'ruen-tiny', pair: 'ruen', sourceLanguage: 'ru', targetLanguage: 'en', tier: 'tiny', size: 16, bleu: 30.4, displayName: 'Russian → English' },
    { id: 'hien-tiny', pair: 'hien', sourceLanguage: 'hi', targetLanguage: 'en', tier: 'tiny', size: 16, bleu: 36.2, displayName: 'Hindi → English' },
    
    // Base models (larger sizes)
    { id: 'enar-base', pair: 'enar', sourceLanguage: 'en', targetLanguage: 'ar', tier: 'base', size: 41, bleu: 29.9, displayName: 'English → Arabic' },
    { id: 'enja-base', pair: 'enja', sourceLanguage: 'en', targetLanguage: 'ja', tier: 'base', size: 57, bleu: 35.3, displayName: 'English → Japanese' },
    { id: 'enko-base', pair: 'enko', sourceLanguage: 'en', targetLanguage: 'ko', tier: 'base', size: 57, bleu: 29.9, displayName: 'English → Korean' },
    { id: 'enzh-base', pair: 'enzh', sourceLanguage: 'en', targetLanguage: 'zh', tier: 'base', size: 41, displayName: 'English → Chinese' },
    { id: 'aren-base', pair: 'aren', sourceLanguage: 'ar', targetLanguage: 'en', tier: 'base', size: 41, bleu: 39.6, displayName: 'Arabic → English' },
    { id: 'jaen-base', pair: 'jaen', sourceLanguage: 'ja', targetLanguage: 'en', tier: 'base', size: 57, bleu: 25.9, displayName: 'Japanese → English' },
    { id: 'koen-base', pair: 'koen', sourceLanguage: 'ko', targetLanguage: 'en', tier: 'base', size: 57, bleu: 29.0, displayName: 'Korean → English' },
    { id: 'zhen-base', pair: 'zhen', sourceLanguage: 'zh', targetLanguage: 'en', tier: 'base', size: 57, displayName: 'Chinese → English' }
  ];

  /**
   * Initialize the Bergamot model service
   */
  static async initialize(): Promise<void> {
    try {
      await FileSystem.makeDirectoryAsync(this.MODELS_DIRECTORY, { intermediates: true });
      await FileSystem.makeDirectoryAsync(this.DOWNLOADS_DIRECTORY, { intermediates: true });
      
      console.log('🌐 BergamotModelService: Initialized directories');
      await this.loadMetadata();
      console.log('🌐 BergamotModelService: Service initialized successfully');
    } catch (error) {
      console.error('🌐 BergamotModelService: Initialization error:', error);
      throw new Error(`Failed to initialize Bergamot model service: ${error}`);
    }
  }

  /**
   * Get all available Bergamot models
   */
  static async getAvailableModels(): Promise<BergamotModel[]> {
    return this.AVAILABLE_MODELS;
  }

  /**
   * Get language pairs (bidirectional grouping for UI)
   */
  static async getLanguagePairs(): Promise<BergamotLanguagePair[]> {
    const pairs = new Map<string, BergamotLanguagePair>();
    
    // Group models by language pair
    for (const model of this.AVAILABLE_MODELS) {
      const [lang1, lang2] = [model.sourceLanguage, model.targetLanguage];
      
      // Create consistent pair ID (alphabetical order)
      const pairId = [lang1, lang2].sort().join('-');
      
      if (!pairs.has(pairId)) {
        const pairLanguages: [string, string] = lang1 < lang2 ? [lang1, lang2] : [lang2, lang1];
        const lang1Name = this.LANGUAGE_NAMES[pairLanguages[0]];
        const lang2Name = this.LANGUAGE_NAMES[pairLanguages[1]];
        const flag1 = this.LANGUAGE_FLAGS[pairLanguages[0]];
        const flag2 = this.LANGUAGE_FLAGS[pairLanguages[1]];
        
        pairs.set(pairId, {
          id: pairId,
          languages: pairLanguages,
          displayName: `${lang1Name} ↔ ${lang2Name}`,
          tier: model.tier, // Will be updated if needed
          models: [],
          totalSize: 0,
          flags: `${flag1}${flag2}`
        });
      }
      
      const pair = pairs.get(pairId)!;
      pair.models.push(model);
      pair.totalSize += model.size;
      
      // Update tier if we find a mix (prefer tiny)
      if (pair.tier !== model.tier) {
        pair.tier = pair.models.some(m => m.tier === 'tiny') ? 'tiny' : 'base';
      }
    }
    
    // Calculate average BLEU scores
    for (const pair of pairs.values()) {
      const bleuScores = pair.models.filter(m => m.bleu).map(m => m.bleu!);
      if (bleuScores.length > 0) {
        pair.averageBleu = Math.round(bleuScores.reduce((sum, bleu) => sum + bleu, 0) / bleuScores.length * 10) / 10;
      }
    }
    
    // Sort by language names for consistent display
    return Array.from(pairs.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /**
   * Get installed models
   */
  static async getInstalledModels(): Promise<InstalledBergamotModel[]> {
    try {
      const metadataExists = await FileSystem.getInfoAsync(this.METADATA_FILE);
      if (!metadataExists.exists) {
        return [];
      }

      const metadata = await FileSystem.readAsStringAsync(this.METADATA_FILE);
      const data = JSON.parse(metadata);
      return data.installed || [];
    } catch (error) {
      console.error('🌐 BergamotModelService: Error getting installed models:', error);
      return [];
    }
  }

  /**
   * Check if a model is installed
   */
  static async isModelInstalled(modelId: string): Promise<boolean> {
    const installed = await this.getInstalledModels();
    return installed.some(model => model.id === modelId);
  }

  /**
   * Download a Bergamot model
   */
  static async startDownload(
    modelId: string, 
    progressCallback?: (download: BergamotModelDownload) => void
  ): Promise<void> {
    const model = this.AVAILABLE_MODELS.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // Check if already downloading
    if (this.activeDownloads.has(modelId)) {
      throw new Error(`Model ${modelId} is already being downloaded`);
    }

    // Register progress callback
    if (progressCallback) {
      this.downloadCallbacks.set(modelId, progressCallback);
    }

    const download: BergamotModelDownload = {
      id: modelId,
      status: 'pending',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: model.size * 1024 * 1024 // Convert MB to bytes
    };

    this.activeDownloads.set(modelId, download);
    this.notifyProgress(modelId);

    try {
      // Download model files
      download.status = 'downloading';
      this.notifyProgress(modelId);

      const files = [
        `model.${model.pair}.intgemm.alphas.bin.gz`,
        `vocab.${model.pair}.spm.gz`,
        `lex.50.50.${model.pair}.s2t.bin.gz`,
        'metadata.json'
      ];

      const modelDir = `${this.DOWNLOADS_DIRECTORY}${modelId}/`;
      await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });

      let totalDownloaded = 0;
      for (const fileName of files) {
        const url = `https://github.com/mozilla/firefox-translations-models/raw/main/models/${model.tier}/${model.pair}/${fileName}`;
        const filePath = `${modelDir}${fileName}`;

        // Download file
        const downloadResult = await FileSystem.downloadAsync(url, filePath);
        
        if (downloadResult.status === 200) {
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          if (fileInfo.exists && 'size' in fileInfo) {
            totalDownloaded += fileInfo.size;
          }
          
          download.downloadedBytes = totalDownloaded;
          download.progress = (totalDownloaded / download.totalBytes) * 100;
          this.notifyProgress(modelId);
        } else {
          throw new Error(`Failed to download ${fileName}: HTTP ${downloadResult.status}`);
        }
      }

      // Install the model
      await this.installModel(modelId, modelDir);
      
      download.status = 'completed';
      download.progress = 100;
      this.notifyProgress(modelId);

      // Clean up
      this.activeDownloads.delete(modelId);
      this.downloadCallbacks.delete(modelId);

    } catch (error) {
      download.status = 'failed';
      download.error = error instanceof Error ? error.message : 'Unknown error';
      this.notifyProgress(modelId);
      
      this.activeDownloads.delete(modelId);
      this.downloadCallbacks.delete(modelId);
      throw error;
    }
  }

  /**
   * Install a downloaded model
   */
  private static async installModel(modelId: string, downloadDir: string): Promise<void> {
    const model = this.AVAILABLE_MODELS.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const modelDir = `${this.MODELS_DIRECTORY}${model.pair}/`;
    await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });

    // Copy and decompress files
    const files = await FileSystem.readDirectoryAsync(downloadDir);
    for (const file of files) {
      const sourcePath = `${downloadDir}${file}`;
      const targetPath = `${modelDir}${file}`;
      
      if (file.endsWith('.gz')) {
        // Decompress .gz files
        const compressedData = await FileSystem.readAsStringAsync(sourcePath, { encoding: 'base64' });
        const compressedBuffer = Buffer.from(compressedData, 'base64');
        const decompressed = unzipSync(compressedBuffer);
        
        const decompressedFileName = file.replace('.gz', '');
        const decompressedPath = `${modelDir}${decompressedFileName}`;
        
        // Write decompressed file
        const firstKey = Object.keys(decompressed)[0];
        if (firstKey) {
          await FileSystem.writeAsStringAsync(
            decompressedPath, 
            Buffer.from(decompressed[firstKey]).toString('base64'),
            { encoding: 'base64' }
          );
        }
      } else {
        // Copy regular files
        await FileSystem.copyAsync({ from: sourcePath, to: targetPath });
      }
    }

    // Update metadata
    await this.updateInstalledModels(model);

    // Clean up download directory
    await FileSystem.deleteAsync(downloadDir, { idempotent: true });
  }

  /**
   * Update installed models metadata
   */
  private static async updateInstalledModels(model: BergamotModel): Promise<void> {
    const installed = await this.getInstalledModels();
    
    const newInstall: InstalledBergamotModel = {
      id: model.id,
      pair: model.pair,
      tier: model.tier,
      installedAt: new Date().toISOString(),
      size: model.size,
      version: '1.0.0'
    };

    const updatedInstalled = [...installed.filter(m => m.id !== model.id), newInstall];
    
    const metadata = {
      installed: updatedInstalled,
      lastUpdated: new Date().toISOString()
    };

    await FileSystem.writeAsStringAsync(this.METADATA_FILE, JSON.stringify(metadata, null, 2));
  }

  /**
   * Get storage statistics
   */
  static async getStorageStats(): Promise<BergamotModelStats> {
    const installed = await this.getInstalledModels();
    const totalSize = installed.reduce((sum, model) => sum + model.size, 0);
    
    // Get available space
    const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
    
    return {
      totalInstalled: installed.length,
      totalSize,
      availableSpace: Math.round(freeDiskStorage / 1024 / 1024), // Convert to MB
      supportedPairs: this.AVAILABLE_MODELS.length
    };
  }

  /**
   * Delete a model
   */
  static async deleteModel(modelId: string): Promise<void> {
    const model = this.AVAILABLE_MODELS.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const modelDir = `${this.MODELS_DIRECTORY}${model.pair}/`;
    await FileSystem.deleteAsync(modelDir, { idempotent: true });

    // Update metadata
    const installed = await this.getInstalledModels();
    const updatedInstalled = installed.filter(m => m.id !== modelId);
    
    const metadata = {
      installed: updatedInstalled,
      lastUpdated: new Date().toISOString()
    };

    await FileSystem.writeAsStringAsync(this.METADATA_FILE, JSON.stringify(metadata, null, 2));
  }

  /**
   * Get active downloads
   */
  static getActiveDownloads(): Map<string, BergamotModelDownload> {
    return new Map(this.activeDownloads);
  }

  private static async loadMetadata(): Promise<void> {
    // Initialize metadata file if it doesn't exist
    const metadataExists = await FileSystem.getInfoAsync(this.METADATA_FILE);
    if (!metadataExists.exists) {
      const initialMetadata = {
        installed: [],
        lastUpdated: new Date().toISOString()
      };
      await FileSystem.writeAsStringAsync(this.METADATA_FILE, JSON.stringify(initialMetadata, null, 2));
    }
  }

  private static notifyProgress(modelId: string): void {
    const download = this.activeDownloads.get(modelId);
    const callback = this.downloadCallbacks.get(modelId);
    
    if (download && callback) {
      callback(download);
    }
  }
}