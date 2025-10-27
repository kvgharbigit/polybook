import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Vibration
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { BergamotService, BergamotTranslationResponse } from '../translation/BergamotService';
import { TranslationPreferencesService, TranslationContext, TranslationAction } from '../services/translationPreferencesService';
import { DictionaryService } from '../services/dictionaryService';

export interface WordDefinition {
  word: string;
  partOfSpeech?: string;
  definition: string;
  pronunciation?: string;
  examples?: string[];
  frequency?: number;
}

export interface TranslationResult {
  word?: {
    original: string;
    translated: string;
    definitions?: WordDefinition[];
    pronunciation?: string;
    partOfSpeech?: string;
  };
  sentence?: {
    original: string;
    translated: string;
    confidence?: number;
  };
  context?: {
    beforeText: string;
    afterText: string;
  };
  sourceLanguage: string;
  targetLanguage: string;
  translationMethod: 'bergamot' | 'dictionary' | 'fallback';
}

interface TranslationPopupProps {
  visible: boolean;
  context: TranslationContext | null;
  onClose: () => void;
  onTranslationComplete?: (result: TranslationResult) => void;
}

export default function TranslationPopup({
  visible,
  context,
  onClose,
  onTranslationComplete
}: TranslationPopupProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  
  // State
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayConfig, setDisplayConfig] = useState({
    showWord: true,
    showSentence: true,
    showDefinitions: true,
    showExamples: false,
    showPronunciation: true
  });
  const [actionPerformed, setActionPerformed] = useState<TranslationAction>('smart');

  // Dimensions
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  useEffect(() => {
    if (visible && context) {
      showPopup();
      performTranslation();
    } else {
      hidePopup();
    }
  }, [visible, context]);

  const showPopup = async () => {
    // Get animation preferences
    const animConfig = await TranslationPreferencesService.getAnimationConfig();
    const accessConfig = await TranslationPreferencesService.getAccessibilityConfig();
    
    // Haptic feedback
    if (accessConfig.hapticFeedback) {
      Vibration.vibrate(50);
    }
    
    if (animConfig.enabled) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: animConfig.duration,
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
      fadeAnim.setValue(1);
      scaleAnim.setValue(1);
    }
  };

  const hidePopup = async () => {
    const animConfig = await TranslationPreferencesService.getAnimationConfig();
    
    if (animConfig.enabled) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: animConfig.duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: animConfig.duration / 2,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  };

  const performTranslation = async () => {
    if (!context) return;

    try {
      setIsLoading(true);
      setError(null);
      setTranslationResult(null);

      // Determine what action to perform based on context and preferences
      const action = await TranslationPreferencesService.determineTranslationAction('tap', context);
      setActionPerformed(action);

      // Get display configuration
      const config = await TranslationPreferencesService.getDisplayConfig(action);
      setDisplayConfig(config);

      // Get context configuration
      const contextConfig = await TranslationPreferencesService.getContextConfig();

      // Prepare translation requests
      const promises: Promise<any>[] = [];
      const [sourceLanguage, targetLanguage] = context.languagePair;

      let wordTranslation: BergamotTranslationResponse | null = null;
      let sentenceTranslation: BergamotTranslationResponse | null = null;
      let definitions: WordDefinition[] = [];

      // Word translation
      if (config.showWord && action !== 'sentence') {
        promises.push(
          BergamotService.translate(context.selectedText, sourceLanguage, targetLanguage)
            .then(result => { wordTranslation = result; })
            .catch(err => console.error('Word translation failed:', err))
        );

        // Dictionary lookup
        if (config.showDefinitions) {
          promises.push(
            DictionaryService.lookupWord(context.selectedText, sourceLanguage)
              .then(result => { 
                if (result) {
                  definitions = Array.isArray(result) ? result : [result];
                }
              })
              .catch(err => console.error('Dictionary lookup failed:', err))
          );
        }
      }

      // Sentence translation
      if (config.showSentence && action !== 'word') {
        const sentenceToTranslate = context.fullSentence || context.selectedText;
        promises.push(
          BergamotService.translate(sentenceToTranslate, sourceLanguage, targetLanguage)
            .then(result => { sentenceTranslation = result; })
            .catch(err => console.error('Sentence translation failed:', err))
        );
      }

      // Wait for all translations to complete
      await Promise.all(promises);

      // Build result
      const result: TranslationResult = {
        sourceLanguage,
        targetLanguage,
        translationMethod: 'bergamot'
      };

      if (wordTranslation && config.showWord) {
        result.word = {
          original: context.selectedText,
          translated: wordTranslation.translation,
          definitions: definitions.length > 0 ? definitions : undefined,
          pronunciation: definitions[0]?.pronunciation
        };
      }

      if (sentenceTranslation && config.showSentence) {
        result.sentence = {
          original: context.fullSentence || context.selectedText,
          translated: sentenceTranslation.translation,
          confidence: sentenceTranslation.confidence
        };
      }

      if (contextConfig.includeContext && context.beforeContext && context.afterContext) {
        result.context = {
          beforeText: context.beforeContext,
          afterText: context.afterContext
        };
      }

      setTranslationResult(result);
      onTranslationComplete?.(result);

    } catch (error) {
      console.error('Translation failed:', error);
      setError(error instanceof Error ? error.message : 'Translation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getPopupPosition = () => {
    if (!context) return { top: '50%', left: '50%' };

    const { x, y } = context.position;
    const popupWidth = screenWidth * 0.85;
    const popupHeight = 300; // Approximate height

    // Calculate position to keep popup on screen
    let left = x - popupWidth / 2;
    let top = y - popupHeight - 20; // Above the selection

    // Adjust if popup would go off screen
    if (left < 10) left = 10;
    if (left + popupWidth > screenWidth - 10) left = screenWidth - popupWidth - 10;
    if (top < 60) top = y + 40; // Below the selection if not enough space above

    return { top, left };
  };

  const renderWordTranslation = () => {
    if (!translationResult?.word || !displayConfig.showWord) return null;

    const { word } = translationResult;

    return (
      <View style={styles.translationSection}>
        <Text style={styles.sectionTitle}>📝 Word Translation</Text>
        <View style={styles.translationItem}>
          <Text style={styles.originalText}>{word.original}</Text>
          <Text style={styles.translatedText}>{word.translated}</Text>
          
          {word.pronunciation && displayConfig.showPronunciation && (
            <Text style={styles.pronunciation}>🔊 {word.pronunciation}</Text>
          )}
          
          {word.definitions && displayConfig.showDefinitions && (
            <View style={styles.definitionsContainer}>
              {word.definitions.slice(0, 3).map((def, index) => (
                <View key={index} style={styles.definitionItem}>
                  {def.partOfSpeech && (
                    <Text style={styles.partOfSpeech}>{def.partOfSpeech}</Text>
                  )}
                  <Text style={styles.definitionText}>{def.definition}</Text>
                  {def.examples && displayConfig.showExamples && (
                    <Text style={styles.exampleText}>"{def.examples[0]}"</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderSentenceTranslation = () => {
    if (!translationResult?.sentence || !displayConfig.showSentence) return null;

    const { sentence } = translationResult;

    return (
      <View style={styles.translationSection}>
        <Text style={styles.sectionTitle}>📖 Sentence Translation</Text>
        <View style={styles.translationItem}>
          <Text style={styles.originalText}>{sentence.original}</Text>
          <Text style={styles.translatedText}>{sentence.translated}</Text>
          
          {sentence.confidence && (
            <Text style={styles.confidenceText}>
              Confidence: {Math.round(sentence.confidence * 100)}%
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderContext = () => {
    if (!translationResult?.context) return null;

    const { context: contextData } = translationResult;

    return (
      <View style={styles.contextSection}>
        <Text style={styles.sectionTitle}>🔍 Context</Text>
        <Text style={styles.contextText}>
          ...{contextData.beforeText} <Text style={styles.selectedText}>{context?.selectedText}</Text> {contextData.afterText}...
        </Text>
      </View>
    );
  };

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.loadingText}>
        {actionPerformed === 'both' ? 'Translating word and sentence...' :
         actionPerformed === 'sentence' ? 'Translating sentence...' :
         'Translating word...'}
      </Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>❌ Translation Failed</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={performTranslation}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const renderActions = () => (
    <View style={styles.actionsContainer}>
      <TouchableOpacity style={styles.actionButton} onPress={onClose}>
        <Text style={styles.actionButtonText}>Close</Text>
      </TouchableOpacity>
      
      {!isLoading && translationResult && (
        <TouchableOpacity 
          style={[styles.actionButton, styles.primaryActionButton]} 
          onPress={() => {
            // Could add features like copying, saving, or sharing translation
            console.log('Save translation action');
          }}
        >
          <Text style={styles.primaryActionButtonText}>Save</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (!visible || !context) return null;

  const position = getPopupPosition();

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
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
              top: position.top,
              left: position.left,
            }
          ]}
          onStartShouldSetResponder={() => true}
        >
          <TouchableOpacity activeOpacity={1} style={styles.popupContent}>
            <ScrollView 
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
            >
              {isLoading && renderLoading()}
              {error && !isLoading && renderError()}
              
              {!isLoading && !error && translationResult && (
                <>
                  {renderWordTranslation()}
                  {renderSentenceTranslation()}
                  {renderContext()}
                </>
              )}
            </ScrollView>
            
            {renderActions()}
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
    width: '85%',
    maxHeight: '70%',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  popupContent: {
    flex: 1,
  },
  scrollView: {
    maxHeight: 400,
    padding: 20,
  },
  translationSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 12,
  },
  translationItem: {
    backgroundColor: theme.colors.background,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  originalText: {
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 8,
    fontWeight: '500',
  },
  translatedText: {
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  pronunciation: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  definitionsContainer: {
    marginTop: 8,
  },
  definitionItem: {
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.primary + '40',
  },
  partOfSpeech: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  definitionText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  exampleText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  confidenceText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  contextSection: {
    marginBottom: 20,
  },
  contextText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    padding: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
  },
  selectedText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.error,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: theme.colors.onPrimary,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  primaryActionButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  primaryActionButtonText: {
    color: theme.colors.onPrimary,
    fontWeight: '600',
  },
});