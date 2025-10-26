import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import InteractiveText from './InteractiveText';
import { Chapter } from '../services/contentParser';
import { useStableDimensions } from '../hooks/useStableDimensions';

interface ModernChapterRendererProps {
  chapter: Chapter;
  onWordTap: (word: string, event: any) => void;
  textStyles?: any;
  theme: any;
  isHighlighted?: (index: number) => boolean;
}

export default React.memo(function ModernChapterRenderer({
  chapter,
  onWordTap,
  textStyles,
  theme,
  isHighlighted,
}: ModernChapterRendererProps) {
  const { width, height } = useStableDimensions(150, 15);
  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  
  // Calculate virtual pages from scroll position
  const pageHeight = height - 180; // Reserve space for header/navigation
  const currentPage = Math.floor(scrollPosition / pageHeight) + 1;
  const totalPages = Math.max(1, Math.ceil(contentHeight / pageHeight));
  
  // Handle scroll events
  const handleScroll = useCallback((event: any) => {
    const newPosition = event.nativeEvent.contentOffset.y;
    setScrollPosition(newPosition);
  }, []);
  
  // Handle content size changes (for accurate page count)
  const handleContentSizeChange = useCallback((contentWidth: number, contentHeight: number) => {
    setContentHeight(contentHeight);
  }, []);
  
  // No page navigation functions needed - just smooth scrolling
  // Page numbers are purely informational, not functional

  return (
    <View style={styles.container}>
      {/* Chapter Header with Page Info */}
      <View style={styles.header}>
        <Text style={[styles.chapterTitle, { color: theme.colors.text }]}>
          {chapter.title}
        </Text>
        <Text style={[styles.pageInfo, { color: theme.colors.textSecondary }]}>
          Page {currentPage} of {totalPages}
        </Text>
      </View>
      
      {/* Smooth Scrolling Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
      >
        <InteractiveText
          text={chapter.content}
          onWordTap={onWordTap}
          textStyles={textStyles}
          isHighlighted={isHighlighted}
        />
      </ScrollView>
      
      {/* Page Navigation Overlay */}
      <View style={styles.pageNavigation}>
        <View style={styles.progressContainer}>
          {/* Progress Bar */}
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${Math.min(100, (scrollPosition / Math.max(1, contentHeight - pageHeight)) * 100)}%`,
                  backgroundColor: theme.colors.primary 
                }
              ]} 
            />
          </View>
          
          {/* Page Counter */}
          <Text style={[styles.pageText, { color: theme.colors.textSecondary }]}>
            {currentPage} / {totalPages}
          </Text>
        </View>
        
        <Text style={[styles.scrollHint, { color: theme.colors.textSecondary }]}>
          Scroll or swipe to navigate
        </Text>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.chapter.id === nextProps.chapter.id &&
    prevProps.chapter.content === nextProps.chapter.content &&
    prevProps.textStyles?.fontSize === nextProps.textStyles?.fontSize &&
    prevProps.theme.colors.text === nextProps.theme.colors.text
  );
});

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