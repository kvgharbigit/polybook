import { postTranslate } from './TranslatorHost';

export type BergamotTranslationResponse = {
  success: boolean;
  translatedText?: string;
  qualityHint?: number | null; // logProb/length, ~[-10..0], closer to 0 is "better"
  error?: string;
};

export interface TranslateOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

class BergamotTranslationService {
  private static initialized = false;
  
  // 8 languages with Bergamot model support
  private static bergamotLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'hi'];
  
  // All 12 languages in the app (8 Bergamot + 4 unsupported)
  private static allLanguages = ['en', 'es', 'zh', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'ar', 'hi'];
  
  // Direct Bergamot model pairs available
  private static directPairs = [
    'en-es', 'en-fr', 'en-de', 'en-it', 'en-pt', 'en-ru', 'en-hi',
    'es-en', 'fr-en', 'de-en', 'it-en', 'pt-en', 'ru-en', 'hi-en'
  ];

  /**
   * Initialize Bergamot translation service
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('🌐 Initializing multi-language Bergamot service...');
      console.log(`🌐 Direct support: ${this.bergamotLanguages.length} languages`);
      console.log(`🌐 Via English hub: ${this.getViEnglishPairs().length} pairs`);
      
      // The actual initialization happens in TranslatorHost
      this.initialized = true;
      console.log('🌐 Multi-language Bergamot service ready');
      
    } catch (error) {
      console.error('🌐 Failed to initialize Bergamot:', error);
      throw error;
    }
  }

  /**
   * Check if language pair is supported (directly or via English)
   */
  static isLanguagePairSupported(sourceLanguage: string, targetLanguage: string): boolean {
    if (sourceLanguage === targetLanguage) return false;
    
    // Check direct support
    if (this.hasDirectSupport(sourceLanguage, targetLanguage)) {
      return true;
    }
    
    // Check via English hub
    if (this.hasViEnglishSupport(sourceLanguage, targetLanguage)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if direct Bergamot model exists
   */
  static hasDirectSupport(sourceLanguage: string, targetLanguage: string): boolean {
    const pair = `${sourceLanguage}-${targetLanguage}`;
    return this.directPairs.includes(pair);
  }

  /**
   * Check if translation possible via English hub
   */
  static hasViEnglishSupport(sourceLanguage: string, targetLanguage: string): boolean {
    // Both languages must be supported by Bergamot
    const sourceToBergamot = this.bergamotLanguages.includes(sourceLanguage);
    const targetFromBergamot = this.bergamotLanguages.includes(targetLanguage);
    
    // Need paths: source→en and en→target
    const sourceToEn = sourceLanguage === 'en' || this.directPairs.includes(`${sourceLanguage}-en`);
    const enToTarget = targetLanguage === 'en' || this.directPairs.includes(`en-${targetLanguage}`);
    
    return sourceToBergamot && targetFromBergamot && sourceToEn && enToTarget;
  }

  /**
   * Get all supported language pairs
   */
  static getViEnglishPairs(): Array<{source: string, target: string, method: 'direct' | 'via-english'}> {
    const pairs = [];
    
    // Direct pairs
    this.directPairs.forEach(pair => {
      const [source, target] = pair.split('-');
      pairs.push({ source, target, method: 'direct' });
    });
    
    // Via English pairs
    this.bergamotLanguages.forEach(source => {
      this.bergamotLanguages.forEach(target => {
        if (source !== target && source !== 'en' && target !== 'en') {
          // Check if we have both directions through English
          const sourceToEn = this.directPairs.includes(`${source}-en`);
          const enToTarget = this.directPairs.includes(`en-${target}`);
          
          if (sourceToEn && enToTarget) {
            pairs.push({ source, target, method: 'via-english' });
          }
        }
      });
    });
    
    return pairs;
  }

  /**
   * Translate sentence using Bergamot WASM (direct or via English)
   */
  static async translateSentence(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    options: TranslateOptions = {}
  ): Promise<BergamotTranslationResponse> {
    try {
      await this.initialize();

      if (!this.isLanguagePairSupported(sourceLanguage, targetLanguage)) {
        return {
          success: false,
          error: `Language pair not supported: ${sourceLanguage} → ${targetLanguage}`
        };
      }

      console.log(`🌐 Translating: "${text}" (${sourceLanguage} → ${targetLanguage})`);

      // Check if direct translation is available
      if (this.hasDirectSupport(sourceLanguage, targetLanguage)) {
        return await this.translateDirect(text, sourceLanguage, targetLanguage, options);
      }
      
      // Use via-English translation
      if (this.hasViEnglishSupport(sourceLanguage, targetLanguage)) {
        return await this.translateViaEnglish(text, sourceLanguage, targetLanguage, options);
      }

      return {
        success: false,
        error: `No translation path available for ${sourceLanguage} → ${targetLanguage}`
      };

    } catch (error) {
      console.error('🌐 Bergamot translation failed:', error);
      return {
        success: false,
        error: `Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Direct translation using available model
   */
  private static async translateDirect(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    options: TranslateOptions = {}
  ): Promise<BergamotTranslationResponse> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    try {
      console.log(`🔗 Direct: ${sourceLanguage} → ${targetLanguage}`);
      
      const translatedText = await postTranslate(
        { id, text, from: sourceLanguage, to: targetLanguage }, 
        options.timeoutMs ?? 5000
      );

      return {
        success: true,
        translatedText,
        qualityHint: null // Populated by WebView
      };

    } catch (error) {
      if (options.signal?.aborted) {
        return { success: false, error: 'Translation cancelled' };
      }

      return {
        success: false,
        error: `Direct translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Two-step translation via English hub
   */
  private static async translateViaEnglish(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    options: TranslateOptions = {}
  ): Promise<BergamotTranslationResponse> {
    console.log(`🔄 Via English: ${sourceLanguage} → en → ${targetLanguage}`);
    
    try {
      // Step 1: Source → English
      const step1 = await this.translateDirect(text, sourceLanguage, 'en', {
        ...options,
        timeoutMs: (options.timeoutMs ?? 5000) / 2 // Split timeout
      });

      if (!step1.success || !step1.translatedText) {
        return {
          success: false,
          error: `Step 1 failed (${sourceLanguage} → en): ${step1.error}`
        };
      }

      // Step 2: English → Target
      const step2 = await this.translateDirect(step1.translatedText, 'en', targetLanguage, {
        ...options,
        timeoutMs: (options.timeoutMs ?? 5000) / 2
      });

      if (!step2.success || !step2.translatedText) {
        return {
          success: false,
          error: `Step 2 failed (en → ${targetLanguage}): ${step2.error}`
        };
      }

      return {
        success: true,
        translatedText: step2.translatedText,
        qualityHint: step2.qualityHint ? step2.qualityHint - 0.5 : null // Slightly lower quality for 2-step
      };

    } catch (error) {
      return {
        success: false,
        error: `Via-English translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Translate multiple sentences with batching
   */
  static async translateSentences(
    sentences: string[],
    sourceLanguage: string,
    targetLanguage: string,
    options: TranslateOptions = {}
  ): Promise<BergamotTranslationResponse[]> {
    const results: BergamotTranslationResponse[] = [];
    
    for (const sentence of sentences) {
      if (options.signal?.aborted) {
        results.push({
          success: false,
          error: 'Translation cancelled'
        });
        continue;
      }

      const result = await this.translateSentence(sentence, sourceLanguage, targetLanguage, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Split text into sentences for better translation quality
   */
  static splitSentences(text: string): string[] {
    // Use Intl.Segmenter if available (modern browsers/WebView)
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const segmenter = new (Intl as any).Segmenter(undefined, { granularity: 'sentence' });
      return Array.from(segmenter.segment(text))
        .map((segment: any) => segment.segment.trim())
        .filter(Boolean);
    }
    
    // Fallback for older environments
    return text.split(/([.!?]+["')\]]?\s+)/)
      .reduce((acc, current, index, array) => {
        if (index % 2 === 0) {
          const sentence = (current + (array[index + 1] || '')).trim();
          if (sentence) acc.push(sentence);
        }
        return acc;
      }, [] as string[])
      .filter(Boolean);
  }

  /**
   * Get available language pairs (direct + via English)
   */
  static getAvailableLanguagePairs(): Array<{source: string, target: string, method: 'direct' | 'via-english'}> {
    return this.getViEnglishPairs();
  }

  /**
   * Check if service is ready
   */
  static isReady(): boolean {
    return this.initialized;
  }

  /**
   * Get service info
   */
  static getServiceInfo(): {
    name: string;
    version: string;
    bergamotLanguages: string[];
    allLanguages: string[];
    directPairs: number;
    viaEnglishPairs: number;
    totalPairs: number;
    isWebViewBased: boolean;
  } {
    const allPairs = this.getAvailableLanguagePairs();
    const directCount = allPairs.filter(p => p.method === 'direct').length;
    const viaEnglishCount = allPairs.filter(p => p.method === 'via-english').length;
    
    return {
      name: 'Multi-Language Bergamot Translation Service',
      version: '2.0.0-multilang',
      bergamotLanguages: this.bergamotLanguages,
      allLanguages: this.allLanguages,
      directPairs: directCount,
      viaEnglishPairs: viaEnglishCount,
      totalPairs: allPairs.length,
      isWebViewBased: true
    };
  }
}

export default BergamotTranslationService;