/**
 * Runtime Type Guards for PolyBook
 * 
 * Provides runtime validation for TypeScript interfaces
 */

import { 
  UserLanguageProfile, 
  BilingualWordDefinition, 
  DictionaryLookupRequest,
  DictionaryLookupResponse,
  VocabularyCard 
} from './types';

/**
 * Type guard for UserLanguageProfile
 */
export function isUserLanguageProfile(obj: any): obj is UserLanguageProfile {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.nativeLanguage === 'string' &&
    Array.isArray(obj.targetLanguages) &&
    obj.targetLanguages.every((lang: any) => typeof lang === 'string') &&
    obj.createdAt instanceof Date &&
    obj.updatedAt instanceof Date
  );
}

/**
 * Type guard for BilingualWordDefinition
 */
export function isBilingualWordDefinition(obj: any): obj is BilingualWordDefinition {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.word === 'string' &&
    typeof obj.sourceLanguage === 'string' &&
    typeof obj.userLanguage === 'string' &&
    Array.isArray(obj.definitions) &&
    Array.isArray(obj.translations)
  );
}

/**
 * Type guard for DictionaryLookupRequest
 */
export function isDictionaryLookupRequest(obj: any): obj is DictionaryLookupRequest {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.word === 'string' &&
    obj.userProfile &&
    isUserLanguageProfile(obj.userProfile)
  );
}

/**
 * Type guard for DictionaryLookupResponse
 */
export function isDictionaryLookupResponse(obj: any): obj is DictionaryLookupResponse {
  return (
    obj &&
    typeof obj === 'object' &&
    obj.result &&
    isBilingualWordDefinition(obj.result) &&
    typeof obj.success === 'boolean'
  );
}

/**
 * Type guard for VocabularyCard
 */
export function isVocabularyCard(obj: any): obj is VocabularyCard {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.word === 'string' &&
    typeof obj.translation === 'string' &&
    typeof obj.sourceLanguage === 'string' &&
    typeof obj.targetLanguage === 'string' &&
    obj.createdAt instanceof Date
  );
}

/**
 * Safe type conversion with validation
 */
export class TypeSafeConverter {
  /**
   * Safely convert object to UserLanguageProfile
   */
  static toUserLanguageProfile(obj: any): UserLanguageProfile | null {
    try {
      if (isUserLanguageProfile(obj)) {
        return obj;
      }

      // Try to convert if it's close to the expected format
      if (obj && typeof obj === 'object') {
        const converted = {
          ...obj,
          createdAt: obj.createdAt ? new Date(obj.createdAt) : new Date(),
          updatedAt: obj.updatedAt ? new Date(obj.updatedAt) : new Date(),
          targetLanguages: Array.isArray(obj.targetLanguages) ? obj.targetLanguages : []
        };

        if (isUserLanguageProfile(converted)) {
          return converted;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Safely convert object to VocabularyCard
   */
  static toVocabularyCard(obj: any): VocabularyCard | null {
    try {
      if (isVocabularyCard(obj)) {
        return obj;
      }

      // Try to convert if it's close to the expected format
      if (obj && typeof obj === 'object') {
        const converted = {
          ...obj,
          createdAt: obj.createdAt ? new Date(obj.createdAt) : new Date(),
          lastReviewedAt: obj.lastReviewedAt ? new Date(obj.lastReviewedAt) : undefined
        };

        if (isVocabularyCard(converted)) {
          return converted;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Validate and sanitize language code
   */
  static validateLanguageCode(code: any): string | null {
    if (typeof code !== 'string') return null;
    
    const validCodes = ['en', 'es', 'fr', 'de', 'it', 'pt'];
    const cleanCode = code.toLowerCase().trim();
    
    return validCodes.includes(cleanCode) ? cleanCode : null;
  }

  /**
   * Validate array of objects using type guard
   */
  static validateArray<T>(
    arr: any[], 
    typeGuard: (obj: any) => obj is T
  ): T[] {
    if (!Array.isArray(arr)) return [];
    
    return arr.filter(typeGuard);
  }
}

export default {
  isUserLanguageProfile,
  isBilingualWordDefinition,
  isDictionaryLookupRequest,
  isDictionaryLookupResponse,
  isVocabularyCard,
  TypeSafeConverter
};