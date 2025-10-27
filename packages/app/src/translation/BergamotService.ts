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
  private static supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt'];

  /**
   * Initialize Bergamot translation service
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('🌐 Initializing Bergamot translation service...');
      
      // The actual initialization happens in TranslatorHost
      // This just marks the service as ready to accept requests
      this.initialized = true;
      console.log('🌐 Bergamot translation service ready');
      
    } catch (error) {
      console.error('🌐 Failed to initialize Bergamot:', error);
      throw error;
    }
  }

  /**
   * Check if language pair is supported
   */
  static isLanguagePairSupported(sourceLanguage: string, targetLanguage: string): boolean {
    return this.supportedLanguages.includes(sourceLanguage) && 
           this.supportedLanguages.includes(targetLanguage) &&
           sourceLanguage !== targetLanguage;
  }

  /**
   * Translate sentence using Bergamot WASM
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

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      
      try {
        const translatedText = await postTranslate(
          { id, text, from: sourceLanguage, to: targetLanguage }, 
          options.timeoutMs ?? 5000
        );

        return {
          success: true,
          translatedText,
          qualityHint: null // Will be populated by the WebView when real Bergamot is integrated
        };

      } catch (error) {
        // Handle cancellation
        if (options.signal?.aborted) {
          return {
            success: false,
            error: 'Translation cancelled'
          };
        }

        return {
          success: false,
          error: `Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }

    } catch (error) {
      console.error('🌐 Bergamot translation failed:', error);
      return {
        success: false,
        error: `Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
   * Get available language pairs
   */
  static getAvailableLanguagePairs(): Array<{source: string, target: string}> {
    const pairs = [];
    
    for (const source of this.supportedLanguages) {
      for (const target of this.supportedLanguages) {
        if (source !== target) {
          pairs.push({ source, target });
        }
      }
    }
    
    return pairs;
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
    supportedLanguages: string[];
    isWebViewBased: boolean;
  } {
    return {
      name: 'Bergamot Translation Service',
      version: '1.0.0-webview',
      supportedLanguages: this.supportedLanguages,
      isWebViewBased: true
    };
  }
}

export default BergamotTranslationService;