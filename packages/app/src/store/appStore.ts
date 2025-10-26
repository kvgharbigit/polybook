import { create } from 'zustand';
import { Book, VocabularyCard, Position, UserSettings, ReadingMode } from '@polybook/shared';
import { db } from '../services/database';

interface AppState {
  // Library state
  books: Book[];
  currentBook: Book | null;
  isLoading: boolean;
  
  // Reading state
  currentPosition: Position | null;
  readingMode: ReadingMode;
  
  // Vocabulary state
  vocabularyCards: VocabularyCard[];
  
  // App settings
  userSettings: UserSettings;
  
  // UI state
  showTranslationPopup: boolean;
  selectedWord: string | null;
  selectedSentence: string | null;
}

interface AppActions {
  // Library actions
  loadBooks: () => Promise<void>;
  addBook: (book: Omit<Book, 'id'>) => Promise<string>;
  deleteBook: (id: string) => Promise<void>;
  setCurrentBook: (book: Book | null) => void;
  
  // Reading actions
  updatePosition: (position: Position) => Promise<void>;
  setReadingMode: (mode: ReadingMode) => void;
  
  // Vocabulary actions
  loadVocabularyCards: (bookId?: string) => Promise<void>;
  addVocabularyCard: (card: Omit<VocabularyCard, 'id'>) => Promise<string>;
  
  // Translation actions
  setSelectedWord: (word: string | null) => void;
  setSelectedSentence: (sentence: string | null) => void;
  showTranslation: (show: boolean) => void;
  
  // Settings actions
  updateSettings: (settings: Partial<UserSettings>) => void;
  
  // Initialization
  initialize: () => Promise<void>;
}

type AppStore = AppState & AppActions;

const defaultSettings: UserSettings = {
  theme: 'light',
  fontSize: 16,
  lineHeight: 1.5,
  translationSpeed: 'quality',
  ttsRate: 1.0,
};

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  books: [],
  currentBook: null,
  isLoading: false,
  currentPosition: null,
  readingMode: 'normal',
  vocabularyCards: [],
  userSettings: defaultSettings,
  showTranslationPopup: false,
  selectedWord: null,
  selectedSentence: null,

  // Library actions
  loadBooks: async () => {
    set({ isLoading: true });
    try {
      const books = await db.getBooks();
      set({ books, isLoading: false });
    } catch (error) {
      console.error('Failed to load books:', error);
      set({ isLoading: false });
    }
  },

  addBook: async (bookData) => {
    try {
      const id = await db.addBook(bookData);
      const book = await db.getBook(id);
      if (book) {
        set(state => ({
          books: [book, ...state.books]
        }));
      }
      return id;
    } catch (error) {
      console.error('Failed to add book:', error);
      throw error;
    }
  },

  deleteBook: async (id) => {
    try {
      await db.deleteBook(id);
      set(state => ({
        books: state.books.filter(book => book.id !== id),
        currentBook: state.currentBook?.id === id ? null : state.currentBook
      }));
    } catch (error) {
      console.error('Failed to delete book:', error);
      throw error;
    }
  },

  setCurrentBook: (book) => {
    set({ currentBook: book });
    if (book) {
      // Update last opened timestamp
      db.updateBookLastOpened(book.id).catch(console.error);
    }
  },

  // Reading actions
  updatePosition: async (position) => {
    try {
      await db.savePosition(position);
      set({ currentPosition: position });
    } catch (error) {
      console.error('Failed to save position:', error);
    }
  },

  setReadingMode: (mode) => {
    set({ readingMode: mode });
  },

  // Vocabulary actions
  loadVocabularyCards: async (bookId) => {
    try {
      const cards = await db.getVocabularyCards(bookId);
      set({ vocabularyCards: cards });
    } catch (error) {
      console.error('Failed to load vocabulary cards:', error);
    }
  },

  addVocabularyCard: async (cardData) => {
    try {
      const id = await db.addVocabularyCard(cardData);
      // Reload vocabulary cards to get the updated list
      const { loadVocabularyCards } = get();
      await loadVocabularyCards(cardData.bookId);
      return id;
    } catch (error) {
      console.error('Failed to add vocabulary card:', error);
      throw error;
    }
  },

  // Translation actions
  setSelectedWord: (word) => {
    set({ selectedWord: word });
  },

  setSelectedSentence: (sentence) => {
    set({ selectedSentence: sentence });
  },

  showTranslation: (show) => {
    set({ showTranslationPopup: show });
  },

  // Settings actions
  updateSettings: (newSettings) => {
    set(state => ({
      userSettings: { ...state.userSettings, ...newSettings }
    }));
  },

  // Initialization
  initialize: async () => {
    try {
      await db.initialize();
      const { loadBooks } = get();
      await loadBooks();
      console.log('App store initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app store:', error);
    }
  },
}));