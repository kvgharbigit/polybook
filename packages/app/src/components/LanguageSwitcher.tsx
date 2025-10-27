import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { UserLanguageProfile } from '@polybook/shared/src/types';
import UserLanguageProfileService from '../services/userLanguageProfileService';
import { useTheme } from '../hooks/useTheme';

interface LanguageSwitcherProps {
  onLanguageChanged?: (profile: UserLanguageProfile) => void;
}

export default function LanguageSwitcher({ onLanguageChanged }: LanguageSwitcherProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [userProfile, setUserProfile] = useState<UserLanguageProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supportedLanguages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  ];

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const profile = await UserLanguageProfileService.getUserProfile();
      setUserProfile(profile);
    } catch (error) {
      console.error('LanguageSwitcher: Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLanguageChange = async (languageCode: string) => {
    if (!userProfile || userProfile.nativeLanguage === languageCode) return;

    try {
      setIsLoading(true);

      // Determine target languages based on native language
      const getTargetLanguages = (native: string): string[] => {
        switch (native) {
          case 'es': return ['en']; // Spanish users learn English
          case 'fr': return ['en']; // French users learn English  
          case 'de': return ['en']; // German users learn English
          default: return ['es'];   // English users learn Spanish by default
        }
      };

      const updatedProfile = await UserLanguageProfileService.updateLanguagePreferences({
        nativeLanguage: languageCode,
        targetLanguages: getTargetLanguages(languageCode),
        preferredDefinitionLanguage: languageCode,
      });

      setUserProfile(updatedProfile);
      
      if (onLanguageChanged) {
        onLanguageChanged(updatedProfile);
      }

      const selectedLang = supportedLanguages.find(l => l.code === languageCode);
      Alert.alert(
        'Language Changed',
        `Your home language is now ${selectedLang?.name}. Word translations will now be shown in ${selectedLang?.name}.`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('LanguageSwitcher: Error changing language:', error);
      Alert.alert('Error', 'Failed to change language');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !userProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading language settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Home Language</Text>
      <Text style={styles.description}>
        Word translations will be shown in this language
      </Text>
      
      <View style={styles.languageGrid}>
        {supportedLanguages.map((language) => (
          <TouchableOpacity
            key={language.code}
            style={[
              styles.languageOption,
              userProfile.nativeLanguage === language.code && styles.languageOptionSelected,
              isLoading && styles.languageOptionDisabled,
            ]}
            onPress={() => handleLanguageChange(language.code)}
            disabled={isLoading}
          >
            <Text style={styles.languageFlag}>{language.flag}</Text>
            <Text
              style={[
                styles.languageText,
                userProfile.nativeLanguage === language.code && styles.languageTextSelected,
              ]}
            >
              {language.name}
            </Text>
            {userProfile.nativeLanguage === language.code && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          Currently learning: {userProfile.targetLanguages.map(lang => 
            supportedLanguages.find(l => l.code === lang)?.name
          ).join(', ')}
        </Text>
        <Text style={styles.infoText}>
          Total lookups: {userProfile.totalLookups}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  languageGrid: {
    gap: 12,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  languageOptionSelected: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary,
  },
  languageOptionDisabled: {
    opacity: 0.6,
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  languageTextSelected: {
    color: theme.colors.primary,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  infoContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
});