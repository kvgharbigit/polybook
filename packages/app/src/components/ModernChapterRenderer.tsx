import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import ReliableTextRenderer from './ReliableTextRenderer';
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
  const [debouncedScrollPosition, setDebouncedScrollPosition] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const lastScrollTime = useRef(Date.now());
  
  // Calculate virtual pages from scroll position
  const pageHeight = height - 180; // Reserve space for header/navigation
  const currentPage = Math.floor(debouncedScrollPosition / pageHeight) + 1;
  const totalPages = Math.max(1, Math.ceil(contentHeight / pageHeight));
  
  // Optimized scroll handling with throttling
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const handleScroll = useCallback((event: any) => {
    const newPosition = event.nativeEvent.contentOffset.y;
    const now = Date.now();
    
    // Track scrolling state
    setIsScrolling(true);
    lastScrollTime.current = now;
    
    // Update text rendering immediately (for smooth scrolling)
    setScrollPosition(newPosition);
    
    // Debounce progress bar updates to prevent UI jumps
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    
    scrollTimeout.current = setTimeout(() => {
      setDebouncedScrollPosition(newPosition);
      setIsScrolling(false); // Mark scrolling as stopped
    }, 150);
  }, []);
  
  // Handle content size changes (for accurate page count)
  const handleContentSizeChange = useCallback((contentWidth: number, contentHeight: number) => {
    setContentHeight(contentHeight);
  }, []);
  
  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

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
        removeClippedSubviews={false}
        bounces={true}
        bouncesZoom={false}
        alwaysBounceVertical={false}
        contentInsetAdjustmentBehavior="never"
      >
        <ReliableTextRenderer
          text={chapter.content}
          scrollPosition={scrollPosition}
          screenHeight={height}
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
                  width: `${Math.min(100, (debouncedScrollPosition / Math.max(1, contentHeight - pageHeight)) * 100)}%`,
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