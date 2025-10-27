import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { 
  TranslationPreferencesService, 
  TranslationPreferences, 
  DEFAULT_TRANSLATION_PREFERENCES,
  TranslationAction
} from '../services/translationPreferencesService';

interface TranslationSettingsScreenProps {
  onBack?: () => void;
}

export default function TranslationSettingsScreen({ onBack }: TranslationSettingsScreenProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [preferences, setPreferences] = useState<TranslationPreferences>(DEFAULT_TRANSLATION_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await TranslationPreferencesService.getPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Failed to load preferences:', error);
      Alert.alert('Error', 'Failed to load translation settings');
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = async <K extends keyof TranslationPreferences>(
    key: K,
    value: TranslationPreferences[K]
  ) => {
    try {
      setIsSaving(true);
      const updatedPrefs = await TranslationPreferencesService.updatePreferences({ [key]: value });
      setPreferences(updatedPrefs);
    } catch (error) {
      console.error('Failed to update preference:', error);
      Alert.alert('Error', 'Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = async () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all translation settings to defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSaving(true);
              const defaultPrefs = await TranslationPreferencesService.resetToDefaults();
              setPreferences(defaultPrefs);
              Alert.alert('Success', 'Settings reset to defaults');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset settings');
            } finally {
              setIsSaving(false);
            }
          }
        }
      ]
    );
  };

  const renderActionSelector = (
    title: string,
    subtitle: string,
    currentValue: TranslationAction,
    onValueChange: (value: TranslationAction) => void,
    options: TranslationAction[] = ['word', 'sentence', 'both', 'smart', 'disabled']
  ) => {
    const actionLabels: Record<TranslationAction, string> = {
      word: '📝 Word Only',
      sentence: '📖 Sentence Only',
      both: '🔄 Both',
      smart: '🧠 Smart Detection',
      disabled: '🚫 Disabled'
    };

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        <View style={styles.optionsContainer}>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionButton,
                currentValue === option && styles.selectedOption
              ]}
              onPress={() => onValueChange(option)}
            >
              <Text
                style={[
                  styles.optionText,
                  currentValue === option && styles.selectedOptionText
                ]}
              >
                {actionLabels[option]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderSwitch = (
    title: string,
    subtitle: string,
    value: boolean,
    onValueChange: (value: boolean) => void
  ) => (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
        thumbColor={value ? theme.colors.primary : theme.colors.textSecondary}
      />
    </View>
  );

  const renderSlider = (
    title: string,
    subtitle: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onValueChange: (value: number) => void,
    formatValue?: (value: number) => string
  ) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      <View style={styles.sliderContainer}>
        <Text style={styles.sliderValue}>
          {formatValue ? formatValue(value) : value.toString()}
        </Text>
        <View style={styles.sliderControls}>
          <TouchableOpacity
            style={styles.sliderButton}
            onPress={() => onValueChange(Math.max(min, value - step))}
          >
            <Text style={styles.sliderButtonText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sliderButton}
            onPress={() => onValueChange(Math.min(max, value + step))}
          >
            <Text style={styles.sliderButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Translation Settings</Text>
        <TouchableOpacity onPress={resetToDefaults}>
          <Text style={styles.resetButton}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Gesture Actions */}
        <Text style={styles.categoryTitle}>🎯 Gesture Actions</Text>
        
        {renderActionSelector(
          'Single Tap',
          'What happens when you tap once on text',
          preferences.singleTapAction,
          (value) => updatePreference('singleTapAction', value)
        )}

        {renderActionSelector(
          'Double Tap',
          'What happens when you tap twice quickly on text',
          preferences.doubleTapAction,
          (value) => updatePreference('doubleTapAction', value)
        )}

        {renderActionSelector(
          'Long Press',
          'What happens when you press and hold text',
          preferences.longPressAction,
          (value) => updatePreference('longPressAction', value)
        )}

        {/* Display Options */}
        <Text style={styles.categoryTitle}>📱 Display Options</Text>

        {renderSwitch(
          'Show Word Translation',
          'Display individual word translations',
          preferences.showWordTranslation,
          (value) => updatePreference('showWordTranslation', value)
        )}

        {renderSwitch(
          'Show Sentence Translation',
          'Display full sentence translations',
          preferences.showSentenceTranslation,
          (value) => updatePreference('showSentenceTranslation', value)
        )}

        {renderSwitch(
          'Show Definitions',
          'Include dictionary definitions for words',
          preferences.showDefinitions,
          (value) => updatePreference('showDefinitions', value)
        )}

        {renderSwitch(
          'Show Pronunciation',
          'Display pronunciation guides',
          preferences.showPronunciation,
          (value) => updatePreference('showPronunciation', value)
        )}

        {renderSwitch(
          'Show Examples',
          'Include example sentences',
          preferences.showExamples,
          (value) => updatePreference('showExamples', value)
        )}

        {renderSwitch(
          'Show Transliterations',
          'Display transliterations for non-Latin scripts',
          preferences.showTransliterations,
          (value) => updatePreference('showTransliterations', value)
        )}

        {/* Smart Behavior */}
        <Text style={styles.categoryTitle}>🧠 Smart Behavior</Text>

        {renderSwitch(
          'Smart Detection',
          'Automatically choose between word and sentence translation',
          preferences.smartDetection,
          (value) => updatePreference('smartDetection', value)
        )}

        {renderSwitch(
          'Fallback to Sentence',
          'Try sentence translation if word translation fails',
          preferences.fallbackToSentence,
          (value) => updatePreference('fallbackToSentence', value)
        )}

        {renderSwitch(
          'Include Context',
          'Use surrounding text to improve translation accuracy',
          preferences.includeContext,
          (value) => updatePreference('includeContext', value)
        )}

        {preferences.includeContext && renderSlider(
          'Context Length',
          'Number of words to include as context',
          preferences.contextLength,
          1,
          10,
          1,
          (value) => updatePreference('contextLength', value),
          (value) => `${value} words`
        )}

        {/* Translation Services */}
        <Text style={styles.categoryTitle}>🌐 Translation Services</Text>

        {renderSwitch(
          'Prefer Offline',
          'Use offline translation when available (ML Kit)',
          preferences.preferOffline,
          (value) => updatePreference('preferOffline', value)
        )}

        {renderSwitch(
          'Offline Only',
          'Only use offline translation services',
          preferences.enableOfflineOnly,
          (value) => updatePreference('enableOfflineOnly', value)
        )}

        {renderSwitch(
          'Enable Fallback Services',
          'Use backup translation services if primary fails',
          preferences.enableFallbackServices,
          (value) => updatePreference('enableFallbackServices', value)
        )}

        {/* Auto Features */}
        <Text style={styles.categoryTitle}>⚡ Auto Features</Text>

        {renderSwitch(
          'Auto-detect Language',
          'Automatically detect source language',
          preferences.autoSelectLanguage,
          (value) => updatePreference('autoSelectLanguage', value)
        )}

        {renderSwitch(
          'Auto-translate on Selection',
          'Start translation immediately when text is selected',
          preferences.autoTranslateOnSelection,
          (value) => updatePreference('autoTranslateOnSelection', value)
        )}

        {/* Animation & UI */}
        <Text style={styles.categoryTitle}>🎨 Animation & UI</Text>

        {renderSwitch(
          'Enable Animations',
          'Use smooth animations for popup transitions',
          preferences.enableAnimations,
          (value) => updatePreference('enableAnimations', value)
        )}

        {preferences.enableAnimations && renderSlider(
          'Animation Duration',
          'Speed of popup animations',
          preferences.animationDuration,
          100,
          1000,
          100,
          (value) => updatePreference('animationDuration', value),
          (value) => `${value}ms`
        )}

        {/* Accessibility */}
        <Text style={styles.categoryTitle}>♿ Accessibility</Text>

        {renderSwitch(
          'Haptic Feedback',
          'Vibrate when translation popup appears',
          preferences.enableHapticFeedback,
          (value) => updatePreference('enableHapticFeedback', value)
        )}

        {renderSwitch(
          'VoiceOver Support',
          'Enhanced support for screen readers',
          preferences.enableVoiceOver,
          (value) => updatePreference('enableVoiceOver', value)
        )}

        {renderSwitch(
          'Large Text Mode',
          'Use larger fonts for better readability',
          preferences.largeTextMode,
          (value) => updatePreference('largeTextMode', value)
        )}

        <View style={styles.footerSpace} />
      </ScrollView>

      {isSaving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  resetButton: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.error,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 24,
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  selectedOption: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  selectedOptionText: {
    color: theme.colors.onPrimary,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '40',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  sliderControls: {
    flexDirection: 'row',
    gap: 8,
  },
  sliderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
  footerSpace: {
    height: 40,
  },
  savingIndicator: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  savingText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.text,
  },
});