import { z } from 'zod';

// Validation schemas using Zod
export const BookFormatSchema = z.enum(['epub', 'pdf', 'txt', 'html']);

export const BookSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  author: z.string().min(1),
  language: z.string().length(2), // ISO 639-1 codes
  targetLanguage: z.string().length(2),
  format: BookFormatSchema,
  filePath: z.string().min(1),
  coverPath: z.string().optional(),
  lastPosition: z.object({
    bookId: z.string().uuid(),
    spineIndex: z.number().int().min(0),
    cfi: z.string().optional(),
    page: z.number().int().min(1).optional(),
    yOffset: z.number().min(0),
    updatedAt: z.date(),
  }).optional(),
  addedAt: z.date(),
  lastOpenedAt: z.date(),
});

export const VocabularyCardSchema = z.object({
  id: z.string().uuid(),
  bookId: z.string().uuid(),
  headword: z.string().min(1),
  lemma: z.string().min(1),
  sourceLanguage: z.string().length(2),
  targetLanguage: z.string().length(2),
  sourceContext: z.string().min(1),
  translation: z.string().min(1),
  definition: z.string().optional(),
  examples: z.array(z.string()).optional(),
  frequency: z.number().int().min(0).optional(),
  srsState: z.enum(['new', 'learning', 'review', 'mature']),
  createdAt: z.date(),
  lastReviewedAt: z.date().optional(),
});

export const LanguagePackSchema = z.object({
  id: z.string().min(1),
  sourceLanguage: z.string().length(2),
  targetLanguage: z.string().length(2),
  version: z.string().min(1),
  size: z.number().int().min(0),
  downloadUrl: z.string().url(),
  checksum: z.string().min(1),
  components: z.object({
    dictionary: z.boolean(),
    translationModel: z.boolean(),
    lemmatizer: z.boolean(),
    tokenizer: z.boolean(),
  }),
});

export const BookContentSchema = z.object({
  id: z.string().uuid(),
  bookId: z.string().uuid(),
  content: z.string(),
  wordCount: z.number().int().min(0),
  estimatedReadingTime: z.number().int().min(0),
  parsedAt: z.date(),
  contentVersion: z.string().default('1.0'),
});

export const UserSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'sepia']),
  fontSize: z.number().min(8).max(32),
  lineHeight: z.number().min(1).max(3),
  translationSpeed: z.enum(['fast', 'quality']),
  ttsVoice: z.string().optional(),
  ttsRate: z.number().min(0.5).max(2),
});

// Export types inferred from schemas
export type BookSchemaType = z.infer<typeof BookSchema>;
export type VocabularyCardSchemaType = z.infer<typeof VocabularyCardSchema>;
export type LanguagePackSchemaType = z.infer<typeof LanguagePackSchema>;
export type BookContentSchemaType = z.infer<typeof BookContentSchema>;
export type UserSettingsSchemaType = z.infer<typeof UserSettingsSchema>;