import { NativeModules } from 'react-native';
import { TranslationService, TranslateOpts, TranslationResult } from './types';
import { canUseMLKit, hasMlkitNativeModule, getBuildKind, logEnvForDebug, getMLKitBlockReason } from '../utils/buildEnv';

// ML Kit native module interface
interface MlkitTranslateModule {
  ensureModel(lang: string): Promise<void>;
  translate(text: string, from: string, to: string): Promise<string>;
  getInstalledModels(): Promise<string[]>;
  deleteModel(lang: string): Promise<void>;
}

const { MlkitTranslate } = NativeModules as { MlkitTranslate?: MlkitTranslateModule };

// Enhanced logging for diagnostics
console.log('🤖 MLKit: Module loading diagnostics');
logEnvForDebug();

export const MlkitService: TranslationService = {
  async ensureModel(lang: string): Promise<void> {
    console.log(`🤖 MLKit: ensureModel called for language: ${lang}`);
    
    if (!canUseMLKit()) {
      const reason = getMLKitBlockReason();
      console.error('🤖 MLKit: ❌ Cannot use MLKit:', reason);
      throw new Error(reason);
    }
    
    console.log(`🤖 MLKit: ✅ MLKit available, ensuring model for ${lang}`);
    
    try {
      if (MlkitTranslate && MlkitTranslate.ensureModel) {
        await MlkitTranslate.ensureModel(lang);
        console.log(`🤖 MLKit: ✅ Model ensured for ${lang}`);
        return;
      }
      
      throw new Error('No MLKit download method available');
    } catch (error) {
      console.error(`🤖 MLKit: ❌ Failed to ensure model for ${lang}:`, error);
      throw error;
    }
  },
  
  async translate(text: string, { from, to, timeoutMs = 8000 }: TranslateOpts): Promise<TranslationResult> {
    console.log(`🤖 MLKit: translate called - "${text.substring(0, 50)}..." from ${from} to ${to}`);
    
    if (!canUseMLKit()) {
      const reason = getMLKitBlockReason();
      console.error('🤖 MLKit: ❌ Cannot use MLKit for translation:', reason);
      throw new Error(reason);
    }
    
    console.log(`🤖 MLKit: ✅ MLKit available, starting translation`);
    
    let translatePromise: Promise<string>;
    
    if (MlkitTranslate && MlkitTranslate.translate) {
      translatePromise = MlkitTranslate.translate(text, from, to);
    } else {
      throw new Error('No MLKit translate method available');
    }
    
    // Optional timeout for UX parity with online service
    const timedPromise = new Promise<TranslationResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        console.error(`🤖 MLKit: ❌ Translation timeout after ${timeoutMs}ms`);
        reject(new Error('Translation timeout'));
      }, timeoutMs);
      
      translatePromise
        .then((translatedText: string) => {
          clearTimeout(timeoutId);
          console.log(`🤖 MLKit: ✅ Translation successful: "${translatedText.substring(0, 50)}..."`);
          resolve({ text: translatedText });
        })
        .catch((error: any) => {
          clearTimeout(timeoutId);
          console.error('🤖 MLKit: ❌ Translation failed:', error);
          reject(error);
        });
    });
    
    return timedPromise;
  },
};

// Additional ML Kit utilities for Dev/Release builds
export const MlkitUtils = {
  async getInstalledModels(): Promise<string[]> {
    console.log('🤖 MLKit: getInstalledModels called');
    
    if (!canUseMLKit()) {
      console.warn('🤖 MLKit: Not available for installed models check - returning empty list');
      return [];
    }
    
    try {
      if (MlkitTranslate && MlkitTranslate.getInstalledModels) {
        const models = await MlkitTranslate.getInstalledModels();
        console.log('🤖 MLKit: Installed models:', models);
        return models;
      }
      
      console.warn('🤖 MLKit: No getInstalledModels method available');
      return [];
    } catch (error) {
      console.error('🤖 MLKit: Error getting installed models:', error);
      return [];
    }
  },
  
  async removeModel(lang: string): Promise<void> {
    console.log(`🤖 MLKit: removeModel called for: ${lang}`);
    
    if (!canUseMLKit()) {
      console.warn('🤖 MLKit: Not available for model removal');
      return;
    }
    
    try {
      if (MlkitTranslate && MlkitTranslate.deleteModel) {
        await MlkitTranslate.deleteModel(lang);
        console.log(`🤖 MLKit: Model ${lang} removed successfully`);
        return;
      }
      
      console.warn('🤖 MLKit: No deleteModel method available');
    } catch (error) {
      console.error(`🤖 MLKit: Error removing model ${lang}:`, error);
      throw error;
    }
  },
  
  isAvailable(): boolean {
    const available = canUseMLKit();
    console.log('🤖 MLKit: isAvailable check:', available);
    return available;
  },
  
  // Get supported language pairs for ML Kit
  getSupportedLanguages(): string[] {
    // ML Kit supports these language codes
    return [
      'af', 'ar', 'be', 'bg', 'bn', 'ca', 'cs', 'cy', 'da', 'de', 
      'el', 'en', 'eo', 'es', 'et', 'fa', 'fi', 'fr', 'ga', 'gl',
      'gu', 'he', 'hi', 'hr', 'hu', 'id', 'is', 'it', 'ja', 'ka',
      'kn', 'ko', 'lt', 'lv', 'mk', 'mr', 'ms', 'mt', 'nl', 'no',
      'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sq', 'sv', 'sw', 'ta',
      'te', 'th', 'tl', 'tr', 'uk', 'ur', 'vi', 'zh'
    ];
  },

  // Language pair functionality
  async ensureLanguagePair(sourceLanguage: string, targetLanguage: string): Promise<{ installed: string[]; newlyDownloaded: string[] }> {
    console.log(`🤖 MLKit: ensureLanguagePair called for ${sourceLanguage} ↔ ${targetLanguage}`);
    
    if (!canUseMLKit()) {
      const reason = getMLKitBlockReason();
      console.error('🤖 MLKit: ❌ Cannot use MLKit for language pair:', reason);
      throw new Error(reason);
    }

    const languages = [sourceLanguage, targetLanguage];
    const installedModels = await this.getInstalledModels();
    const missing: string[] = [];
    const alreadyInstalled: string[] = [];

    // Check which models are missing
    for (const lang of languages) {
      if (installedModels.includes(lang)) {
        alreadyInstalled.push(lang);
      } else {
        missing.push(lang);
      }
    }

    console.log(`🤖 MLKit: Language pair status - Already installed: [${alreadyInstalled.join(', ')}], Missing: [${missing.join(', ')}]`);

    // Download missing models
    const newlyDownloaded: string[] = [];
    for (const lang of missing) {
      try {
        console.log(`🤖 MLKit: Downloading ${lang} model...`);
        await MlkitService.ensureModel(lang);
        newlyDownloaded.push(lang);
        console.log(`🤖 MLKit: ✅ ${lang} model downloaded successfully`);
      } catch (error) {
        console.error(`🤖 MLKit: ❌ Failed to download ${lang} model:`, error);
        throw new Error(`Failed to download ${lang} model: ${error.message}`);
      }
    }

    return { 
      installed: languages, 
      newlyDownloaded 
    };
  },

  async isLanguagePairReady(sourceLanguage: string, targetLanguage: string): Promise<boolean> {
    console.log(`🤖 MLKit: Checking if language pair ${sourceLanguage} ↔ ${targetLanguage} is ready`);
    
    if (!canUseMLKit()) {
      return false;
    }

    try {
      const installedModels = await this.getInstalledModels();
      const hasSource = installedModels.includes(sourceLanguage);
      const hasTarget = installedModels.includes(targetLanguage);
      
      console.log(`🤖 MLKit: Language pair ready status - ${sourceLanguage}: ${hasSource}, ${targetLanguage}: ${hasTarget}`);
      return hasSource && hasTarget;
    } catch (error) {
      console.error('🤖 MLKit: Error checking language pair readiness:', error);
      return false;
    }
  }
};