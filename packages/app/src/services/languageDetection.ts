import { franc } from 'franc';

export interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
  method: 'metadata' | 'content-analysis' | 'fallback';
  supportedForTranslation: boolean;
}

/**
 * Language detection service using franc for content analysis
 */
export class LanguageDetectionService {
  
  /**
   * Detect language from book content and metadata
   */
  static async detectBookLanguage(
    bookContent: string,
    bookMetadata?: { language?: string; title?: string; author?: string },
    userNativeLanguage: string = 'en'
  ): Promise<LanguageDetectionResult> {
    
    console.log('🔍 Language Detection: Starting analysis...');
    console.log('🔍 Language Detection: Content length:', bookContent.length);
    console.log('🔍 Language Detection: Metadata language:', bookMetadata?.language);
    console.log('🔍 Language Detection: User native language:', userNativeLanguage);
    // 1. Try metadata first
    if (bookMetadata?.language) {
      const metadataLang = this.normalizeLanguageCode(bookMetadata.language);
      if (this.isValidLanguageCode(metadataLang)) {
        console.log('🔍 Language Detection: ✅ Using metadata language:', metadataLang);
        return {
          detectedLanguage: metadataLang,
          confidence: 0.95,
          method: 'metadata',
          supportedForTranslation: this.isTranslationSupported(metadataLang)
        };
      }
    }
    
    // 2. Use franc for content analysis
    try {
      // Take a reasonable sample from the book (first 5000 chars, avoiding metadata)
      const sampleText = this.extractContentSample(bookContent);
      console.log('🔍 Language Detection: Sample text length:', sampleText.length);
      console.log('🔍 Language Detection: Sample preview:', sampleText.substring(0, 200) + '...');
      
      if (sampleText.length < 50) {
        console.log('🔍 Language Detection: ⚠️ Sample too short, using fallback');
        return this.getFallbackResult(userNativeLanguage);
      }
      
      const detectedCode = franc(sampleText);
      console.log('🔍 Language Detection: Franc result:', detectedCode);
      
      if (detectedCode === 'und' || !detectedCode) {
        console.log('🔍 Language Detection: ⚠️ Franc returned undefined, using fallback');
        return this.getFallbackResult(userNativeLanguage);
      }
      
      const normalizedLang = this.francToISO(detectedCode);
      console.log('🔍 Language Detection: ✅ Detected language:', normalizedLang);
      
      return {
        detectedLanguage: normalizedLang,
        confidence: 0.85,
        method: 'content-analysis',
        supportedForTranslation: this.isTranslationSupported(normalizedLang)
      };
      
    } catch (error) {
      console.error('🔍 Language Detection: ❌ Error during detection:', error);
      return this.getFallbackResult(userNativeLanguage);
    }
  }
  
  /**
   * Extract a good sample of text for language detection
   */
  private static extractContentSample(content: string): string {
    // Remove common metadata patterns
    let cleanContent = content
      .replace(/^.*?CHAPTER\s+(?:I|1|ONE)\b/i, 'CHAPTER I') // Remove prologue/metadata
      .replace(/Project Gutenberg.*$/gim, '') // Remove Gutenberg text
      .replace(/\*\*\*.*?\*\*\*/gs, '') // Remove asterisk sections
      .replace(/_{3,}/g, '') // Remove underline separators
      .replace(/={3,}/g, '') // Remove equal separators
      .replace(/\[.*?\]/g, '') // Remove bracketed metadata
      .trim();
    
    // Take first 3000 characters of actual content
    const sample = cleanContent.substring(0, 3000);
    
    // Remove extra whitespace
    return sample.replace(/\s+/g, ' ').trim();
  }
  
  /**
   * Convert franc language codes to ISO 639-1
   */
  private static francToISO(francCode: string): string {
    const francToISO: Record<string, string> = {
      'eng': 'en',
      'spa': 'es', 
      'fra': 'fr',
      'deu': 'de',
      'ita': 'it',
      'por': 'pt',
      'nld': 'nl',
      'rus': 'ru',
      'jpn': 'ja',
      'kor': 'ko',
      'cmn': 'zh', // Chinese Mandarin
      'arb': 'ar', // Arabic
    };
    
    return francToISO[francCode] || francCode.substring(0, 2);
  }
  
  /**
   * Normalize language codes to ISO 639-1
   */
  private static normalizeLanguageCode(langCode: string): string {
    if (!langCode) return 'en';
    
    // Handle common variants
    const normalized = langCode.toLowerCase().substring(0, 2);
    
    const variants: Record<string, string> = {
      'en-us': 'en',
      'en-gb': 'en',
      'es-es': 'es',
      'es-mx': 'es',
      'fr-fr': 'fr',
      'de-de': 'de',
    };
    
    return variants[langCode.toLowerCase()] || normalized;
  }
  
  /**
   * Check if language code is valid
   */
  private static isValidLanguageCode(langCode: string): boolean {
    const validCodes = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'ja', 'ko', 'zh', 'ar'];
    return validCodes.includes(langCode);
  }
  
  /**
   * Check if language is supported for translation
   */
  private static isTranslationSupported(langCode: string): boolean {
    // ML Kit supported languages
    const supported = [
      'af', 'ar', 'be', 'bg', 'bn', 'ca', 'cs', 'cy', 'da', 'de', 
      'el', 'en', 'eo', 'es', 'et', 'fa', 'fi', 'fr', 'ga', 'gl',
      'gu', 'he', 'hi', 'hr', 'hu', 'id', 'is', 'it', 'ja', 'ka',
      'kk', 'km', 'kn', 'ko', 'ky', 'lo', 'lt', 'lv', 'mk', 'ml',
      'mn', 'mr', 'ms', 'mt', 'my', 'ne', 'nl', 'no', 'pa', 'pl',
      'ps', 'pt', 'ro', 'ru', 'si', 'sk', 'sl', 'sq', 'sr', 'sv',
      'sw', 'ta', 'te', 'th', 'tl', 'tr', 'uk', 'ur', 'uz', 'vi',
      'zh'
    ];
    
    return supported.includes(langCode);
  }
  
  /**
   * Get fallback result when detection fails
   */
  private static getFallbackResult(userNativeLanguage: string): LanguageDetectionResult {
    // If user is English native, assume book is in Spanish (common learning case)
    // Otherwise assume English (most common book language)
    const fallbackLang = userNativeLanguage === 'en' ? 'es' : 'en';
    
    return {
      detectedLanguage: fallbackLang,
      confidence: 0.3,
      method: 'fallback',
      supportedForTranslation: this.isTranslationSupported(fallbackLang)
    };
  }
  
  /**
   * Quick language detection for short texts (like chapter titles)
   */
  static detectQuick(text: string): string {
    if (text.length < 20) return 'unknown';
    
    try {
      const detected = franc(text);
      return this.francToISO(detected);
    } catch {
      return 'unknown';
    }
  }
}

export default LanguageDetectionService;