import * as FileSystem from 'expo-file-system/legacy';
import { unzipSync } from 'fflate';
import { ErrorHandler, ErrorCode, Validator } from './errorHandling';

/**
 * Pack Manager - Pure JS dictionary pack download and extraction
 * Works in Expo Go, no native linking required
 */

const PACKS_DIR = `${FileSystem.documentDirectory}packs/`;
const CACHE_DIR = `${FileSystem.cacheDirectory}`;

// GitHub repository for dictionary packs
const GITHUB_REPO = 'kayvangharbi/PolyBook';
const REGISTRY_URL = `https://github.com/${GITHUB_REPO}/releases/download/packs/registry.json`;

interface PackRegistry {
  version: string;
  baseUrl: string;
  packs: Record<string, {
    url: string;
    bytes: number;
    sha256: string;
    license: string;
    source: string;
  }>;
}

interface PackInfo {
  id: string;
  url: string;
  bytes: number;
  sha256: string;
  license: string;
  source: string;
}

// Helper functions for base64 ↔ Uint8Array conversion with error handling
const toU8 = (b64: string): Uint8Array => {
  if (!Validator.isValidBase64(b64)) {
    throw new Error('Invalid base64 format');
  }
  
  try {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  } catch (error) {
    ErrorHandler.logError(error as Error, 'PackManager', { function: 'toU8', input: 'base64 string' });
    throw new Error('Invalid base64 format');
  }
};

const toB64 = (u8: Uint8Array): string => {
  try {
    return btoa(String.fromCharCode(...u8));
  } catch (error) {
    console.error('Failed to convert Uint8Array to base64:', error);
    throw new Error('Failed to encode to base64');
  }
};

export class PackManager {
  private static registry: PackRegistry | null = null;

  /**
   * Initialize pack manager
   */
  static async initialize(): Promise<void> {
    try {
      await FileSystem.makeDirectoryAsync(PACKS_DIR, { intermediates: true });
      console.log('📦 PackManager initialized');
    } catch (error) {
      console.error('📦 PackManager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Fetch registry from GitHub
   */
  static async fetchRegistry(): Promise<PackRegistry> {
    if (this.registry) {
      return this.registry;
    }

    try {
      console.log('📡 Fetching pack registry from GitHub...');
      const response = await fetch(REGISTRY_URL);
      
      if (!response.ok) {
        throw new Error(`Registry fetch failed: ${response.status}`);
      }
      
      this.registry = await response.json();
      console.log(`📡 Registry loaded: ${Object.keys(this.registry!.packs).length} packs available`);
      return this.registry!;
      
    } catch (error) {
      console.error('📡 Failed to fetch registry:', error);
      
      // Fallback registry for development
      console.log('📡 Using fallback registry');
      this.registry = {
        version: 'fallback',
        baseUrl: '',
        packs: {
          'eng-spa': {
            url: 'https://github.com/kvgharbigit/polybook/releases/download/packs/eng-spa.sqlite.zip',
            bytes: 1200000,
            sha256: 'placeholder',
            license: 'Wiktionary',
            source: 'Wiktionary'
          },
          'spa-eng': {
            url: 'https://github.com/kvgharbigit/polybook/releases/download/packs/spa-eng.sqlite.zip',
            bytes: 1200000,
            sha256: 'placeholder',
            license: 'Wiktionary',
            source: 'Wiktionary'
          }
        }
      };
      return this.registry!;
    }
  }

  /**
   * Get pack info by ID
   */
  static async getPackInfo(packId: string): Promise<PackInfo | null> {
    const registry = await this.fetchRegistry();
    const pack = registry.packs[packId];
    
    if (!pack) {
      return null;
    }
    
    return {
      id: packId,
      ...pack
    };
  }

  /**
   * Check if pack is installed
   */
  static async isPackInstalled(packId: string): Promise<boolean> {
    try {
      const packPath = `${PACKS_DIR}${packId}.sqlite`;
      const info = await FileSystem.getInfoAsync(packPath);
      return info.exists && info.size! > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get installed pack path
   */
  static getPackPath(packId: string): string {
    return `${PACKS_DIR}${packId}.sqlite`;
  }

  /**
   * Download and install pack (pure JS, Expo-friendly)
   */
  static async ensureSqlitePack(
    packId: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<string> {
    const packPath = this.getPackPath(packId);
    
    // Check if already installed
    if (await this.isPackInstalled(packId)) {
      console.log(`📦 Pack already installed: ${packId}`);
      onProgress?.(100, 'Pack ready!');
      return packPath;
    }

    const packInfo = await this.getPackInfo(packId);
    if (!packInfo) {
      throw new Error(`Pack not found: ${packId}`);
    }

    await this.initialize();

    // Handle different URL formats
    if (packInfo.url.endsWith('.sqlite.zip')) {
      return await this.downloadSqliteZip(packInfo, onProgress);
    } else if (packInfo.url.endsWith('.tar.xz')) {
      // For development: create placeholder until GitHub CI builds the .sqlite.zip files
      console.log(`⚠️ .tar.xz not supported in app, creating placeholder for ${packId}`);
      return await this.createPlaceholderPack(packId, onProgress);
    } else {
      throw new Error(`Unsupported pack format: ${packInfo.url}`);
    }
  }

  /**
   * Download and extract .sqlite.zip pack
   */
  private static async downloadSqliteZip(
    packInfo: PackInfo,
    onProgress?: (progress: number, status: string) => void
  ): Promise<string> {
    const packPath = this.getPackPath(packInfo.id);
    const tmpZip = `${CACHE_DIR}${packInfo.id}.zip`;

    try {
      onProgress?.(0, 'Downloading pack...');

      // Download ZIP
      const downloadResult = await FileSystem.downloadAsync(packInfo.url, tmpZip, {
        // @ts-ignore
        resumable: false,
        progress: (downloadInfo: any) => {
          const progress = (downloadInfo.totalBytesWritten / downloadInfo.totalBytesExpectedToWrite) * 70;
          onProgress?.(Math.round(progress), 'Downloading pack...');
        }
      });

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed: ${downloadResult.status}`);
      }

      onProgress?.(70, 'Extracting pack...');

      // Read and extract ZIP
      const b64 = await FileSystem.readAsStringAsync(tmpZip, { 
        encoding: FileSystem.EncodingType.Base64 
      });
      
      const zipBytes = toU8(b64);
      const entries = unzipSync(zipBytes);
      
      // Find SQLite file
      const sqliteEntry = Object.keys(entries).find(k => k.endsWith('.sqlite'));
      if (!sqliteEntry) {
        throw new Error('ZIP missing .sqlite file');
      }

      // Write SQLite file
      const sqliteBytes = entries[sqliteEntry];
      await FileSystem.writeAsStringAsync(packPath, toB64(sqliteBytes), {
        encoding: FileSystem.EncodingType.Base64
      });

      // Verify file
      const info = await FileSystem.getInfoAsync(packPath);
      if (!info.exists || info.size === 0) {
        throw new Error('Pack extraction failed');
      }

      // Cleanup
      await FileSystem.deleteAsync(tmpZip, { idempotent: true });

      onProgress?.(100, 'Pack ready!');
      console.log(`✅ Installed pack: ${packInfo.id} (${Math.round(info.size! / 1024)}KB)`);
      
      return packPath;

    } catch (error) {
      // Cleanup on error
      await FileSystem.deleteAsync(tmpZip, { idempotent: true });
      await FileSystem.deleteAsync(packPath, { idempotent: true });
      
      console.error(`❌ Pack installation failed: ${packInfo.id}`, error);
      throw error;
    }
  }

  /**
   * Create placeholder pack for development
   */
  private static async createPlaceholderPack(
    packId: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<string> {
    const packPath = this.getPackPath(packId);
    
    onProgress?.(50, 'Creating placeholder pack...');
    
    // For now, use the enhanced fallback from StarDictProcessor
    const { StarDictProcessor } = await import('./starDictProcessor');
    await StarDictProcessor.createEnhancedDatabase(packPath, packId, 'placeholder', onProgress);
    
    onProgress?.(100, 'Placeholder pack ready!');
    return packPath;
  }

  /**
   * Remove pack
   */
  static async removePack(packId: string): Promise<boolean> {
    try {
      const packPath = this.getPackPath(packId);
      await FileSystem.deleteAsync(packPath, { idempotent: true });
      console.log(`🗑️ Removed pack: ${packId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to remove pack ${packId}:`, error);
      return false;
    }
  }

  /**
   * Get installed packs
   */
  static async getInstalledPacks(): Promise<string[]> {
    try {
      await this.initialize();
      const files = await FileSystem.readDirectoryAsync(PACKS_DIR);
      return files
        .filter(file => file.endsWith('.sqlite'))
        .map(file => file.replace('.sqlite', ''));
    } catch (error) {
      console.error('Failed to get installed packs:', error);
      return [];
    }
  }

  /**
   * Get storage info
   */
  static async getStorageInfo(): Promise<{
    totalSize: number;
    packs: Array<{ id: string; size: number }>;
  }> {
    try {
      await this.initialize();
      const files = await FileSystem.readDirectoryAsync(PACKS_DIR);
      const packs = [];
      let totalSize = 0;

      for (const file of files) {
        if (file.endsWith('.sqlite')) {
          const filePath = `${PACKS_DIR}${file}`;
          const info = await FileSystem.getInfoAsync(filePath);
          
          if (info.exists && info.size) {
            const packId = file.replace('.sqlite', '');
            packs.push({ id: packId, size: info.size });
            totalSize += info.size;
          }
        }
      }

      return { totalSize, packs };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return { totalSize: 0, packs: [] };
    }
  }

  /**
   * Get available packs from registry
   */
  static async getAvailablePacks(): Promise<PackInfo[]> {
    const registry = await this.fetchRegistry();
    return Object.entries(registry.packs).map(([id, pack]) => ({
      id,
      ...pack
    }));
  }
}

export default PackManager;