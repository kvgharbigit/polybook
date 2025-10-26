import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '../navigation/SimpleNavigator';
import { useTheme } from '../hooks/useTheme';
import { useFont } from '../hooks/useFont';
import { ttsService, TTSVoice } from '../services/ttsService';
import { Theme } from '@polybook/shared/src/types';

export default function SettingsScreen() {
  const { goBack } = useNavigation();
  const { theme, setTheme, currentThemeName } = useTheme();
  const { 
    settings: fontSettings, 
    presets: fontPresets, 
    currentPreset,
    setFontSize, 
    setLineHeight,
    applyPreset,
    resetToDefaults, 
  } = useFont();

  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [autoSaveWords, setAutoSaveWords] = useState(true);
  const [availableVoices, setAvailableVoices] = useState<TTSVoice[]>([]);
  const [currentVoice, setCurrentVoice] = useState<TTSVoice | undefined>();
  const [ttsRate, setTtsRate] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(1.0);

  useEffect(() => {
    loadTTSSettings();
  }, []);

  const loadTTSSettings = async () => {
    try {
      const voices = await ttsService.getAvailableVoices();
      setAvailableVoices(voices);
      setCurrentVoice(ttsService.getCurrentVoice());
      
      const state = ttsService.getState();
      setTtsRate(state.rate);
      setTtsPitch(state.pitch);
    } catch (error) {
      console.error('Error loading TTS settings:', error);
    }
  };

  const styles = createStyles(theme);

  const renderThemeOption = (themeName: Theme, emoji: string, label: string) => (
    <TouchableOpacity
      key={themeName}
      style={[
        styles.optionButton,
        currentThemeName === themeName && styles.optionButtonActive,
      ]}
      onPress={() => setTheme(themeName)}
    >
      <Text style={styles.optionEmoji}>{emoji}</Text>
      <Text style={[
        styles.optionText,
        currentThemeName === themeName && styles.optionTextActive,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderFontPreset = (preset: any) => (
    <TouchableOpacity
      key={preset.name}
      style={[
        styles.optionButton,
        currentPreset?.name === preset.name && styles.optionButtonActive,
      ]}
      onPress={() => applyPreset(preset)}
    >
      <Text style={[
        styles.presetText,
        currentPreset?.name === preset.name && styles.optionTextActive,
        { fontSize: preset.settings.fontSize * 0.8 },
      ]}>
        Aa
      </Text>
      <Text style={[
        styles.optionText,
        currentPreset?.name === preset.name && styles.optionTextActive,
      ]}>
        {preset.name}
      </Text>
    </TouchableOpacity>
  );

  const handleVoiceSelect = (voice: TTSVoice) => {
    ttsService.setVoice(voice.identifier);
    setCurrentVoice(voice);
  };

  const handleTTSRateChange = (rate: number) => {
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));
    ttsService.setRate(clampedRate);
    setTtsRate(clampedRate);
  };

  const handleTTSPitchChange = (pitch: number) => {
    const clampedPitch = Math.max(0.5, Math.min(2.0, pitch));
    ttsService.setPitch(clampedPitch);
    setTtsPitch(clampedPitch);
  };

  const testTTS = async () => {
    try {
      await ttsService.speak('This is a test of the text to speech system', {
        rate: ttsRate,
        pitch: ttsPitch,
      });
    } catch (error) {
      Alert.alert('TTS Error', 'Failed to test text-to-speech. Please try again.');
    }
  };

  const renderVoiceOption = (voice: TTSVoice) => (
    <TouchableOpacity
      key={voice.identifier}
      style={[
        styles.voiceOption,
        currentVoice?.identifier === voice.identifier && styles.voiceOptionActive,
      ]}
      onPress={() => handleVoiceSelect(voice)}
    >
      <View style={styles.voiceInfo}>
        <Text style={[
          styles.voiceName,
          currentVoice?.identifier === voice.identifier && styles.voiceNameActive,
        ]}>
          {voice.name}
        </Text>
        <Text style={[
          styles.voiceLanguage,
          currentVoice?.identifier === voice.identifier && styles.voiceLanguageActive,
        ]}>
          {voice.language} • {voice.quality}
        </Text>
      </View>
      {currentVoice?.identifier === voice.identifier && (
        <Text style={styles.voiceSelected}>✓</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack()}>
          <Text style={[styles.backButton, { color: theme.colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.headerText }]}>Settings</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Reading Theme Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reading Theme</Text>
          <Text style={styles.sectionDescription}>
            Choose your preferred reading theme for comfortable reading
          </Text>
          <View style={styles.optionGrid}>
            {renderThemeOption('light', '☀️', 'Light')}
            {renderThemeOption('dark', '🌙', 'Dark')}
            {renderThemeOption('sepia', '📜', 'Sepia')}
          </View>
        </View>

        {/* Font Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Font Settings</Text>
          <Text style={styles.sectionDescription}>
            Adjust text size and spacing for optimal reading
          </Text>
          
          {/* Font Size Presets */}
          <Text style={styles.subsectionTitle}>Quick Size Presets</Text>
          <View style={styles.optionGrid}>
            {fontPresets.map(renderFontPreset)}
          </View>

          {/* Custom Font Controls */}
          <Text style={styles.subsectionTitle}>Custom Adjustments</Text>
          <View style={styles.customControls}>
            <View style={styles.sliderContainer}>
              <Text style={styles.controlLabel}>Font Size: {Math.round(fontSettings.fontSize)}px</Text>
              <View style={styles.sliderButtonContainer}>
                <TouchableOpacity 
                  style={styles.sliderButton}
                  onPress={() => setFontSize(fontSettings.fontSize - 1)}
                >
                  <Text style={styles.sliderButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.sliderValue}>{Math.round(fontSettings.fontSize)}</Text>
                <TouchableOpacity 
                  style={styles.sliderButton}
                  onPress={() => setFontSize(fontSettings.fontSize + 1)}
                >
                  <Text style={styles.sliderButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.controlLabel}>Line Height: {Math.round(fontSettings.lineHeight)}px</Text>
              <View style={styles.sliderButtonContainer}>
                <TouchableOpacity 
                  style={styles.sliderButton}
                  onPress={() => setLineHeight(fontSettings.lineHeight - 1)}
                >
                  <Text style={styles.sliderButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.sliderValue}>{Math.round(fontSettings.lineHeight)}</Text>
                <TouchableOpacity 
                  style={styles.sliderButton}
                  onPress={() => setLineHeight(fontSettings.lineHeight + 1)}
                >
                  <Text style={styles.sliderButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Reset Button */}
          <TouchableOpacity style={styles.resetButton} onPress={resetToDefaults}>
            <Text style={styles.resetButtonText}>Reset to Defaults</Text>
          </TouchableOpacity>
        </View>

        {/* Reading Features Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reading Features</Text>
          
          <View style={styles.switchContainer}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Text-to-Speech</Text>
              <Text style={styles.switchDescription}>
                Enable word pronunciation when tapping
              </Text>
            </View>
            <Switch
              value={ttsEnabled}
              onValueChange={setTtsEnabled}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.background}
            />
          </View>

          <View style={styles.switchContainer}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Auto-save Words</Text>
              <Text style={styles.switchDescription}>
                Automatically save tapped words to vocabulary
              </Text>
            </View>
            <Switch
              value={autoSaveWords}
              onValueChange={setAutoSaveWords}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.background}
            />
          </View>
        </View>

        {/* TTS Settings Section */}
        {ttsEnabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Text-to-Speech Settings</Text>
            <Text style={styles.sectionDescription}>
              Customize voice, speed, and pitch for word pronunciation
            </Text>

            {/* Voice Selection */}
            <Text style={styles.subsectionTitle}>Voice Selection</Text>
            <View style={styles.voiceContainer}>
              {availableVoices.length > 0 ? (
                availableVoices.slice(0, 5).map(renderVoiceOption)
              ) : (
                <Text style={styles.noVoicesText}>Loading voices...</Text>
              )}
            </View>

            {/* Rate Control */}
            <Text style={styles.subsectionTitle}>Speaking Rate</Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.controlLabel}>Speed: {ttsRate.toFixed(1)}x</Text>
              <View style={styles.sliderButtonContainer}>
                <TouchableOpacity 
                  style={styles.sliderButton}
                  onPress={() => handleTTSRateChange(ttsRate - 0.1)}
                >
                  <Text style={styles.sliderButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.sliderValue}>{ttsRate.toFixed(1)}x</Text>
                <TouchableOpacity 
                  style={styles.sliderButton}
                  onPress={() => handleTTSRateChange(ttsRate + 0.1)}
                >
                  <Text style={styles.sliderButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Pitch Control */}
            <Text style={styles.subsectionTitle}>Voice Pitch</Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.controlLabel}>Pitch: {ttsPitch.toFixed(1)}</Text>
              <View style={styles.sliderButtonContainer}>
                <TouchableOpacity 
                  style={styles.sliderButton}
                  onPress={() => handleTTSPitchChange(ttsPitch - 0.1)}
                >
                  <Text style={styles.sliderButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.sliderValue}>{ttsPitch.toFixed(1)}</Text>
                <TouchableOpacity 
                  style={styles.sliderButton}
                  onPress={() => handleTTSPitchChange(ttsPitch + 0.1)}
                >
                  <Text style={styles.sliderButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Test Button */}
            <TouchableOpacity style={styles.testButton} onPress={testTTS}>
              <Text style={styles.testButtonText}>🔊 Test Voice</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About PolyBook</Text>
          <View style={styles.aboutContainer}>
            <Text style={styles.aboutText}>Version 1.0.0 (Beta)</Text>
            <Text style={styles.aboutText}>Your offline language learning companion</Text>
            <Text style={styles.aboutDescription}>
              PolyBook helps you learn languages by reading books with instant translation 
              and vocabulary building features, all working completely offline.
            </Text>
          </View>
        </View>

        {/* Bottom Spacing */}
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.header,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 12,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    minWidth: 100,
    backgroundColor: theme.colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  optionTextActive: {
    color: theme.colors.background,
  },
  presetText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  customControls: {
    gap: 16,
  },
  sliderContainer: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  sliderButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderButton: {
    width: 40,
    height: 40,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.background,
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    minWidth: 60,
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  aboutContainer: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  aboutText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  aboutDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginTop: 8,
  },
  voiceContainer: {
    gap: 8,
  },
  voiceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  voiceOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  voiceInfo: {
    flex: 1,
  },
  voiceName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  voiceNameActive: {
    color: theme.colors.background,
  },
  voiceLanguage: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  voiceLanguageActive: {
    color: theme.colors.background,
    opacity: 0.8,
  },
  voiceSelected: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.background,
    marginLeft: 16,
  },
  noVoicesText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  testButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.background,
  },
});