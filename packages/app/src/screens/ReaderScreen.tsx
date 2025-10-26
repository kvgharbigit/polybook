import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '../navigation/SimpleNavigator';
import { useAppStore } from '../store/appStore';
import { ContentParser } from '../services/contentParser';
import { db } from '../services/databaseInterface';

export default function ReaderScreen() {
  const { navigationState, goBack } = useNavigation();
  const { id } = navigationState.params || { id: '1' };
  
  const [content, setContent] = useState<string>('');
  const [bookTitle, setBookTitle] = useState<string>('Loading...');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const books = useAppStore(state => state.books);

  useEffect(() => {
    loadBookContent();
  }, [id]);

  const loadBookContent = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Find the book
      const book = books.find(b => b.id === id);
      if (!book) {
        setError('Book not found');
        return;
      }

      setBookTitle(book.title);

      // Check if content is already cached
      let bookContent = await db.getBookContent(book.id);
      
      if (!bookContent) {
        // Parse the book content for the first time
        console.log('Parsing book content for:', book.title);
        
        try {
          const parsed = await ContentParser.parseFile(book.filePath, book.format);
          
          // Save to database
          bookContent = {
            bookId: book.id,
            content: parsed.content,
            wordCount: parsed.wordCount,
            estimatedReadingTime: parsed.estimatedReadingTime,
            parsedAt: new Date(),
            contentVersion: '1.0'
          };
          
          await db.saveBookContent(bookContent);
          console.log('Book content parsed and cached successfully');
        } catch (parseError) {
          console.error('Error parsing book content:', parseError);
          setError('Failed to parse book content. Please try again.');
          return;
        }
      }

      setContent(bookContent.content);
    } catch (error) {
      console.error('Error loading book content:', error);
      setError('Failed to load book content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWordTap = (word: string) => {
    console.log('Tapped word:', word);
    // TODO: Implement word translation lookup
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Parsing book content...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error Loading Book</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadBookContent}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!content) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No content available</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.textContainer}>
          {content.split(/(\s+)/).map((segment, index) => {
            // Check if it's a word (not whitespace)
            const isWord = segment.trim().length > 0 && !/^\s+$/.test(segment);
            
            if (isWord) {
              return (
                <TouchableOpacity 
                  key={index}
                  onPress={() => handleWordTap(segment.trim())}
                  style={styles.wordContainer}
                >
                  <Text style={styles.word}>{segment}</Text>
                </TouchableOpacity>
              );
            } else {
              // Render whitespace as is
              return <Text key={index} style={styles.word}>{segment}</Text>;
            }
          })}
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with controls */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{bookTitle}</Text>
        <TouchableOpacity>
          <Text style={styles.settingsButton}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Reading content */}
      <View style={styles.content}>
        {renderContent()}
      </View>

      {/* Bottom controls */}
      {!isLoading && !error && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton}>
            <Text style={styles.controlText}>🔊</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton}>
            <Text style={styles.controlText}>📖</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton}>
            <Text style={styles.controlText}>⚡</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  settingsButton: {
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#e74c3c',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 20,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contentScroll: {
    flex: 1,
    padding: 20,
  },
  textContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    lineHeight: 24,
  },
  wordContainer: {
    marginVertical: 2,
  },
  word: {
    fontSize: 16,
    lineHeight: 24,
    color: '#2c3e50',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    backgroundColor: '#f8f9fa',
  },
  controlButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  controlText: {
    fontSize: 20,
  },
});