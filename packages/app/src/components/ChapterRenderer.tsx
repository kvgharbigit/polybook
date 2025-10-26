import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity, Dimensions } from 'react-native';
import { PanGestureHandler, State as GestureState } from 'react-native-gesture-handler';
import RenderHtml from 'react-native-render-html';
import InteractiveText from './InteractiveText';
import { Chapter } from '../services/contentParser';

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
  const { width, height } = useWindowDimensions();
  const [currentPage, setCurrentPage] = useState(0);
  
  // Smart pagination that adapts to text size but keeps it manageable
  const pages = useMemo(() => {
    const content = chapter.content;
    const baseFontSize = 16;
    const currentFontSize = textStyles?.fontSize || baseFontSize;
    const fontSizeRatio = currentFontSize / baseFontSize;
    
    // Keep pages small enough that InteractiveText always works well
    const baseCharsPerPage = 1800; // Smaller for consistent performance
    const CHARS_PER_PAGE = Math.max(
      Math.floor(baseCharsPerPage / fontSizeRatio),
      1200 // Smaller minimum
    );
    
    if (content.length <= CHARS_PER_PAGE) {
      return [{ content, htmlContent: chapter.htmlContent }];
    }
    
    // Split at paragraph boundaries for better reading
    const paragraphs = content.split(/\n\s*\n/);
    const pages = [];
    let currentPageContent = '';
    
    for (const paragraph of paragraphs) {
      const nextLength = currentPageContent.length + paragraph.length + 2;
      
      if (nextLength > CHARS_PER_PAGE && currentPageContent.length > 500) {
        pages.push({
          content: currentPageContent.trim(),
          htmlContent: `<div>${currentPageContent.trim().replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>`
        });
        currentPageContent = paragraph;
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
    
    return pages;
  }, [chapter.content, textStyles?.fontSize]);
  
  const currentPageData = pages[currentPage] || pages[0];
  const totalPages = pages.length;
  
  // Reset to first page if current page is out of bounds
  React.useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(0);
    }
  }, [totalPages, currentPage]);
  
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

  // Handle swipe gestures for page navigation
  const onGestureEvent = (event: any) => {
    // Handle gesture events if needed
  };

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === GestureState.END) {
      const { translationX, velocityX } = event.nativeEvent;
      
      // Swipe right (positive translationX) = previous page
      // Swipe left (negative translationX) = next page
      if (Math.abs(translationX) > 50 || Math.abs(velocityX) > 500) {
        if (translationX > 0 && velocityX > -300) {
          // Swipe right - previous page
          goToPreviousPage();
        } else if (translationX < 0 && velocityX < 300) {
          // Swipe left - next page
          goToNextPage();
        }
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
      
      {/* Page Content with Swipe Gestures */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        minPointers={1}
        maxPointers={1}
      >
        <View style={styles.contentArea}>
          <InteractiveText
            text={currentPageData.content}
            onWordTap={onWordTap}
            textStyles={textStyles}
            isHighlighted={isHighlighted}
          />
        </View>
      </PanGestureHandler>
      
      {/* Subtle Page Navigation (swipe is primary) */}
      {totalPages > 1 && (
        <View style={styles.pageNavigation}>
          <View style={styles.pageIndicatorCenter}>
            <Text style={[styles.pageText, { color: theme.colors.textSecondary }]}>
              {currentPage + 1} / {totalPages}
            </Text>
            <Text style={[styles.swipeHint, { color: theme.colors.textSecondary }]}>
              ← Swipe to navigate →
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
    minHeight: 400, // Ensure consistent page height
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
  simpleTextContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  simpleText: {
    fontSize: 16,
    lineHeight: 28,
    textAlign: 'justify',
  },
  performanceNote: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 6,
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