import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';

interface InteractiveTextProps {
  text: string;
  onWordTap: (word: string, event: any) => void;
  style?: any;
  isHighlighted?: (index: number) => boolean;
  textStyles?: any;
}

function InteractiveText({ 
  text, 
  onWordTap, 
  style, 
  isHighlighted,
  textStyles, 
}: InteractiveTextProps) {
  // Split text into words and whitespace
  const segments = text.split(/(\s+)/);
  
  return (
    <View style={[styles.container, style]}>
      {segments.map((segment, index) => {
        // Check if it's a word (not whitespace)
        const isWord = segment.trim().length > 0 && !/^\s+$/.test(segment);
        
        if (isWord) {
          const highlighted = isHighlighted ? isHighlighted(index) : false;
          return (
            <TouchableOpacity 
              key={index}
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
          // Render whitespace as is
          return <Text key={index} style={[styles.word, textStyles]}>{segment}</Text>;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  wordContainer: {
    marginVertical: 2,
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

// Memoize to prevent unnecessary re-renders
export default React.memo(InteractiveText, (prevProps, nextProps) => {
  return (
    prevProps.text === nextProps.text &&
    prevProps.textStyles?.fontSize === nextProps.textStyles?.fontSize &&
    prevProps.isHighlighted === nextProps.isHighlighted
  );
});