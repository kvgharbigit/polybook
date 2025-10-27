import { TranslationService, TranslateOpts, TranslationResult } from './types';

export const OnlineService: TranslationService = {
  async ensureModel() { 
    /* no-op for online service */ 
  },
  
  async translate(text: string, { from, to, timeoutMs = 8000 }: TranslateOpts): Promise<TranslationResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    
    try {
      console.log(`🌐 Google Translate: "${text}" (${from} → ${to})`);
      
      // Use unofficial Google Translate endpoint
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PolyBook/1.0.0)',
        },
        signal: ctrl.signal,
      });
      
      if (!response.ok) {
        console.warn(`Google Translate API error: ${response.status} ${response.statusText}`);
        // Fallback to mock for development
        const mockTranslation = `[${to.toUpperCase()}] ${text}`;
        console.log(`✅ Fallback translation: "${mockTranslation}"`);
        return { text: mockTranslation };
      }
      
      const result = await response.json();
      
      // Google's response format: [[[translated_text, original_text, null, null, score], ...], ...]
      if (result && result[0] && result[0][0] && result[0][0][0]) {
        const translatedText = result[0][0][0];
        console.log(`✅ Google Translate result: "${translatedText}"`);
        return { text: translatedText };
      } else {
        console.warn('Google Translate unexpected response format:', result);
        // Fallback to mock for development
        const mockTranslation = `[${to.toUpperCase()}] ${text}`;
        console.log(`✅ Fallback translation: "${mockTranslation}"`);
        return { text: mockTranslation };
      }
      
    } catch (error) {
      console.warn('Google Translate failed, using fallback:', error);
      // Graceful fallback to mock for development
      const mockTranslation = `[${to.toUpperCase()}] ${text}`;
      console.log(`✅ Fallback translation: "${mockTranslation}"`);
      return { text: mockTranslation };
    } finally {
      clearTimeout(timer);
    }
  },
};