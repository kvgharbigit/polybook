import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface HybridVirtualizedTextProps {
  text: string;
  scrollPosition: number;
  screenHeight: number;
  onWordTap: (word: string, event: any) => void;
  textStyles?: any;
  isHighlighted?: (index: number) => boolean;
}

/**
 * Hybrid approach: Virtualize text but keep individual word touch targets
 * More reliable than coordinate detection while still performant
 */
export default React.memo(function HybridVirtualizedText({
  text,
  scrollPosition,
  screenHeight,
  onWordTap,
  textStyles,
  isHighlighted,
}: HybridVirtualizedTextProps) {
  
  // Calculate visible text range - only render what's on screen + small buffer
  const { visibleSegments, startWordIndex } = useMemo(() => {
    const fontSize = textStyles?.fontSize || 16;
    const lineHeight = textStyles?.lineHeight || (fontSize * 1.6);
    
    // Calculate roughly how many words fit on screen
    const linesOnScreen = Math.ceil(screenHeight / lineHeight);
    const avgWordsPerLine = 12; // Conservative estimate
    const wordsPerScreen = linesOnScreen * avgWordsPerLine;
    
    // Add buffer for smooth scrolling
    const bufferScreens = 1; // 1 screen above and below
    const totalWordsToRender = wordsPerScreen * (1 + 2 * bufferScreens);
    
    // Split all text into words and whitespace
    const allSegments = text.split(/(\s+)/);
    const words = allSegments.filter((segment, index) => index % 2 === 0 && segment.trim().length > 0);
    
    // Calculate start position based on scroll with better end-of-content handling
    const scrollRatio = Math.max(0, Math.min(1, scrollPosition / Math.max(1, screenHeight * 4))); // Better content height estimate
    const estimatedStartWord = Math.floor(scrollRatio * words.length);
    const bufferWords = wordsPerScreen * bufferScreens;
    
    let startWordIndex = Math.max(0, estimatedStartWord - bufferWords);
    let endWordIndex = Math.min(words.length, startWordIndex + totalWordsToRender);
    
    // Prevent skipping at end - if we're near the end, extend the window backwards
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
      const isWord = segment.trim().length > 0 && !/^\s+$/.test(segment);
      
      if (isWord) {
        const highlighted = isHighlighted ? isHighlighted(currentWordIndex) : false;
        const wordIndex = currentWordIndex;
        currentWordIndex++;
        
        return (
          <TouchableOpacity 
            key={`${startWordIndex}-${segmentIndex}-${segment}`}
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
  // Even more conservative - disable virtualization updates during momentum scrolling
  const scrollDiff = Math.abs(prevProps.scrollPosition - nextProps.scrollPosition);
  
  const textChanged = prevProps.text !== nextProps.text;
  const styleChanged = prevProps.textStyles?.fontSize !== nextProps.textStyles?.fontSize;
  const highlightChanged = prevProps.isHighlighted !== nextProps.isHighlighted;
  
  // Only update for non-scroll changes during momentum
  if (scrollDiff > 0 && scrollDiff < 300) {
    // During momentum scrolling, only update for text/style changes
    return !(textChanged || styleChanged || highlightChanged);
  }
  
  // For large scroll changes, allow updates
  const significantScrollChange = scrollDiff > 800;
  const shouldUpdate = significantScrollChange || textChanged || styleChanged || highlightChanged;
  
  return !shouldUpdate;
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  wordContainer: {
    marginVertical: 1,
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