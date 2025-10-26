/**
 * Generate a hash for a sentence to use as cache key
 * Simple hash implementation for cross-platform compatibility
 */
export function hashSentence(text: string, languagePair: string): string {
  const normalized = text.trim().toLowerCase();
  const input = `${normalized}:${languagePair}`;
  
  // Simple hash function for cross-platform compatibility
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if a language pair is supported
 */
export function isLanguagePairSupported(source: string, target: string): boolean {
  // For MVP, only Spanish <-> English
  return (source === 'es' && target === 'en') || (source === 'en' && target === 'es');
}

/**
 * Validate file format
 */
export function isValidBookFormat(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop();
  return ['epub', 'pdf', 'txt', 'html', 'htm'].includes(ext || '');
}

/**
 * Clean and normalize text for processing
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[""]/g, '"') // Normalize quotes
    .replace(/['']/g, "'"); // Normalize apostrophes
}

/**
 * Split text into sentences (basic implementation)
 */
export function splitIntoSentences(text: string): string[] {
  // Basic sentence splitting - can be improved with proper NLP
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return sentences;
}

/**
 * Check if text is likely a word (not punctuation or whitespace)
 */
export function isWord(text: string): boolean {
  return /\w/.test(text) && text.length > 0;
}

/**
 * Calculate reading time estimate
 */
export function estimateReadingTime(wordCount: number, wordsPerMinute: number = 200): number {
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}