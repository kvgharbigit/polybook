/**
 * Bergamot Translation Service
 * 
 * Provides offline sentence-level translation using Bergamot WASM models
 * Implemented using WebView-based WASM integration for React Native
 */

// Re-export the new WebView-based implementation
import BergamotServiceImpl from '../translation/BergamotService';
export type { BergamotTranslationResponse, TranslateOptions } from '../translation/BergamotService';

export { BergamotServiceImpl as BergamotTranslationService };

// Backward compatibility
export default BergamotServiceImpl;