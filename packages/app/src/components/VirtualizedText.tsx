import React, { useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback, GestureResponderEvent } from 'react-native';

interface VirtualizedTextProps {
  text: string;
  scrollPosition: number;
  screenHeight: number;
  onWordTap: (word: string, event: GestureResponderEvent) => void;
  textStyles?: any;
  isHighlighted?: (index: number) => boolean;
}

interface WordInfo {
  word: string;
  globalIndex: number;
  startPos: number;
  endPos: number;
}

/**
 * Virtualized text rendering - only renders visible portion
 * This is how Kindle, Apple Books, and other e-readers handle large text
 */
export default React.memo(function VirtualizedText({
  text,
  scrollPosition,
  screenHeight,
  onWordTap,
  textStyles,
  isHighlighted,
}: VirtualizedTextProps) {
  const textRef = useRef<Text>(null);
  
  // Calculate visible text range based on scroll position
  const { visibleText, visibleWords, startOffset } = useMemo(() => {
    const fontSize = textStyles?.fontSize || 16;
    const lineHeight = textStyles?.lineHeight || (fontSize * 1.6);
    
    // Calculate approximately how many characters fit on screen
    const linesOnScreen = Math.ceil(screenHeight / lineHeight);
    const avgCharsPerLine = 80; // Rough estimate
    const charsPerScreen = linesOnScreen * avgCharsPerLine;
    
    // Add buffer above and below visible area for smooth scrolling
    const bufferScreens = 1.5; // Render 1.5 screens above and below
    const totalCharsToRender = charsPerScreen * (1 + 2 * bufferScreens);
    
    // Calculate start position based on scroll
    const scrollRatio = Math.max(0, scrollPosition / Math.max(1, screenHeight));
    const estimatedScrollChars = scrollRatio * charsPerScreen;
    const bufferChars = charsPerScreen * bufferScreens;
    
    const startIndex = Math.max(0, Math.floor(estimatedScrollChars - bufferChars));
    const endIndex = Math.min(text.length, startIndex + totalCharsToRender);
    
    // Extract visible text
    const visibleText = text.slice(startIndex, endIndex);
    
    // Create word index mapping for the visible portion
    const words = visibleText.split(/(\s+)/);
    const visibleWords: WordInfo[] = [];
    let currentPos = 0;
    let globalWordIndex = 0;
    
    // Count words before visible area to maintain global word index
    const textBeforeVisible = text.slice(0, startIndex);
    const wordsBeforeVisible = textBeforeVisible.split(/\s+/).filter(w => w.trim().length > 0);
    globalWordIndex = wordsBeforeVisible.length;
    
    for (const segment of words) {
      const isWord = segment.trim().length > 0 && !/^\s+$/.test(segment);
      
      if (isWord) {
        visibleWords.push({
          word: segment,
          globalIndex: globalWordIndex++,
          startPos: currentPos,
          endPos: currentPos + segment.length,
        });
      }
      currentPos += segment.length;
    }
    
    return {
      visibleText,
      visibleWords,
      startOffset: startIndex,
    };
  }, [text, scrollPosition, screenHeight, textStyles]);

  // Create highlighted word indices for performance
  const highlightedIndices = useMemo(() => {
    if (!isHighlighted) return new Set();
    return new Set(
      visibleWords
        .filter(word => isHighlighted(word.globalIndex))
        .map(word => word.globalIndex)
    );
  }, [visibleWords, isHighlighted]);

  // Handle word tap via improved coordinate detection
  const handlePress = useCallback((event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const fontSize = textStyles?.fontSize || 16;
    const lineHeight = textStyles?.lineHeight || (fontSize * 1.6);
    
    // More accurate character width estimation based on font size
    // Account for font metrics and spacing
    const charWidth = fontSize * 0.6; // Adjusted for better accuracy
    
    // Calculate approximate character position in the entire visible text
    const lineIndex = Math.floor(locationY / lineHeight);
    const charInLine = Math.floor(locationX / charWidth);
    
    // Split text into lines while preserving word boundaries
    const textLines = visibleText.split('\n');
    let charPosition = 0;
    
    // Calculate character position more accurately
    for (let i = 0; i < lineIndex && i < textLines.length; i++) {
      charPosition += textLines[i].length + 1; // +1 for newline
    }
    
    // Add position within the current line
    if (lineIndex < textLines.length) {
      charPosition += Math.min(charInLine, textLines[lineIndex].length);
    }
    
    // Find the closest word using multiple strategies
    let bestMatch = null;
    let bestScore = Infinity;
    
    for (const word of visibleWords) {
      const wordCenter = (word.startPos + word.endPos) / 2;
      const distance = Math.abs(charPosition - wordCenter);
      
      // Prefer exact matches within word boundaries
      if (charPosition >= word.startPos && charPosition <= word.endPos) {
        bestMatch = word;
        break;
      }
      
      // Otherwise find closest word
      if (distance < bestScore) {
        bestScore = distance;
        bestMatch = word;
      }
    }
    
    // Additional accuracy check: verify the word makes sense given tap position
    if (bestMatch) {
      // Calculate expected line for this word
      let wordLine = 0;
      let charsBeforeWord = bestMatch.startPos;
      
      for (const line of textLines) {
        if (charsBeforeWord <= line.length) {
          break;
        }
        charsBeforeWord -= (line.length + 1);
        wordLine++;
      }
      
      // If word is on wrong line and far away, try next closest
      if (Math.abs(wordLine - lineIndex) > 1) {
        // Find words on the correct line
        const wordsOnLine = visibleWords.filter(word => {
          let wLine = 0;
          let wChars = word.startPos;
          
          for (const line of textLines) {
            if (wChars <= line.length) {
              break;
            }
            wChars -= (line.length + 1);
            wLine++;
          }
          
          return Math.abs(wLine - lineIndex) <= 1;
        });
        
        if (wordsOnLine.length > 0) {
          bestMatch = wordsOnLine.reduce((closest, word) => {
            const wordCenter = (word.startPos + word.endPos) / 2;
            const closestCenter = (closest.startPos + closest.endPos) / 2;
            return Math.abs(charPosition - wordCenter) < Math.abs(charPosition - closestCenter) ? word : closest;
          });
        }
      }
      
      onWordTap(bestMatch.word.trim(), event);
    }
  }, [visibleWords, visibleText, onWordTap, textStyles]);

  // Render text with highlighting
  const renderText = useMemo(() => {
    const segments = visibleText.split(/(\s+)/);
    let globalWordIndex = Math.max(0, visibleWords[0]?.globalIndex || 0);
    
    return segments.map((segment, index) => {
      const isWord = segment.trim().length > 0 && !/^\s+$/.test(segment);
      
      if (isWord) {
        const isHighlightedWord = highlightedIndices.has(globalWordIndex);
        const result = (
          <Text
            key={`${startOffset}-${index}-${segment}`}
            style={isHighlightedWord ? styles.highlighted : null}
          >
            {segment}
          </Text>
        );
        globalWordIndex++;
        return result;
      } else {
        return segment; // Whitespace
      }
    });
  }, [visibleText, highlightedIndices, startOffset, visibleWords]);

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View style={styles.container}>
        <Text 
          ref={textRef}
          style={[styles.text, textStyles]}
          selectable={false}
        >
          {renderText}
        </Text>
      </View>
    </TouchableWithoutFeedback>
  );
}, (prevProps, nextProps) => {
  // Only re-render if visible content might have changed
  const scrollChanged = Math.abs(prevProps.scrollPosition - nextProps.scrollPosition) > 100;
  const textChanged = prevProps.text !== nextProps.text;
  const styleChanged = prevProps.textStyles?.fontSize !== nextProps.textStyles?.fontSize;
  const highlightChanged = prevProps.isHighlighted !== nextProps.isHighlighted;
  
  return !scrollChanged && !textChanged && !styleChanged && !highlightChanged;
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'justify',
  },
  highlighted: {
    backgroundColor: '#FFE066',
    borderRadius: 2,
  },
});