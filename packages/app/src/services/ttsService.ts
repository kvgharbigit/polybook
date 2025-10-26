import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

export interface TTSVoice {
  identifier: string;
  name: string;
  language: string;
  quality: 'default' | 'enhanced';
}

export interface TTSOptions {
  language?: string;
  pitch?: number;
  rate?: number;
  voice?: string;
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: any) => void;
  onBoundary?: (boundary: { charIndex: number; charLength: number }) => void;
}

export interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  currentText: string;
  currentPosition: number;
  rate: number;
  pitch: number;
}

export class TTSService {
  private static instance: TTSService;
  private state: TTSState = {
    isPlaying: false,
    isPaused: false,
    currentText: '',
    currentPosition: 0,
    rate: 1.0,
    pitch: 1.0,
  };
  
  private options: TTSOptions = {};
  private availableVoices: TTSVoice[] = [];
  private currentVoice?: string;

  static getInstance(): TTSService {
    if (!TTSService.instance) {
      TTSService.instance = new TTSService();
    }
    return TTSService.instance;
  }

  private constructor() {
    this.loadAvailableVoices();
  }

  /**
   * Load available voices for the platform
   */
  private async loadAvailableVoices(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        // Web Speech API voices
        if ('speechSynthesis' in window) {
          const voices = speechSynthesis.getVoices();
          this.availableVoices = voices.map(voice => ({
            identifier: voice.voiceURI,
            name: voice.name,
            language: voice.lang,
            quality: voice.localService ? 'enhanced' : 'default',
          }));
        }
      } else {
        // Use expo-speech for native platforms
        const voices = await Speech.getAvailableVoicesAsync();
        this.availableVoices = voices.map(voice => ({
          identifier: voice.identifier,
          name: voice.name,
          language: voice.language,
          quality: voice.quality === Speech.VoiceQuality.Enhanced ? 'enhanced' : 'default',
        }));
      }
      
      console.log('Available TTS voices:', this.availableVoices.length);
    } catch (error) {
      console.error('Error loading TTS voices:', error);
    }
  }

  /**
   * Get available voices
   */
  async getAvailableVoices(): Promise<TTSVoice[]> {
    if (this.availableVoices.length === 0) {
      await this.loadAvailableVoices();
    }
    return this.availableVoices;
  }

  /**
   * Set TTS options
   */
  setOptions(options: TTSOptions): void {
    this.options = { ...this.options, ...options };
    if (options.rate !== undefined) {
      this.state.rate = options.rate;
    }
    if (options.pitch !== undefined) {
      this.state.pitch = options.pitch;
    }
  }

  /**
   * Speak the given text
   */
  async speak(text: string, options?: TTSOptions): Promise<void> {
    try {
      // Stop current speech if playing
      if (this.state.isPlaying) {
        await this.stop();
      }

      const combinedOptions = { ...this.options, ...options };
      
      this.state.currentText = text;
      this.state.isPlaying = true;
      this.state.isPaused = false;
      this.state.currentPosition = 0;

      // Prepare speech options for expo-speech
      const speechOptions: any = {
        language: combinedOptions.language || 'en-US',
        pitch: combinedOptions.pitch || this.state.pitch,
        rate: combinedOptions.rate || this.state.rate,
        voice: this.currentVoice || combinedOptions.voice,
        onStart: () => {
          console.log('TTS started');
          this.state.isPlaying = true;
          combinedOptions.onStart?.();
        },
        onDone: () => {
          console.log('TTS completed');
          this.state.isPlaying = false;
          this.state.isPaused = false;
          this.state.currentPosition = 0;
          combinedOptions.onDone?.();
        },
        onStopped: () => {
          console.log('TTS stopped');
          this.state.isPlaying = false;
          this.state.isPaused = false;
          combinedOptions.onStopped?.();
        },
        onError: (error: any) => {
          console.error('TTS error:', error);
          this.state.isPlaying = false;
          this.state.isPaused = false;
          combinedOptions.onError?.(error);
        },
      };

      // Handle word boundary events for text highlighting
      if (Platform.OS !== 'web' && combinedOptions.onBoundary) {
        speechOptions.onBoundary = (event: any) => {
          this.state.currentPosition = event.charIndex || 0;
          combinedOptions.onBoundary?.(event);
        };
      }

      await Speech.speak(text, speechOptions);
      
    } catch (error) {
      console.error('Error starting TTS:', error);
      this.state.isPlaying = false;
      this.state.isPaused = false;
      options?.onError?.(error);
    }
  }

  /**
   * Pause speech
   */
  async pause(): Promise<void> {
    try {
      if (this.state.isPlaying && !this.state.isPaused) {
        await Speech.pause();
        this.state.isPaused = true;
        console.log('TTS paused');
      }
    } catch (error) {
      console.error('Error pausing TTS:', error);
    }
  }

  /**
   * Resume speech
   */
  async resume(): Promise<void> {
    try {
      if (this.state.isPlaying && this.state.isPaused) {
        await Speech.resume();
        this.state.isPaused = false;
        console.log('TTS resumed');
      }
    } catch (error) {
      console.error('Error resuming TTS:', error);
    }
  }

  /**
   * Stop speech
   */
  async stop(): Promise<void> {
    try {
      if (this.state.isPlaying) {
        await Speech.stop();
        this.state.isPlaying = false;
        this.state.isPaused = false;
        this.state.currentPosition = 0;
        console.log('TTS stopped');
      }
    } catch (error) {
      console.error('Error stopping TTS:', error);
    }
  }

  /**
   * Check if TTS is currently speaking
   */
  isSpeaking(): boolean {
    return this.state.isPlaying && !this.state.isPaused;
  }

  /**
   * Check if TTS is paused
   */
  isPaused(): boolean {
    return this.state.isPaused;
  }

  /**
   * Get current TTS state
   */
  getState(): TTSState {
    return { ...this.state };
  }

  /**
   * Set speaking rate (0.5 - 2.0)
   */
  setRate(rate: number): void {
    this.state.rate = Math.max(0.5, Math.min(2.0, rate));
  }

  /**
   * Set pitch (0.5 - 2.0)
   */
  setPitch(pitch: number): void {
    this.state.pitch = Math.max(0.5, Math.min(2.0, pitch));
  }

  /**
   * Set voice by identifier
   */
  setVoice(voiceIdentifier: string): void {
    const voice = this.availableVoices.find(v => v.identifier === voiceIdentifier);
    if (voice) {
      this.currentVoice = voiceIdentifier;
      console.log('TTS voice set to:', voice.name);
    }
  }

  /**
   * Get current voice
   */
  getCurrentVoice(): TTSVoice | undefined {
    if (!this.currentVoice) return undefined;
    return this.availableVoices.find(v => v.identifier === this.currentVoice);
  }

  /**
   * Check if TTS is available on this platform
   */
  static isAvailable(): boolean {
    if (Platform.OS === 'web') {
      return 'speechSynthesis' in window;
    }
    return true; // expo-speech is available on native platforms
  }

  /**
   * Get suggested voices for a language
   */
  getVoicesForLanguage(language: string): TTSVoice[] {
    const langCode = language.substring(0, 2).toLowerCase();
    return this.availableVoices.filter(voice => 
      voice.language.toLowerCase().startsWith(langCode),
    );
  }
}

// Export singleton instance
export const ttsService = TTSService.getInstance();
export default ttsService;