import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { UserLanguageProfile } from '@polybook/shared/src/types';
import UserLanguageProfileService from '../services/userLanguageProfileService';
import LanguagePackManager from '../services/languagePackManager';
import SQLiteDictionaryService from '../services/sqliteDictionaryService';
import { getServiceInfo } from '../services';

interface LanguageOption {
  code: string;
  name: string;
  flag: string;
  nativeName: string;
}

// Top 10 languages with comprehensive offline support
const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', flag: '🇺🇸', nativeName: 'English' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
  { code: 'fr', name: 'French', flag: '🇫🇷', nativeName: 'Français' },
  { code: 'de', name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', nativeName: '한국어' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', nativeName: 'हिन्दी' },
];

// No limited support languages - all 10 languages have full Wiktionary support
const LIMITED_SUPPORT_LANGUAGES: LanguageOption[] = [];

interface LanguagePackInfo {
  dictionaryInstalled: boolean;
  translatorInstalled: boolean;
  downloadingDictionary: boolean;
  downloadingTranslator: boolean;
  dictionaryProgress: number;
  translatorProgress: number;
  dictionarySize?: number;
  translatorSize?: number;
  error?: string;
}

interface LanguagePackSettingsProps {
  onClose?: () => void;
}

export const LanguagePackSettings: React.FC<LanguagePackSettingsProps> = ({
  onClose,
}) => {
  const [profile, setProfile] = useState<UserLanguageProfile | null>(null);
  const [languagePacks, setLanguagePacks] = useState<Record<string, LanguagePackInfo>>({});
  const [loading, setLoading] = useState(true);
  const [storageInfo, setStorageInfo] = useState<{
    totalSize: number;
    languagePacks: Array<{ language: string; size: number }>;
  }>({ totalSize: 0, languagePacks: [] });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('🔄 LanguagePackSettings: Loading data...');
      setLoading(true);
      
      // Load user profile
      console.log('👤 Loading user profile...');
      const currentProfile = await UserLanguageProfileService.getUserProfile();
      console.log('👤 User profile loaded:', currentProfile);
      setProfile(currentProfile);

      // Check which languages are installed
      console.log('📦 Checking installed languages...');
      const installedLanguages = await LanguagePackManager.getInstalledLanguages();
      console.log('📦 Installed languages:', installedLanguages);
      
      console.log('💾 Getting storage info...');
      const storageData = await LanguagePackManager.getStorageInfo();
      console.log('💾 Storage data:', storageData);
      
      setStorageInfo(storageData);

      // Initialize language pack status
      console.log('🌍 Initializing language pack status...');
      const packStatus: Record<string, LanguagePackInfo> = {};
      
      // Check translation engine availability
      const serviceInfo = getServiceInfo();
      const isMlkitAvailable = serviceInfo.engine === 'mlkit';
      
      for (const lang of SUPPORTED_LANGUAGES) {
        const isDictionaryInstalled = installedLanguages.includes(lang.code);
        
        // Check for ML Kit translation models (only in production builds)
        let isTranslatorInstalled = false;
        if (isMlkitAvailable) {
          try {
            // Dynamic import to check ML Kit status
            const { MlkitUtils } = await import('../services/mlkit');
            const installedModels = await MlkitUtils.getInstalledModels();
            isTranslatorInstalled = installedModels.includes(lang.code);
          } catch (error) {
            console.log(`ML Kit check failed for ${lang.code}:`, error);
            isTranslatorInstalled = false;
          }
        }
        
        console.log(`🔍 ${lang.code}: dictionary = ${isDictionaryInstalled}, translator = ${isTranslatorInstalled} (${serviceInfo.engine})`);
        packStatus[lang.code] = {
          dictionaryInstalled: isDictionaryInstalled,
          translatorInstalled: isTranslatorInstalled,
          downloadingDictionary: false,
          downloadingTranslator: false,
          dictionaryProgress: 0,
          translatorProgress: 0,
          dictionarySize: storageData.languagePacks.find(p => p.language === lang.code)?.size,
          translatorSize: isTranslatorInstalled ? 25 * 1024 * 1024 : undefined // ~25MB for ML Kit models
        };
      }

      setLanguagePacks(packStatus);
      console.log('✅ LanguagePackSettings: Data loaded successfully');

    } catch (error) {
      console.error('❌ Failed to load language pack data:', error);
      Alert.alert('Error', `Failed to load language pack information: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadDictionary = async (languageCode: string) => {
    try {
      const languageInfo = SUPPORTED_LANGUAGES.find(l => l.code === languageCode);
      if (!languageInfo) return;

      // Update UI to show downloading
      setLanguagePacks(prev => ({
        ...prev,
        [languageCode]: {
          ...prev[languageCode],
          downloadingDictionary: true,
          dictionaryProgress: 0,
          error: undefined
        }
      }));

      Alert.alert(
        'Download Dictionary',
        `Download ${languageInfo.name} dictionary?\n\nThis will download approximately 2-3MB of dictionary data for word lookups.`,
        [
          { text: 'Cancel', onPress: () => {
            setLanguagePacks(prev => ({
              ...prev,
              [languageCode]: { ...prev[languageCode], downloadingDictionary: false }
            }));
          }},
          { text: 'Download', onPress: async () => {
            const success = await LanguagePackManager.downloadLanguagePack(
              languageCode,
              (progress) => {
                setLanguagePacks(prev => ({
                  ...prev,
                  [languageCode]: {
                    ...prev[languageCode],
                    dictionaryProgress: progress
                  }
                }));
              }
            );

            if (success) {
              // Update state
              setLanguagePacks(prev => ({
                ...prev,
                [languageCode]: {
                  ...prev[languageCode],
                  dictionaryInstalled: true,
                  downloadingDictionary: false,
                  dictionaryProgress: 100
                }
              }));

              // Refresh data
              await loadData();

              Alert.alert('Success', `${languageInfo.name} dictionary installed successfully!`);
            } else {
              setLanguagePacks(prev => ({
                ...prev,
                [languageCode]: {
                  ...prev[languageCode],
                  downloadingDictionary: false,
                  error: 'Dictionary download failed'
                }
              }));

              Alert.alert('Download Failed', `Failed to download ${languageInfo.name} dictionary. Please try again.`);
            }
          }}
        ]
      );

    } catch (error) {
      console.error(`Failed to download language pack ${languageCode}:`, error);
      
      setLanguagePacks(prev => ({
        ...prev,
        [languageCode]: {
          ...prev[languageCode],
          downloadingDictionary: false,
          error: 'Dictionary download error'
        }
      }));

      Alert.alert('Error', 'Failed to download dictionary');
    }
  };

  const downloadTranslator = async (languageCode: string) => {
    try {
      const languageInfo = SUPPORTED_LANGUAGES.find(l => l.code === languageCode);
      if (!languageInfo) return;

      if (!profile) {
        Alert.alert('Error', 'User profile not loaded');
        return;
      }

      // Update UI to show downloading
      setLanguagePacks(prev => ({
        ...prev,
        [languageCode]: {
          ...prev[languageCode],
          downloadingTranslator: true,
          translatorProgress: 0,
          error: undefined
        }
      }));

      Alert.alert(
        'Download Translation Model',
        `Download ${languageInfo.name} translation model?\n\nThis will download approximately 50-80MB of translation models for sentence translation.`,
        [
          { text: 'Cancel', onPress: () => {
            setLanguagePacks(prev => ({
              ...prev,
              [languageCode]: { ...prev[languageCode], downloadingTranslator: false }
            }));
          }},
          { text: 'Download', onPress: async () => {
            console.log(`📥 Downloading translation model for ${languageCode}`);
            
            try {
              // Import ML Kit utilities dynamically
              const { MlkitUtils } = await import('../services/mlkit');
              
              // Download the model
              await MlkitUtils.ensureModel(languageCode);
              
              // Update state
              setLanguagePacks(prev => ({
                ...prev,
                [languageCode]: {
                  ...prev[languageCode],
                  translatorInstalled: true,
                  downloadingTranslator: false,
                  translatorProgress: 100,
                  translatorSize: 25 * 1024 * 1024 // ~25MB for ML Kit models
                }
              }));

              Alert.alert('Success', `${languageInfo.name} translation model installed successfully!\n\nYou can now translate text offline in this language.`);
            } catch (error) {
              console.error('ML Kit model download failed:', error);
              
              setLanguagePacks(prev => ({
                ...prev,
                [languageCode]: {
                  ...prev[languageCode],
                  downloadingTranslator: false,
                  error: 'Translation model download failed'
                }
              }));
              
              Alert.alert('Download Failed', 'Translation model download failed. This feature requires a production build with ML Kit support.');
            }
          }}
        ]
      );

    } catch (error) {
      console.error(`Failed to download translation model ${languageCode}:`, error);
      
      setLanguagePacks(prev => ({
        ...prev,
        [languageCode]: {
          ...prev[languageCode],
          downloadingTranslator: false,
          error: 'Translation model download error'
        }
      }));

      Alert.alert('Error', 'Failed to download translation model');
    }
  };

  const removeLanguagePack = async (languageCode: string) => {
    try {
      const languageInfo = SUPPORTED_LANGUAGES.find(l => l.code === languageCode);
      if (!languageInfo) return;

      // Check if this language is currently in use
      if (profile && (profile.nativeLanguage === languageCode || profile.targetLanguages.includes(languageCode))) {
        Alert.alert(
          'Cannot Remove',
          `${languageInfo.name} is currently set as your home or target language. Please change your language settings first.`
        );
        return;
      }

      const packInfo = languagePacks[languageCode];
      const hasDict = packInfo?.dictionaryInstalled;
      const hasTranslator = packInfo?.translatorInstalled;
      
      if (!hasDict && !hasTranslator) {
        Alert.alert('Nothing to Remove', `No ${languageInfo.name} components are installed.`);
        return;
      }

      const components = [];
      if (hasDict) components.push('dictionary');
      if (hasTranslator) components.push('translation model');

      Alert.alert(
        'Remove Language Components',
        `Remove ${languageInfo.name} ${components.join(' and ')}?\n\nThis will free up storage space.`,
        [
          { text: 'Cancel' },
          { text: 'Remove', style: 'destructive', onPress: async () => {
            let success = true;
            
            if (hasDict) {
              const dictSuccess = await LanguagePackManager.removeLanguagePack(languageCode);
              success = success && dictSuccess;
            }

            // Remove ML Kit translation model
            if (hasTranslator) {
              try {
                const { MlkitUtils } = await import('../services/mlkit');
                await MlkitUtils.deleteModel(languageCode);
                console.log(`🗑️ Removed translation model for ${languageCode}`);
              } catch (error) {
                console.error('Failed to remove ML Kit model:', error);
                success = false;
              }
            }
            
            if (success) {
              setLanguagePacks(prev => ({
                ...prev,
                [languageCode]: {
                  ...prev[languageCode],
                  dictionaryInstalled: false,
                  translatorInstalled: false,
                  dictionarySize: undefined,
                  translatorSize: undefined
                }
              }));

              await loadData();
              Alert.alert('Success', `${languageInfo.name} components removed`);
            } else {
              Alert.alert('Error', 'Failed to remove some components');
            }
          }}
        ]
      );

    } catch (error) {
      console.error(`Failed to remove language pack ${languageCode}:`, error);
      Alert.alert('Error', 'Failed to remove language pack');
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)}KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const renderLanguageOption = (language: LanguageOption, isLimitedSupport = false) => {
    const packInfo = languagePacks[language.code] || {
      dictionaryInstalled: false,
      translatorInstalled: false,
      downloadingDictionary: false,
      downloadingTranslator: false,
      dictionaryProgress: 0,
      translatorProgress: 0
    };

    const isCurrentLanguage = profile && (
      profile.nativeLanguage === language.code || 
      profile.targetLanguages.includes(language.code)
    );

    return (
      <View key={language.code} style={styles.languageOption}>
        <View style={styles.languageInfo}>
          <Text style={styles.flag}>{language.flag}</Text>
          <View style={styles.languageDetails}>
            <Text style={styles.languageName}>{language.name}</Text>
            <Text style={styles.nativeName}>{language.nativeName}</Text>
            {isCurrentLanguage && (
              <Text style={styles.currentLanguageText}>Currently in use</Text>
            )}
          </View>
        </View>

        <View style={styles.languageActions}>
          {/* Size Info */}
          <View style={styles.sizeInfo}>
            {packInfo.dictionarySize && (
              <Text style={styles.sizeText}>Dict: {formatSize(packInfo.dictionarySize)}</Text>
            )}
            {packInfo.translatorSize && (
              <Text style={styles.sizeText}>Trans: {formatSize(packInfo.translatorSize)}</Text>
            )}
          </View>

          {/* Dictionary Component */}
          <View style={styles.componentRow}>
            <Text style={styles.componentLabel}>📖 Dictionary</Text>
            {isLimitedSupport ? (
              <Text style={styles.notAvailableText}>❌ Not Available</Text>
            ) : packInfo.downloadingDictionary ? (
              <View style={styles.downloadingContainer}>
                <ActivityIndicator size="small" color="#2196f3" />
                <Text style={styles.progressText}>{packInfo.dictionaryProgress}%</Text>
              </View>
            ) : packInfo.dictionaryInstalled ? (
              <Text style={styles.installedText}>✅ Installed</Text>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, styles.downloadButton]}
                onPress={() => downloadDictionary(language.code)}
              >
                <Text style={styles.actionButtonText}>Download</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Translation Model Component */}
          <View style={styles.componentRow}>
            <Text style={styles.componentLabel}>🌐 Translator</Text>
            {packInfo.downloadingTranslator ? (
              <View style={styles.downloadingContainer}>
                <ActivityIndicator size="small" color="#2196f3" />
                <Text style={styles.progressText}>{packInfo.translatorProgress}%</Text>
              </View>
            ) : packInfo.translatorInstalled ? (
              <Text style={styles.installedText}>✅ Installed</Text>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, styles.downloadButton]}
                onPress={() => downloadTranslator(language.code)}
              >
                <Text style={styles.actionButtonText}>Download</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Remove Button */}
          {(packInfo.dictionaryInstalled || packInfo.translatorInstalled) && (
            <TouchableOpacity
              style={[styles.actionButton, styles.removeButton, { marginTop: 8 }]}
              onPress={() => removeLanguagePack(language.code)}
              disabled={isCurrentLanguage}
            >
              <Text style={[styles.actionButtonText, isCurrentLanguage && styles.disabledText]}>
                Remove Components
              </Text>
            </TouchableOpacity>
          )}

          {packInfo.error && (
            <Text style={styles.errorText}>{packInfo.error}</Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196f3" />
          <Text style={styles.loadingText}>Loading language packs...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Language Packs</Text>
        <Text style={styles.subtitle}>
          Manage offline dictionaries
        </Text>
      </View>

      <View style={styles.storageInfo}>
        <Text style={styles.storageTitle}>📦 Storage Usage</Text>
        <Text style={styles.storageText}>
          Total: {formatSize(storageInfo.totalSize)} • {storageInfo.languagePacks.length} dictionaries
        </Text>
        <Text style={styles.storageText}>
          Translation: {getServiceInfo().engine === 'mlkit' ? 'ML Kit models available' : 'Online mode (Expo Go)'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top 10 Languages - Full Support</Text>
        <Text style={styles.sectionSubtitle}>Bilingual dictionaries + ML Kit translation models</Text>
        {SUPPORTED_LANGUAGES.map(renderLanguageOption)}
      </View>

      {LIMITED_SUPPORT_LANGUAGES.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Limited Support Languages</Text>
          <Text style={styles.sectionSubtitle}>ML Kit translation only - no dictionary available</Text>
          {LIMITED_SUPPORT_LANGUAGES.map((language) => renderLanguageOption(language, true))}
        </View>
      )}

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>ℹ️ About Language Packs</Text>
        <Text style={styles.infoText}>
          • Dictionary: Optimal bilingual dictionaries (Wiktionary){'\n'}
          • Translation: ML Kit on-device models for 58+ languages{'\n'}
          • Strategy: Best source chosen per language pair (verified URLs){'\n'}
          • Coverage: English, Spanish, French, German, Italian, Portuguese, Russian, Korean, Arabic, Hindi{'\n'}
          • All resources work completely offline after download
        </Text>
      </View>

      {onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Done</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  storageInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  storageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  storageText: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageDetails: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  nativeName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  currentLanguageText: {
    fontSize: 12,
    color: '#2196f3',
    fontWeight: '500',
    marginTop: 2,
  },
  languageActions: {
    alignItems: 'flex-end',
    flex: 1,
    paddingLeft: 12,
  },
  sizeInfo: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  componentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingVertical: 4,
  },
  componentLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    flex: 1,
  },
  installedText: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '500',
  },
  notAvailableText: {
    fontSize: 12,
    color: '#ff9800',
    fontWeight: '500',
  },
  sizeText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  downloadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 12,
    color: '#2196f3',
    marginLeft: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 70,
    alignItems: 'center',
  },
  downloadButton: {
    backgroundColor: '#2196f3',
  },
  removeButton: {
    backgroundColor: '#f44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  disabledText: {
    color: '#ccc',
  },
  errorText: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 4,
  },
  infoSection: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1976d2',
    lineHeight: 20,
  },
  closeButton: {
    backgroundColor: '#2196f3',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LanguagePackSettings;