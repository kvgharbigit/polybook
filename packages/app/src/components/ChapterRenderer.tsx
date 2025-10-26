import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';
import InteractiveText from './InteractiveText';
import { EPUBChapter } from '../services/epubParser';

interface ChapterRendererProps {
  chapter: EPUBChapter;
  onWordTap: (word: string, event: any) => void;
  textStyles?: any;
  theme: any;
  isHighlighted?: (index: number) => boolean;
}

export default function ChapterRenderer({ 
  chapter, 
  onWordTap, 
  textStyles, 
  theme,
  isHighlighted, 
}: ChapterRendererProps) {
  const { width } = useWindowDimensions();
  
  // Custom renderer for text nodes to add word interaction
  const renderers = {
    textNode: (props: any) => {
      const text = props.tnode.data;
      if (!text || typeof text !== 'string') {
        return null;
      }
      
      return (
        <InteractiveText
          text={text}
          onWordTap={onWordTap}
          textStyles={textStyles}
          isHighlighted={isHighlighted}
        />
      );
    },
  };

  // Custom tag styles to match app theme
  const tagsStyles = {
    body: {
      color: theme.colors.text,
      fontSize: textStyles?.fontSize || 16,
      lineHeight: textStyles?.lineHeight || 24,
    },
    p: {
      marginBottom: 16,
      color: theme.colors.text,
    },
    h1: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 16,
      marginTop: 20,
    },
    h2: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 12,
      marginTop: 16,
    },
    h3: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 10,
      marginTop: 14,
    },
    em: {
      fontStyle: 'italic',
    },
    strong: {
      fontWeight: 'bold',
    },
    blockquote: {
      backgroundColor: theme.colors.surface,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
      paddingLeft: 16,
      paddingVertical: 12,
      marginVertical: 16,
      fontStyle: 'italic',
    },
  };

  // Clean HTML content - remove problematic elements
  const cleanHtmlContent = chapter.htmlContent
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
    .replace(/<link[^>]*>/gi, '') // Remove external links
    .replace(/<meta[^>]*>/gi, '') // Remove meta tags
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '') // Remove head section
    .replace(/<!DOCTYPE[^>]*>/gi, '') // Remove DOCTYPE
    .replace(/<html[^>]*>/gi, '') // Remove html tag
    .replace(/<\/html>/gi, '')
    .replace(/<body[^>]*>/gi, '') // Remove body tag
    .replace(/<\/body>/gi, '');

  return (
    <View style={styles.container}>
      <Text style={[styles.chapterTitle, { color: theme.colors.text }]}>
        {chapter.title}
      </Text>
      
      <RenderHtml
        contentWidth={width - 40} // Account for padding
        source={{ html: cleanHtmlContent || `<p>${chapter.content}</p>` }}
        renderers={renderers}
        tagsStyles={tagsStyles}
        defaultTextProps={{
          style: textStyles,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  chapterTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
});