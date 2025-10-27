import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  PanResponder,
  GestureResponderEvent,
  TouchableOpacity,
  Vibration
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { TranslationPreferencesService, TranslationContext } from '../services/translationPreferencesService';
import TranslationPopup, { TranslationResult } from './TranslationPopup';

interface TranslatableTextProps {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  style?: any;
  textStyle?: any;
  selectable?: boolean;
  enableTranslation?: boolean;
  onTranslationResult?: (result: TranslationResult) => void;
  onWordSelect?: (word: string, position: { x: number; y: number }) => void;
}

interface TextSelection {
  text: string;
  start: number;
  end: number;
  position: { x: number; y: number };
}

export default function TranslatableText({
  text,
  sourceLanguage,
  targetLanguage,
  style,
  textStyle,
  selectable = true,
  enableTranslation = true,
  onTranslationResult,
  onWordSelect
}: TranslatableTextProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  // State
  const [showTranslationPopup, setShowTranslationPopup] = useState(false);
  const [translationContext, setTranslationContext] = useState<TranslationContext | null>(null);
  const [selectedText, setSelectedText] = useState<TextSelection | null>(null);
  const [highlightedRanges, setHighlightedRanges] = useState<Array<{ start: number; end: number; type: 'word' | 'sentence' }>>([]);
  
  // Refs
  const textRef = useRef<Text>(null);
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Extract words and sentences for easier interaction
  const words = text.split(/(\s+)/).filter(w => w.trim().length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Create selectable text segments
  const createTextSegments = useCallback(() => {
    const segments: Array<{
      text: string;
      isWord: boolean;
      wordIndex?: number;
      sentenceIndex?: number;
      start: number;
      end: number;
    }> = [];

    let currentIndex = 0;
    const splitText = text.split(/(\s+|[.!?]+)/);

    splitText.forEach((segment, index) => {
      const start = currentIndex;
      const end = currentIndex + segment.length;
      
      if (segment.trim().length > 0 && !/^[\s.!?]+$/.test(segment)) {
        // This is a word
        const wordIndex = words.indexOf(segment);
        segments.push({
          text: segment,
          isWord: true,
          wordIndex: wordIndex >= 0 ? wordIndex : undefined,
          start,
          end
        });
      } else {
        // This is whitespace or punctuation
        segments.push({
          text: segment,
          isWord: false,
          start,
          end
        });
      }
      
      currentIndex = end;
    });

    return segments;
  }, [text, words]);

  const findWordAtPosition = (position: number): { word: string; start: number; end: number } | null => {
    const segments = createTextSegments();
    const segment = segments.find(s => s.isWord && position >= s.start && position <= s.end);
    
    if (segment) {
      return {
        word: segment.text,
        start: segment.start,
        end: segment.end
      };
    }
    
    return null;
  };

  const findSentenceAtPosition = (position: number): { sentence: string; start: number; end: number } | null => {
    let currentIndex = 0;
    
    for (const sentence of sentences) {
      const start = text.indexOf(sentence, currentIndex);
      const end = start + sentence.length;
      
      if (position >= start && position <= end) {
        return {
          sentence: sentence.trim(),
          start,
          end
        };
      }
      
      currentIndex = end;
    }
    
    return null;
  };

  const getContextAroundPosition = (position: number, contextLength: number = 5): { before: string; after: string } => {
    const beforeWords = words.slice(Math.max(0, words.indexOf(findWordAtPosition(position)?.word || '') - contextLength));
    const afterWords = words.slice(words.indexOf(findWordAtPosition(position)?.word || '') + 1, contextLength);
    
    return {
      before: beforeWords.join(' '),
      after: afterWords.join(' ')
    };
  };

  const handleTextPress = async (gestureType: 'tap' | 'doubleTap' | 'longPress', event: GestureResponderEvent) => {
    if (!enableTranslation || !selectable) return;

    const { locationX, locationY, pageX, pageY } = event.nativeEvent;
    
    // For now, we'll use a simple approach to estimate text position
    // In a real implementation, you might need more sophisticated text measurement
    const estimatedCharPosition = Math.floor((locationX / 300) * text.length); // Rough estimation
    const wordAtPosition = findWordAtPosition(estimatedCharPosition);
    const sentenceAtPosition = findSentenceAtPosition(estimatedCharPosition);
    
    if (!wordAtPosition && !sentenceAtPosition) return;

    // Get user preferences to determine action
    const prefs = await TranslationPreferencesService.getPreferences();
    const accessConfig = await TranslationPreferencesService.getAccessibilityConfig();
    
    // Haptic feedback
    if (accessConfig.hapticFeedback) {
      Vibration.vibrate(gestureType === 'longPress' ? 100 : 50);
    }

    // Build translation context
    const context: TranslationContext = {
      selectedText: wordAtPosition?.word || sentenceAtPosition?.sentence || '',
      fullSentence: sentenceAtPosition?.sentence,
      languagePair: [sourceLanguage, targetLanguage],
      position: { x: pageX, y: pageY },
      elementType: wordAtPosition ? 'word' : 'sentence'
    };

    // Add context if enabled
    if (prefs.includeContext && wordAtPosition) {
      const contextData = getContextAroundPosition(estimatedCharPosition, prefs.contextLength);
      context.beforeContext = contextData.before;
      context.afterContext = contextData.after;
    }

    // Determine translation action
    const action = await TranslationPreferencesService.determineTranslationAction(gestureType, context);
    
    if (action === 'disabled') return;

    // Show translation popup
    setTranslationContext(context);
    setShowTranslationPopup(true);

    // Highlight selected text
    if (wordAtPosition) {
      setHighlightedRanges([{
        start: wordAtPosition.start,
        end: wordAtPosition.end,
        type: 'word'
      }]);
    } else if (sentenceAtPosition) {
      setHighlightedRanges([{
        start: sentenceAtPosition.start,
        end: sentenceAtPosition.end,
        type: 'sentence'
      }]);
    }

    // Callback
    onWordSelect?.(context.selectedText, context.position);
  };

  const handleSingleTap = (event: GestureResponderEvent) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    // Clear any existing timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }
    
    if (timeSinceLastTap < 300) {
      // This is a double tap
      lastTapRef.current = 0;
      handleTextPress('doubleTap', event);
    } else {
      // This might be a single tap, wait to see if there's another tap
      lastTapRef.current = now;
      tapTimeoutRef.current = setTimeout(() => {
        handleTextPress('tap', event);
        tapTimeoutRef.current = null;
      }, 300);
    }
  };

  const handleLongPress = (event: GestureResponderEvent) => {
    // Clear single tap timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }
    handleTextPress('longPress', event);
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => false,
    
    onPanResponderGrant: (event) => {
      // Handle touch start - could be used for immediate feedback
    },
    
    onPanResponderRelease: (event) => {
      handleSingleTap(event);
    }
  });

  const renderHighlightedText = () => {
    if (highlightedRanges.length === 0) {
      return <Text style={[styles.text, textStyle]}>{text}</Text>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    highlightedRanges.forEach((range, index) => {
      // Add text before highlight
      if (range.start > lastIndex) {
        parts.push(
          <Text key={`before-${index}`} style={[styles.text, textStyle]}>
            {text.substring(lastIndex, range.start)}
          </Text>
        );
      }

      // Add highlighted text
      parts.push(
        <Text 
          key={`highlight-${index}`} 
          style={[
            styles.text, 
            textStyle,
            range.type === 'word' ? styles.highlightedWord : styles.highlightedSentence
          ]}
        >
          {text.substring(range.start, range.end)}
        </Text>
      );

      lastIndex = range.end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <Text key="after" style={[styles.text, textStyle]}>
          {text.substring(lastIndex)}
        </Text>
      );
    }

    return <>{parts}</>;
  };

  const handleTranslationClose = () => {
    setShowTranslationPopup(false);
    setTranslationContext(null);
    setHighlightedRanges([]);
    setSelectedText(null);
  };

  const handleTranslationComplete = (result: TranslationResult) => {
    onTranslationResult?.(result);
  };

  return (
    <View style={[styles.container, style]}>
      <View
        {...panResponder.panHandlers}
        onLongPress={handleLongPress}
        style={styles.textContainer}
      >
        {renderHighlightedText()}
      </View>

      <TranslationPopup
        visible={showTranslationPopup}
        context={translationContext}
        onClose={handleTranslationClose}
        onTranslationComplete={handleTranslationComplete}
      />
    </View>
  );
}

// Alternative simpler component for basic text with word-level tap
export function SimpleTranslatableText({
  text,
  sourceLanguage,
  targetLanguage,
  style,
  textStyle,
  onWordPress
}: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  style?: any;
  textStyle?: any;
  onWordPress?: (word: string, position: { x: number; y: number }) => void;
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const words = text.split(/(\s+)/);

  const handleWordPress = (word: string, event: GestureResponderEvent) => {
    if (word.trim().length === 0) return;
    
    const { pageX, pageY } = event.nativeEvent;
    onWordPress?.(word.trim(), { x: pageX, y: pageY });
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.text, textStyle]}>
        {words.map((word, index) => 
          word.trim().length > 0 ? (
            <TouchableOpacity
              key={index}
              onPress={(event) => handleWordPress(word, event)}
              style={styles.wordButton}
            >
              <Text style={[styles.text, textStyle, styles.tappableWord]}>
                {word}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text key={index} style={[styles.text, textStyle]}>
              {word}
            </Text>
          )
        )}
      </Text>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  textContainer: {
    flex: 1,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.text,
  },
  highlightedWord: {
    backgroundColor: theme.colors.primary + '20',
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  highlightedSentence: {
    backgroundColor: theme.colors.secondary + '20',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  wordButton: {
    borderRadius: 2,
  },
  tappableWord: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
    textDecorationColor: theme.colors.primary + '40',
  },
});

export { TranslatableText };