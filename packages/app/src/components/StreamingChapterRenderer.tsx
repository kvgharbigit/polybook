import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import ReliableTextRenderer from './ReliableTextRenderer';
import { Chapter } from '../services/contentParser';
import { useStableDimensions } from '../hooks/useStableDimensions';

interface StreamingChapterRendererProps {
  chapter: Chapter;
  onWordTap: (word: string, event: any) => void;
  textStyles?: any;
  theme: any;
  isHighlighted?: (index: number) => boolean;
}

/**
 * Streaming chapter renderer that loads content progressively
 * Eliminates loading lag by rendering content in chunks as it loads
 */
export default React.memo(function StreamingChapterRenderer({
  chapter,
  onWordTap,
  textStyles,
  theme,
  isHighlighted,
}: StreamingChapterRendererProps) {
  const { width, height } = useStableDimensions(150, 15);
  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const lastScrollTime = useRef(Date.now());
  
  // Progressive loading state
  const [loadedContent, setLoadedContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Load content progressively to prevent UI blocking
  useEffect(() => {
    const loadContentProgressively = async () => {
      const content = chapter.content;
      setIsLoading(true);
      setLoadedContent('');
      setLoadingProgress(0);
      
      // For small content, load immediately
      if (content.length < 10000) {
        setLoadedContent(content);
        setIsLoading(false);
        setLoadingProgress(100);
        return;
      }
      
      // For large content, load in progressive chunks
      const chunkSize = 5000; // 5KB chunks
      const totalChunks = Math.ceil(content.length / chunkSize);
      let currentChunk = 0;
      
      const loadChunk = () => {
        const start = currentChunk * chunkSize;
        const end = Math.min((currentChunk + 1) * chunkSize, content.length);
        const chunk = content.slice(start, end);
        
        // Ensure we don't break words
        let adjustedEnd = end;
        if (end < content.length) {
          // Find the last complete word boundary
          const nextSpace = content.indexOf(' ', end);
          if (nextSpace !== -1 && nextSpace - end < 100) {
            adjustedEnd = nextSpace;
          }
        }
        
        const adjustedChunk = content.slice(start, adjustedEnd);
        
        setLoadedContent(prev => prev + adjustedChunk);
        setLoadingProgress(Math.round(((currentChunk + 1) / totalChunks) * 100));
        
        currentChunk++;
        
        if (adjustedEnd >= content.length) {
          setIsLoading(false);
        } else {
          // Use requestAnimationFrame for smooth loading
          loadingTimeoutRef.current = setTimeout(() => {
            requestAnimationFrame(loadChunk);
          }, 16); // ~60fps
        }
      };
      
      // Start loading after a brief delay to allow UI to render
      loadingTimeoutRef.current = setTimeout(() => {
        requestAnimationFrame(loadChunk);
      }, 50);
    };
    
    loadContentProgressively();
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [chapter.id, chapter.content]);
  
  // Calculate virtual pages from scroll position with memoization
  const { pageHeight, currentPage, totalPages, progressPercentage } = useMemo(() => {
    const pageHeight = height - 180; // Reserve space for header/navigation
    const currentPage = Math.floor(scrollPosition / pageHeight) + 1;
    const totalPages = Math.max(1, Math.ceil(contentHeight / pageHeight));
    
    // Pre-calculate progress percentage to avoid repeated math operations
    const maxScrollPosition = Math.max(1, contentHeight - pageHeight);
    const progressPercentage = Math.min(100, (scrollPosition / maxScrollPosition) * 100);
    
    return { pageHeight, currentPage, totalPages, progressPercentage };
  }, [scrollPosition, height, contentHeight]);
  
  // High-performance scroll handling with momentum detection
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastScrollUpdate = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastKnownPosition = useRef(0);
  const userStoppedScrolling = useRef(false);
  
  const handleScroll = useCallback((event: any) => {
    const newPosition = event.nativeEvent.contentOffset.y;
    
    console.log(`📍 SCROLL EVENT: position=${Math.round(newPosition)}`);
    
    // Always update position immediately for responsive scrolling
    setScrollPosition(newPosition);
    setIsScrolling(true);
    lastKnownPosition.current = newPosition;
    
    // Clear any existing timeout
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    
    // Set a timeout to mark as stopped, but momentum events will override this
    scrollTimeout.current = setTimeout(() => {
      console.log(`⏹️ TIMEOUT STOP: position=${Math.round(lastKnownPosition.current)}`);
      setIsScrolling(false);
    }, 200);
  }, []);
  
  // Handle when ScrollView momentum ends (this is the definitive stop)
  const handleMomentumScrollEnd = useCallback((event: any) => {
    const finalPosition = event.nativeEvent.contentOffset.y;
    console.log(`🏁 MOMENTUM END: final position=${Math.round(finalPosition)}`);
    
    // Clear any pending timeout
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    
    // Set final position and mark as truly stopped
    setScrollPosition(finalPosition);
    setIsScrolling(false);
    lastKnownPosition.current = finalPosition;
  }, []);
  
  // Handle content size changes (for accurate page count)
  const handleContentSizeChange = useCallback((contentWidth: number, contentHeight: number) => {
    setContentHeight(contentHeight);
  }, []);
  
  // Cleanup scroll timeout and animation frame on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
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
          {isLoading ? `Loading... ${loadingProgress}%` : `Page ${currentPage} of ${totalPages}`}
        </Text>
      </View>
      
      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading chapter content... {loadingProgress}%
          </Text>
        </View>
      )}
      
      {/* High-performance Scrolling Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={16} // Back to 16 for smoother position updates
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
        removeClippedSubviews={true} // Enable for better memory management
        bounces={true}
        bouncesZoom={false}
        alwaysBounceVertical={false}
        contentInsetAdjustmentBehavior="never"
        // Additional performance optimizations
        keyboardShouldPersistTaps="never"
        automaticallyAdjustContentInsets={false}
        scrollToOverflowEnabled={false}
      >
        {loadedContent.length > 0 && (
          <ReliableTextRenderer
            text={loadedContent}
            scrollPosition={scrollPosition}
            screenHeight={height}
            onWordTap={onWordTap}
            textStyles={textStyles}
            isHighlighted={isHighlighted}
          />
        )}
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
                  width: isLoading ? `${loadingProgress}%` : `${progressPercentage}%`,
                  backgroundColor: isLoading ? theme.colors.secondary : theme.colors.primary 
                }
              ]} 
            />
          </View>
          
          {/* Page Counter */}
          <Text style={[styles.pageText, { color: theme.colors.textSecondary }]}>
            {isLoading ? `${loadingProgress}%` : `${currentPage} / ${totalPages}`}
          </Text>
        </View>
        
        <Text style={[styles.scrollHint, { color: theme.colors.textSecondary }]}>
          {isLoading ? 'Loading chapter content...' : 'Scroll or swipe to navigate'}
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  loadingText: {
    fontSize: 12,
    marginLeft: 8,
    fontStyle: 'italic',
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