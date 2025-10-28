import * as FileSystem from 'expo-file-system/legacy';
import PackManager from './packManager';

// Centralized language code mappings
const LANGUAGE_MAPPINGS: Record<string, string> = {
  'es': 'spa',
  'fr': 'fra', 
  'de': 'deu',
  'it': 'ita',
  'pt': 'por',
  'en': 'eng'
};

const getLanguageCode = (code: string): string => LANGUAGE_MAPPINGS[code] || code;

/**
 * Language Pack Manager
 * 
 * Manages download and installation of StarDict language packs
 * for offline bilingual dictionary functionality
 */
export class LanguagePackManager {
  private static readonly PACKS_DIR = `${FileSystem.documentDirectory}SQLite/`;
  // Use relative URL for development, can be configured for production
  private static readonly REGISTRY_URL = '/dictionaries/package-registry.json';
  
  // Use PackManager for modern GitHub-hosted packs

  /**
   * Initialize language pack directory
   */
  static async initialize(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.PACKS_DIR);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.PACKS_DIR, { intermediates: true });
        console.log('📁 Created language packs directory');
      }
      
      console.log('📦 LanguagePackManager initialized');
    } catch (error) {
      console.error('📦 Failed to initialize LanguagePackManager:', error);
      throw error;
    }
  }

  /**
   * Get language pack registry (delegates to PackManager)
   */
  static async getRegistry(): Promise<Record<string, any>> {
    try {
      console.log('📡 Fetching language pack registry...');
      
      // Use PackManager for GitHub-hosted packs
      const packs = await PackManager.getAvailablePacks();
      const registry: Record<string, any> = {};
      
      // Convert language codes from pack IDs (eng-spa -> en, spa-eng -> es)
      for (const pack of packs) {
        if (pack.id.includes('-')) {
          const [source, target] = pack.id.split('-');
          const langCode = source === 'eng' ? 'en' : source === 'spa' ? 'es' : source === 'fra' ? 'fr' : source === 'deu' ? 'de' : source;
          
          registry[langCode] = {
            url: pack.url,
            description: pack.source,
            size: pack.bytes,
            entries: pack.id.includes('eng-spa') ? '60,000+' : pack.id.includes('spa-eng') ? '4,500+' : 'Unknown'
          };
        }
      }
      
      console.log('📡 Retrieved registry from PackManager');
      return registry;
      
    } catch (error) {
      console.log('📡 PackManager registry failed, using empty registry');
      return {};
    }
  }

  /**
   * Get registry for specific languages only
   */
  static async getLanguageRegistry(languages: string[]): Promise<Record<string, any>> {
    const fullRegistry = await this.getRegistry();
    const filteredRegistry: Record<string, any> = {};
    
    languages.forEach(lang => {
      if (fullRegistry[lang]) {
        filteredRegistry[lang] = fullRegistry[lang];
      }
    });
    
    console.log(`📚 Filtered registry for languages: ${languages.join(', ')}`);
    return filteredRegistry;
  }

  /**
   * Check if language pack is installed
   */
  static async isLanguagePackInstalled(languageCode: string): Promise<boolean> {
    // Convert language code to pack ID format for bilingual packs
    const mappedCode = getLanguageCode(languageCode);
    const packIds = [
      `eng-${mappedCode}`,
      `${mappedCode}-eng`
    ];
    
    // Check if any pack for this language is installed
    for (const packId of packIds) {
      if (await PackManager.isPackInstalled(packId)) {
        return true;
      }
    }
    
    return false;
  }


  /**
   * Download and install language pack
   */
  static async downloadLanguagePack(
    languageCode: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    try {
      console.log(`📦 Downloading language pack: ${languageCode}`);
      
      await this.initialize();
      
      // Check if already exists
      if (await this.isLanguagePackInstalled(languageCode)) {
        console.log(`📦 Language pack already installed: ${languageCode}`);
        return true;
      }

      // Determine pack ID based on language code
      const mappedCode = getLanguageCode(languageCode);
      const packId = languageCode === 'en' ? 'eng-spa' : // Default English pack
                     `${mappedCode}-eng`; // Standard format for other languages
      
      if (!packId) {
        throw new Error(`Language pack not available: ${languageCode}`);
      }

      // Use PackManager to download and install
      console.log(`📥 Downloading pack: ${packId}`);
      
      await PackManager.ensureSqlitePack(
        packId,
        (progress, status) => {
          if (onProgress) {
            onProgress(progress);
          }
          console.log(`📦 ${status} (${progress}%)`);
        }
      );

      console.log(`✅ Successfully downloaded and processed language pack: ${languageCode}`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to download language pack ${languageCode}:`, error);
      return false;
    }
  }


  /**
   * Download complete language pair (dictionaries only)
   */
  static async downloadLanguagePair(
    homeLanguage: string,
    targetLanguage: string,
    onProgress?: (step: string, progress: number) => void
  ): Promise<boolean> {
    try {
      console.log(`📚 Setting up language pair: ${homeLanguage} ↔ ${targetLanguage}`);

      // Step 1: Download home language dictionary
      onProgress?.('Downloading home language dictionary...', 0);
      const homePackSuccess = await this.downloadLanguagePack(homeLanguage, (progress) => {
        onProgress?.('Downloading home language dictionary...', Math.round(progress / 2));
      });

      if (!homePackSuccess) {
        throw new Error(`Failed to download ${homeLanguage} dictionary`);
      }

      // Step 2: Download target language dictionary
      onProgress?.('Downloading target language dictionary...', 50);
      const targetPackSuccess = await this.downloadLanguagePack(targetLanguage, (progress) => {
        onProgress?.('Downloading target language dictionary...', 50 + Math.round(progress / 2));
      });

      if (!targetPackSuccess) {
        throw new Error(`Failed to download ${targetLanguage} dictionary`);
      }

      onProgress?.('Setup complete!', 100);
      console.log(`✅ Language pair setup complete: ${homeLanguage} ↔ ${targetLanguage}`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to setup language pair ${homeLanguage} ↔ ${targetLanguage}:`, error);
      return false;
    }
  }

  /**
   * Delete language pack
   */
  static async deleteLanguagePack(languageCode: string): Promise<boolean> {
    const mappedCode = getLanguageCode(languageCode);
    const packId = languageCode === 'en' ? 'eng-spa' : // Default English pack
                   `${mappedCode}-eng`; // Standard format for other languages
    
    if (!packId) {
      return false;
    }
    
    return await PackManager.removePack(packId);
  }

  /**
   * Remove language pack (alias for deleteLanguagePack)
   */
  static async removeLanguagePack(languageCode: string): Promise<boolean> {
    return await this.deleteLanguagePack(languageCode);
  }

  /**
   * Get installed language packs
   */
  static async getInstalledLanguages(): Promise<string[]> {
    try {
      await this.initialize();
      
      const installedPacks = await PackManager.getInstalledPacks();
      const languages: string[] = [];
      
      // Convert pack IDs back to language codes
      for (const packId of installedPacks) {
        if (packId.includes('-')) {
          const [source, target] = packId.split('-');
          
          // Add source language
          if (source === 'eng') languages.push('en');
          else if (source === 'spa') languages.push('es');
          else if (source === 'fra') languages.push('fr');
          else if (source === 'deu') languages.push('de');
          
          // Add target language
          if (target === 'eng') languages.push('en');
          else if (target === 'spa') languages.push('es');
          else if (target === 'fra') languages.push('fr');
          else if (target === 'deu') languages.push('de');
        }
      }
      
      // Remove duplicates
      return [...new Set(languages)];
    } catch (error) {
      console.error('Failed to get installed languages:', error);
      return [];
    }
  }

  /**
   * Get storage usage information
   */
  static async getStorageInfo(): Promise<{
    totalSize: number;
    languagePacks: Array<{ language: string; size: number }>;
  }> {
    try {
      await this.initialize();
      
      const storageInfo = await PackManager.getStorageInfo();
      const languagePacks = [];
      
      // Convert pack IDs to language codes
      for (const pack of storageInfo.packs) {
        if (pack.id.includes('-')) {
          const [source, target] = pack.id.split('-');
          const langCode = source === 'eng' ? 'en' : source === 'spa' ? 'es' : source === 'fra' ? 'fr' : source === 'deu' ? 'de' : source;
          
          languagePacks.push({
            language: langCode,
            size: pack.size
          });
        }
      }

      return { 
        totalSize: storageInfo.totalSize, 
        languagePacks 
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return { totalSize: 0, languagePacks: [] };
    }
  }

}

export default LanguagePackManager;