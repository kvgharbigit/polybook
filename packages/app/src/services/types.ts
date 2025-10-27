export type TranslateOpts = { 
  from: string; 
  to: string; 
  timeoutMs?: number; 
};

export type TranslationResult = { 
  text: string;
};

export interface TranslationService {
  ensureModel(lang: string): Promise<void>;           // no-op for online
  translate(text: string, opts: TranslateOpts): Promise<TranslationResult>;
}