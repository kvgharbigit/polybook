import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { 
  BilingualWordDefinition, 
  UserLanguageProfile, 
  DictionaryLookupResponse 
} from '@polybook/shared/src/types';
import DictionaryService from '../services/bilingualDictionaryService';
import UserLanguageProfileService from '../services/userLanguageProfileService';
import LanguagePackManager from '../services/languagePackManager';
import { useTheme } from '../hooks/useTheme';

interface BilingualTranslationPopupProps {
  visible: boolean;
  word: string;
  position: { x: number; y: number };
  context?: string; // Surrounding sentence for context
  sourceLanguage?: string;
  onClose: () => void;
  onSaveWord?: (word: string, definition: BilingualWordDefinition) => void;
  onPlayAudio?: (word: string, language: string) => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function BilingualTranslationPopup({
  visible,
  word,
  position,
  context,
  sourceLanguage,
  onClose,
  onSaveWord,
  onPlayAudio,
}: BilingualTranslationPopupProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Animation states
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  // Data states
  const [isLoading, setIsLoading] = useState(false);
  const [lookupResponse, setLookupResponse] = useState<DictionaryLookupResponse | null>(null);
  const [userProfile, setUserProfile] = useState<UserLanguageProfile | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);

  // Load user profile and lookup word when popup becomes visible
  useEffect(() => {
    if (visible && word) {
      loadUserProfileAndLookupWord();
    }
  }, [visible, word]);

  // Animation effects
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const loadUserProfileAndLookupWord = async () => {
    try {
      setIsLoading(true);

      // Load user profile
      const profile = await UserLanguageProfileService.getUserProfile();
      setUserProfile(profile);

      // Perform bilingual lookup
      const response = await DictionaryService.lookupWord({
        word,
        sourceLanguage,
        userProfile: profile,
        context
      });

      setLookupResponse(response);

      // Record lookup for statistics
      if (response.success) {
        await UserLanguageProfileService.recordLookup(response.sourceLanguage);
      }

    } catch (error) {
      console.error('BilingualTranslationPopup: Error looking up word:', error);
      setLookupResponse({
        success: false,
        word,
        sourceLanguage: sourceLanguage || 'unknown',
        error: `Lookup failed: ${error}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveWord = () => {
    if (lookupResponse?.primaryDefinition && onSaveWord) {
      onSaveWord(word, lookupResponse.primaryDefinition);
    }
  };

  const handlePlayAudio = (wordToPlay: string, language: string) => {
    if (onPlayAudio) {
      onPlayAudio(wordToPlay, language);
    }
  };

  const handleDownloadMissingLanguages = async () => {
    if (!lookupResponse?.missingLanguages || !userProfile) return;

    try {
      setIsLoading(true);

      for (const languageCode of lookupResponse.missingLanguages) {
        console.log(`📦 Downloading missing language pack: ${languageCode}`);
        
        const success = await LanguagePackManager.downloadLanguagePack(languageCode);
        
        if (success) {
          // TODO: Integrate with ML Kit model management
          console.log('Language pack downloaded successfully. ML Kit models will be available in future update.');
        }
      }

      // Retry the lookup
      await loadUserProfileAndLookupWord();

    } catch (error) {
      console.error('Failed to download language packs:', error);
      // Show error in the popup
      setLookupResponse(prev => prev ? {
        ...prev,
        error: 'Failed to download language packs. Please try again.'
      } : null);
    } finally {
      setIsLoading(false);
    }
  };

  const getLanguageDisplayName = (code: string): string => {
    const names: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish', 
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese'
    };
    return names[code] || code.toUpperCase();
  };

  const calculatePopupPosition = () => {
    const popupWidth = Math.min(screenWidth * 0.9, 350);
    const popupHeight = Math.min(screenHeight * 0.7, 500);
    
    let x = position.x - popupWidth / 2;
    let y = position.y - popupHeight - 10;

    // Keep popup on screen
    if (x < 20) x = 20;
    if (x + popupWidth > screenWidth - 20) x = screenWidth - popupWidth - 20;
    if (y < 50) y = position.y + 30;

    return { x, y, width: popupWidth, height: popupHeight };
  };

  const popupPosition = calculatePopupPosition();

  const renderTranslations = (definition: BilingualWordDefinition) => {
    if (!definition.translations.length) return null;

    return (
      <View style={styles.translationsContainer}>
        <Text style={styles.sectionTitle}>Translations</Text>
        {definition.translations.slice(0, 3).map((translation, index) => (
          <View key={index} style={styles.translationItem}>
            <Text style={styles.translationWord}>{translation.word}</Text>
            <View style={styles.translationMeta}>
              <Text style={styles.languageTag}>
                {UserLanguageProfileService.getLanguageDisplayName(translation.language, userProfile?.nativeLanguage)}
              </Text>
              {translation.confidence && (
                <Text style={styles.confidenceScore}>
                  {Math.round(translation.confidence * 100)}%
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderDefinitions = (definition: BilingualWordDefinition) => {
    if (!definition.definitions.length) return null;

    // Filter definitions to user's preferred language
    const relevantDefinitions = definition.definitions.filter(def =>
      def.definitionLanguage === userProfile?.preferredDefinitionLanguage ||
      def.definitionLanguage === userProfile?.nativeLanguage
    );

    const definitionsToShow = relevantDefinitions.length > 0 ? relevantDefinitions : definition.definitions;

    return (
      <View style={styles.definitionsContainer}>
        <Text style={styles.sectionTitle}>Definitions</Text>
        {definitionsToShow.slice(0, 2).map((def, index) => (
          <View key={index} style={styles.definitionItem}>
            <View style={styles.definitionHeader}>
              <Text style={styles.partOfSpeech}>{def.partOfSpeech}</Text>
              <Text style={styles.definitionLanguage}>
                {UserLanguageProfileService.getLanguageDisplayName(def.definitionLanguage, userProfile?.nativeLanguage)}
              </Text>
            </View>
            <Text style={styles.definitionText}>{def.definition}</Text>
            
            {def.example && userProfile?.showExamples && (
              <View style={styles.exampleContainer}>
                <Text style={styles.exampleLabel}>Example:</Text>
                <Text style={styles.exampleText}>{def.example}</Text>
                {def.exampleTranslation && (
                  <Text style={styles.exampleTranslation}>{def.exampleTranslation}</Text>
                )}
              </View>
            )}

            {def.synonyms && def.synonyms.length > 0 && (
              <View style={styles.synonymsContainer}>
                <Text style={styles.synonymsLabel}>Synonyms:</Text>
                <Text style={styles.synonymsText}>{def.synonyms.join(', ')}</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderPronunciation = (definition: BilingualWordDefinition) => {
    if (!definition.pronunciation || !userProfile?.showPronunciation) return null;

    return (
      <View style={styles.pronunciationContainer}>
        {definition.pronunciation.ipa && (
          <Text style={styles.pronunciationIPA}>/{definition.pronunciation.ipa}/</Text>
        )}
        <TouchableOpacity
          style={styles.audioButton}
          onPress={() => handlePlayAudio(definition.word, definition.language)}
        >
          <Text style={styles.audioButtonText}>🔊</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMetadata = (definition: BilingualWordDefinition) => {
    return (
      <View style={styles.metadataContainer}>
        {definition.frequency && (
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Frequency:</Text>
            <Text style={styles.metadataValue}>{definition.frequency.toLocaleString()}</Text>
          </View>
        )}
        
        {definition.difficulty && (
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Level:</Text>
            <Text style={[styles.metadataValue, styles[`difficulty${definition.difficulty.charAt(0).toUpperCase() + definition.difficulty.slice(1)}`]]}>
              {definition.difficulty}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Looking up "{word}"...</Text>
        </View>
      );
    }

    if (!lookupResponse) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load definition</Text>
        </View>
      );
    }

    if (!lookupResponse.success) {
      // Handle missing language packs specifically
      if (lookupResponse.error === 'missing_language_packs' && lookupResponse.missingLanguages) {
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>📦 Language Packs Required</Text>
            <Text style={styles.errorText}>
              To translate "{word}", you need to download:
            </Text>
            
            <View style={styles.missingLanguagesContainer}>
              {lookupResponse.missingLanguages.map((langCode, index) => (
                <View key={index} style={styles.missingLanguageItem}>
                  <Text style={styles.missingLanguageText}>
                    • {getLanguageDisplayName(langCode)} Dictionary
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.downloadButton}
              onPress={handleDownloadMissingLanguages}
              disabled={isLoading}
            >
              <Text style={styles.downloadButtonText}>
                {isLoading ? 'Downloading...' : 'Download Language Packs'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.downloadNote}>
              This will download ~2-3MB per language and enable offline translation.
            </Text>
          </View>
        );
      }

      // Handle other errors
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{lookupResponse.error}</Text>
          {lookupResponse.suggestions && lookupResponse.suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsLabel}>Did you mean:</Text>
              {lookupResponse.suggestions.map((suggestion, index) => (
                <TouchableOpacity key={index} style={styles.suggestionItem}>
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      );
    }

    const { primaryDefinition, alternatives } = lookupResponse;

    if (!primaryDefinition) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No definition found for "{word}"</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Word Header */}
        <View style={styles.wordHeader}>
          <View style={styles.wordTitleContainer}>
            <Text style={styles.wordTitle}>{primaryDefinition.word}</Text>
            <Text style={styles.wordLanguage}>
              {UserLanguageProfileService.getLanguageDisplayName(primaryDefinition.language, userProfile?.nativeLanguage)}
            </Text>
          </View>
          {renderPronunciation(primaryDefinition)}
        </View>

        {/* Translations */}
        {renderTranslations(primaryDefinition)}

        {/* Definitions */}
        {renderDefinitions(primaryDefinition)}

        {/* Metadata */}
        {renderMetadata(primaryDefinition)}

        {/* Etymology */}
        {primaryDefinition.etymology && userProfile?.showEtymology && (
          <View style={styles.etymologyContainer}>
            <Text style={styles.sectionTitle}>Etymology</Text>
            <Text style={styles.etymologyText}>{primaryDefinition.etymology}</Text>
          </View>
        )}

        {/* Alternatives */}
        {alternatives && alternatives.length > 0 && (
          <View style={styles.alternativesContainer}>
            <TouchableOpacity
              style={styles.alternativesToggle}
              onPress={() => setShowAlternatives(!showAlternatives)}
            >
              <Text style={styles.alternativesToggleText}>
                Alternative Meanings {showAlternatives ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>
            
            {showAlternatives && alternatives.map((alt, index) => (
              <View key={index} style={styles.alternativeItem}>
                <Text style={styles.alternativeWord}>{alt.word}</Text>
                {renderDefinitions(alt)}
              </View>
            ))}
          </View>
        )}

        {/* Context */}
        {context && (
          <View style={styles.contextContainer}>
            <Text style={styles.sectionTitle}>Context</Text>
            <Text style={styles.contextText}>{context}</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.popup,
            {
              left: popupPosition.x,
              top: popupPosition.y,
              width: popupPosition.width,
              maxHeight: popupPosition.height,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            {renderContent()}

            {/* Action Buttons */}
            {lookupResponse?.success && lookupResponse.primaryDefinition && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleSaveWord}
                >
                  <Text style={styles.actionButtonText}>💾 Save</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.primaryActionButton]}
                  onPress={onClose}
                >
                  <Text style={[styles.actionButtonText, styles.primaryActionButtonText]}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  popup: {
    position: 'absolute',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: '70%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  wordTitleContainer: {
    flex: 1,
  },
  wordTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  wordLanguage: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  pronunciationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pronunciationIPA: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  audioButton: {
    padding: 4,
  },
  audioButtonText: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  translationsContainer: {
    marginBottom: 8,
  },
  translationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    marginBottom: 4,
  },
  translationWord: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
    flex: 1,
  },
  translationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageTag: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  confidenceScore: {
    fontSize: 11,
    color: theme.colors.success,
    fontWeight: '500',
  },
  definitionsContainer: {
    marginBottom: 8,
  },
  definitionItem: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
  },
  definitionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  partOfSpeech: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  definitionLanguage: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  definitionText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  exampleContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border + '40',
  },
  exampleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 13,
    color: theme.colors.text,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  exampleTranslation: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  synonymsContainer: {
    marginTop: 6,
  },
  synonymsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  synonymsText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  metadataContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
    padding: 8,
    backgroundColor: theme.colors.background,
    borderRadius: 6,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metadataLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  metadataValue: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text,
  },
  difficultyBeginner: {
    color: theme.colors.success,
  },
  difficultyIntermediate: {
    color: theme.colors.warning || '#ff9500',
  },
  difficultyAdvanced: {
    color: theme.colors.error,
  },
  etymologyContainer: {
    marginBottom: 8,
  },
  etymologyText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  alternativesContainer: {
    marginBottom: 8,
  },
  alternativesToggle: {
    padding: 8,
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    marginBottom: 8,
  },
  alternativesToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  alternativeItem: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  alternativeWord: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  contextContainer: {
    marginBottom: 8,
  },
  contextText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    padding: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  suggestionsContainer: {
    marginTop: 16,
  },
  suggestionsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  suggestionItem: {
    padding: 8,
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 14,
    color: theme.colors.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  primaryActionButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  primaryActionButtonText: {
    color: theme.colors.background,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  missingLanguagesContainer: {
    marginVertical: 12,
  },
  missingLanguageItem: {
    marginVertical: 4,
  },
  missingLanguageText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  downloadButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 12,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  downloadNote: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});