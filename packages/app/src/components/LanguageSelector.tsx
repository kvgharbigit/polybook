import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { UserLanguageProfile } from '@polybook/shared/src/types';
import UserLanguageProfileService from '../services/userLanguageProfileService';
import LanguagePackManager from '../services/languagePackManager';

interface LanguageOption {
  code: string;
  name: string;
  flag: string;
  nativeName: string;
}

const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', flag: '🇬🇧', nativeName: 'English' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
  { code: 'zh', name: 'Mandarin', flag: '🇨🇳', nativeName: '中文' },
  { code: 'fr', name: 'French', flag: '🇫🇷', nativeName: 'Français' },
  { code: 'de', name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', nativeName: '한국어' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', nativeName: 'हिन्दी' },
];

interface LanguageSelectorProps {
  onLanguageChange?: (profile: UserLanguageProfile) => void;
  onClose?: () => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  onLanguageChange,
  onClose,
}) => {
  const [profile, setProfile] = useState<UserLanguageProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const currentProfile = await UserLanguageProfileService.getUserProfile();
      setProfile(currentProfile);
    } catch (error) {
      console.error('Failed to load language profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHomeLanguageChange = async (languageCode: string) => {
    if (!profile) return;

    try {
      // Determine appropriate target language
      const getDefaultTargetLanguage = (homeLanguage: string): string => {
        switch (homeLanguage) {
          case 'es': return 'en'; // Spanish → English
          case 'zh': return 'en'; // Mandarin → English
          case 'fr': return 'en'; // French → English
          case 'de': return 'en'; // German → English
          case 'it': return 'en'; // Italian → English
          case 'pt': return 'en'; // Portuguese → English
          case 'ru': return 'en'; // Russian → English
          case 'ja': return 'en'; // Japanese → English
          case 'ko': return 'en'; // Korean → English
          case 'ar': return 'en'; // Arabic → English
          case 'hi': return 'en'; // Hindi → English
          default: return 'es';   // English → Spanish (most popular)
        }
      };

      const newTargetLanguage = getDefaultTargetLanguage(languageCode);
      
      // Show confirmation with download info
      const homeLanguageName = SUPPORTED_LANGUAGES.find(l => l.code === languageCode)?.name;
      const targetLanguageName = SUPPORTED_LANGUAGES.find(l => l.code === newTargetLanguage)?.name;
      
      Alert.alert(
        'Language Selection',
        `Home: ${homeLanguageName}\nTarget: ${targetLanguageName}\n\nThis will download translation models (~100MB). Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue', 
            onPress: () => updateLanguageProfile(languageCode, newTargetLanguage)
          }
        ]
      );

    } catch (error) {
      console.error('Error changing home language:', error);
      Alert.alert('Error', 'Failed to update language settings');
    }
  };

  const handleTargetLanguageChange = async (languageCode: string) => {
    if (!profile) return;

    try {
      const homeLanguageName = SUPPORTED_LANGUAGES.find(l => l.code === profile.nativeLanguage)?.name;
      const targetLanguageName = SUPPORTED_LANGUAGES.find(l => l.code === languageCode)?.name;
      
      Alert.alert(
        'Target Language',
        `Home: ${homeLanguageName}\nTarget: ${targetLanguageName}\n\nThis will download translation models (~100MB). Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue', 
            onPress: () => updateLanguageProfile(profile.nativeLanguage, languageCode)
          }
        ]
      );

    } catch (error) {
      console.error('Error changing target language:', error);
      Alert.alert('Error', 'Failed to update language settings');
    }
  };

  const updateLanguageProfile = async (homeLanguage: string, targetLanguage: string) => {
    if (!profile) return;

    try {
      setLoading(true);

      // Download only the specific language pair needed
      const homeLanguageName = SUPPORTED_LANGUAGES.find(l => l.code === homeLanguage)?.name;
      const targetLanguageName = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name;
      
      Alert.alert(
        'Downloading Language Packs',
        `Downloading ${homeLanguageName} and ${targetLanguageName} dictionaries and translation models...`,
        [{ text: 'OK' }]
      );

      const downloadSuccess = await LanguagePackManager.downloadLanguagePair(
        homeLanguage,
        targetLanguage,
        (step, progress) => {
          console.log(`📦 ${step} (${progress}%)`);
        }
      );

      if (!downloadSuccess) {
        Alert.alert(
          'Download Failed',
          'Some language packs could not be downloaded. The dictionary will work with limited functionality.',
          [{ text: 'Continue Anyway' }]
        );
      }

      // Update profile regardless of download success
      const updatedProfile = await UserLanguageProfileService.updateLanguagePreferences({
        nativeLanguage: homeLanguage,
        targetLanguages: [targetLanguage],
        preferredDefinitionLanguage: homeLanguage
      });

      setProfile(updatedProfile);
      onLanguageChange?.(updatedProfile);

      Alert.alert(
        'Success', 
        downloadSuccess 
          ? 'Language settings updated and packs downloaded successfully!'
          : 'Language settings updated! Some packs may still be downloading.',
        [{ text: 'OK', onPress: onClose }]
      );

    } catch (error) {
      console.error('Error updating language profile:', error);
      Alert.alert('Error', 'Failed to update language settings');
    } finally {
      setLoading(false);
    }
  };

  const renderLanguageOption = (
    language: LanguageOption, 
    isSelected: boolean, 
    onPress: () => void
  ) => (
    <TouchableOpacity
      key={language.code}
      style={[styles.languageOption, isSelected && styles.selectedLanguage]}
      onPress={onPress}
      disabled={loading}
    >
      <Text style={styles.flag}>{language.flag}</Text>
      <View style={styles.languageInfo}>
        <Text style={[styles.languageName, isSelected && styles.selectedText]}>
          {language.name}
        </Text>
        <Text style={[styles.nativeName, isSelected && styles.selectedText]}>
          {language.nativeName}
        </Text>
      </View>
      {isSelected && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
  );

  if (loading || !profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading language settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Language Settings</Text>
        <Text style={styles.subtitle}>
          Choose your home language and what language you want to learn
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏠 Home Language (Your native language)</Text>
        <Text style={styles.sectionSubtitle}>
          Dictionary definitions will be shown in this language
        </Text>
        {SUPPORTED_LANGUAGES.map(language =>
          renderLanguageOption(
            language,
            language.code === profile.nativeLanguage,
            () => handleHomeLanguageChange(language.code)
          )
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 Target Language (Language you're learning)</Text>
        <Text style={styles.sectionSubtitle}>
          Books you read and words you tap for translation
        </Text>
        {SUPPORTED_LANGUAGES
          .filter(lang => lang.code !== profile.nativeLanguage)
          .map(language =>
            renderLanguageOption(
              language,
              profile.targetLanguages.includes(language.code),
              () => handleTargetLanguageChange(language.code)
            )
          )}
      </View>

      <View style={styles.downloadInfo}>
        <Text style={styles.downloadTitle}>📦 Download Information</Text>
        <Text style={styles.downloadText}>
          • Translation models: ~100MB per language pair{'\n'}
          • Dictionary data: ~20MB per language{'\n'}
          • Downloads happen automatically when needed{'\n'}
          • All data works offline after download
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
  section: {
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  selectedLanguage: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
  },
  flag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageInfo: {
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
  selectedText: {
    color: '#1976d2',
  },
  checkmark: {
    fontSize: 18,
    color: '#2196f3',
    fontWeight: 'bold',
  },
  downloadInfo: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    marginVertical: 20,
  },
  downloadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  downloadText: {
    fontSize: 14,
    color: '#666',
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
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
  },
});

export default LanguageSelector;