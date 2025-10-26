import { Platform } from 'react-native';
import { Book, VocabularyCard, Position, TranslationCache } from '@polybook/shared';

// Conditional import for SQLite (only on native platforms)
let SQLite: any = null;
if (Platform.OS !== 'web') {
  try {
    SQLite = require('expo-sqlite');
  } catch (error) {
    console.warn('SQLite not available, using web fallback');
  }
}

const DATABASE_NAME = 'polybook.db';
const DATABASE_VERSION = 1;

class DatabaseService {
  private db: any = null;

  async initialize(): Promise<void> {
    try {
      console.log('Initializing database...');
      
      // Check if we're on web or SQLite is unavailable
      if (Platform.OS === 'web' || !SQLite) {
        console.warn('Running on web or SQLite unavailable - using localStorage fallback');
        return;
      }
      
      this.db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      console.log('Database opened successfully');
      
      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      console.error('Error details:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const createTablesSQL = `
      -- Books table
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        language TEXT NOT NULL,
        target_language TEXT NOT NULL,
        format TEXT NOT NULL,
        file_path TEXT NOT NULL,
        cover_path TEXT,
        file_size INTEGER,
        total_pages INTEGER,
        added_at INTEGER NOT NULL,
        last_opened_at INTEGER NOT NULL
      );

      -- Reading positions table
      CREATE TABLE IF NOT EXISTS positions (
        book_id TEXT PRIMARY KEY,
        spine_index INTEGER NOT NULL DEFAULT 0,
        cfi TEXT,
        page INTEGER,
        y_offset REAL NOT NULL DEFAULT 0,
        progress REAL NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );

      -- Vocabulary cards table
      CREATE TABLE IF NOT EXISTS vocabulary_cards (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        headword TEXT NOT NULL,
        lemma TEXT NOT NULL,
        source_language TEXT NOT NULL,
        target_language TEXT NOT NULL,
        source_context TEXT NOT NULL,
        translation TEXT NOT NULL,
        definition TEXT,
        examples TEXT, -- JSON array
        frequency INTEGER,
        srs_state TEXT NOT NULL DEFAULT 'new',
        created_at INTEGER NOT NULL,
        last_reviewed_at INTEGER,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );

      -- Translation cache table
      CREATE TABLE IF NOT EXISTS translation_cache (
        source_hash TEXT PRIMARY KEY,
        source_text TEXT NOT NULL,
        source_language TEXT NOT NULL,
        target_language TEXT NOT NULL,
        translation TEXT NOT NULL,
        model_version TEXT NOT NULL DEFAULT 'mock-v1',
        created_at INTEGER NOT NULL
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_books_language ON books(language, target_language);
      CREATE INDEX IF NOT EXISTS idx_positions_updated ON positions(updated_at);
      CREATE INDEX IF NOT EXISTS idx_vocabulary_book ON vocabulary_cards(book_id);
      CREATE INDEX IF NOT EXISTS idx_vocabulary_language ON vocabulary_cards(source_language, target_language);
      CREATE INDEX IF NOT EXISTS idx_cache_languages ON translation_cache(source_language, target_language);
    `;

    await this.db.execAsync(createTablesSQL);
  }

  // Book operations
  async addBook(book: Omit<Book, 'id'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const id = `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.db.runAsync(
      `INSERT INTO books (id, title, author, language, target_language, format, file_path, cover_path, file_size, total_pages, added_at, last_opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        book.title,
        book.author,
        book.language,
        book.targetLanguage,
        book.format,
        book.filePath,
        book.coverPath || null,
        0, // file_size - will be updated when we process the file
        0, // total_pages - will be updated when we process the file
        Date.now(),
        Date.now()
      ]
    );

    return id;
  }

  async getBooks(): Promise<Book[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getAllAsync(`
      SELECT b.*, p.progress, p.updated_at as last_read_at
      FROM books b
      LEFT JOIN positions p ON b.id = p.book_id
      ORDER BY p.updated_at DESC, b.added_at DESC
    `);

    return (result as any[]).map(row => ({
      id: row.id,
      title: row.title,
      author: row.author,
      language: row.language,
      targetLanguage: row.target_language,
      format: row.format as any,
      filePath: row.file_path,
      coverPath: row.cover_path,
      addedAt: new Date(row.added_at),
      lastOpenedAt: new Date(row.last_opened_at),
      lastPosition: row.progress ? {
        bookId: row.id,
        spineIndex: 0,
        yOffset: row.y_offset || 0,
        updatedAt: new Date(row.updated_at)
      } : undefined
    }));
  }

  async getBook(id: string): Promise<Book | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync(
      'SELECT * FROM books WHERE id = ?',
      [id]
    ) as any;

    if (!result) return null;

    return {
      id: result.id,
      title: result.title,
      author: result.author,
      language: result.language,
      targetLanguage: result.target_language,
      format: result.format,
      filePath: result.file_path,
      coverPath: result.cover_path,
      addedAt: new Date(result.added_at),
      lastOpenedAt: new Date(result.last_opened_at)
    };
  }

  async updateBookLastOpened(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'UPDATE books SET last_opened_at = ? WHERE id = ?',
      [Date.now(), id]
    );
  }

  async deleteBook(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync('DELETE FROM books WHERE id = ?', [id]);
  }

  // Position operations
  async savePosition(position: Position): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`
      INSERT OR REPLACE INTO positions (book_id, spine_index, cfi, page, y_offset, progress, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      position.bookId,
      position.spineIndex,
      position.cfi || null,
      position.page || null,
      position.yOffset,
      0, // progress - will calculate later based on position
      Date.now()
    ]);
  }

  async getPosition(bookId: string): Promise<Position | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync(
      'SELECT * FROM positions WHERE book_id = ?',
      [bookId]
    ) as any;

    if (!result) return null;

    return {
      bookId: result.book_id,
      spineIndex: result.spine_index,
      cfi: result.cfi,
      page: result.page,
      yOffset: result.y_offset,
      updatedAt: new Date(result.updated_at)
    };
  }

  // Vocabulary operations
  async addVocabularyCard(card: Omit<VocabularyCard, 'id'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const id = `vocab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.db.runAsync(`
      INSERT INTO vocabulary_cards (id, book_id, headword, lemma, source_language, target_language, source_context, translation, definition, examples, frequency, srs_state, created_at, last_reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      card.bookId,
      card.headword,
      card.lemma,
      card.sourceLanguage,
      card.targetLanguage,
      card.sourceContext,
      card.translation,
      card.definition || null,
      card.examples ? JSON.stringify(card.examples) : null,
      card.frequency || null,
      card.srsState,
      Date.now(),
      card.lastReviewedAt ? card.lastReviewedAt.getTime() : null
    ]);

    return id;
  }

  async getVocabularyCards(bookId?: string): Promise<VocabularyCard[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = bookId 
      ? 'SELECT * FROM vocabulary_cards WHERE book_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM vocabulary_cards ORDER BY created_at DESC';
    
    const params = bookId ? [bookId] : [];
    const result = await this.db.getAllAsync(query, params);

    return (result as any[]).map(row => ({
      id: row.id,
      bookId: row.book_id,
      headword: row.headword,
      lemma: row.lemma,
      sourceLanguage: row.source_language,
      targetLanguage: row.target_language,
      sourceContext: row.source_context,
      translation: row.translation,
      definition: row.definition,
      examples: row.examples ? JSON.parse(row.examples) : undefined,
      frequency: row.frequency,
      srsState: row.srs_state as any,
      createdAt: new Date(row.created_at),
      lastReviewedAt: row.last_reviewed_at ? new Date(row.last_reviewed_at) : undefined
    }));
  }

  // Translation cache operations
  async cacheTranslation(cache: Omit<TranslationCache, 'id'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`
      INSERT OR REPLACE INTO translation_cache (source_hash, source_text, source_language, target_language, translation, model_version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      cache.sourceHash,
      cache.sourceText,
      cache.sourceLanguage,
      cache.targetLanguage,
      cache.translation,
      cache.modelVersion,
      Date.now()
    ]);
  }

  async getCachedTranslation(sourceHash: string): Promise<TranslationCache | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync(
      'SELECT * FROM translation_cache WHERE source_hash = ?',
      [sourceHash]
    ) as any;

    if (!result) return null;

    return {
      id: result.source_hash,
      sourceText: result.source_text,
      sourceHash: result.source_hash,
      sourceLanguage: result.source_language,
      targetLanguage: result.target_language,
      translation: result.translation,
      modelVersion: result.model_version,
      createdAt: new Date(result.created_at)
    };
  }

  // Utility operations
  async clearOldCache(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoff = Date.now() - maxAge;
    await this.db.runAsync(
      'DELETE FROM translation_cache WHERE created_at < ?',
      [cutoff]
    );
  }

  async getStats(): Promise<{books: number, vocabulary: number, translations: number}> {
    if (!this.db) throw new Error('Database not initialized');

    const [books, vocabulary, translations] = await Promise.all([
      this.db.getFirstAsync('SELECT COUNT(*) as count FROM books') as Promise<{count: number}>,
      this.db.getFirstAsync('SELECT COUNT(*) as count FROM vocabulary_cards') as Promise<{count: number}>,
      this.db.getFirstAsync('SELECT COUNT(*) as count FROM translation_cache') as Promise<{count: number}>
    ]);

    return {
      books: books.count,
      vocabulary: vocabulary.count,
      translations: translations.count
    };
  }
}

// Export singleton instance
export const db = new DatabaseService();
export default db;