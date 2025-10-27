import { NativeModules } from 'react-native';
import { TranslationService, TranslateOpts, TranslationResult } from './types';

// ML Kit native module interface
interface MlkitTranslateModule {
  ensureModel(lang: string): Promise<void>;
  translate(text: string, from: string, to: string): Promise<string>;
  getInstalledModels(): Promise<string[]>;
  deleteModel(lang: string): Promise<void>;
}

const { MlkitTranslate } = NativeModules as { MlkitTranslate?: MlkitTranslateModule };

export const MlkitService: TranslationService = {
  async ensureModel(lang: string): Promise<void> {
    if (!MlkitTranslate) {
      throw new Error('ML Kit native module not available - ensure you are using Dev Client or production build');
    }
    
    // Call ahead of time from your Settings/UI; no-op if already present
    await MlkitTranslate.ensureModel(lang);
  },
  
  async translate(text: string, { from, to, timeoutMs = 8000 }: TranslateOpts): Promise<TranslationResult> {
    if (!MlkitTranslate) {
      throw new Error('ML Kit native module not available - ensure you are using Dev Client or production build');
    }
    
    const translatePromise: Promise<string> = MlkitTranslate.translate(text, from, to);
    
    // Optional timeout for UX parity with online service
    const timedPromise = new Promise<TranslationResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('Translation timeout')), timeoutMs);
      
      translatePromise
        .then((translatedText: string) => {
          clearTimeout(timeoutId);
          resolve({ text: translatedText });
        })
        .catch((error: any) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
    
    return timedPromise;
  },
};

// Additional ML Kit utilities for Dev/Release builds
export const MlkitUtils = {
  async getInstalledModels(): Promise<string[]> {
    if (!MlkitTranslate) {
      console.warn('ML Kit not available - returning empty model list');
      return [];
    }
    return MlkitTranslate.getInstalledModels();
  },
  
  async removeModel(lang: string): Promise<void> {
    if (!MlkitTranslate) {
      console.warn('ML Kit not available - cannot remove model');
      return;
    }
    return MlkitTranslate.deleteModel(lang);
  },
  
  isAvailable(): boolean {
    return !!MlkitTranslate;
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
  }
};