import { TranslationService, TranslateOpts, TranslationResult } from './types';

export const OnlineService: TranslationService = {
  async ensureModel() { 
    /* no-op for online service */ 
  },
  
  async translate(text: string, { from, to, timeoutMs = 8000 }: TranslateOpts): Promise<TranslationResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    
    try {
      const response = await fetch('https://libretranslate.com/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          q: text, 
          source: from, 
          target: to, 
          format: 'text' 
        }),
        signal: ctrl.signal,
      });
      
      const json = await response.json().catch(() => ({}));
      return { text: json.translatedText ?? text };
      
    } catch (error) {
      // Graceful fallback on any error (network, timeout, rate limit)
      console.warn('Online translation failed:', error);
      return { text }; // Return original text as fallback
    } finally {
      clearTimeout(timer);
    }
  },
};