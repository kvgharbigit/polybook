import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { PanGestureHandler, State as GestureState } from 'react-native-gesture-handler';
import RenderHtml from 'react-native-render-html';
import InteractiveText from './InteractiveText';
import { Chapter } from '../services/contentParser';
import { useStableDimensions } from '../hooks/useStableDimensions';

interface ChapterRendererProps {
  chapter: Chapter;
  onWordTap: (word: string, event: any) => void;
  textStyles?: any;
  theme: any;
  isHighlighted?: (index: number) => boolean;
}

function ChapterRenderer({ 
  chapter, 
  onWordTap, 
  textStyles, 
  theme,
  isHighlighted, 
}: ChapterRendererProps) {
  const { width, height } = useStableDimensions(150, 15); // 150ms debounce, 15px threshold
  const [currentPage, setCurrentPage] = useState(0);
  
  // Animation values for smooth page transitions
  const translateX = useRef(new Animated.Value(0)).current;
  const gestureState = useRef({ isActive: false, startX: 0 }).current;
  const isAnimating = useRef(false);
  
  // Dynamic pagination based on screen space - no scrolling needed
  const pages = useMemo(() => {
    const content = chapter.content;
    const currentFontSize = textStyles?.fontSize || 16;
    const lineHeight = textStyles?.lineHeight || (currentFontSize * 1.6);
    
    // Calculate available content height (screen minus header, navigation, controls)
    const availableHeight = height - 250; // Reserve space for header/nav/controls
    
    // Calculate how many lines fit on screen
    const linesPerPage = Math.floor(availableHeight / lineHeight);
    
    // Estimate characters per line based on font size and screen width
    // Using a more accurate character width ratio for better estimation
    const charWidthRatio = 0.6; // Typical character width ratio for readable fonts
    const availableTextWidth = width - 60; // Account for horizontal padding
    const charsPerLine = Math.floor(availableTextWidth / (currentFontSize * charWidthRatio));
    
    // Calculate characters that fit without scrolling
    const CHARS_PER_PAGE = Math.max(
      linesPerPage * charsPerLine,
      800 // Minimum for readability
    );
    
    console.log(`📖 ChapterRenderer: Dynamic pagination - Screen: ${width}x${height}, Font: ${currentFontSize}px (line height: ${lineHeight}), Available height: ${availableHeight}px`);
    console.log(`📖 ChapterRenderer: Calculated: ${linesPerPage} lines × ${charsPerLine} chars/line = ${CHARS_PER_PAGE} chars per page`);
    
    if (content.length <= CHARS_PER_PAGE) {
      return [{ content, htmlContent: chapter.htmlContent }];
    }
    
    // Split at paragraph boundaries for better reading
    const paragraphs = content.split(/\n\s*\n/);
    const pages = [];
    let currentPageContent = '';
    
    for (const paragraph of paragraphs) {
      const nextLength = currentPageContent.length + paragraph.length + 2;
      
      // More intelligent page break logic
      if (nextLength > CHARS_PER_PAGE && currentPageContent.length > 300) {
        // Only break if we have substantial content
        pages.push({
          content: currentPageContent.trim(),
          htmlContent: `<div>${currentPageContent.trim().replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>`
        });
        currentPageContent = paragraph;
      } else if (nextLength > CHARS_PER_PAGE * 1.5) {
        // If paragraph is very long, force a break even with less content
        if (currentPageContent.length > 100) {
          pages.push({
            content: currentPageContent.trim(),
            htmlContent: `<div>${currentPageContent.trim().replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>`
          });
          currentPageContent = paragraph;
        } else {
          // Very first paragraph is too long, need to split it
          const words = paragraph.split(' ');
          let currentChunk = currentPageContent ? currentPageContent + '\n\n' : '';
          
          for (const word of words) {
            if ((currentChunk + word).length > CHARS_PER_PAGE && currentChunk.length > 300) {
              pages.push({
                content: currentChunk.trim(),
                htmlContent: `<div>${currentChunk.trim().replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>`
              });
              currentChunk = word;
            } else {
              currentChunk += (currentChunk && !currentChunk.endsWith(' ') ? ' ' : '') + word;
            }
          }
          currentPageContent = currentChunk;
        }
      } else {
        currentPageContent += (currentPageContent ? '\n\n' : '') + paragraph;
      }
    }
    
    if (currentPageContent.trim()) {
      pages.push({
        content: currentPageContent.trim(),
        htmlContent: `<div>${currentPageContent.trim().replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>`
      });
    }
    
    // Log final pagination results
    const pageSizes = pages.map(p => p.content.length);
    const avgPageSize = pageSizes.reduce((sum, size) => sum + size, 0) / pages.length;
    const maxPageSize = Math.max(...pageSizes);
    const minPageSize = Math.min(...pageSizes);
    
    console.log(`📖 ChapterRenderer: Created ${pages.length} pages from ${content.length} chars`);
    console.log(`📖 ChapterRenderer: Page sizes - Avg: ${Math.round(avgPageSize)}, Min: ${minPageSize}, Max: ${maxPageSize}`);
    
    return pages;
  }, [chapter.content, chapter.id, textStyles?.fontSize, textStyles?.lineHeight, width, height]);
  
  const currentPageData = pages[currentPage] || pages[0];
  const totalPages = pages.length;
  
  // Reset to first page if current page is out of bounds
  React.useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(0);
    }
  }, [totalPages, currentPage]);
  
  // Update animation position when page changes (only if not currently animating from gesture)
  React.useEffect(() => {
    if (!isAnimating.current) {
      translateX.setValue(-currentPage * width);
    }
  }, [currentPage, width, translateX]);
  
  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };


  // Handle swipe gestures with smooth visual feedback
  const onGestureEvent = (event: any) => {
    const { translationX } = event.nativeEvent;
    const baseOffset = -currentPage * width;
    
    // Update animation value with gesture + base offset
    translateX.setValue(baseOffset + translationX);
  };

  const onHandlerStateChange = (event: any) => {
    const { state, translationX, velocityX } = event.nativeEvent;
    
    if (state === GestureState.END || state === GestureState.CANCELLED) {
      // Determine if we should change pages based on gesture
      const swipeThreshold = width * 0.25; // 25% of screen width
      const velocityThreshold = 500;
      const shouldChangePage = Math.abs(translationX) > swipeThreshold || Math.abs(velocityX) > velocityThreshold;
      
      let newPage = currentPage;
      
      if (shouldChangePage) {
        if (translationX > 0 && currentPage > 0) {
          // Swipe right - previous page
          newPage = currentPage - 1;
        } else if (translationX < 0 && currentPage < totalPages - 1) {
          // Swipe left - next page
          newPage = currentPage + 1;
        }
      }
      
      // Animate to the target page position with coordinated state update
      const targetOffset = -newPage * width;
      
      if (newPage !== currentPage) {
        // Mark as animating to prevent useEffect interference
        isAnimating.current = true;
        
        Animated.spring(translateX, {
          toValue: targetOffset,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start((finished) => {
          // Update state after animation completes for perfect sync
          if (finished) {
            setCurrentPage(newPage);
            isAnimating.current = false;
          }
        });
      } else {
        // No page change, just spring back to current position
        Animated.spring(translateX, {
          toValue: targetOffset,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Chapter Header */}
      <View style={styles.header}>
        <Text style={[styles.chapterTitle, { color: theme.colors.text }]}>
          {chapter.title}
        </Text>
        {totalPages > 1 && (
          <Text style={[styles.pageInfo, { color: theme.colors.textSecondary }]}>
            Page {currentPage + 1} of {totalPages}
          </Text>
        )}
      </View>
      
      {/* Page Content with Smooth Swipe Gestures */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        minPointers={1}
        maxPointers={1}
        activeOffsetX={[-10, 10]}
        failOffsetY={[-20, 20]}
      >
        <Animated.View style={styles.contentArea}>
          <Animated.View 
            style={[
              styles.pageContainer,
              {
                transform: [{ translateX }],
                width: width * totalPages, // Total width for all pages
              }
            ]}
          >
            {/* Render current page and adjacent pages for smooth transitions */}
            {pages
              .map((pageData, index) => ({ pageData, index }))
              .filter(({ index }) => Math.abs(index - currentPage) <= 1)
              .map(({ pageData, index }) => (
                <View 
                  key={index}
                  style={[
                    styles.singlePage,
                    { 
                      left: index * width,
                      width: width, // Full screen width per page
                    }
                  ]}
                >
                  <InteractiveText
                    text={pageData.content}
                    onWordTap={onWordTap}
                    textStyles={textStyles}
                    isHighlighted={isHighlighted}
                  />
                </View>
              ))}
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
      
      {/* Subtle Page Navigation (swipe is primary) */}
      {totalPages > 1 && (
        <View style={styles.pageNavigation}>
          <View style={styles.pageIndicatorCenter}>
            <Text style={[styles.pageText, { color: theme.colors.textSecondary }]}>
              {currentPage + 1} / {totalPages}
            </Text>
            <Text style={[styles.swipeHint, { color: theme.colors.textSecondary }]}>
              ← Drag to turn pages →
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: 680,
    alignSelf: 'center',
    width: '100%',
    flex: 1,
    paddingBottom: 20,
  },
  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  chapterTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'left',
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  pageInfo: {
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  contentArea: {
    flex: 1,
    minHeight: 400,
    overflow: 'hidden',
  },
  pageContainer: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  singlePage: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    paddingHorizontal: 30,
    justifyContent: 'flex-start',
  },
  pageNavigation: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    marginTop: 20,
  },
  pageIndicatorCenter: {
    alignItems: 'center',
  },
  pageText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  swipeHint: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.7,
  },
});

// Memoize to prevent unnecessary re-renders
export default React.memo(ChapterRenderer, (prevProps, nextProps) => {
  return (
    prevProps.chapter.id === nextProps.chapter.id &&
    prevProps.chapter.content === nextProps.chapter.content &&
    prevProps.textStyles?.fontSize === nextProps.textStyles?.fontSize &&
    prevProps.theme.colors.text === nextProps.theme.colors.text
  );
});