import LanguageDetectionService, { LanguageDetectionResult } from './languageDetection';
import SQLiteDictionaryService from './sqliteDictionaryService';
import { MlkitUtils } from './mlkit';

export interface TranslationRequirements {
  bookLanguage: string;
  userNativeLanguage: string;
  detectionResult: LanguageDetectionResult;
  
  // Dictionary requirements
  needsDictionaries: boolean;
  missingDictionaries: string[];
  availableDictionaries: string[];
  
  // MLKit requirements  
  needsMLKit: boolean;
  mlkitAvailable: boolean;
  missingMLKitModels: string[];
  availableMLKitModels: string[];
  
  // Summary
  translationReady: boolean;
  requiredActions: string[];
}

/**
 * Service to check translation requirements when entering a book
 */
export class TranslationRequirementsService {
  
  /**
   * Check all translation requirements for a book
   */
  static async checkRequirements(
    bookContent: string,
    bookMetadata: { language?: string; title?: string; author?: string },
    userNativeLanguage: string
  ): Promise<TranslationRequirements> {
    
    console.log('🔧 Translation Requirements: Starting analysis...');
    console.log('🔧 Translation Requirements: User native language:', userNativeLanguage);
    
    // 1. Detect book language
    const detectionResult = await LanguageDetectionService.detectBookLanguage(
      bookContent,
      bookMetadata,
      userNativeLanguage
    );
    
    const bookLanguage = detectionResult.detectedLanguage;
    console.log('🔧 Translation Requirements: Book language detected as:', bookLanguage);
    
    // 2. Check dictionary requirements
    const dictionaryCheck = await this.checkDictionaryRequirements(bookLanguage, userNativeLanguage);
    
    // 3. Check MLKit requirements
    const mlkitCheck = await this.checkMLKitRequirements(bookLanguage, userNativeLanguage);
    
    // 4. Determine required actions
    const requiredActions: string[] = [];
    
    if (dictionaryCheck.needsDictionaries && dictionaryCheck.missingDictionaries.length > 0) {
      requiredActions.push(`Download dictionary packs: ${dictionaryCheck.missingDictionaries.join(', ')}`);
    }
    
    if (mlkitCheck.needsMLKit && !mlkitCheck.mlkitAvailable) {
      requiredActions.push('Enable MLKit translation (requires Dev Client build)');
    } else if (mlkitCheck.needsMLKit && mlkitCheck.missingMLKitModels.length > 0) {
      requiredActions.push(`Download MLKit models: ${mlkitCheck.missingMLKitModels.join(', ')}`);
    }
    
    const translationReady = requiredActions.length === 0;
    
    console.log('🔧 Translation Requirements: Translation ready:', translationReady);
    console.log('🔧 Translation Requirements: Required actions:', requiredActions);
    
    return {
      bookLanguage,
      userNativeLanguage,
      detectionResult,
      
      needsDictionaries: dictionaryCheck.needsDictionaries,
      missingDictionaries: dictionaryCheck.missingDictionaries,
      availableDictionaries: dictionaryCheck.availableDictionaries,
      
      needsMLKit: mlkitCheck.needsMLKit,
      mlkitAvailable: mlkitCheck.mlkitAvailable,
      missingMLKitModels: mlkitCheck.missingMLKitModels,
      availableMLKitModels: mlkitCheck.availableMLKitModels,
      
      translationReady,
      requiredActions
    };
  }
  
  /**
   * Check dictionary availability
   */
  private static async checkDictionaryRequirements(bookLanguage: string, userNativeLanguage: string) {
    console.log('📚 Dictionary Check: Checking requirements...');
    
    try {
      // Check if dictionaries are needed (different languages)
      const needsDictionaries = bookLanguage !== userNativeLanguage;
      
      if (!needsDictionaries) {
        console.log('📚 Dictionary Check: Same language, no dictionaries needed');
        return {
          needsDictionaries: false,
          missingDictionaries: [],
          availableDictionaries: []
        };
      }
      
      // Check available dictionaries
      const availableLanguages = await SQLiteDictionaryService.getAvailableLanguages();
      console.log('📚 Dictionary Check: Available languages:', availableLanguages);
      
      const requiredLanguages = [bookLanguage, userNativeLanguage];
      const missingDictionaries = requiredLanguages.filter(lang => !availableLanguages.includes(lang));
      
      console.log('📚 Dictionary Check: Required languages:', requiredLanguages);
      console.log('📚 Dictionary Check: Missing dictionaries:', missingDictionaries);
      
      return {
        needsDictionaries: true,
        missingDictionaries,
        availableDictionaries: availableLanguages
      };
      
    } catch (error) {
      console.error('📚 Dictionary Check: Error checking requirements:', error);
      return {
        needsDictionaries: true,
        missingDictionaries: [bookLanguage, userNativeLanguage],
        availableDictionaries: []
      };
    }
  }
  
  /**
   * Check MLKit model availability
   */
  private static async checkMLKitRequirements(bookLanguage: string, userNativeLanguage: string) {
    console.log('🤖 MLKit Check: Checking requirements...');
    
    try {
      // Check if MLKit is available
      const mlkitAvailable = MlkitUtils.isAvailable();
      console.log('🤖 MLKit Check: MLKit available:', mlkitAvailable);
      
      if (!mlkitAvailable) {
        return {
          needsMLKit: true,
          mlkitAvailable: false,
          missingMLKitModels: [bookLanguage, userNativeLanguage],
          availableMLKitModels: []
        };
      }
      
      // Check available models
      const availableModels = await MlkitUtils.getInstalledModels();
      console.log('🤖 MLKit Check: Available models:', availableModels);
      
      const requiredModels = [bookLanguage, userNativeLanguage];
      const missingModels = requiredModels.filter(lang => !availableModels.includes(lang));
      
      console.log('🤖 MLKit Check: Required models:', requiredModels);
      console.log('🤖 MLKit Check: Missing models:', missingModels);
      
      return {
        needsMLKit: bookLanguage !== userNativeLanguage,
        mlkitAvailable: true,
        missingMLKitModels: missingModels,
        availableMLKitModels: availableModels
      };
      
    } catch (error) {
      console.error('🤖 MLKit Check: Error checking requirements:', error);
      return {
        needsMLKit: true,
        mlkitAvailable: false,
        missingMLKitModels: [bookLanguage, userNativeLanguage],
        availableMLKitModels: []
      };
    }
  }
  
  /**
   * Generate user-friendly requirement summary
   */
  static getRequirementSummary(requirements: TranslationRequirements): string {
    const { detectionResult, translationReady, requiredActions } = requirements;
    
    if (translationReady) {
      return `✅ Ready for translation! Book detected as ${this.getLanguageName(requirements.bookLanguage)} with ${detectionResult.confidence * 100}% confidence.`;
    }
    
    const actionText = requiredActions.length === 1 ? 'action' : 'actions';
    return `⚠️ Translation setup needed (${requiredActions.length} ${actionText}): ${requiredActions.join(', ')}`;
  }
  
  /**
   * Get friendly language name
   */
  private static getLanguageName(langCode: string): string {
    const languages: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'nl': 'Dutch',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ar': 'Arabic'
    };
    return languages[langCode] || langCode.toUpperCase();
  }
}

export default TranslationRequirementsService;