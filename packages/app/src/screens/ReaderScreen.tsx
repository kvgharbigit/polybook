import React, { useState, useEffect, useRef, useReducer, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '../navigation/SimpleNavigator';
import { useAppStore } from '../store/appStore';
import { ContentParser } from '../services/contentParser';
import { db } from '../services/databaseInterface';
import BilingualTranslationPopup from '../components/BilingualTranslationPopup';
import TranslationPopup, { WordDefinition } from '../components/TranslationPopup';
import WordPopup from '../components/WordPopup';
import ModernChapterRenderer from '../components/ModernChapterRenderer';
import InteractiveText from '../components/InteractiveText';
import { WordLookupService } from '../services/wordLookup';
import SQLiteDictionaryService from '../services/sqliteDictionaryService';
import { ttsService } from '../services/ttsService';
import { useTheme } from '../hooks/useTheme';
import { useFont } from '../hooks/useFont';
import { useTTSHighlight } from '../hooks/useTTSHighlight';
import { Chapter } from '../services/contentParser';

function ReaderScreen() {
  console.log('🔵 ReaderScreen: Component mounting/re-rendering');
  
  const { navigationState, goBack } = useNavigation();
  const { id } = navigationState.params || { id: '1' };
  const { theme, setTheme, currentThemeName, availableThemes } = useTheme();
  const { 
    userLanguageProfile,
    addBookmark,
    getBookmarks,
  } = useAppStore();
  
  console.log('🔵 ReaderScreen: userLanguageProfile from store:', userLanguageProfile);
  const { settings: fontSettings, increaseFontSize, decreaseFontSize, textStyles: rawTextStyles } = useFont();
  
  // Memoize textStyles to prevent ReaderScreen re-renders on font changes
  const textStyles = useMemo(() => rawTextStyles, [
    rawTextStyles?.fontSize, 
    rawTextStyles?.lineHeight, 
    rawTextStyles?.letterSpacing
  ]);
  const { highlightWord, isWordHighlighted, clearHighlight } = useTTSHighlight();
  
  const [content, setContent] = useState<string>('');
  const [bookTitle, setBookTitle] = useState<string>('Loading...');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contentLoaded, setContentLoaded] = useState(false);
  
  // Chapter navigation state
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isEpub, setIsEpub] = useState(false);
  const [showChapterSidebar, setShowChapterSidebar] = useState(false);
  
  // Translation popup state (legacy)
  const [showPopup, setShowPopup] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string>('');
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [wordDefinition, setWordDefinition] = useState<WordDefinition | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  
  // New WordPopup state
  const [showWordPopup, setShowWordPopup] = useState(false);
  const [currentLookupWord, setCurrentLookupWord] = useState<string>('');
  const [wordPopupPosition, setWordPopupPosition] = useState({ x: 0, y: 0 });
  
  // Success message state
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  
  // TTS state
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  
  // Large document chunking state
  const [isChunkingLargeDocument, setIsChunkingLargeDocument] = useState(false);
  const [pseudoChapters, setPseudoChapters] = useState<Chapter[]>([]);
  
  const [currentBook, setCurrentBook] = useState<any>(null);
  
  // Force re-render hook
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Initialize SQLite dictionary service
  useEffect(() => {
    const initializeDictionary = async () => {
      console.log('📚 ReaderScreen: Dictionary initialization effect triggered');
      console.log('📚 ReaderScreen: userLanguageProfile from store:', userLanguageProfile);
      
      // Always try to get fresh profile from service if store profile is missing or seems default
      let currentProfile = userLanguageProfile;
      
      if (!currentProfile || currentProfile.nativeLanguage === 'en') {
        console.log('📚 ReaderScreen: Store profile missing or default, fetching fresh profile...');
        try {
          // Import the service dynamically to avoid circular imports
          const UserLanguageProfileService = (await import('../services/userLanguageProfileService')).default;
          currentProfile = await UserLanguageProfileService.getUserProfile();
          console.log('📚 ReaderScreen: Fresh profile loaded:', currentProfile);
        } catch (error) {
          console.error('📚 ReaderScreen: Failed to load fresh profile:', error);
        }
      }
      
      if (!currentProfile) {
        console.log('📚 ReaderScreen: ❌ No user language profile available, skipping dictionary initialization');
        return;
      }

      try {
        console.log('📚 ReaderScreen: ✅ User language profile found, proceeding with dictionary initialization');
        const languages = [
          currentProfile.nativeLanguage,
          ...currentProfile.targetLanguages
        ];
        console.log('📚 ReaderScreen: Languages to initialize:', languages);
        console.log('📚 ReaderScreen: Native language:', currentProfile.nativeLanguage);
        console.log('📚 ReaderScreen: Target languages:', currentProfile.targetLanguages);
        
        console.log('📚 ReaderScreen: Calling SQLiteDictionaryService.initialize()...');
        await SQLiteDictionaryService.initialize(languages);
        console.log('📚 ReaderScreen: ✅ SQLite dictionary service initialized successfully');
      } catch (error) {
        console.error('📚 ReaderScreen: ❌ Failed to initialize dictionary service:', error);
        console.error('📚 ReaderScreen: Error stack:', error.stack);
      }
    };

    initializeDictionary();
  }, [userLanguageProfile]);
  
  // Handle large document chunking in background
  useEffect(() => {
    const processLargeDocument = async () => {
      // Only process if content is large and we don't already have chapters
      if (content.length > 100000 && chapters.length === 0 && !isChunkingLargeDocument) {
        console.log(`📚 ReaderScreen: Large document detected (${content.length} chars), chunking in background...`);
        setIsChunkingLargeDocument(true);
        
        try {
          // Defer to next tick to avoid blocking render
          await new Promise(resolve => setTimeout(resolve, 0));
          
          const chunks = ContentParser.splitIntoChunks(content, 15000);
          console.log(`📚 ReaderScreen: Split into ${chunks.length} chunks`);
          
          const newPseudoChapters = chunks.map((chunk, index) => ({
            id: chunk.id,
            title: `Section ${index + 1}`,
            content: chunk.text,
            htmlContent: `<div>${chunk.text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>`,
            order: index,
          }));
          
          setPseudoChapters(newPseudoChapters);
          setChapters(newPseudoChapters);
          setIsEpub(true);
          setIsChunkingLargeDocument(false);
          
          console.log('📚 ReaderScreen: Large document chunking completed');
        } catch (error) {
          console.error('📚 ReaderScreen: Error chunking large document:', error);
          setIsChunkingLargeDocument(false);
        }
      }
    };
    
    processLargeDocument();
  }, [content.length, chapters.length, isChunkingLargeDocument]);
  
  const books = useAppStore(state => state.books);
  const scrollViewRef = useRef<ScrollView>(null);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  // Component cleanup
  useEffect(() => {
    console.log('🔵 ReaderScreen: Component mounted');
    mountedRef.current = true;
    return () => {
      console.log('🔴 ReaderScreen: Component unmounting');
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    console.log('📘 ReaderScreen: useEffect triggered', {
      id,
      booksLength: books.length,
      contentLoaded,
      isLoading: loadingRef.current,
    });
    
    // Don't reload if content is already loaded for this book or if already loading
    if (contentLoaded || loadingRef.current) {
      console.log('📘 ReaderScreen: Skipping reload - content already loaded or loading in progress');
      return;
    }
    
    // Ensure books are loaded before trying to access them
    const loadData = async () => {
      console.log('📘 ReaderScreen: Starting loadData function');
      if (books.length === 0) {
        console.log('📘 ReaderScreen: No books loaded, loading books first');
        await useAppStore.getState().loadBooks();
      }
      console.log('📘 ReaderScreen: Calling loadBookContent');
      await loadBookContent();
    };
    loadData();
  }, [id]); // Only depend on id, not books.length

  const loadBookContent = async () => {
    console.log('📖 loadBookContent: Starting function');
    try {
      loadingRef.current = true;
      setIsLoading(true);
      setError(null);
      console.log('📖 loadBookContent: Set loading state to true');

      // Find the book
      const book = books.find(b => b.id === id);
      console.log('📖 loadBookContent: Looking for book with ID:', id);
      console.log('📖 loadBookContent: Available books:', books.map(b => ({ id: b.id, title: b.title, format: b.format })));
      
      if (!book) {
        console.error('📖 loadBookContent: Book not found!');
        setError('Book not found');
        return;
      }

      console.log('📖 loadBookContent: Found book:', { title: book.title, format: book.format, filePath: book.filePath });
      setBookTitle(`${book.title} (${book.format.toUpperCase()})`);
      setCurrentBook(book);

      // Check if content is already cached and compatible
      console.log('📖 loadBookContent: Checking for cached content');
      let bookContent = await db.getBookContent(book.id);
      
      // Check if we need to re-parse due to missing chapters or old version (for any format)
      const needsReparse = bookContent && 
        (!bookContent.chapters || bookContent.contentVersion === '1.0' || bookContent.contentVersion === '2.0' || bookContent.contentVersion === '3.0' || bookContent.contentVersion === '4.0' || bookContent.contentVersion === '5.0' || bookContent.contentVersion === '6.0');
      
      if (!bookContent || needsReparse) {
        if (needsReparse) {
          console.log('📖 loadBookContent: Content needs re-parsing for enhanced chapter support');
          await db.deleteBookContent(book.id);
        }
        console.log('📖 loadBookContent: No cached content found, parsing file for first time');
        console.log('📖 loadBookContent: Parsing file:', book.filePath, 'with format:', book.format);
        
        try {
          const parsed = await ContentParser.parseFile(book.filePath, book.format);
          console.log('📖 loadBookContent: File parsed successfully', {
            contentLength: parsed.content.length,
            wordCount: parsed.wordCount,
            hasChapters: !!parsed.chapters,
            chaptersCount: parsed.chapters?.length || 0,
          });
          
          // Save to database
          bookContent = {
            bookId: book.id,
            content: parsed.content,
            wordCount: parsed.wordCount,
            estimatedReadingTime: parsed.estimatedReadingTime,
            parsedAt: new Date(),
            contentVersion: '7.0',
            chapters: parsed.chapters, // Include chapters if available
          };
          
          console.log('📖 loadBookContent: Saving parsed content to database');
          await db.saveBookContent(bookContent);
          console.log('📖 loadBookContent: Content saved to database successfully');
        } catch (parseError) {
          console.error('📖 loadBookContent: Error parsing book content:', parseError);
          setError('Failed to parse book content. Please try again.');
          return;
        }
      } else {
        console.log('📖 loadBookContent: Found cached content', {
          contentLength: bookContent.content.length,
          wordCount: bookContent.wordCount,
          hasChapters: !!bookContent.chapters,
          chaptersCount: bookContent.chapters?.length || 0,
        });
      }

      // Only update state if component is still mounted
      console.log('📖 loadBookContent: Updating component state');
      if (mountedRef.current) {
        console.log('📖 loadBookContent: Component still mounted, setting content');
        setContent(bookContent.content);
        setContentLoaded(true);
        
        
        // Handle chapters if available (from any file format)
        if (bookContent.chapters && bookContent.chapters.length > 0) {
          console.log('📖 loadBookContent: Setting chapters from', book.format.toUpperCase(), {
            chaptersCount: bookContent.chapters.length,
            chapterTitles: bookContent.chapters.map((c: any) => c.title),
          });
          setChapters(bookContent.chapters);
          setIsEpub(true); // Use chapter-based navigation for any format with chapters
        } else {
          console.log('📖 loadBookContent: No chapters found, using single-document mode');
          setIsEpub(false);
        }
      } else {
        console.warn('📖 loadBookContent: Component unmounted, skipping state update');
      }
    } catch (error) {
      console.error('📖 loadBookContent: Caught error:', error);
      if (mountedRef.current) {
        console.log('📖 loadBookContent: Setting error state');
        setError('Failed to load book content');
      }
    } finally {
      console.log('📖 loadBookContent: In finally block');
      loadingRef.current = false;
      if (mountedRef.current) {
        console.log('📖 loadBookContent: Setting loading to false');
        setIsLoading(false);
        
        // Force a re-render to ensure UI updates
        setTimeout(() => {
          if (mountedRef.current) {
            console.log('📖 loadBookContent: Force update timeout triggered');
            setIsLoading(false);
            setContentLoaded(true);
            forceUpdate();
          }
        }, 50);
      }
    }
  };


  const handleWordTap = async (word: string, event: any, wordIndex?: number) => {
    console.log('📖 Tapped word:', word);
    
    // Extract position immediately before async operations
    const { pageX, pageY } = event.nativeEvent;
    
    // Clean the word (remove punctuation)
    const cleanWord = word.replace(/[^\w'-]/g, '').toLowerCase();
    if (!cleanWord || cleanWord.length < 2) {
      console.log('📖 Skipping lookup for short/empty word:', cleanWord);
      return;
    }
    
    // Speak the word if TTS is enabled
    if (isTTSEnabled) {
      try {
        if (cleanWord.length > 0) {
          // Highlight the word during TTS
          if (wordIndex !== undefined) {
            highlightWord(cleanWord, wordIndex, 1500);
          }
          
          await ttsService.speak(cleanWord, {
            rate: 0.8, // Slightly slower for single words
            language: 'en-US', // TODO: Use book language from userLanguageProfile
            onDone: () => {
              // Clear highlight when TTS is done
              clearHighlight();
            },
          });
        }
      } catch (error) {
        console.error('Error speaking word:', error);
        clearHighlight();
      }
    }
    
    // Show the new SQLite-powered dictionary popup
    setCurrentLookupWord(cleanWord);
    setWordPopupPosition({ x: pageX, y: pageY });
    setShowWordPopup(true);
    
    // Legacy popup fallback (keep for now)
    setSelectedWord(word);
    setPopupPosition({ x: pageX, y: pageY });
  };

  const handleClosePopup = () => {
    setShowPopup(false);
    setSelectedWord('');
    setWordDefinition(null);
    setLookupError(null);
  };

  const handleCloseWordPopup = () => {
    setShowWordPopup(false);
    setCurrentLookupWord('');
  };

  const handleSaveWord = (word: string, definition: any) => {
    // Save word to user's collection/bookmarks
    console.log('📚 Saving word:', word, definition);
    setSuccessMessage(`Saved "${word}" to your word collection`);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const extractContext = (word: string, fullText: string): string => {
    // Find the word in the text and extract surrounding context
    const wordIndex = fullText.toLowerCase().indexOf(word.toLowerCase());
    if (wordIndex === -1) return word;

    // Find sentence boundaries around the word
    const beforeText = fullText.substring(0, wordIndex);
    const afterText = fullText.substring(wordIndex + word.length);

    // Look for sentence endings before the word
    const sentenceStart = Math.max(
      beforeText.lastIndexOf('.'),
      beforeText.lastIndexOf('!'),
      beforeText.lastIndexOf('?'),
      beforeText.lastIndexOf('\n'),
    );

    // Look for sentence endings after the word
    const sentenceEndPos = Math.min(
      afterText.indexOf('.') !== -1 ? afterText.indexOf('.') + wordIndex + word.length : Infinity,
      afterText.indexOf('!') !== -1 ? afterText.indexOf('!') + wordIndex + word.length : Infinity,
      afterText.indexOf('?') !== -1 ? afterText.indexOf('?') + wordIndex + word.length : Infinity,
      afterText.indexOf('\n') !== -1 ? afterText.indexOf('\n') + wordIndex + word.length : Infinity,
    );

    const start = sentenceStart >= 0 ? sentenceStart + 1 : 0;
    const end = sentenceEndPos < Infinity ? sentenceEndPos + 1 : fullText.length;

    return fullText.substring(start, end).trim();
  };


  const handleTranslateWord = async (word: string) => {
    try {
      console.log('Translating word:', word);
      // TODO: Implement actual translation service
      // For now, just retry the lookup
      setIsLookingUp(true);
      setLookupError(null);
      const definition = await WordLookupService.lookupWord(word);
      setWordDefinition(definition);
    } catch (error) {
      console.error('Error translating word:', error);
      setLookupError('Translation failed. Please try again.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const toggleTTS = () => {
    setIsTTSEnabled(!isTTSEnabled);
    console.log('TTS', isTTSEnabled ? 'disabled' : 'enabled');
  };

  const cycleTheme = () => {
    const themes = ['light', 'dark', 'sepia'] as const;
    const currentIndex = themes.indexOf(currentThemeName);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const goToChapter = (index: number) => {
    console.log('📚 goToChapter: Moving to chapter', index, ':', chapters[index]?.title);
    setCurrentChapterIndex(index);
    setShowChapterSidebar(false);
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  };

  const goToNextChapter = () => {
    console.log('📚 goToNextChapter: Current chapter index:', currentChapterIndex, 'Total chapters:', chapters.length);
    if (currentChapterIndex < chapters.length - 1) {
      const nextIndex = currentChapterIndex + 1;
      console.log('📚 goToNextChapter: Moving to chapter', nextIndex, ':', chapters[nextIndex]?.title);
      setCurrentChapterIndex(nextIndex);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    } else {
      console.log('📚 goToNextChapter: Already at last chapter');
    }
  };

  const goToPreviousChapter = () => {
    console.log('📚 goToPreviousChapter: Current chapter index:', currentChapterIndex);
    if (currentChapterIndex > 0) {
      const prevIndex = currentChapterIndex - 1;
      console.log('📚 goToPreviousChapter: Moving to chapter', prevIndex, ':', chapters[prevIndex]?.title);
      setCurrentChapterIndex(prevIndex);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    } else {
      console.log('📚 goToPreviousChapter: Already at first chapter');
    }
  };


  const styles = createStyles(theme);

  // Clean content rendering without useMemo blocking
  const renderContent = () => {
    console.log('📖 ReaderScreen: Rendering content:', {
      isEpub,
      chaptersLength: chapters.length,
      contentLength: content.length,
      currentChapterIndex,
      currentChapterTitle: chapters[currentChapterIndex]?.title,
      isChunkingLargeDocument,
    });
    
    if (content.length === 0) {
      return null;
    }
    
    // Show loading state while chunking large documents
    if (isChunkingLargeDocument) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Processing large document...</Text>
        </View>
      );
    }
    
    // Chapter-based rendering (for EPUB or chunked documents)
    if (chapters.length > 0) {
      const currentChapter = chapters[currentChapterIndex];
      console.log('📖 ReaderScreen: Rendering chapter:', {
        chapterIndex: currentChapterIndex,
        chapterTitle: currentChapter?.title,
        chapterContentLength: currentChapter?.content?.length,
      });
      
      if (currentChapter) {
        return (
          <ModernChapterRenderer
            chapter={currentChapter}
            onWordTap={handleWordTap}
            textStyles={textStyles}
            theme={theme}
            isHighlighted={isWordHighlighted}
          />
        );
      } else {
        console.warn('📖 ReaderScreen: Current chapter is null/undefined');
        return null;
      }
    }
    
    // Traditional text rendering for smaller documents
    console.log('📖 ReaderScreen: Rendering traditional text');
    return (
      <ScrollView 
        ref={scrollViewRef}
        style={styles.contentScroll} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.simpleTextContainer}>
          <InteractiveText
            text={content}
            onWordTap={handleWordTap}
            textStyles={textStyles}
            isHighlighted={isWordHighlighted}
          />
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with controls */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack()}>
          <Text style={[styles.backButton, { color: theme.colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.headerText }]} numberOfLines={1}>
          {bookTitle}
        </Text>
        <View style={styles.headerRight}>
          {/* Chapter list button for books with chapters */}
          {isEpub && chapters.length > 0 && !isLoading && !error && (
            <TouchableOpacity 
              style={styles.chapterListButton}
              onPress={() => setShowChapterSidebar(true)}
            >
              <Text style={styles.chapterListButtonText}>📋</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={cycleTheme}>
            <Text style={styles.themeButton}>
              {currentThemeName === 'light' ? '☀️' : currentThemeName === 'dark' ? '🌙' : '📜'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Reading content */}
      <View style={styles.content}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Error Loading Book</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadBookContent}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3498db" />
            <Text style={styles.loadingText}>Loading book content...</Text>
          </View>
        ) : (
          <>
            {renderContent()}
            
          </>
        )}
      </View>

      {/* Bottom controls with integrated progress */}
      {!isLoading && !error && (
        <View style={styles.readerFooter}>
          {/* Progress indicator - moved to bottom */}
          <View style={styles.footerProgress}>
            {chapters.length > 0 ? (
              <>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${((currentChapterIndex + 1) / chapters.length) * 100}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>
                  Chapter {currentChapterIndex + 1} of {chapters.length}
                </Text>
              </>
            ) : (
              <>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: '0%' }]} />
                </View>
                <Text style={styles.progressText}>Reading...</Text>
              </>
            )}
          </View>

          {/* Reading controls */}
          <View style={styles.controls}>
            {/* Font Size Decrease */}
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={decreaseFontSize}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.controlText}>A-</Text>
            </TouchableOpacity>

            {/* Font Size Display */}
            <View style={styles.fontSizeDisplay}>
              <Text style={styles.fontSizeText}>
                {Math.round(fontSettings.fontSize)}
              </Text>
            </View>

            {/* Font Size Increase */}
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={increaseFontSize}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.controlText}>A+</Text>
            </TouchableOpacity>

            {/* TTS Toggle */}
            <TouchableOpacity 
              style={[styles.controlButton, isTTSEnabled && styles.controlButtonActive]}
              onPress={toggleTTS}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.controlText}>
                {isTTSEnabled ? '🔊' : '🔇'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <BilingualTranslationPopup
        visible={showPopup}
        word={selectedWord}
        position={popupPosition}
        context={undefined} // Could be enhanced to pass sentence context
        sourceLanguage={undefined} // Will be auto-detected
        onClose={handleClosePopup}
        onSaveWord={(word, definition) => {
          // Convert BilingualWordDefinition to WordDefinition format for compatibility
          const compatDefinition: WordDefinition = {
            word: definition.word,
            pronunciation: definition.pronunciation?.ipa,
            definitions: definition.definitions.map(def => ({
              partOfSpeech: def.partOfSpeech,
              meaning: def.definition,
              example: def.example
            })),
            frequency: definition.frequency
          };
          handleSaveWord(word, compatDefinition);
        }}
        onPlayAudio={(word, language) => {
          // Handle audio playback if needed
          console.log(`🔊 Play audio: ${word} (${language})`);
        }}
      />

      {/* New SQLite-powered WordPopup */}
      <WordPopup
        word={currentLookupWord}
        visible={showWordPopup}
        onClose={handleCloseWordPopup}
        position={wordPopupPosition}
        userProfile={userLanguageProfile || {
          nativeLanguage: 'es', // Default to Spanish since user said they set it to Español
          targetLanguages: ['en'],
        }}
        onSaveWord={handleSaveWord}
        onNavigateToLanguagePacks={() => navigate('LanguagePacksScreen')}
      />

      {showSuccessMessage && (
        <View style={styles.successMessage}>
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}

      {/* Chapter Sidebar Modal */}
      <Modal
        visible={showChapterSidebar}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowChapterSidebar(false)}
      >
        <SafeAreaView style={styles.sidebarContainer}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>Chapters</Text>
            <TouchableOpacity 
              style={styles.sidebarCloseButton}
              onPress={() => setShowChapterSidebar(false)}
            >
              <Text style={styles.sidebarCloseButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={chapters}
            keyExtractor={(item, index) => `chapter-${index}`}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  styles.chapterItem,
                  index === currentChapterIndex && styles.chapterItemActive
                ]}
                onPress={() => goToChapter(index)}
              >
                <View style={styles.chapterItemContent}>
                  <Text style={styles.chapterNumber}>
                    {index + 1}
                  </Text>
                  <Text 
                    style={[
                      styles.chapterItemTitle,
                      index === currentChapterIndex && styles.chapterItemTitleActive
                    ]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                </View>
                {index === currentChapterIndex && (
                  <View style={styles.currentChapterIndicator} />
                )}
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.chapterList}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// Memoize ReaderScreen to prevent re-renders on font changes
export default React.memo(ReaderScreen);

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.border + '40',
    backgroundColor: theme.colors.header + 'F8',
    backdropFilter: 'blur(10px)',
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    opacity: 0.8,
  },
  wordTappingStatus: {
    fontSize: 12,
    fontWeight: '400',
    fontStyle: 'italic',
    opacity: 0.7,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chapterListButton: {
    padding: 8,
    marginRight: 8,
  },
  chapterListButtonText: {
    fontSize: 18,
  },
  themeButton: {
    fontSize: 20,
    padding: 8,
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
    color: theme.colors.textSecondary,
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
    color: theme.colors.error,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 20,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  textContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    lineHeight: 24,
  },
  simpleTextContainer: {
    maxWidth: 680,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 60,
  },
  simpleText: {
    color: theme.colors.text,
    lineHeight: 28,
    textAlign: 'left',
  },
  wordContainer: {
    marginVertical: 2,
  },
  wordContainerHighlighted: {
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  word: {
    color: theme.colors.text,
  },
  wordHighlighted: {
    color: theme.colors.background,
    fontWeight: 'bold',
  },
  readerFooter: {
    backgroundColor: theme.colors.surface + 'F8',
    borderTopWidth: 0.5,
    borderTopColor: theme.colors.border + '40',
    backdropFilter: 'blur(10px)',
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  footerProgress: {
    alignItems: 'center',
    marginBottom: 16,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.background,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  controlButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  fontSizeDisplay: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: theme.colors.background,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  fontSizeText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  controlText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  speedText: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontWeight: 'bold',
  },
  successMessage: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: theme.colors.success,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  successText: {
    color: theme.colors.background,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 2,
    backgroundColor: theme.colors.border + '40',
    borderRadius: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 1,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    opacity: 0.8,
  },
  // Sidebar styles
  sidebarContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  sidebarCloseButton: {
    padding: 8,
  },
  sidebarCloseButtonText: {
    fontSize: 18,
    color: theme.colors.textSecondary,
  },
  chapterList: {
    padding: 20,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chapterItemActive: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary,
  },
  chapterItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chapterNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    width: 32,
    textAlign: 'center',
    marginRight: 16,
  },
  chapterItemTitle: {
    fontSize: 16,
    color: theme.colors.text,
    flex: 1,
    lineHeight: 22,
  },
  chapterItemTitleActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  currentChapterIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginLeft: 12,
  },
});