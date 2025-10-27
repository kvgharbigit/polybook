import Constants from 'expo-constants';
import { OnlineService } from './online';
import { MlkitService } from './mlkit';
import { TranslationService } from './types';

// One-liner engine switch
const isExpoGo = Constants.appOwnership === 'expo';
export const Translation: TranslationService = isExpoGo ? OnlineService : MlkitService;

// Re-export types for convenience
export type { TranslationService, TranslateOpts, TranslationResult } from './types';

// Re-export utilities for Dev/Release builds
export { MlkitUtils } from './mlkit';

// Service info for debugging
export const getServiceInfo = () => ({
  engine: isExpoGo ? 'online' : 'mlkit',
  isExpoGo,
  description: isExpoGo 
    ? 'Google Translate (free unofficial API for dev only)'
    : 'ML Kit on-device translation'
});