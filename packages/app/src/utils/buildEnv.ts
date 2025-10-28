import Constants from 'expo-constants';
import { Platform, NativeModules } from 'react-native';

type BuildKind = 'expo-go' | 'dev-client' | 'standalone';

export function getBuildKind(): BuildKind {
  // 'expo' => Expo Go, 'guest' => dev client, 'standalone' => prod build
  const owner = Constants.appOwnership;
  if (owner === 'expo') return 'expo-go';
  if (owner === 'guest') return 'dev-client';
  return 'standalone';
}

export function hasMlkitNativeModule(): boolean {
  // Check for various MLKit native module names
  const nm = NativeModules as any;
  return Boolean(
    nm.MLKitTranslate ||
    nm.RNGoogleMLKitLanguageIdentification ||
    nm.RNGoogleMlkitTranslate ||
    nm.MLKitLanguageTranslator ||
    nm.RNMLKitTranslateText ||
    nm.ExpoMlkitTranslation // for expo-mlkit-translation
  );
}

export function canUseMLKit(): boolean {
  // Allow in dev-client + standalone, and only if the native module is linked.
  const allowedByBuild = getBuildKind() !== 'expo-go';
  return allowedByBuild && hasMlkitNativeModule();
}

export function logEnvForDebug() {
  console.log('🏗️ [BuildEnv] appOwnership:', Constants.appOwnership);
  console.log('🏗️ [BuildEnv] __DEV__:', __DEV__);
  console.log('🏗️ [BuildEnv] platform:', Platform.OS);
  console.log('🏗️ [BuildEnv] buildKind:', getBuildKind());
  console.log('🏗️ [BuildEnv] hasMlkitNativeModule:', hasMlkitNativeModule());
  console.log('🏗️ [BuildEnv] canUseMLKit:', canUseMLKit());
  console.log('🏗️ [BuildEnv] Available NativeModules:', Object.keys(NativeModules).filter(key => key.toLowerCase().includes('mlkit')));
}

export function getMLKitBlockReason(): string {
  const kind = getBuildKind();
  
  if (kind === 'expo-go') {
    return 'This is running in Expo Go, which cannot load ML Kit native modules. Create a development build with "npx expo run:ios" to enable ML Kit.';
  }
  
  if (!hasMlkitNativeModule()) {
    return 'ML Kit native module not detected. Make sure react-native-mlkit-translate-text is properly installed and rebuild the app.';
  }
  
  return 'Unknown ML Kit availability issue.';
}