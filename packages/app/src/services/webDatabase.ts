import * as Crypto from 'expo-crypto';
import { Book, VocabularyCard, Position, TranslationCache, BookContent } from '@polybook/shared';

const STORAGE_KEYS = {
  BOOKS: 'polybook_books',
  POSITIONS: 'polybook_positions',
  VOCABULARY: 'polybook_vocabulary',
  TRANSLATIONS: 'polybook_translations',
  BOOK_CONTENT: 'polybook_book_content',
};

class WebDatabaseService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      console.log('Initializing web database (localStorage)...');
      
      // Initialize storage if needed
      if (!localStorage.getItem(STORAGE_KEYS.BOOKS)) {
        localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.POSITIONS)) {
        localStorage.setItem(STORAGE_KEYS.POSITIONS, JSON.stringify({}));
      }
      if (!localStorage.getItem(STORAGE_KEYS.VOCABULARY)) {
        localStorage.setItem(STORAGE_KEYS.VOCABULARY, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.TRANSLATIONS)) {
        localStorage.setItem(STORAGE_KEYS.TRANSLATIONS, JSON.stringify({}));
      }
      
      this.isInitialized = true;
      console.log('Web database initialized successfully');
    } catch (error) {
      console.error('Web database initialization failed:', error);
      throw error;
    }
  }

  // Book operations
  async addBook(book: Omit<Book, 'id'>): Promise<string> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    const id = `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newBook: Book = {
      ...book,
      id,
      addedAt: new Date(book.addedAt),
      lastOpenedAt: new Date(book.lastOpenedAt),
    };

    const books = this.getStoredBooks();
    books.push(newBook);
    localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books));

    return id;
  }

  async getBooks(): Promise<Book[]> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    const books = this.getStoredBooks();
    const positions = this.getStoredPositions();

    return books.map(book => ({
      ...book,
      addedAt: new Date(book.addedAt),
      lastOpenedAt: new Date(book.lastOpenedAt),
      lastPosition: positions[book.id] ? {
        ...positions[book.id],
        updatedAt: new Date(positions[book.id].updatedAt),
      } : undefined,
    })).sort((a, b) => {
      // Sort by last position update, then by added date
      const aTime = a.lastPosition?.updatedAt?.getTime() || a.addedAt.getTime();
      const bTime = b.lastPosition?.updatedAt?.getTime() || b.addedAt.getTime();
      return bTime - aTime;
    });
  }

  async getBook(id: string): Promise<Book | null> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    const books = this.getStoredBooks();
    const book = books.find(b => b.id === id);
    
    if (!book) return null;

    return {
      ...book,
      addedAt: new Date(book.addedAt),
      lastOpenedAt: new Date(book.lastOpenedAt),
    };
  }

  async updateBookLastOpened(id: string): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    const books = this.getStoredBooks();
    const bookIndex = books.findIndex(b => b.id === id);
    
    if (bookIndex !== -1) {
      books[bookIndex].lastOpenedAt = new Date();
      localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books));
    }
  }

  async deleteBook(id: string): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    const books = this.getStoredBooks();
    const filteredBooks = books.filter(b => b.id !== id);
    localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(filteredBooks));

    // Also remove related data
    const positions = this.getStoredPositions();
    delete positions[id];
    localStorage.setItem(STORAGE_KEYS.POSITIONS, JSON.stringify(positions));

    const vocabulary = this.getStoredVocabulary();
    const filteredVocabulary = vocabulary.filter(v => v.bookId !== id);
    localStorage.setItem(STORAGE_KEYS.VOCABULARY, JSON.stringify(filteredVocabulary));
  }

  // Position operations
  async savePosition(position: Position): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    const positions = this.getStoredPositions();
    positions[position.bookId] = {
      ...position,
      updatedAt: new Date(),
    };
    localStorage.setItem(STORAGE_KEYS.POSITIONS, JSON.stringify(positions));
  }

  async getPosition(bookId: string): Promise<Position | null> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    const positions = this.getStoredPositions();
    const position = positions[bookId];
    
    if (!position) return null;

    return {
      ...position,
      updatedAt: new Date(position.updatedAt),
    };
  }

  // Vocabulary operations
  async addVocabularyCard(card: Omit<VocabularyCard, 'id'>): Promise<string> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    const id = `vocab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newCard: VocabularyCard = {
      ...card,
      id,
      createdAt: new Date(),
      lastReviewedAt: card.lastReviewedAt ? new Date(card.lastReviewedAt) : undefined,
    };

    const vocabulary = this.getStoredVocabulary();
    vocabulary.push(newCard);
    localStorage.setItem(STORAGE_KEYS.VOCABULARY, JSON.stringify(vocabulary));

    return id;
  }

  async getVocabularyCards(bookId?: string): Promise<VocabularyCard[]> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    const vocabulary = this.getStoredVocabulary();
    let filtered = vocabulary;

    if (bookId) {
      filtered = vocabulary.filter(v => v.bookId === bookId);
    }

    return filtered.map(card => ({
      ...card,
      createdAt: new Date(card.createdAt),
      lastReviewedAt: card.lastReviewedAt ? new Date(card.lastReviewedAt) : undefined,
    })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteVocabularyCard(id: string): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    const vocabulary = this.getStoredVocabulary();
    const filtered = vocabulary.filter(card => card.id !== id);
    localStorage.setItem(STORAGE_KEYS.VOCABULARY, JSON.stringify(filtered));
  }

  // Translation cache operations
  async cacheTranslation(cache: Omit<TranslationCache, 'id'>): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    const translations = this.getStoredTranslations();
    translations[cache.sourceHash] = {
      ...cache,
      id: cache.sourceHash,
      createdAt: new Date(),
    };
    localStorage.setItem(STORAGE_KEYS.TRANSLATIONS, JSON.stringify(translations));
  }

  async getCachedTranslation(sourceHash: string): Promise<TranslationCache | null> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    const translations = this.getStoredTranslations();
    const translation = translations[sourceHash];
    
    if (!translation) return null;

    return {
      ...translation,
      createdAt: new Date(translation.createdAt),
    };
  }

  // Utility operations
  async clearOldCache(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    const translations = this.getStoredTranslations();
    const cutoff = Date.now() - maxAge;
    
    Object.keys(translations).forEach(key => {
      if (new Date(translations[key].createdAt).getTime() < cutoff) {
        delete translations[key];
      }
    });
    
    localStorage.setItem(STORAGE_KEYS.TRANSLATIONS, JSON.stringify(translations));
  }

  async getStats(): Promise<{books: number, vocabulary: number, translations: number}> {
    if (!this.isInitialized) throw new Error('Database not initialized');

    const books = this.getStoredBooks();
    const vocabulary = this.getStoredVocabulary();
    const translations = this.getStoredTranslations();

    return {
      books: books.length,
      vocabulary: vocabulary.length,
      translations: Object.keys(translations).length,
    };
  }

  // Helper methods
  private getStoredBooks(): Book[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKS) || '[]');
    } catch (error) {
      console.error('Error parsing stored books:', error);
      return [];
    }
  }

  private getStoredPositions(): Record<string, Position> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.POSITIONS) || '{}');
    } catch (error) {
      console.error('Error parsing stored positions:', error);
      return {};
    }
  }

  private getStoredVocabulary(): VocabularyCard[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.VOCABULARY) || '[]');
    } catch (error) {
      console.error('Error parsing stored vocabulary:', error);
      return [];
    }
  }

  private getStoredTranslations(): Record<string, TranslationCache> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSLATIONS) || '{}');
    } catch (error) {
      console.error('Error parsing stored translations:', error);
      return {};
    }
  }

  // Book content operations
  async saveBookContent(bookContent: Omit<BookContent, 'id'>): Promise<string> {
    const id = Crypto.randomUUID();
    const stored = this.getStoredBookContent();
    
    const content: BookContent = {
      id,
      ...bookContent
    };

    stored[bookContent.bookId] = content;
    localStorage.setItem(STORAGE_KEYS.BOOK_CONTENT, JSON.stringify(stored));
    
    return id;
  }

  async getBookContent(bookId: string): Promise<BookContent | null> {
    const stored = this.getStoredBookContent();
    const content = stored[bookId];
    
    if (!content) return null;

    // Convert date strings back to Date objects
    return {
      ...content,
      parsedAt: new Date(content.parsedAt)
    };
  }

  async deleteBookContent(bookId: string): Promise<void> {
    const stored = this.getStoredBookContent();
    delete stored[bookId];
    localStorage.setItem(STORAGE_KEYS.BOOK_CONTENT, JSON.stringify(stored));
  }

  private getStoredBookContent(): Record<string, BookContent> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOK_CONTENT) || '{}');
    } catch (error) {
      console.error('Error parsing stored book content:', error);
      return {};
    }
  }
}

export const webDb = new WebDatabaseService();
export default webDb;