/**
 * Timeout and Performance Constants
 * Centralized configuration for timeouts, delays, and performance settings
 */

export const TIMEOUTS = {
  // Dictionary lookup timeouts
  DICTIONARY_LOOKUP_TIMEOUT: 5000, // 5 seconds
  WORD_LOOKUP_SIMULATION_BASE: 300, // Base simulation delay
  WORD_LOOKUP_SIMULATION_RANDOM: 500, // Random additional delay
  
  // Network timeouts
  DOWNLOAD_TIMEOUT: 30000, // 30 seconds
  FILE_OPERATION_TIMEOUT: 10000, // 10 seconds
  
  // Database timeouts
  DB_CONNECTION_TIMEOUT: 5000, // 5 seconds
  DB_QUERY_TIMEOUT: 3000, // 3 seconds
} as const;

export const PERFORMANCE = {
  // Memory limits
  MAX_BUFFER_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_CACHE_SIZE: 50 * 1024 * 1024, // 50MB
  
  // Batch sizes
  VOCABULARY_BATCH_SIZE: 100,
  SEARCH_RESULTS_LIMIT: 50,
  
  // Debounce delays
  SEARCH_DEBOUNCE: 300, // 300ms
  AUTOSAVE_DEBOUNCE: 1000, // 1 second
} as const;

export const PATHS = {
  // Directory paths
  LANGUAGE_PACKS_DIR: 'language-packs/',
  DICTIONARIES_DIR: 'dictionaries/',
  CACHE_DIR: 'cache/',
  DOCUMENTS_DIR: 'documents/',
} as const;