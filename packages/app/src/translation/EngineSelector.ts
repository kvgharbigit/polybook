import Constants from 'expo-constants';

// LEGACY FILE - DEPRECATED
// Engine selection is now handled in services/index.ts
// This file exists for backward compatibility only

export type Engine = 'online' | 'mlkit';

export const chooseEngine = (): Engine =>
  Constants.appOwnership === 'expo' ? 'online' : 'mlkit';

export const getEngineInfo = (engine: Engine) => {
  switch (engine) {
    case 'online':
      return {
        name: 'Online Translation',
        description: 'Fast cloud-based translation for development',
        offline: false,
        quality: 'high',
        speed: 'fast'
      };
    case 'mlkit':
      return {
        name: 'ML Kit Translation',
        description: 'Native on-device translation for production',
        offline: true,
        quality: 'high',
        speed: 'fast'
      };
    default:
      return getEngineInfo('online');
  }
};