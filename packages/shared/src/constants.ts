// Language codes and configurations
export const SUPPORTED_LANGUAGES = {
  es: { name: 'Spanish', nativeName: 'Español' },
  en: { name: 'English', nativeName: 'English' },
  fr: { name: 'French', nativeName: 'Français' },
  de: { name: 'German', nativeName: 'Deutsch' },
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

// MVP language pair
export const MVP_LANGUAGE_PAIRS = [
  { source: 'es', target: 'en' },
  { source: 'en', target: 'es' },
] as const;

// File format configurations
export const SUPPORTED_FORMATS = {
  epub: {
    extensions: ['.epub'],
    mimeTypes: ['application/epub+zip'],
    maxSize: 100 * 1024 * 1024, // 100MB
  },
  pdf: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    maxSize: 50 * 1024 * 1024, // 50MB
  },
  txt: {
    extensions: ['.txt'],
    mimeTypes: ['text/plain'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  html: {
    extensions: ['.html', '.htm'],
    mimeTypes: ['text/html'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
} as const;

// Database configuration
export const DATABASE_VERSION = 1;
export const DATABASE_NAME = 'polybook.db';

// Translation cache settings
export const TRANSLATION_CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
export const TRANSLATION_CACHE_MAX_ENTRIES = 10000;

// Performance targets
export const PERFORMANCE_TARGETS = {
  WORD_LOOKUP_MAX_MS: 80,
  SENTENCE_TRANSLATION_MAX_MS: 300,
  SENTENCE_TRANSLATION_FAST_MS: 150,
  APP_STARTUP_MAX_MS: 2000,
  BOOK_OPEN_MAX_MS: 1000,
} as const;

// Storage limits
export const STORAGE_LIMITS = {
  BASE_APP_MAX_MB: 50,
  LANGUAGE_PACK_MAX_MB: 250,
  TOTAL_BOOKS_MAX_MB: 1000,
  CACHE_MAX_MB: 100,
} as const;

// Subscription configuration
export const SUBSCRIPTION_CONFIG = {
  TRIAL_DURATION_DAYS: 7,
  MONTHLY_PRICE_USD: 4.99,
  YEARLY_PRICE_USD: 49.99,
} as const;

// Feature flags for development
export const FEATURE_FLAGS = {
  ENABLE_ANALYTICS: false,
  ENABLE_CRASH_REPORTING: true,
  ENABLE_BETA_FEATURES: false,
  ENABLE_SYNC: false, // Disabled in MVP
} as const;

// API endpoints (when needed)
export const API_ENDPOINTS = {
  LANGUAGE_PACKS_CDN: 'https://cdn.polybook.app/packs',
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
} as const;