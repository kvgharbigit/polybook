import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface ReliableTextRendererProps {
  text: string;
  scrollPosition: number;
  screenHeight: number;
  onWordTap: (word: string, event: any) => void;
  textStyles?: any;
  isHighlighted?: (index: number) => boolean;
}

/**
 * Reliable text renderer using individual TouchableOpacity for each word
 * But with smart virtualization to only render visible words
 * This guarantees accurate word selection at the cost of some performance
 */
export default React.memo(function ReliableTextRenderer({
  text,
  scrollPosition,
  screenHeight,
  onWordTap,
  textStyles,
  isHighlighted,
}: ReliableTextRendererProps) {
  
  // Calculate visible text range - only render what's on screen + small buffer
  const { visibleSegments, startWordIndex } = useMemo(() => {
    const fontSize = textStyles?.fontSize || 16;
    const lineHeight = textStyles?.lineHeight || (fontSize * 1.6);
    
    // Calculate roughly how many words fit on screen
    const linesOnScreen = Math.ceil(screenHeight / lineHeight);
    const avgWordsPerLine = 12; // Conservative estimate
    const wordsPerScreen = linesOnScreen * avgWordsPerLine;
    
    // Add small buffer for smooth scrolling (reduced from previous version)
    const bufferScreens = 0.5; // Smaller buffer for better performance
    const totalWordsToRender = wordsPerScreen * (1 + 2 * bufferScreens);
    
    // Split all text into words and whitespace
    const allSegments = text.split(/([\s\n]+)/);
    const words = allSegments.filter((segment, index) => index % 2 === 0 && segment.trim().length > 0);
    
    // Calculate start position based on scroll
    const scrollRatio = Math.max(0, Math.min(1, scrollPosition / Math.max(1, screenHeight * 3)));
    const estimatedStartWord = Math.floor(scrollRatio * words.length);
    const bufferWords = Math.floor(wordsPerScreen * bufferScreens);
    
    let startWordIndex = Math.max(0, estimatedStartWord - bufferWords);
    let endWordIndex = Math.min(words.length, startWordIndex + totalWordsToRender);
    
    // Prevent issues at the end
    if (endWordIndex >= words.length - bufferWords) {
      endWordIndex = words.length;
      startWordIndex = Math.max(0, endWordIndex - totalWordsToRender);
    }
    
    // Find the actual segment indices for the visible word range
    let segmentStartIndex = 0;
    let wordCount = 0;
    
    // Find start segment index
    for (let i = 0; i < allSegments.length && wordCount < startWordIndex; i++) {
      if (i % 2 === 0 && allSegments[i].trim().length > 0) {
        wordCount++;
      }
      if (wordCount < startWordIndex) {
        segmentStartIndex = i + 1;
      }
    }
    
    // Find end segment index
    let segmentEndIndex = segmentStartIndex;
    wordCount = startWordIndex;
    
    for (let i = segmentStartIndex; i < allSegments.length && wordCount < endWordIndex; i++) {
      if (i % 2 === 0 && allSegments[i].trim().length > 0) {
        wordCount++;
      }
      segmentEndIndex = i + 1;
    }
    
    const visibleSegments = allSegments.slice(segmentStartIndex, segmentEndIndex);
    
    return {
      visibleSegments,
      startWordIndex,
    };
  }, [text, scrollPosition, screenHeight, textStyles]);

  // Render segments with individual touch targets for words
  const renderSegments = useMemo(() => {
    let currentWordIndex = startWordIndex;
    
    return visibleSegments.map((segment, segmentIndex) => {
      const isWord = segment.trim().length > 0 && !/^[\s\n]+$/.test(segment);
      
      if (isWord) {
        const highlighted = isHighlighted ? isHighlighted(currentWordIndex) : false;
        const wordIndex = currentWordIndex;
        currentWordIndex++;
        
        return (
          <TouchableOpacity 
            key={`${startWordIndex}-${segmentIndex}-${wordIndex}`}
            onPress={(event) => onWordTap(segment.trim(), event)}
            style={[
              styles.wordContainer,
              highlighted && styles.wordContainerHighlighted,
            ]}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.word, 
              textStyles,
              highlighted && styles.wordHighlighted,
            ]}>
              {segment}
            </Text>
          </TouchableOpacity>
        );
      } else {
        // Render whitespace as plain text
        return (
          <Text 
            key={`${startWordIndex}-${segmentIndex}-space`} 
            style={[styles.word, textStyles]}
          >
            {segment}
          </Text>
        );
      }
    });
  }, [visibleSegments, startWordIndex, onWordTap, textStyles, isHighlighted]);

  return (
    <View style={styles.container}>
      {renderSegments}
    </View>
  );
}, (prevProps, nextProps) => {
  // Conservative re-render logic - only update for significant changes
  const scrollDiff = Math.abs(prevProps.scrollPosition - nextProps.scrollPosition);
  
  const textChanged = prevProps.text !== nextProps.text;
  const styleChanged = prevProps.textStyles?.fontSize !== nextProps.textStyles?.fontSize;
  const highlightChanged = prevProps.isHighlighted !== nextProps.isHighlighted;
  
  // For font size changes, always update immediately (no performance cost since it's just style)
  if (styleChanged) {
    return false; // Always re-render for style changes
  }
  
  // For scroll changes, use a larger threshold to reduce re-renders
  const significantScrollChange = scrollDiff > 200; // Increased threshold
  const shouldUpdate = significantScrollChange || textChanged || highlightChanged;
  
  return !shouldUpdate;
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  wordContainer: {
    // Minimal styling for performance
  },
  wordContainerHighlighted: {
    backgroundColor: '#3498db',
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  word: {
    fontSize: 16,
    lineHeight: 24,
  },
  wordHighlighted: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});