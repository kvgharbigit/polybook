import * as FileSystem from 'expo-file-system';
import { unzipSync } from 'fflate';
import { Buffer } from 'buffer';
import { PERFORMANCE, PATHS } from '../constants/timeouts';
import { 
  LanguagePackManifest, 
  LanguagePackDownload, 
  InstalledLanguagePack,
  LanguagePackStats,
  AVAILABLE_LANGUAGE_PACKS,
  formatPackSize 
} from '@polybook/shared/src/types/languagePacks';

/**
 * Language Pack Download and Management Service
 * 
 * Handles downloading, installation, and management of offline translation models
 */
export class LanguagePackService {
  private static readonly PACKS_DIRECTORY = `${FileSystem.documentDirectory}language-packs/`;
  private static readonly DOWNLOADS_DIRECTORY = `${FileSystem.documentDirectory}downloads/`;
  private static readonly METADATA_FILE = `${FileSystem.documentDirectory}pack-metadata.json`;
  
  // Active downloads tracking
  private static activeDownloads = new Map<string, LanguagePackDownload>();
  private static downloadCallbacks = new Map<string, (download: LanguagePackDownload) => void>();

  /**
   * Initialize the language pack service
   */
  static async initialize(): Promise<void> {
    try {
      // Ensure directories exist
      await FileSystem.makeDirectoryAsync(this.PACKS_DIRECTORY, { intermediates: true });
      await FileSystem.makeDirectoryAsync(this.DOWNLOADS_DIRECTORY, { intermediates: true });
      
      console.log('📦 LanguagePackService: Initialized directories');
      
      // Load existing metadata
      await this.loadMetadata();
      
      console.log('📦 LanguagePackService: Service initialized successfully');
    } catch (error) {
      console.error('📦 LanguagePackService: Initialization error:', error);
      throw new Error(`Failed to initialize language pack service: ${error}`);
    }
  }

  /**
   * Get all available language packs
   */
  static getAvailablePacks(): LanguagePackManifest[] {
    return AVAILABLE_LANGUAGE_PACKS;
  }

  /**
   * Get installed language packs
   */
  static async getInstalledPacks(): Promise<InstalledLanguagePack[]> {
    try {
      const metadata = await this.loadMetadata();
      return metadata.installed || [];
    } catch (error) {
      console.error('📦 LanguagePackService: Error getting installed packs:', error);
      return [];
    }
  }

  /**
   * Check if a language pack is installed
   */
  static async isPackInstalled(packId: string): Promise<boolean> {
    const installed = await this.getInstalledPacks();
    return installed.some(pack => pack.id === packId);
  }

  /**
   * Get storage statistics
   */
  static async getStorageStats(): Promise<LanguagePackStats> {
    try {
      const installed = await this.getInstalledPacks();
      
      const stats: LanguagePackStats = {
        totalInstalled: installed.length,
        totalSize: installed.reduce((sum, pack) => sum + pack.manifest.totalSize, 0),
        totalDictionaryLookups: installed.reduce((sum, pack) => sum + (pack.dictionaryLookups || 0), 0),
        totalTranslations: installed.reduce((sum, pack) => sum + pack.translationCount, 0),
        lastUsed: installed.reduce((latest, pack) => {
          if (!pack.lastUsed) return latest;
          if (!latest) return pack.lastUsed;
          return pack.lastUsed > latest ? pack.lastUsed : latest;
        }, undefined as Date | undefined)
      };

      return stats;
    } catch (error) {
      console.error('📦 LanguagePackService: Error getting storage stats:', error);
      return {
        totalInstalled: 0,
        totalSize: 0,
        totalDictionaryLookups: 0,
        totalTranslations: 0
      };
    }
  }

  /**
   * Check available storage space
   */
  static async checkStorageSpace(packId: string): Promise<{ hasSpace: boolean; availableSpace: number; requiredSpace: number }> {
    try {
      const pack = AVAILABLE_LANGUAGE_PACKS.find(p => p.id === packId);
      if (!pack) {
        throw new Error(`Language pack ${packId} not found`);
      }

      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      const requiredSpace = pack.totalSize;
      
      // Add buffer for extraction and temporary files
      const hasSpace = freeSpace > (requiredSpace + PERFORMANCE.MAX_BUFFER_SIZE);

      return {
        hasSpace,
        availableSpace: freeSpace,
        requiredSpace
      };
    } catch (error) {
      console.error('📦 LanguagePackService: Error checking storage space:', error);
      return {
        hasSpace: false,
        availableSpace: 0,
        requiredSpace: 0
      };
    }
  }

  /**
   * Start downloading a language pack
   */
  static async startDownload(
    packId: string, 
    onProgress?: (download: LanguagePackDownload) => void
  ): Promise<void> {
    try {
      const pack = AVAILABLE_LANGUAGE_PACKS.find(p => p.id === packId);
      if (!pack) {
        throw new Error(`Language pack ${packId} not found`);
      }

      // Check if already installed
      if (await this.isPackInstalled(packId)) {
        throw new Error(`Language pack ${packId} is already installed`);
      }

      // Check if already downloading
      if (this.activeDownloads.has(packId)) {
        throw new Error(`Language pack ${packId} is already downloading`);
      }

      // Check storage space
      const storage = await this.checkStorageSpace(packId);
      if (!storage.hasSpace) {
        throw new Error(
          `Insufficient storage space. Need ${formatPackSize(storage.requiredSpace)}, ` +
          `have ${formatPackSize(storage.availableSpace)}`
        );
      }

      console.log(`📦 LanguagePackService: Starting download for ${pack.name}`);

      // Initialize download tracking
      const download: LanguagePackDownload = {
        id: packId,
        status: 'pending',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: pack.totalSize,
        retryCount: 0,
        startedAt: new Date()
      };

      this.activeDownloads.set(packId, download);
      if (onProgress) {
        this.downloadCallbacks.set(packId, onProgress);
      }

      // Start the actual download
      await this.performDownload(pack, download);

    } catch (error) {
      console.error(`📦 LanguagePackService: Download error for ${packId}:`, error);
      
      // Clean up failed download
      this.activeDownloads.delete(packId);
      this.downloadCallbacks.delete(packId);
      
      throw error;
    }
  }

  /**
   * Perform the actual download
   */
  private static async performDownload(
    pack: LanguagePackManifest, 
    download: LanguagePackDownload
  ): Promise<void> {
    try {
      // Use proper extension based on download URL
      const urlExtension = pack.downloadUrl.split('.').pop() || 'pack';
      const downloadPath = `${this.DOWNLOADS_DIRECTORY}${pack.id}.${urlExtension}`;
      
      // Update status
      download.status = 'downloading';
      this.updateDownloadProgress(download);

      console.log(`📦 LanguagePackService: Downloading ${pack.name} to ${downloadPath}`);
      console.log(`📦 Download URL: ${pack.downloadUrl}`);
      console.log(`📦 Expected size: ${pack.totalSize} bytes`);

      // Start download with progress tracking
      const downloadResumable = FileSystem.createDownloadResumable(
        pack.downloadUrl,
        downloadPath,
        {},
        (downloadProgress) => {
          const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;
          
          download.downloadedBytes = totalBytesWritten;
          download.totalBytes = totalBytesExpectedToWrite;
          download.progress = Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 70); // 70% for download
          
          console.log(`📦 Download progress: ${totalBytesWritten}/${totalBytesExpectedToWrite} bytes (${download.progress}%)`);
          this.updateDownloadProgress(download);
        }
      );

      console.log(`📦 Starting download from: ${pack.downloadUrl}`);
      const result = await downloadResumable.downloadAsync();
      
      if (!result) {
        throw new Error('Download failed - no result');
      }

      console.log(`📦 LanguagePackService: Download completed for ${pack.name}`);
      console.log(`📦 Downloaded file URI: ${result.uri}`);
      
      // Check downloaded file size
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      console.log(`📦 Downloaded file info:`, fileInfo);
      console.log(`📦 Downloaded file size: ${fileInfo.size} bytes (expected: ${pack.totalSize})`);
      
      // Check if size matches expected
      if (Math.abs(fileInfo.size - pack.totalSize) > 1000) {
        console.warn(`📦 WARNING: Downloaded file size (${fileInfo.size}) doesn't match expected size (${pack.totalSize})`);
        console.warn(`📦 This might indicate a corrupted download or wrong file`);
      }
      
      if (!fileInfo.exists) {
        throw new Error('Downloaded file does not exist');
      }
      
      if (fileInfo.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      // Verify checksum
      download.status = 'extracting';
      download.progress = 75;
      this.updateDownloadProgress(download);

      await this.verifyAndInstall(pack, result.uri, download);

    } catch (error) {
      download.status = 'failed';
      download.error = String(error);
      this.updateDownloadProgress(download);
      
      console.error(`📦 LanguagePackService: Download failed for ${pack.id}:`, error);
      throw error;
    }
  }

  /**
   * Verify checksum and install the pack
   */
  private static async verifyAndInstall(
    pack: LanguagePackManifest,
    downloadedFile: string,
    download: LanguagePackDownload
  ): Promise<void> {
    try {
      console.log(`📦 LanguagePackService: Verifying and installing ${pack.name}`);
      console.log(`📦 Downloaded file: ${downloadedFile}`);

      // For now, skip checksum verification (would need crypto library)
      // TODO: Implement proper checksum verification in production

      // Create installation directory
      const installDir = `${this.PACKS_DIRECTORY}${pack.id}/`;
      await FileSystem.makeDirectoryAsync(installDir, { intermediates: true });
      console.log(`📦 Created install directory: ${installDir}`);

      // Extract/install dictionary and models
      const dictionaryPath = `${installDir}${pack.dictionary.filename}`;
      const modelPath1 = `${installDir}${pack.models.sourceToTarget.filename}`;
      const modelPath2 = `${installDir}${pack.models.targetToSource.filename}`;
      
      console.log(`📦 Target dictionary path: ${dictionaryPath}`);
      
      // Update extraction progress
      download.progress = 80;
      this.updateDownloadProgress(download);

      // Extract ZIP file contents using fflate
      console.log(`📦 Extracting ZIP file: ${downloadedFile}`);
      try {
        // Read the ZIP file as base64
        const zipBase64 = await FileSystem.readAsStringAsync(downloadedFile, { 
          encoding: FileSystem.EncodingType.Base64 
        });
        console.log(`📦 Read ZIP file as base64: ${zipBase64.length} characters`);
        
        // Convert base64 to Uint8Array
        const zipBuffer = Buffer.from(zipBase64, 'base64');
        const zipUint8Array = new Uint8Array(zipBuffer);
        console.log(`📦 Converted to Uint8Array: ${zipUint8Array.length} bytes`);
        
        // Extract using fflate
        const extracted = unzipSync(zipUint8Array);
        console.log(`📦 Extracted files: ${Object.keys(extracted).join(', ')}`);
        
        // Find and save the dictionary file
        let dictionaryFound = false;
        for (const [filename, fileData] of Object.entries(extracted)) {
          console.log(`📦 Processing extracted file: ${filename} (${fileData.length} bytes)`);
          
          if (filename === pack.dictionary.filename || filename.endsWith('.sqlite')) {
            // Save the dictionary file
            const fileBase64 = Buffer.from(fileData).toString('base64');
            await FileSystem.writeAsStringAsync(dictionaryPath, fileBase64, {
              encoding: FileSystem.EncodingType.Base64
            });
            console.log(`📦 Saved dictionary file: ${dictionaryPath}`);
            dictionaryFound = true;
          }
        }
        
        if (!dictionaryFound) {
          throw new Error(`Dictionary file not found in ZIP archive. Available files: ${Object.keys(extracted).join(', ')}`);
        }
        
        // Verify the extracted dictionary file
        const dictFileInfo = await FileSystem.getInfoAsync(dictionaryPath);
        console.log(`📦 Dictionary file info:`, dictFileInfo);
        
        if (!dictFileInfo.exists) {
          throw new Error(`Dictionary file was not saved correctly: ${pack.dictionary.filename}`);
        }
        
        if (dictFileInfo.size === 0) {
          throw new Error(`Dictionary file is empty after extraction`);
        }
        
        // Check if it's a valid SQLite file by reading the header
        const fileHeader = await FileSystem.readAsStringAsync(dictionaryPath, { 
          encoding: FileSystem.EncodingType.Base64,
          length: 32 // Read first 32 bytes for SQLite header check
        });
        const headerBytes = Buffer.from(fileHeader, 'base64');
        const headerText = headerBytes.toString('ascii', 0, 16);
        console.log(`📦 File header: "${headerText}"`);
        
        if (!headerText.startsWith('SQLite format 3')) {
          console.warn(`📦 Warning: File doesn't appear to be a SQLite database. Header: "${headerText}"`);
        } else {
          console.log(`📦 Confirmed: Valid SQLite database header detected`);
        }
        
        console.log(`📦 Dictionary extracted successfully: ${dictFileInfo.size} bytes`);
        
        // Database validation - real data should be available from GitHub
        console.log(`📦 Validating downloaded database...`);
        try {
          const SQLite = await import('expo-sqlite');
          const db = await SQLite.openDatabaseAsync(dictionaryPath);
          const tables = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'");
          
          if (tables.some(t => t.name === 'dict')) {
            const count = await db.getAllAsync('SELECT COUNT(*) as count FROM dict');
            console.log(`📦 Dictionary database loaded successfully: ${count[0].count} entries`);
          } else {
            console.warn(`📦 Warning: No dict table found in database`);
          }
        } catch (validationError) {
          console.error(`📦 Database validation error:`, validationError);
        }
        
      } catch (extractError) {
        console.error(`📦 ZIP extraction failed:`, extractError);
        throw new Error(`Failed to extract language pack: ${extractError}`);
      }
      
      download.progress = 90;
      this.updateDownloadProgress(download);
      
      // For model files, create placeholder files for now since we're focusing on dictionary
      // TODO: Implement proper model extraction when Bergamot integration is ready
      console.log(`📦 Creating placeholder model files...`);
      await FileSystem.writeAsStringAsync(modelPath1, 'placeholder-model-1');
      await FileSystem.writeAsStringAsync(modelPath2, 'placeholder-model-2');

      // Create installed pack record
      const installedPack: InstalledLanguagePack = {
        id: pack.id,
        manifest: pack,
        installedAt: new Date(),
        dictionaryPath: dictionaryPath,
        modelPaths: {
          sourceToTarget: modelPath1,
          targetToSource: modelPath2
        },
        dictionaryLookups: 0,
        translationCount: 0,
        totalUsageTime: 0
      };

      // Save to metadata
      await this.addInstalledPack(installedPack);

      // Clean up download file
      await FileSystem.deleteAsync(downloadedFile, { idempotent: true });

      // Mark as completed
      download.status = 'completed';
      download.progress = 100;
      download.completedAt = new Date();
      this.updateDownloadProgress(download);

      console.log(`📦 LanguagePackService: Successfully installed ${pack.name}`);

      // Clean up tracking
      setTimeout(() => {
        this.activeDownloads.delete(pack.id);
        this.downloadCallbacks.delete(pack.id);
      }, 2000); // Keep success state visible for 2 seconds

    } catch (error) {
      console.error(`📦 LanguagePackService: Installation failed for ${pack.id}:`, error);
      throw error;
    }
  }

  /**
   * Delete an installed language pack
   */
  static async deletePack(packId: string): Promise<void> {
    try {
      console.log(`📦 LanguagePackService: Deleting pack ${packId}`);

      // Remove from filesystem
      const packDir = `${this.PACKS_DIRECTORY}${packId}/`;
      await FileSystem.deleteAsync(packDir, { idempotent: true });

      // Remove from metadata
      await this.removeInstalledPack(packId);

      console.log(`📦 LanguagePackService: Successfully deleted pack ${packId}`);
    } catch (error) {
      console.error(`📦 LanguagePackService: Error deleting pack ${packId}:`, error);
      throw error;
    }
  }

  /**
   * Get active download status
   */
  static getDownloadStatus(packId: string): LanguagePackDownload | undefined {
    return this.activeDownloads.get(packId);
  }

  /**
   * Cancel an active download
   */
  static async cancelDownload(packId: string): Promise<void> {
    try {
      const download = this.activeDownloads.get(packId);
      if (!download) return;

      console.log(`📦 LanguagePackService: Cancelling download for ${packId}`);

      // Clean up files
      const downloadPath = `${this.DOWNLOADS_DIRECTORY}${packId}.pack`;
      await FileSystem.deleteAsync(downloadPath, { idempotent: true });

      // Clean up tracking
      this.activeDownloads.delete(packId);
      this.downloadCallbacks.delete(packId);

    } catch (error) {
      console.error(`📦 LanguagePackService: Error cancelling download ${packId}:`, error);
    }
  }

  /**
   * Update download progress and notify callback
   */
  private static updateDownloadProgress(download: LanguagePackDownload): void {
    const callback = this.downloadCallbacks.get(download.id);
    if (callback) {
      callback(download);
    }
  }

  /**
   * Load metadata from file
   */
  private static async loadMetadata(): Promise<{ installed: InstalledLanguagePack[] }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(this.METADATA_FILE);
      if (!fileInfo.exists) {
        return { installed: [] };
      }

      const content = await FileSystem.readAsStringAsync(this.METADATA_FILE);
      const metadata = JSON.parse(content);
      
      // Convert date strings back to Date objects
      metadata.installed = metadata.installed.map((pack: any) => ({
        ...pack,
        installedAt: new Date(pack.installedAt),
        lastUsed: pack.lastUsed ? new Date(pack.lastUsed) : undefined
      }));

      return metadata;
    } catch (error) {
      console.error('📦 LanguagePackService: Error loading metadata:', error);
      return { installed: [] };
    }
  }

  /**
   * Save metadata to file
   */
  private static async saveMetadata(metadata: { installed: InstalledLanguagePack[] }): Promise<void> {
    try {
      const content = JSON.stringify(metadata, null, 2);
      await FileSystem.writeAsStringAsync(this.METADATA_FILE, content);
    } catch (error) {
      console.error('📦 LanguagePackService: Error saving metadata:', error);
      throw error;
    }
  }

  /**
   * Add an installed pack to metadata
   */
  private static async addInstalledPack(pack: InstalledLanguagePack): Promise<void> {
    const metadata = await this.loadMetadata();
    
    // Remove existing pack with same ID
    metadata.installed = metadata.installed.filter(p => p.id !== pack.id);
    
    // Add new pack
    metadata.installed.push(pack);
    
    await this.saveMetadata(metadata);
  }

  /**
   * Remove an installed pack from metadata
   */
  private static async removeInstalledPack(packId: string): Promise<void> {
    const metadata = await this.loadMetadata();
    metadata.installed = metadata.installed.filter(p => p.id !== packId);
    await this.saveMetadata(metadata);
  }

}