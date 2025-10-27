import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '../navigation/SimpleNavigator';
import { useTheme } from '../hooks/useTheme';
import { UserLanguageProfile } from '@polybook/shared/src/types';
import UserLanguageProfileService from '../services/userLanguageProfileService';

export default function LanguageProfileScreen() {
  const { goBack } = useNavigation();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [profile, setProfile] = useState<UserLanguageProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Load user profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const userProfile = await UserLanguageProfileService.getUserProfile();
      setProfile(userProfile);
    } catch (error) {
      console.error('LanguageProfileScreen: Error loading profile:', error);
      Alert.alert('Error', 'Failed to load language profile');
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile || !hasChanges) return;

    try {
      await UserLanguageProfileService.saveUserProfile(profile);
      setHasChanges(false);
      Alert.alert('Success', 'Language profile saved successfully');
    } catch (error) {
      console.error('LanguageProfileScreen: Error saving profile:', error);
      Alert.alert('Error', 'Failed to save language profile');
    }
  };

  const updateProfile = (updates: Partial<UserLanguageProfile>) => {
    if (!profile) return;

    setProfile(prev => prev ? { ...prev, ...updates } : null);
    setHasChanges(true);
  };

  const handleNativeLanguageChange = (language: string) => {
    if (!profile) return;

    // Update target languages when native language changes
    const newTargetLanguages = language === 'en' ? ['es'] : ['en'];
    
    updateProfile({
      nativeLanguage: language,
      targetLanguages: newTargetLanguages,
      preferredDefinitionLanguage: language,
    });
  };

  const handleProficiencyChange = (language: string, level: 'beginner' | 'intermediate' | 'advanced') => {
    if (!profile) return;

    updateProfile({
      proficiencyLevels: {
        ...profile.proficiencyLevels,
        [language]: level
      }
    });
  };

  const renderLanguageSelector = (
    title: string,
    selectedLanguage: string,
    languages: Array<{ code: string; name: string }>,
    onSelect: (language: string) => void
  ) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.languageGrid}>
        {languages.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.languageOption,
              selectedLanguage === lang.code && styles.languageOptionSelected,
            ]}
            onPress={() => onSelect(lang.code)}
          >
            <Text
              style={[
                styles.languageOptionText,
                selectedLanguage === lang.code && styles.languageOptionTextSelected,
              ]}
            >
              {lang.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderProficiencySelector = (language: string) => {
    if (!profile) return null;

    const currentLevel = profile.proficiencyLevels[language] || 'beginner';
    const levels: Array<{ key: 'beginner' | 'intermediate' | 'advanced'; label: string; description: string }> = [
      { key: 'beginner', label: 'Beginner', description: 'Learning basic vocabulary' },
      { key: 'intermediate', label: 'Intermediate', description: 'Can understand complex texts' },
      { key: 'advanced', label: 'Advanced', description: 'Near-native proficiency' },
    ];

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {UserLanguageProfileService.getLanguageDisplayName(language, profile.nativeLanguage)} Proficiency
        </Text>
        <View style={styles.proficiencyGrid}>
          {levels.map((level) => (
            <TouchableOpacity
              key={level.key}
              style={[
                styles.proficiencyOption,
                currentLevel === level.key && styles.proficiencyOptionSelected,
              ]}
              onPress={() => handleProficiencyChange(language, level.key)}
            >
              <Text
                style={[
                  styles.proficiencyTitle,
                  currentLevel === level.key && styles.proficiencyTitleSelected,
                ]}
              >
                {level.label}
              </Text>
              <Text
                style={[
                  styles.proficiencyDescription,
                  currentLevel === level.key && styles.proficiencyDescriptionSelected,
                ]}
              >
                {level.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderDictionaryPreferences = () => {
    if (!profile) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dictionary Preferences</Text>
        
        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Text style={styles.preferenceLabel}>Show Pronunciation</Text>
            <Text style={styles.preferenceDescription}>
              Display IPA pronunciation and audio controls
            </Text>
          </View>
          <Switch
            value={profile.showPronunciation}
            onValueChange={(value) => updateProfile({ showPronunciation: value })}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={theme.colors.background}
          />
        </View>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Text style={styles.preferenceLabel}>Show Examples</Text>
            <Text style={styles.preferenceDescription}>
              Include example sentences with translations
            </Text>
          </View>
          <Switch
            value={profile.showExamples}
            onValueChange={(value) => updateProfile({ showExamples: value })}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={theme.colors.background}
          />
        </View>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Text style={styles.preferenceLabel}>Show Etymology</Text>
            <Text style={styles.preferenceDescription}>
              Display word origins and linguistic history
            </Text>
          </View>
          <Switch
            value={profile.showEtymology}
            onValueChange={(value) => updateProfile({ showEtymology: value })}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={theme.colors.background}
          />
        </View>

        <View style={styles.dictionaryModeSection}>
          <Text style={styles.subsectionTitle}>Default Dictionary Mode</Text>
          <View style={styles.dictionaryModeGrid}>
            {[
              { key: 'translation', label: 'Translation', description: 'Show translations only' },
              { key: 'definition', label: 'Definition', description: 'Show definitions only' },
              { key: 'both', label: 'Both', description: 'Show translations and definitions' },
            ].map((mode) => (
              <TouchableOpacity
                key={mode.key}
                style={[
                  styles.dictionaryModeOption,
                  profile.defaultDictionaryMode === mode.key && styles.dictionaryModeOptionSelected,
                ]}
                onPress={() => updateProfile({ defaultDictionaryMode: mode.key as any })}
              >
                <Text
                  style={[
                    styles.dictionaryModeLabel,
                    profile.defaultDictionaryMode === mode.key && styles.dictionaryModeLabelSelected,
                  ]}
                >
                  {mode.label}
                </Text>
                <Text
                  style={[
                    styles.dictionaryModeDescription,
                    profile.defaultDictionaryMode === mode.key && styles.dictionaryModeDescriptionSelected,
                  ]}
                >
                  {mode.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderUsageStats = () => {
    if (!profile) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Usage Statistics</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.totalLookups.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Lookups</Text>
          </View>
          
          {Object.entries(profile.languageLookupCounts).map(([language, count]) => (
            <View key={language} style={styles.statItem}>
              <Text style={styles.statValue}>{count.toLocaleString()}</Text>
              <Text style={styles.statLabel}>
                {UserLanguageProfileService.getLanguageDisplayName(language, profile.nativeLanguage)} Lookups
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (isLoading || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack}>
            <Text style={[styles.backButton, { color: theme.colors.primary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.headerText }]}>
            Language Profile
          </Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const supportedLanguages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Text style={[styles.backButton, { color: theme.colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.headerText }]}>
          Language Profile
        </Text>
        {hasChanges ? (
          <TouchableOpacity onPress={saveProfile}>
            <Text style={[styles.saveButton, { color: theme.colors.primary }]}>Save</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Native Language */}
        {renderLanguageSelector(
          'Native Language',
          profile.nativeLanguage,
          supportedLanguages,
          handleNativeLanguageChange
        )}

        {/* Target Languages Proficiency */}
        {profile.targetLanguages.map((language) => renderProficiencySelector(language))}

        {/* Dictionary Preferences */}
        {renderDictionaryPreferences()}

        {/* Usage Statistics */}
        {renderUsageStats()}

        {/* Reset Profile */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => {
              Alert.alert(
                'Reset Profile',
                'This will reset all language preferences to defaults. Are you sure?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        const newProfile = await UserLanguageProfileService.resetProfile();
                        setProfile(newProfile);
                        setHasChanges(false);
                        Alert.alert('Success', 'Profile reset to defaults');
                      } catch (error) {
                        Alert.alert('Error', 'Failed to reset profile');
                      }
                    },
                  },
                ]
              );
            }}
          >
            <Text style={styles.resetButtonText}>Reset to Defaults</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.border + '40',
    backgroundColor: theme.colors.header + 'F8',
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 60,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
    marginTop: 16,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  languageOption: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
    minWidth: 100,
  },
  languageOptionSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  languageOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  languageOptionTextSelected: {
    color: theme.colors.background,
  },
  proficiencyGrid: {
    gap: 12,
  },
  proficiencyOption: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  proficiencyOptionSelected: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary,
  },
  proficiencyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  proficiencyTitleSelected: {
    color: theme.colors.primary,
  },
  proficiencyDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  proficiencyDescriptionSelected: {
    color: theme.colors.primary,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 16,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  dictionaryModeSection: {
    marginTop: 16,
  },
  dictionaryModeGrid: {
    gap: 8,
  },
  dictionaryModeOption: {
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  dictionaryModeOptionSelected: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary,
  },
  dictionaryModeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  dictionaryModeLabelSelected: {
    color: theme.colors.primary,
  },
  dictionaryModeDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  dictionaryModeDescriptionSelected: {
    color: theme.colors.primary,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    flex: 1,
    minWidth: 120,
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: theme.colors.error + '20',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.error,
  },
});