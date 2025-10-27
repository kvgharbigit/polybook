interface TranslationRequest {
  text: string;
  from: string;
  to: string;
}

interface TranslationResult {
  text: string;
  quality: number | null;
}

export class OnlineTranslateService {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor(options: {
    baseUrl?: string;
    timeout?: number;
    maxRetries?: number;
  } = {}) {
    // Use a simple translation API - you can replace with your preferred service
    this.baseUrl = options.baseUrl || 'https://api.mymemory.translated.net/get';
    this.timeout = options.timeout || 5000;
    this.maxRetries = options.maxRetries || 2;
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const { text, from, to } = request;
    
    // Validate input
    if (!text?.trim()) {
      throw new Error('Translation text cannot be empty');
    }
    
    if (!from || !to) {
      throw new Error('Source and target languages must be specified');
    }

    let lastError: Error | null = null;
    
    // Retry logic
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.makeRequest(text, from, to);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Translation attempt ${attempt + 1} failed:`, error);
        
        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Translation failed after all retries');
  }

  private async makeRequest(text: string, from: string, to: string): Promise<TranslationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      // MyMemory API format
      const langPair = `${from}|${to}`;
      const url = `${this.baseUrl}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PolyBook/1.0'
        },
        signal: controller.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // MyMemory API response format
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        return {
          text: data.responseData.translatedText,
          quality: data.responseData.match || null
        };
      } else {
        throw new Error(data.responseDetails || 'Translation service error');
      }
      
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Alternative: Google Translate API (requires API key)
  private async makeGoogleRequest(text: string, from: string, to: string): Promise<TranslationResult> {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (!apiKey) {
      throw new Error('Google Translate API key not configured');
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          source: from,
          target: to,
          format: 'text'
        }),
        signal: controller.signal
      });
      
      if (!response.ok) {
        throw new Error(`Google Translate API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.data?.translations?.[0]?.translatedText) {
        return {
          text: data.data.translations[0].translatedText,
          quality: 0.9 // Google Translate is generally high quality
        };
      } else {
        throw new Error('Invalid response from Google Translate API');
      }
      
    } finally {
      clearTimeout(timeoutId);
    }
  }
}