import React, { useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface ReliableTextRendererProps {
  text: string;
  scrollPosition: number;
  screenHeight: number;
  onWordTap: (word: string, event: any) => void;
  textStyles?: any;
  isHighlighted?: (index: number) => boolean;
  isWordTappingEnabled?: boolean;
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
  isWordTappingEnabled = true,
}: ReliableTextRendererProps) {
  
  console.log('🔄 ReliableTextRenderer: Re-rendering with textStyles', {
    fontSize: textStyles?.fontSize,
    lineHeight: textStyles?.lineHeight,
    wordSpacing: textStyles?.wordSpacing,
    wordTappingEnabled: isWordTappingEnabled
  });
  
  // Track when scrolling to freeze virtualization during momentum
  const lastVirtualizationUpdate = useRef(0);
  const isScrollingFast = useRef(false);
  
  // SMART VIRTUALIZATION: Use larger windows that don't change during scroll
  const { visibleSegments, startWordIndex } = useMemo(() => {
    // Skip expensive virtualization when word tapping is disabled (during font changes)
    if (!isWordTappingEnabled) {
      console.log(`🚫 VIRTUALIZATION DISABLED: during font changes`);
      // Return a simple subset to avoid expensive recalculation
      const allSegments = text.split(/([\s\n]+)/);
      return {
        visibleSegments: allSegments.slice(0, 100), // Just first 100 segments for instant response
        startWordIndex: 0
      };
    }
    
    console.log(`🎯 SMART VIRTUALIZATION: scroll=${Math.round(scrollPosition)}`);
    
    // Split all text into words and whitespace
    const allSegments = text.split(/([\s\n]+)/);
    const words = allSegments.filter((segment, index) => index % 2 === 0 && segment.trim().length > 0);
    
    // Calculate fixed windows based on scroll position ranges
    // Use large windows (2000 words) that only change at major boundaries
    const wordsPerWindow = 2000;
    const windowIndex = Math.floor((scrollPosition / (screenHeight * 5))); // Change window every 5 screen heights
    
    const startWordIndex = windowIndex * wordsPerWindow;
    const endWordIndex = Math.min(words.length, (windowIndex + 1) * wordsPerWindow);
    
    console.log(`📋 WINDOW: ${windowIndex}, words ${startWordIndex}-${endWordIndex} of ${words.length}`);
    
    // Find actual segments for this window
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
  }, [text, Math.floor(scrollPosition / (screenHeight * 5)), textStyles]); // Window-based dependency

  // Render segments with individual touch targets for words
  const renderSegments = useMemo(() => {
    let currentWordIndex = startWordIndex;
    
    return visibleSegments.map((segment, segmentIndex) => {
      const isWord = segment.trim().length > 0 && !/^[\s\n]+$/.test(segment);
      
      if (isWord) {
        const highlighted = isHighlighted ? isHighlighted(currentWordIndex) : false;
        const wordIndex = currentWordIndex;
        currentWordIndex++;
        
        // Conditionally render as touchable or plain text based on word tapping state
        if (isWordTappingEnabled) {
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
          // Render as plain text when word tapping is disabled (during font changes)
          return (
            <Text 
              key={`${startWordIndex}-${segmentIndex}-${wordIndex}-disabled`}
              style={[
                styles.word, 
                textStyles,
                highlighted && styles.wordHighlighted,
              ]}
            >
              {segment}
            </Text>
          );
        }
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
  }, [visibleSegments, startWordIndex, onWordTap, textStyles, isHighlighted, isWordTappingEnabled]);

  return (
    <View style={styles.container}>
      {renderSegments}
    </View>
  );
}, (prevProps, nextProps) => {
  // Ultra-conservative re-render logic - prevent ALL virtualization during scroll momentum
  const scrollDiff = Math.abs(prevProps.scrollPosition - nextProps.scrollPosition);
  
  const textChanged = prevProps.text !== nextProps.text;
  const styleChanged = prevProps.textStyles?.fontSize !== nextProps.textStyles?.fontSize;
  const highlightChanged = prevProps.isHighlighted !== nextProps.isHighlighted;
  const wordTappingChanged = prevProps.isWordTappingEnabled !== nextProps.isWordTappingEnabled;
  
  // For font size changes or word tapping state changes, always update immediately
  if (styleChanged || wordTappingChanged) {
    return false; // Always re-render for style or word tapping changes
  }
  
  // COMPLETELY disable virtualization updates during any scroll movement
  // Only update when scroll stops completely or for major changes
  const majorScrollChange = scrollDiff > 2000; // Very large threshold - almost never during normal scroll
  const shouldUpdate = majorScrollChange || textChanged || highlightChanged;
  
  console.log(`🔒 MEMO CHECK: scrollDiff=${scrollDiff}, shouldUpdate=${shouldUpdate}, wordTappingChanged=${wordTappingChanged}`);
  
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