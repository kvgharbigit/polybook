import { DatabaseService } from '../../services/database';
import { Book, VocabularyCard, Position } from '@polybook/shared';

// Mock Platform
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn(obj => obj.ios || obj.default),
}));

describe('DatabaseService', () => {
  let dbService: DatabaseService;
  let mockDatabase: any;

  beforeEach(() => {
    // Mock database with common methods
    mockDatabase = {
      transaction: jest.fn(),
      exec: jest.fn(),
      close: jest.fn(),
    };

    // Mock openDatabase
    jest.doMock('expo-sqlite', () => ({
      openDatabase: jest.fn(() => mockDatabase),
    }));

    dbService = new DatabaseService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize database with correct schema', async () => {
      const mockTransaction = jest.fn((callback) => {
        callback({
          executeSql: jest.fn((sql, params, success) => {
            if (success) success();
          })
        });
      });
      
      mockDatabase.transaction = mockTransaction;

      await dbService.initialize();

      expect(mockTransaction).toHaveBeenCalled();
      
      // Check if table creation SQL was executed
      const calls = mockTransaction.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });

    it('should handle initialization errors gracefully', async () => {
      const mockTransaction = jest.fn((callback) => {
        callback({
          executeSql: jest.fn((sql, params, success, error) => {
            if (error) error(null, new Error('Database error'));
          })
        });
      });
      
      mockDatabase.transaction = mockTransaction;

      await expect(dbService.initialize()).rejects.toThrow('Database error');
    });
  });

  describe('book operations', () => {
    const mockBook: Omit<Book, 'id'> = {
      title: 'Test Book',
      author: 'Test Author',
      language: 'en',
      targetLanguage: 'es',
      format: 'txt',
      filePath: '/path/to/book.txt',
      addedAt: new Date(),
      lastOpenedAt: new Date(),
    };

    it('should add a book successfully', async () => {
      const mockExecuteSql = jest.fn((sql, params, success) => {
        if (success) success({ insertId: 1 });
      });

      const mockTransaction = jest.fn((callback) => {
        callback({ executeSql: mockExecuteSql });
      });

      mockDatabase.transaction = mockTransaction;

      const bookId = await dbService.addBook(mockBook);

      expect(bookId).toBe('1');
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockExecuteSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO books'),
        expect.arrayContaining([
          mockBook.title,
          mockBook.author,
          mockBook.language,
          mockBook.targetLanguage,
          mockBook.format,
          mockBook.filePath
        ]),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should retrieve books successfully', async () => {
      const mockRows = [
        {
          id: '1',
          title: 'Book 1',
          author: 'Author 1',
          language: 'en',
          targetLanguage: 'es',
          format: 'txt',
          filePath: '/path/book1.txt',
          addedAt: '2023-01-01T00:00:00.000Z',
          lastOpenedAt: '2023-01-01T00:00:00.000Z'
        },
        {
          id: '2',
          title: 'Book 2',
          author: 'Author 2',
          language: 'en',
          targetLanguage: 'fr',
          format: 'epub',
          filePath: '/path/book2.epub',
          addedAt: '2023-01-02T00:00:00.000Z',
          lastOpenedAt: '2023-01-02T00:00:00.000Z'
        }
      ];

      const mockExecuteSql = jest.fn((sql, params, success) => {
        if (success) success({ rows: { _array: mockRows } });
      });

      const mockTransaction = jest.fn((callback) => {
        callback({ executeSql: mockExecuteSql });
      });

      mockDatabase.transaction = mockTransaction;

      const books = await dbService.getBooks();

      expect(books).toHaveLength(2);
      expect(books[0].title).toBe('Book 1');
      expect(books[1].title).toBe('Book 2');
      expect(books[0].addedAt).toBeInstanceOf(Date);
    });

    it('should get a specific book by ID', async () => {
      const mockRow = {
        id: '1',
        title: 'Specific Book',
        author: 'Specific Author',
        language: 'en',
        targetLanguage: 'es',
        format: 'txt',
        filePath: '/path/specific.txt',
        addedAt: '2023-01-01T00:00:00.000Z',
        lastOpenedAt: '2023-01-01T00:00:00.000Z'
      };

      const mockExecuteSql = jest.fn((sql, params, success) => {
        if (success) success({ rows: { _array: [mockRow] } });
      });

      const mockTransaction = jest.fn((callback) => {
        callback({ executeSql: mockExecuteSql });
      });

      mockDatabase.transaction = mockTransaction;

      const book = await dbService.getBook('1');

      expect(book).toBeDefined();
      expect(book!.title).toBe('Specific Book');
      expect(book!.id).toBe('1');
    });

    it('should delete a book successfully', async () => {
      const mockExecuteSql = jest.fn((sql, params, success) => {
        if (success) success();
      });

      const mockTransaction = jest.fn((callback) => {
        callback({ executeSql: mockExecuteSql });
      });

      mockDatabase.transaction = mockTransaction;

      await dbService.deleteBook('1');

      expect(mockTransaction).toHaveBeenCalled();
      expect(mockExecuteSql).toHaveBeenCalledWith(
        'DELETE FROM books WHERE id = ?',
        ['1'],
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should update book last opened timestamp', async () => {
      const mockExecuteSql = jest.fn((sql, params, success) => {
        if (success) success();
      });

      const mockTransaction = jest.fn((callback) => {
        callback({ executeSql: mockExecuteSql });
      });

      mockDatabase.transaction = mockTransaction;

      await dbService.updateBookLastOpened('1');

      expect(mockExecuteSql).toHaveBeenCalledWith(
        'UPDATE books SET lastOpenedAt = ? WHERE id = ?',
        expect.any(Array),
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe('vocabulary operations', () => {
    const mockVocabCard: Omit<VocabularyCard, 'id'> = {
      bookId: '1',
      word: 'hello',
      definition: 'A greeting',
      context: 'Hello, how are you?',
      translation: 'hola',
      addedAt: new Date(),
    };

    it('should add vocabulary card successfully', async () => {
      const mockExecuteSql = jest.fn((sql, params, success) => {
        if (success) success({ insertId: 1 });
      });

      const mockTransaction = jest.fn((callback) => {
        callback({ executeSql: mockExecuteSql });
      });

      mockDatabase.transaction = mockTransaction;

      const cardId = await dbService.addVocabularyCard(mockVocabCard);

      expect(cardId).toBe('1');
      expect(mockExecuteSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO vocabulary_cards'),
        expect.arrayContaining([
          mockVocabCard.bookId,
          mockVocabCard.word,
          mockVocabCard.definition,
          mockVocabCard.context,
          mockVocabCard.translation
        ]),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should retrieve vocabulary cards for a book', async () => {
      const mockRows = [
        {
          id: '1',
          bookId: '1',
          word: 'hello',
          definition: 'A greeting',
          context: 'Hello there!',
          translation: 'hola',
          addedAt: '2023-01-01T00:00:00.000Z'
        }
      ];

      const mockExecuteSql = jest.fn((sql, params, success) => {
        if (success) success({ rows: { _array: mockRows } });
      });

      const mockTransaction = jest.fn((callback) => {
        callback({ executeSql: mockExecuteSql });
      });

      mockDatabase.transaction = mockTransaction;

      const cards = await dbService.getVocabularyCards('1');

      expect(cards).toHaveLength(1);
      expect(cards[0].word).toBe('hello');
      expect(cards[0].bookId).toBe('1');
    });

    it('should retrieve all vocabulary cards when no bookId provided', async () => {
      const mockRows = [
        {
          id: '1',
          bookId: '1',
          word: 'hello',
          definition: 'A greeting',
          context: 'Hello there!',
          translation: 'hola',
          addedAt: '2023-01-01T00:00:00.000Z'
        },
        {
          id: '2',
          bookId: '2',
          word: 'goodbye',
          definition: 'A farewell',
          context: 'Goodbye friend!',
          translation: 'adiós',
          addedAt: '2023-01-02T00:00:00.000Z'
        }
      ];

      const mockExecuteSql = jest.fn((sql, params, success) => {
        if (success) success({ rows: { _array: mockRows } });
      });

      const mockTransaction = jest.fn((callback) => {
        callback({ executeSql: mockExecuteSql });
      });

      mockDatabase.transaction = mockTransaction;

      const cards = await dbService.getVocabularyCards();

      expect(cards).toHaveLength(2);
      expect(cards[0].word).toBe('hello');
      expect(cards[1].word).toBe('goodbye');
    });
  });

  describe('position operations', () => {
    const mockPosition: Position = {
      bookId: '1',
      chapterIndex: 0,
      scrollPosition: 100,
      lastReadAt: new Date(),
    };

    it('should save reading position successfully', async () => {
      const mockExecuteSql = jest.fn((sql, params, success) => {
        if (success) success();
      });

      const mockTransaction = jest.fn((callback) => {
        callback({ executeSql: mockExecuteSql });
      });

      mockDatabase.transaction = mockTransaction;

      await dbService.savePosition(mockPosition);

      expect(mockExecuteSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO positions'),
        expect.arrayContaining([
          mockPosition.bookId,
          mockPosition.chapterIndex,
          mockPosition.scrollPosition
        ]),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should retrieve reading position successfully', async () => {
      const mockRow = {
        bookId: '1',
        chapterIndex: 0,
        scrollPosition: 100,
        lastReadAt: '2023-01-01T00:00:00.000Z'
      };

      const mockExecuteSql = jest.fn((sql, params, success) => {
        if (success) success({ rows: { _array: [mockRow] } });
      });

      const mockTransaction = jest.fn((callback) => {
        callback({ executeSql: mockExecuteSql });
      });

      mockDatabase.transaction = mockTransaction;

      const position = await dbService.getPosition('1');

      expect(position).toBeDefined();
      expect(position!.bookId).toBe('1');
      expect(position!.chapterIndex).toBe(0);
      expect(position!.scrollPosition).toBe(100);
    });

    it('should return null when position not found', async () => {
      const mockExecuteSql = jest.fn((sql, params, success) => {
        if (success) success({ rows: { _array: [] } });
      });

      const mockTransaction = jest.fn((callback) => {
        callback({ executeSql: mockExecuteSql });
      });

      mockDatabase.transaction = mockTransaction;

      const position = await dbService.getPosition('999');

      expect(position).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle SQL execution errors', async () => {
      const mockExecuteSql = jest.fn((sql, params, success, error) => {
        if (error) error(null, new Error('SQL error'));
      });

      const mockTransaction = jest.fn((callback) => {
        callback({ executeSql: mockExecuteSql });
      });

      mockDatabase.transaction = mockTransaction;

      await expect(dbService.getBooks()).rejects.toThrow('SQL error');
    });

    it('should handle transaction errors', async () => {
      const mockTransaction = jest.fn((callback, error) => {
        if (error) error(new Error('Transaction error'));
      });

      mockDatabase.transaction = mockTransaction;

      await expect(dbService.getBooks()).rejects.toThrow('Transaction error');
    });
  });

  describe('data validation', () => {
    it('should handle invalid book data', async () => {
      const invalidBook = {
        title: '', // Invalid empty title
        author: 'Author',
        language: 'en',
        targetLanguage: 'es',
        format: 'txt',
        filePath: '/path/to/book.txt',
        addedAt: new Date(),
        lastOpenedAt: new Date(),
      } as Omit<Book, 'id'>;

      const mockExecuteSql = jest.fn((sql, params, success, error) => {
        if (error) error(null, new Error('Validation error'));
      });

      const mockTransaction = jest.fn((callback) => {
        callback({ executeSql: mockExecuteSql });
      });

      mockDatabase.transaction = mockTransaction;

      await expect(dbService.addBook(invalidBook)).rejects.toThrow();
    });
  });
});