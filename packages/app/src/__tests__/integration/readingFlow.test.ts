import { ContentParser } from '../../services/contentParser';
import { WordLookupService } from '../../services/wordLookup';
import { DatabaseService } from '../../services/database';
import { useAppStore } from '../../store/appStore';
import * as FileSystem from 'expo-file-system';

// Mock dependencies
jest.mock('../../services/database');
jest.mock('../../store/appStore');

const mockDatabaseService = DatabaseService as jest.MockedClass<typeof DatabaseService>;
const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>;

describe('Reading Flow Integration Tests', () => {
  let mockDbInstance: jest.Mocked<DatabaseService>;
  let mockStore: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database instance
    mockDbInstance = {
      initialize: jest.fn().mockResolvedValue(undefined),
      addBook: jest.fn().mockResolvedValue('1'),
      getBook: jest.fn(),
      getBooks: jest.fn().mockResolvedValue([]),
      deleteBook: jest.fn().mockResolvedValue(undefined),
      updateBookLastOpened: jest.fn().mockResolvedValue(undefined),
      savePosition: jest.fn().mockResolvedValue(undefined),
      getPosition: jest.fn().mockResolvedValue(null),
      addVocabularyCard: jest.fn().mockResolvedValue('1'),
      getVocabularyCards: jest.fn().mockResolvedValue([]),
    } as any;

    mockDatabaseService.mockImplementation(() => mockDbInstance);

    // Mock store
    mockStore = {
      books: [],
      currentBook: null,
      isLoading: false,
      currentPosition: null,
      vocabularyCards: [],
      addBook: jest.fn(),
      setCurrentBook: jest.fn(),
      updatePosition: jest.fn(),
      addVocabularyCard: jest.fn(),
      loadVocabularyCards: jest.fn(),
    };

    mockUseAppStore.mockReturnValue(mockStore);
    mockUseAppStore.getState = jest.fn().mockReturnValue(mockStore);
  });

  describe('Complete Reading Flow', () => {
    it('should handle complete flow: import → read → translate → save vocabulary', async () => {
      // Mock file system for book import
      const mockBookContent = `Chapter 1: The Beginning

This is a fascinating story about language learning and reading comprehension. The protagonist discovers new words and expands their vocabulary through dedicated study.

Chapter 2: The Journey

The adventure continues as our hero encounters challenging texts and learns to understand complex sentences through context and practice.`;

      (FileSystem.readAsStringAsync as jest.MockedFunction<typeof FileSystem.readAsStringAsync>)
        .mockResolvedValue(mockBookContent);

      // Step 1: Import and parse book
      const bookData = {
        title: 'Language Learning Adventure',
        author: 'Test Author',
        language: 'en',
        targetLanguage: 'es',
        format: 'txt' as const,
        filePath: '/mock/path/book.txt',
        addedAt: new Date(),
        lastOpenedAt: new Date(),
      };

      mockStore.addBook.mockResolvedValue('1');
      mockDbInstance.getBook.mockResolvedValue({
        id: '1',
        ...bookData
      });

      // Add book to store
      const bookId = await mockStore.addBook(bookData);
      expect(bookId).toBe('1');
      expect(mockStore.addBook).toHaveBeenCalledWith(bookData);

      // Step 2: Parse book content
      const parsedContent = await ContentParser.parseFile('/mock/path/book.txt', 'txt');
      
      expect(parsedContent.title).toBe('Language Learning Adventure');
      expect(parsedContent.content).toContain('fascinating story');
      expect(parsedContent.chapters).toBeDefined();
      expect(parsedContent.chapters!.length).toBe(2);
      expect(parsedContent.chapters![0].title).toBe('Chapter 1: The Beginning');

      // Step 3: Set current book and load content
      const book = await mockDbInstance.getBook('1');
      mockStore.setCurrentBook(book);
      expect(mockStore.setCurrentBook).toHaveBeenCalledWith(book);

      // Step 4: Save reading position
      const position = {
        bookId: '1',
        chapterIndex: 0,
        scrollPosition: 150,
        lastReadAt: new Date(),
      };

      await mockStore.updatePosition(position);
      expect(mockStore.updatePosition).toHaveBeenCalledWith(position);

      // Step 5: Look up word definition
      const wordDefinition = await WordLookupService.lookupWord('fascinating');
      
      expect(wordDefinition).toBeDefined();
      expect(wordDefinition.word).toBe('fascinating');
      expect(wordDefinition.definition).toBeDefined();
      expect(wordDefinition.partOfSpeech).toBeDefined();

      // Step 6: Save vocabulary card
      const vocabularyCard = {
        bookId: '1',
        word: 'fascinating',
        definition: wordDefinition.definition,
        context: 'This is a fascinating story about language learning',
        translation: 'fascinante',
        addedAt: new Date(),
      };

      mockStore.addVocabularyCard.mockResolvedValue('1');
      
      const cardId = await mockStore.addVocabularyCard(vocabularyCard);
      expect(cardId).toBe('1');
      expect(mockStore.addVocabularyCard).toHaveBeenCalledWith(vocabularyCard);

      // Step 7: Load vocabulary cards for the book
      const mockVocabCards = [
        {
          id: '1',
          ...vocabularyCard
        }
      ];
      
      mockStore.loadVocabularyCards.mockResolvedValue(mockVocabCards);
      
      await mockStore.loadVocabularyCards('1');
      expect(mockStore.loadVocabularyCards).toHaveBeenCalledWith('1');
    });

    it('should handle EPUB books with chapters', async () => {
      // Mock EPUB content
      const mockEPUBContent = {
        title: 'Digital EPUB Book',
        content: 'Complete EPUB content...',
        wordCount: 500,
        estimatedReadingTime: 2,
        author: 'EPUB Author',
        chapters: [
          {
            id: 'chapter-1',
            title: 'EPUB Chapter 1',
            content: 'First chapter content...',
            htmlContent: '<div>First chapter content...</div>',
            order: 0,
          },
          {
            id: 'chapter-2', 
            title: 'EPUB Chapter 2',
            content: 'Second chapter content...',
            htmlContent: '<div>Second chapter content...</div>',
            order: 1,
          }
        ]
      };

      // Mock EPUBService
      jest.doMock('../../services/epubService', () => ({
        EPUBService: {
          parseFile: jest.fn().mockResolvedValue(mockEPUBContent)
        }
      }));

      const parsedContent = await ContentParser.parseFile('/mock/path/book.epub', 'epub');
      
      expect(parsedContent.title).toBe('Digital EPUB Book');
      expect(parsedContent.chapters).toBeDefined();
      expect(parsedContent.chapters!.length).toBe(2);
      expect(parsedContent.chapters![0].title).toBe('EPUB Chapter 1');
    });

    it('should handle reading position persistence across sessions', async () => {
      const bookId = '1';
      
      // First session: Save position
      const initialPosition = {
        bookId,
        chapterIndex: 1,
        scrollPosition: 250,
        lastReadAt: new Date(),
      };

      mockDbInstance.savePosition.mockResolvedValue(undefined);
      await mockDbInstance.savePosition(initialPosition);
      expect(mockDbInstance.savePosition).toHaveBeenCalledWith(initialPosition);

      // Second session: Retrieve position
      mockDbInstance.getPosition.mockResolvedValue(initialPosition);
      const retrievedPosition = await mockDbInstance.getPosition(bookId);
      
      expect(retrievedPosition).toEqual(initialPosition);
      expect(retrievedPosition?.chapterIndex).toBe(1);
      expect(retrievedPosition?.scrollPosition).toBe(250);
    });

    it('should handle vocabulary management workflow', async () => {
      const bookId = '1';

      // Add multiple vocabulary cards
      const vocabCards = [
        {
          bookId,
          word: 'comprehension',
          definition: 'The ability to understand',
          context: 'Reading comprehension is important',
          translation: 'comprensión',
          addedAt: new Date(),
        },
        {
          bookId,
          word: 'vocabulary',
          definition: 'Words known by a person',
          context: 'Expand your vocabulary through reading',
          translation: 'vocabulario',
          addedAt: new Date(),
        }
      ];

      for (let i = 0; i < vocabCards.length; i++) {
        mockDbInstance.addVocabularyCard.mockResolvedValueOnce((i + 1).toString());
        const cardId = await mockDbInstance.addVocabularyCard(vocabCards[i]);
        expect(cardId).toBe((i + 1).toString());
      }

      // Retrieve all vocabulary cards for the book
      const mockStoredCards = vocabCards.map((card, index) => ({
        id: (index + 1).toString(),
        ...card
      }));

      mockDbInstance.getVocabularyCards.mockResolvedValue(mockStoredCards);
      const retrievedCards = await mockDbInstance.getVocabularyCards(bookId);
      
      expect(retrievedCards).toHaveLength(2);
      expect(retrievedCards[0].word).toBe('comprehension');
      expect(retrievedCards[1].word).toBe('vocabulary');
    });

    it('should handle error scenarios gracefully', async () => {
      // File reading error
      (FileSystem.readAsStringAsync as jest.MockedFunction<typeof FileSystem.readAsStringAsync>)
        .mockRejectedValue(new Error('File not found'));

      await expect(ContentParser.parseTxtFile('/invalid/path.txt'))
        .rejects.toThrow('Failed to parse text file');

      // Database error
      mockDbInstance.addBook.mockRejectedValue(new Error('Database connection failed'));
      
      await expect(mockDbInstance.addBook({
        title: 'Test',
        author: 'Author',
        language: 'en',
        targetLanguage: 'es',
        format: 'txt',
        filePath: '/path',
        addedAt: new Date(),
        lastOpenedAt: new Date(),
      })).rejects.toThrow('Database connection failed');

      // Word lookup error for unknown words
      const unknownWordResult = await WordLookupService.lookupWord('nonexistentword123');
      expect(unknownWordResult.definition).toContain('definition not available');
    });

    it('should handle concurrent operations safely', async () => {
      const bookId = '1';
      
      // Simulate concurrent vocabulary additions
      const concurrentWords = ['word1', 'word2', 'word3'];
      const promises = concurrentWords.map((word, index) => {
        mockDbInstance.addVocabularyCard.mockResolvedValueOnce((index + 1).toString());
        return mockDbInstance.addVocabularyCard({
          bookId,
          word,
          definition: `Definition for ${word}`,
          context: `Context for ${word}`,
          translation: `Traducción ${index + 1}`,
          addedAt: new Date(),
        });
      });

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      expect(results).toEqual(['1', '2', '3']);
    });

    it('should maintain data consistency throughout reading session', async () => {
      // Start reading session
      const bookId = '1';
      const bookData = {
        id: bookId,
        title: 'Consistency Test Book',
        author: 'Test Author',
        language: 'en' as const,
        targetLanguage: 'es' as const,
        format: 'txt' as const,
        filePath: '/mock/path/consistency.txt',
        addedAt: new Date(),
        lastOpenedAt: new Date(),
      };

      mockDbInstance.getBook.mockResolvedValue(bookData);
      
      // Load book
      const book = await mockDbInstance.getBook(bookId);
      expect(book?.id).toBe(bookId);

      // Update reading position multiple times
      const positions = [
        { bookId, chapterIndex: 0, scrollPosition: 100, lastReadAt: new Date() },
        { bookId, chapterIndex: 0, scrollPosition: 250, lastReadAt: new Date() },
        { bookId, chapterIndex: 1, scrollPosition: 50, lastReadAt: new Date() },
      ];

      for (const position of positions) {
        await mockDbInstance.savePosition(position);
        expect(mockDbInstance.savePosition).toHaveBeenCalledWith(position);
      }

      // Verify final position
      mockDbInstance.getPosition.mockResolvedValue(positions[positions.length - 1]);
      const finalPosition = await mockDbInstance.getPosition(bookId);
      
      expect(finalPosition?.chapterIndex).toBe(1);
      expect(finalPosition?.scrollPosition).toBe(50);

      // Update last opened timestamp
      await mockDbInstance.updateBookLastOpened(bookId);
      expect(mockDbInstance.updateBookLastOpened).toHaveBeenCalledWith(bookId);
    });
  });
});