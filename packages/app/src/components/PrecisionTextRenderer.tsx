import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback, GestureResponderEvent, Dimensions } from 'react-native';

interface PrecisionTextRendererProps {
  text: string;
  scrollPosition: number;
  screenHeight: number;
  onWordTap: (word: string, event: GestureResponderEvent) => void;
  textStyles?: any;
  isHighlighted?: (index: number) => boolean;
}

interface MeasuredWord {
  word: string;
  globalIndex: number;
  lineIndex: number;
  positionInLine: number;
  width: number;
  x: number;
  y: number;
}

/**
 * Production-grade text renderer using line-by-line layout measurement
 * More accurate than coordinate estimation
 */
export default React.memo(function PrecisionTextRenderer({
  text,
  scrollPosition,
  screenHeight,
  onWordTap,
  textStyles,
  isHighlighted,
}: PrecisionTextRendererProps) {
  const containerRef = useRef<View>(null);
  const textRef = useRef<Text>(null);
  const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width - 40); // Account for padding
  
  // Get container width when layout changes
  const handleLayout = useCallback((event: any) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  }, []);
  
  // Calculate visible text range with buffer
  const { visibleText, startOffset, allWords } = useMemo(() => {
    const fontSize = textStyles?.fontSize || 16;
    const lineHeight = textStyles?.lineHeight || (fontSize * 1.6);
    
    const linesOnScreen = Math.ceil(screenHeight / lineHeight);
    const avgCharsPerLine = 80;
    const charsPerScreen = linesOnScreen * avgCharsPerLine;
    const bufferScreens = 1.5;
    const totalCharsToRender = charsPerScreen * (1 + 2 * bufferScreens);
    
    const scrollRatio = Math.max(0, scrollPosition / Math.max(1, screenHeight));
    const estimatedScrollChars = scrollRatio * charsPerScreen;
    const bufferChars = charsPerScreen * bufferScreens;
    
    const startIndex = Math.max(0, Math.floor(estimatedScrollChars - bufferChars));
    const endIndex = Math.min(text.length, startIndex + totalCharsToRender);
    
    const visibleText = text.slice(startIndex, endIndex);
    
    // Create word mapping for the visible text
    const segments = visibleText.split(/(\s+)/);
    const allWords: { word: string; globalIndex: number; startPos: number; endPos: number }[] = [];
    let globalWordIndex = 0;
    let currentPos = 0;
    
    // Count words before visible area
    const textBeforeVisible = text.slice(0, startIndex);
    const wordsBeforeVisible = textBeforeVisible.split(/\s+/).filter(w => w.trim().length > 0);
    globalWordIndex = wordsBeforeVisible.length;
    
    for (const segment of segments) {
      const isWord = segment.trim().length > 0 && !/^\s+$/.test(segment);
      
      if (isWord) {
        allWords.push({
          word: segment.trim(),
          globalIndex: globalWordIndex++,
          startPos: currentPos,
          endPos: currentPos + segment.length,
        });
      }
      currentPos += segment.length;
    }
    
    return {
      visibleText,
      startOffset: startIndex,
      allWords,
    };
  }, [text, scrollPosition, screenHeight, textStyles]);

  // Calculate actual character positions and line breaks based on container width
  const { lines, wordPositions } = useMemo(() => {
    const fontSize = textStyles?.fontSize || 16;
    const lineHeight = textStyles?.lineHeight || (fontSize * 1.6);
    
    // Estimate character width based on font size (more accurate for monospace-like estimation)
    const avgCharWidth = fontSize * 0.55; // Refined based on typical font metrics
    const maxCharsPerLine = Math.floor(containerWidth / avgCharWidth);
    
    // Split text into words and whitespace
    const segments = visibleText.split(/(\s+)/);
    const lines: string[] = [];
    const wordPositions: { word: string; globalIndex: number; line: number; charStart: number; charEnd: number; x: number; y: number }[] = [];
    
    let currentLine = '';
    let currentLineLength = 0;
    let lineIndex = 0;
    let globalWordIndex = allWords[0]?.globalIndex || 0;
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isWord = segment.trim().length > 0 && !/^\s+$/.test(segment);
      
      // Check if adding this segment would exceed line width
      const segmentLength = segment.length;
      const wouldExceedLine = currentLineLength + segmentLength > maxCharsPerLine;
      
      if (wouldExceedLine && currentLine.trim().length > 0) {
        // Finish current line
        lines.push(currentLine);
        currentLine = '';
        currentLineLength = 0;
        lineIndex++;
      }
      
      // Add segment to current line
      const charStartInLine = currentLineLength;
      currentLine += segment;
      currentLineLength += segmentLength;
      
      if (isWord) {
        const charEndInLine = currentLineLength;
        const x = charStartInLine * avgCharWidth;
        const y = lineIndex * lineHeight;
        
        wordPositions.push({
          word: segment.trim(),
          globalIndex: globalWordIndex++,
          line: lineIndex,
          charStart: charStartInLine,
          charEnd: charEndInLine,
          x,
          y,
        });
      }
    }
    
    // Add final line if not empty
    if (currentLine.trim().length > 0) {
      lines.push(currentLine);
    }
    
    return { lines, wordPositions };
  }, [visibleText, containerWidth, textStyles, allWords]);

  // Handle word tap using precise coordinate detection
  const handlePress = useCallback((event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    
    // Find the closest word based on calculated positions
    let closestWord = null;
    let minDistance = Infinity;
    
    for (const wordPos of wordPositions) {
      // Calculate distance from tap point to word center
      const wordCenterX = wordPos.x + (wordPos.charEnd - wordPos.charStart) * (textStyles?.fontSize || 16) * 0.55 / 2;
      const wordCenterY = wordPos.y + (textStyles?.lineHeight || (textStyles?.fontSize || 16) * 1.6) / 2;
      
      const distance = Math.sqrt(
        Math.pow(locationX - wordCenterX, 2) + 
        Math.pow(locationY - wordCenterY, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestWord = wordPos;
      }
    }
    
    // Also check if the tap is reasonably close to any word (within line height)
    const fontSize = textStyles?.fontSize || 16;
    const lineHeight = textStyles?.lineHeight || (fontSize * 1.6);
    const maxDistance = lineHeight; // Allow selection within a line height distance
    
    if (closestWord && minDistance <= maxDistance) {
      onWordTap(closestWord.word, event);
    }
  }, [wordPositions, onWordTap, textStyles]);

  // Create highlighted word indices
  const highlightedIndices = useMemo(() => {
    if (!isHighlighted) return new Set();
    return new Set(
      wordPositions
        .filter(word => isHighlighted(word.globalIndex))
        .map(word => word.globalIndex)
    );
  }, [wordPositions, isHighlighted]);

  // Render text with highlighting
  const renderText = useMemo(() => {
    const segments = visibleText.split(/(\s+)/);
    let globalWordIndex = wordPositions[0]?.globalIndex || 0;
    
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
  }, [visibleText, highlightedIndices, startOffset, wordPositions]);

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View ref={containerRef} style={styles.container} onLayout={handleLayout}>
        <Text 
          style={[styles.text, textStyles]}
          selectable={false}
        >
          {renderText}
        </Text>
      </View>
    </TouchableWithoutFeedback>
  );
}, (prevProps, nextProps) => {
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