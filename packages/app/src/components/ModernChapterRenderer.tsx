import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import StreamingChapterRenderer from './StreamingChapterRenderer';
import { Chapter } from '../services/contentParser';
import { useStableDimensions } from '../hooks/useStableDimensions';

interface ModernChapterRendererProps {
  chapter: Chapter;
  onWordTap: (word: string, event: any) => void;
  textStyles?: any;
  theme: any;
  isHighlighted?: (index: number) => boolean;
}

export default function ModernChapterRenderer(props: ModernChapterRendererProps) {
  // Delegate to streaming renderer for better performance
  return <StreamingChapterRenderer {...props} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  chapterTitle: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    marginBottom: 6,
  },
  pageInfo: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40, // Extra space at bottom
  },
  pageNavigation: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressBar: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 1.5,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  pageText: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 60,
    textAlign: 'right',
  },
  scrollHint: {
    fontSize: 10,
    fontStyle: 'italic',
    opacity: 0.6,
    textAlign: 'center',
  },
});