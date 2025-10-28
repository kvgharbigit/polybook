import Constants from 'expo-constants';
import { OnlineService } from './online';
import { MlkitService } from './mlkit';
import { TranslationService } from './types';

// Enhanced diagnostics for service selection
console.log('🔧 Translation Service: Diagnostics starting...');
console.log('🔧 Translation Service: Constants.appOwnership:', Constants.appOwnership);
console.log('🔧 Translation Service: Constants.executionEnvironment:', Constants.executionEnvironment);
console.log('🔧 Translation Service: Constants.platform:', Constants.platform);

const isExpoGo = Constants.appOwnership === 'expo';
console.log('🔧 Translation Service: isExpoGo:', isExpoGo);

export const Translation: TranslationService = isExpoGo ? OnlineService : MlkitService;

console.log('🔧 Translation Service: Selected service:', isExpoGo ? 'OnlineService' : 'MlkitService');

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