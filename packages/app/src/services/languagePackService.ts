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
 * Handles downloading, installation, and management of offline dictionary packs
 * for SQLite-based word lookup. ML Kit models are managed separately by the ML Kit service.
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
   * Force reinstall a language pack (useful for companion packs with schema issues)
   */
  static async forceReinstall(
    packId: string,
    onProgress?: (download: LanguagePackDownload) => void
  ): Promise<void> {
    console.log(`📦 LanguagePackService: Force reinstalling pack ${packId}`);
    
    // Delete if exists
    if (await this.isPackInstalled(packId)) {
      await this.deletePack(packId);
      console.log(`📦 LanguagePackService: Deleted existing pack ${packId} for reinstall`);
    }
    
    // Download fresh
    return this.startDownload(packId, onProgress);
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

      // Check if already installed - for companion packs, allow overwrite to ensure correct schema
      if (await this.isPackInstalled(packId)) {
        // For companion packs, we should overwrite to ensure correct database schema
        const isCompanionPack = pack.hidden === true;
        
        if (isCompanionPack) {
          console.log(`📦 LanguagePackService: Companion pack ${packId} already installed - overwriting to ensure correct schema`);
          
          // Delete the existing pack first
          try {
            await this.deletePack(packId);
            console.log(`📦 LanguagePackService: Successfully deleted existing companion pack ${packId}`);
          } catch (deleteError) {
            console.error(`📦 LanguagePackService: Failed to delete existing pack ${packId}:`, deleteError);
            // Continue anyway - installation might still work
          }
        } else {
          console.log(`📦 LanguagePackService: Main pack ${packId} already installed - treating as successful completion`);
          
          // Create a successful completion notification for UI
          const completedDownload: LanguagePackDownload = {
            id: packId,
            status: 'completed',
            progress: 100,
            downloadedBytes: pack.totalSize,
            totalBytes: pack.totalSize,
            retryCount: 0,
            startedAt: new Date(),
            completedAt: new Date()
          };
          
          // Notify the progress callback that it's "completed"
          if (onProgress) {
            onProgress(completedDownload);
          }
          
          console.log(`📦 LanguagePackService: Sent completion notification for already-installed pack ${packId}`);
          return; // Return successfully without throwing
        }
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
      const isDirectSqlite = pack.downloadUrl.includes('wikdict.com') && urlExtension === 'sqlite3';
      
      // Update status and trigger initial UI update
      download.status = 'downloading';
      download.progress = 0;
      this.updateDownloadProgress(download);
      console.log(`📦 Download service: Initial download state set for ${pack.id}`);

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
          console.log(`📦 Calling UI progress callback for ${pack.id}...`);
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

      // Handle direct SQLite files vs ZIP extraction
      if (isDirectSqlite) {
        // Direct SQLite file - no extraction needed
        download.status = 'extracting';
        download.progress = 90;
        console.log(`📦 Download service: Direct SQLite file - no extraction needed for ${pack.id}`);
        this.updateDownloadProgress(download);
        
        await this.installDirectSqlite(pack, result.uri, download);
      } else {
        // ZIP file - needs extraction
        download.status = 'extracting';
        download.progress = 75;
        console.log(`📦 Download service: Status changed to extracting for ${pack.id}`);
        this.updateDownloadProgress(download);

        await this.verifyAndInstall(pack, result.uri, download);
      }

    } catch (error) {
      download.status = 'failed';
      download.error = String(error);
      this.updateDownloadProgress(download);
      
      console.error(`📦 LanguagePackService: Download failed for ${pack.id}:`, error);
      throw error;
    }
  }

  /**
   * Install direct SQLite file (WikiDict format)
   */
  private static async installDirectSqlite(
    pack: LanguagePackManifest,
    downloadedFile: string,
    download: LanguagePackDownload
  ): Promise<void> {
    try {
      console.log(`📦 LanguagePackService: Installing direct SQLite file ${pack.name}`);
      
      // Create installation directory
      const installDir = `${this.PACKS_DIRECTORY}${pack.id}/`;
      const dirInfo = await FileSystem.getInfoAsync(installDir);
      if (dirInfo.exists) {
        console.log(`📦 Removing existing installation directory: ${installDir}`);
        await FileSystem.deleteAsync(installDir, { idempotent: true });
      }
      
      await FileSystem.makeDirectoryAsync(installDir, { intermediates: true });
      console.log(`📦 Created install directory: ${installDir}`);

      // Copy SQLite file to installation directory
      const dictionaryPath = `${installDir}${pack.dictionary.filename}`;
      await FileSystem.copyAsync({
        from: downloadedFile,
        to: dictionaryPath
      });
      
      console.log(`📦 Copied SQLite file to: ${dictionaryPath}`);
      
      // Copy to expo-sqlite directory for access
      const sqliteDir = `${FileSystem.documentDirectory}SQLite/`;
      await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
      const sqliteDbPath = `${sqliteDir}${pack.dictionary.filename}`;
      
      await FileSystem.copyAsync({
        from: dictionaryPath,
        to: sqliteDbPath
      });
      
      console.log(`📦 Copied to SQLite directory: ${sqliteDbPath}`);
      
      // Validate database
      const fileInfo = await FileSystem.getInfoAsync(sqliteDbPath);
      console.log(`📦 Final database file info:`, fileInfo);
      
      // Create installed pack record
      const installedPack: InstalledLanguagePack = {
        id: pack.id,
        manifest: pack,
        installedAt: new Date(),
        dictionaryPath: dictionaryPath,
        mlKitStatus: {
          sourceToTarget: pack.mlKitSupport.sourceToTarget ? 'available' : 'error',
          targetToSource: pack.mlKitSupport.targetToSource ? 'available' : 'error'
        },
        dictionaryLookups: 0,
        translationCount: 0,
        totalUsageTime: 0
      };

      // Save to metadata
      await this.addInstalledPack(installedPack);

      // Clean up download file
      console.log(`📦 Cleaning up download file: ${downloadedFile}`);
      await FileSystem.deleteAsync(downloadedFile, { idempotent: true });

      // Mark as completed
      download.status = 'completed';
      download.progress = 100;
      download.completedAt = new Date();
      console.log(`📦 Direct SQLite installation completed for ${pack.id}`);
      this.updateDownloadProgress(download);

      console.log(`📦 LanguagePackService: Successfully installed ${pack.name}`);

      // Reload databases to pick up the new pack
      try {
        const SQLiteDictionaryService = (await import('./sqliteDictionaryService')).default;
        await SQLiteDictionaryService.reloadDatabases();
        console.log(`📦 Database reload completed for ${pack.id}`);
      } catch (error) {
        console.error(`📦 Failed to reload databases after installing ${pack.id}:`, error);
      }

      // Clean up tracking
      setTimeout(() => {
        this.activeDownloads.delete(pack.id);
        this.downloadCallbacks.delete(pack.id);
      }, 2000);

    } catch (error) {
      console.error(`📦 LanguagePackService: Direct SQLite installation failed for ${pack.id}:`, error);
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

      // Create installation directory (clean first to avoid conflicts)
      const installDir = `${this.PACKS_DIRECTORY}${pack.id}/`;
      
      // Remove existing directory if it exists to ensure clean install
      const dirInfo = await FileSystem.getInfoAsync(installDir);
      if (dirInfo.exists) {
        console.log(`📦 Removing existing installation directory: ${installDir}`);
        await FileSystem.deleteAsync(installDir, { idempotent: true });
      }
      
      await FileSystem.makeDirectoryAsync(installDir, { intermediates: true });
      console.log(`📦 Created clean install directory: ${installDir}`);

      // Extract/install dictionary (ML Kit models are handled separately)
      const dictionaryPath = `${installDir}${pack.dictionary.filename}`;
      const metadataPath1 = `${installDir}mlkit-${pack.sourceLanguage}-${pack.targetLanguage}.meta`;
      const metadataPath2 = `${installDir}mlkit-${pack.targetLanguage}-${pack.sourceLanguage}.meta`;
      
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
        
        // CRITICAL: Copy database to expo-sqlite's default location
        // expo-sqlite looks for databases in its own directory when using filename-only
        console.log(`📦 Step 0: Copying database to expo-sqlite default location...`);
        const sqliteDir = `${FileSystem.documentDirectory}SQLite/`;
        await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
        const sqliteDbPath = `${sqliteDir}${pack.dictionary.filename}`;
        
        console.log(`📦 Step 0: Copying from: ${dictionaryPath}`);
        console.log(`📦 Step 0: Copying to: ${sqliteDbPath}`);
        
        await FileSystem.copyAsync({
          from: dictionaryPath,
          to: sqliteDbPath
        });
        
        const copiedFileInfo = await FileSystem.getInfoAsync(sqliteDbPath);
        console.log(`📦 Step 0: ✅ Database copied to SQLite directory:`, copiedFileInfo);
        
        // Database validation - real data should be available from GitHub
        console.log(`📦 Validating downloaded database...`);
        console.log(`📦 Full database path: ${dictionaryPath}`);
        console.log(`📦 Database file size: ${dictFileInfo.size} bytes`);
        try {
          console.log(`📦 Step 1: Importing expo-sqlite module...`);
          const SQLite = await import('expo-sqlite');
          console.log(`📦 Step 1: ✅ SQLite module imported successfully`);
          
          // Use filename only (same as sqliteDictionaryService.ts) to avoid creating new empty database
          const dbName = pack.dictionary.filename;
          console.log(`📦 Step 2: Opening database with filename: ${dbName}`);
          console.log(`📦 Step 2: Current working directory context: ${FileSystem.documentDirectory}`);
          
          const db = await SQLite.openDatabaseAsync(dbName);
          console.log(`📦 Step 2: ✅ Database opened successfully`);
          console.log(`📦 Step 2: Database object type: ${typeof db}`);
          console.log(`📦 Step 2: Database object keys: ${Object.keys(db)}`);
          
          console.log(`📦 Step 3: Querying sqlite_master for table information...`);
          const tables = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'");
          console.log(`📦 Step 3: ✅ Query completed. Raw result:`, tables);
          console.log(`📦 Step 3: Available tables:`, tables.map(t => t.name));
          console.log(`📦 Step 3: Total tables found: ${tables.length}`);
          
          // Also check all objects in the database
          console.log(`📦 Step 4: Querying ALL database objects...`);
          const allObjects = await db.getAllAsync("SELECT name, type, sql FROM sqlite_master");
          console.log(`📦 Step 4: All database objects:`, allObjects);
          
          // Check database integrity
          console.log(`📦 Step 5: Checking database integrity...`);
          const integrityResult = await db.getAllAsync("PRAGMA integrity_check");
          console.log(`📦 Step 5: Integrity check result:`, integrityResult);
          
          // Check if database is read-only or has permissions issues
          console.log(`📦 Step 6: Checking database permissions...`);
          try {
            await db.getAllAsync("PRAGMA table_info(sqlite_master)");
            console.log(`📦 Step 6: ✅ Database is readable`);
          } catch (permError) {
            console.error(`📦 Step 6: ❌ Database permission error:`, permError);
          }
          
          // Check for both possible table schemas
          console.log(`📦 Step 7: Analyzing table schemas...`);
          if (tables.some(t => t.name === 'dict')) {
            console.log(`📦 Step 7: ✅ Found 'dict' table, querying count...`);
            const count = await db.getAllAsync('SELECT COUNT(*) as count FROM dict');
            console.log(`📦 Step 7: Dictionary database loaded successfully: ${count[0].count} entries (dict table)`);
            
            // Sample a few entries to verify content
            console.log(`📦 Step 7: Sampling entries from 'dict' table...`);
            const sample = await db.getAllAsync('SELECT lemma, def FROM dict LIMIT 3');
            console.log(`📦 Step 7: Sample entries:`, sample);
            
            // Check if this looks like test data vs real data
            if (count[0].count < 100) {
              console.warn(`📦 WARNING: Database has suspiciously few entries (${count[0].count}). This might be test data!`);
              console.warn(`📦 Expected 43,638 entries for Spanish-English dictionary`);
              console.warn(`📦 Database path: ${dictionaryPath}`);
              console.warn(`📦 File size: ${dictFileInfo.size} bytes`);
            }
            
            console.log(`📦 Step 8: Closing database connection...`);
            await db.closeAsync();
            console.log(`📦 Step 8: ✅ Database closed successfully`);
          } else if (tables.some(t => t.name === 'word')) {
            console.log(`📦 Step 7: ✅ Found 'word' table, querying count...`);
            const count = await db.getAllAsync('SELECT COUNT(*) as count FROM word');
            console.log(`📦 Step 7: Dictionary database loaded successfully: ${count[0].count} entries (word table)`);
            
            // Sample a few entries to verify content
            console.log(`📦 Step 7: Sampling entries from 'word' table...`);
            const sample = await db.getAllAsync('SELECT w, substr(m, 1, 100) FROM word LIMIT 3');
            console.log(`📦 Step 7: Sample entries:`, sample);
            
            console.log(`📦 Step 8: Closing database connection...`);
            await db.closeAsync();
            console.log(`📦 Step 8: ✅ Database closed successfully`);
          } else {
            console.warn(`📦 Step 7: ❌ No dict or word table found in database`);
            console.warn(`📦 Step 7: This indicates either:`);
            console.warn(`📦 Step 7: 1. Wrong database file opened`);
            console.warn(`📦 Step 7: 2. Database is empty/corrupted`);
            console.warn(`📦 Step 7: 3. expo-sqlite opened wrong file location`);
            
            console.log(`📦 Step 8: Closing database connection...`);
            await db.closeAsync();
            console.log(`📦 Step 8: ✅ Database closed successfully`);
          }
        } catch (validationError) {
          console.error(`📦 ❌ Database validation error at step:`, validationError);
          console.error(`📦 ❌ Error type:`, typeof validationError);
          console.error(`📦 ❌ Error message:`, validationError?.message || 'No message');
          console.error(`📦 ❌ Error stack:`, validationError?.stack || 'No stack');
          console.error(`📦 ❌ Full error object:`, JSON.stringify(validationError, null, 2));
          // Don't throw here - validation is optional, just log the warning
          console.warn(`📦 Warning: Database validation failed, but installation will continue`);
        }
        
      } catch (extractError) {
        console.error(`📦 ZIP extraction failed:`, extractError);
        throw new Error(`Failed to extract language pack: ${extractError}`);
      }
      
      download.progress = 90;
      console.log(`📦 Download service: Progress 90% for ${pack.id}`);
      this.updateDownloadProgress(download);
      
      // Note: Translation models are handled by ML Kit service automatically
      // Dictionary packs only contain SQLite database files for word lookup
      console.log(`📦 Language pack installation focuses on dictionary data only`);
      await FileSystem.writeAsStringAsync(metadataPath1, JSON.stringify({
        type: 'mlkit-metadata',
        sourceLanguage: pack.sourceLanguage,
        targetLanguage: pack.targetLanguage,
        supported: pack.mlKitSupport.sourceToTarget,
        estimatedSize: pack.mlKitSupport.downloadSize / 2
      }));
      await FileSystem.writeAsStringAsync(metadataPath2, JSON.stringify({
        type: 'mlkit-metadata',
        sourceLanguage: pack.targetLanguage,
        targetLanguage: pack.sourceLanguage,
        supported: pack.mlKitSupport.targetToSource,
        estimatedSize: pack.mlKitSupport.downloadSize / 2
      }));

      // Create installed pack record
      const installedPack: InstalledLanguagePack = {
        id: pack.id,
        manifest: pack,
        installedAt: new Date(),
        dictionaryPath: dictionaryPath,
        mlKitStatus: {
          sourceToTarget: pack.mlKitSupport.sourceToTarget ? 'available' : 'error',
          targetToSource: pack.mlKitSupport.targetToSource ? 'available' : 'error'
        },
        dictionaryLookups: 0,
        translationCount: 0,
        totalUsageTime: 0
      };

      // Save to metadata
      await this.addInstalledPack(installedPack);

      // Clean up download file
      console.log(`📦 Cleaning up download file: ${downloadedFile}`);
      await FileSystem.deleteAsync(downloadedFile, { idempotent: true });

      // Mark as completed and notify UI
      download.status = 'completed';
      download.progress = 100;
      download.completedAt = new Date();
      console.log(`📦 Download service: Completed ${pack.id} - notifying UI`);
      this.updateDownloadProgress(download);

      console.log(`📦 LanguagePackService: Successfully installed ${pack.name}`);

      // Reload databases to pick up the new pack
      try {
        const SQLiteDictionaryService = (await import('./sqliteDictionaryService')).default;
        await SQLiteDictionaryService.reloadDatabases();
        console.log(`📦 Database reload completed for ${pack.id}`);
      } catch (error) {
        console.error(`📦 Failed to reload databases after installing ${pack.id}:`, error);
      }

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
   * Delete a language pack and its companion pack (if any)
   */
  static async deletePackWithCompanion(packId: string): Promise<{ deletedPacks: string[], totalSize: number }> {
    try {
      console.log(`📦 LanguagePackService: Deleting pack with companion: ${packId}`);
      
      const installedPacks = await this.getInstalledPacks();
      const mainPack = installedPacks.find(p => p.id === packId);
      
      if (!mainPack) {
        throw new Error(`Pack ${packId} not found`);
      }
      
      const deletedPacks: string[] = [];
      let totalSize = 0;
      
      // Delete main pack
      await this.deletePack(packId);
      deletedPacks.push(packId);
      totalSize += mainPack.manifest.totalSize;
      
      // Delete companion pack if it exists
      const companionPackId = mainPack.manifest.companionPackId;
      if (companionPackId && await this.isPackInstalled(companionPackId)) {
        const companionPack = installedPacks.find(p => p.id === companionPackId);
        try {
          await this.deletePack(companionPackId);
          deletedPacks.push(companionPackId);
          if (companionPack) {
            totalSize += companionPack.manifest.totalSize;
          }
          console.log(`📦 LanguagePackService: Successfully deleted companion pack ${companionPackId}`);
        } catch (companionError) {
          console.error(`📦 LanguagePackService: Failed to delete companion pack ${companionPackId}:`, companionError);
          // Don't throw - main pack was deleted successfully
        }
      }
      
      console.log(`📦 LanguagePackService: Successfully deleted packs: ${deletedPacks.join(', ')}`);
      return { deletedPacks, totalSize };
      
    } catch (error) {
      console.error(`📦 LanguagePackService: Error deleting pack with companion ${packId}:`, error);
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