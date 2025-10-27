/**
 * Centralized Error Handling Framework for PolyBook
 */

export enum ErrorCode {
  // Service initialization
  SERVICE_INIT_FAILED = 'SERVICE_INIT_FAILED',
  
  // Dictionary errors
  DICTIONARY_NOT_FOUND = 'DICTIONARY_NOT_FOUND',
  DICTIONARY_LOOKUP_FAILED = 'DICTIONARY_LOOKUP_FAILED',
  
  // Language pack errors
  LANGUAGE_PACK_DOWNLOAD_FAILED = 'LANGUAGE_PACK_DOWNLOAD_FAILED',
  LANGUAGE_PACK_INSTALL_FAILED = 'LANGUAGE_PACK_INSTALL_FAILED',
  LANGUAGE_PACK_NOT_FOUND = 'LANGUAGE_PACK_NOT_FOUND',
  
  // User profile errors
  USER_PROFILE_LOAD_FAILED = 'USER_PROFILE_LOAD_FAILED',
  USER_PROFILE_SAVE_FAILED = 'USER_PROFILE_SAVE_FAILED',
  
  // PDF processing errors
  PDF_EXTRACTION_FAILED = 'PDF_EXTRACTION_FAILED',
  PDF_INVALID_FORMAT = 'PDF_INVALID_FORMAT',
  
  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_PERMISSION_DENIED = 'FILE_PERMISSION_DENIED',
  STORAGE_FULL = 'STORAGE_FULL',
  
  // Network errors
  NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  
  // Validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_LANGUAGE_CODE = 'INVALID_LANGUAGE_CODE',
  
  // Unknown errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface PolyBookError {
  code: ErrorCode;
  message: string;
  details?: any;
  timestamp: Date;
  service?: string;
  context?: Record<string, any>;
}

export class PolyBookException extends Error {
  public readonly error: PolyBookError;

  constructor(
    code: ErrorCode,
    message: string,
    details?: any,
    service?: string,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'PolyBookException';
    
    this.error = {
      code,
      message,
      details,
      timestamp: new Date(),
      service,
      context
    };
  }

  toString(): string {
    return `${this.error.service ? `[${this.error.service}] ` : ''}${this.error.code}: ${this.error.message}`;
  }
}

/**
 * Error handling utility functions
 */
export class ErrorHandler {
  private static errorLog: PolyBookError[] = [];
  private static maxLogSize = 100;

  /**
   * Log an error for debugging and monitoring
   */
  static logError(error: PolyBookError | PolyBookException | Error, service?: string, context?: Record<string, any>): void {
    let polyBookError: PolyBookError;

    if (error instanceof PolyBookException) {
      polyBookError = error.error;
    } else if (error instanceof Error) {
      polyBookError = {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error.message,
        details: {
          stack: error.stack,
          name: error.name
        },
        timestamp: new Date(),
        service,
        context
      };
    } else {
      polyBookError = error as PolyBookError;
    }

    // Add to local log
    this.errorLog.push(polyBookError);
    
    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    // Console logging with structured format
    console.error('🚨 PolyBook Error:', {
      service: polyBookError.service,
      code: polyBookError.code,
      message: polyBookError.message,
      timestamp: polyBookError.timestamp.toISOString(),
      context: polyBookError.context,
      details: polyBookError.details
    });
  }

  /**
   * Handle async operations with error logging
   */
  static async safeAsync<T>(
    operation: () => Promise<T>,
    errorCode: ErrorCode,
    service: string,
    context?: Record<string, any>
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      this.logError(
        new PolyBookException(
          errorCode,
          error instanceof Error ? error.message : 'Unknown error',
          error,
          service,
          context
        )
      );
      return null;
    }
  }

  /**
   * Wrap sync operations with error handling
   */
  static safe<T>(
    operation: () => T,
    errorCode: ErrorCode,
    service: string,
    context?: Record<string, any>
  ): T | null {
    try {
      return operation();
    } catch (error) {
      this.logError(
        new PolyBookException(
          errorCode,
          error instanceof Error ? error.message : 'Unknown error',
          error,
          service,
          context
        )
      );
      return null;
    }
  }

  /**
   * Get recent errors for debugging
   */
  static getRecentErrors(count: number = 10): PolyBookError[] {
    return this.errorLog.slice(-count);
  }

  /**
   * Clear error log
   */
  static clearLog(): void {
    this.errorLog = [];
  }

  /**
   * Get user-friendly error message
   */
  static getUserMessage(error: PolyBookError | PolyBookException): string {
    const code = error instanceof PolyBookException ? error.error.code : error.code;
    
    switch (code) {
      case ErrorCode.DICTIONARY_NOT_FOUND:
        return 'Dictionary not available. Please download the language pack.';
      
      case ErrorCode.LANGUAGE_PACK_DOWNLOAD_FAILED:
        return 'Failed to download language pack. Please check your internet connection.';
      
      case ErrorCode.LANGUAGE_PACK_INSTALL_FAILED:
        return 'Failed to install language pack. Please try again.';
      
      case ErrorCode.PDF_EXTRACTION_FAILED:
        return 'Unable to extract text from PDF. The file may be encrypted or corrupted.';
      
      case ErrorCode.STORAGE_FULL:
        return 'Not enough storage space. Please free up some space and try again.';
      
      case ErrorCode.NETWORK_UNAVAILABLE:
        return 'No internet connection available. Some features require an internet connection.';
      
      case ErrorCode.INVALID_LANGUAGE_CODE:
        return 'Invalid language selection. Please choose a supported language.';
      
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
}

/**
 * Input validation utilities
 */
export class Validator {
  /**
   * Validate language code
   */
  static isValidLanguageCode(code: string): boolean {
    const validCodes = ['en', 'es', 'fr', 'de', 'it', 'pt'];
    return validCodes.includes(code);
  }

  /**
   * Validate and sanitize file path
   */
  static sanitizeFilePath(path: string): string {
    if (!path || typeof path !== 'string') {
      throw new Error('Invalid path: must be a non-empty string');
    }
    
    // Remove any path traversal attempts
    let sanitized = path.replace(/\.\./g, '').replace(/\/+/g, '/');
    
    // Remove leading/trailing whitespace
    sanitized = sanitized.trim();
    
    // Ensure path doesn't start with / (relative paths only)
    sanitized = sanitized.replace(/^\/+/, '');
    
    // Validate characters (allow letters, numbers, hyphens, underscores, dots, slashes)
    if (!/^[\w\-_\.\/]+$/.test(sanitized)) {
      throw new Error('Invalid path: contains illegal characters');
    }
    
    // Additional security: ensure no double dots remain
    if (sanitized.includes('..')) {
      throw new Error('Invalid path: path traversal not allowed');
    }
    
    return sanitized;
  }

  /**
   * Validate base64 string
   */
  static isValidBase64(str: string): boolean {
    try {
      return btoa(atob(str)) === str;
    } catch {
      return false;
    }
  }

  /**
   * Validate word for dictionary lookup
   */
  static sanitizeWordForLookup(word: string): string {
    return word.trim().toLowerCase().replace(/[^\w\s'-]/g, '');
  }
}

export default {
  ErrorCode,
  PolyBookException,
  ErrorHandler,
  Validator
};