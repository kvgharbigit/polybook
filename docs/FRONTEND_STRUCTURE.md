# PolyBook Frontend Structure & Navigation Flow

## Overview
This document maintains the high-level frontend architecture, page structure, and navigation flow for the PolyBook app. This serves as a reference for development and should be updated as the app evolves.

## Tech Stack
- **Framework**: React Native + Expo (Managed Workflow)
- **Navigation**: Custom Navigation Solution (no react-native-screens)
- **State Management**: Zustand with SQLite/localStorage persistence
- **Database**: Cross-platform (SQLite native, localStorage web)
- **Styling**: React Native StyleSheet + react-native-safe-area-context
- **Language**: TypeScript

## App Structure

```
packages/app/
├── src/
│   ├── screens/           # Main app screens
│   │   ├── HomeScreen.tsx         # Landing/welcome page with file import
│   │   ├── LibraryScreen.tsx      # Book library with real database data
│   │   └── ReaderScreen.tsx       # Book reading with word interaction
│   ├── navigation/        # Custom navigation system
│   │   └── SimpleNavigator.tsx    # Platform-agnostic navigation
│   ├── services/          # Database and business logic
│   │   ├── database.ts            # SQLite database service (native)
│   │   ├── webDatabase.ts         # localStorage fallback (web)
│   │   └── databaseInterface.ts   # Cross-platform database API
│   ├── store/             # State management
│   │   └── appStore.ts            # Zustand store with database integration
│   └── types/             # TypeScript definitions
├── App.tsx               # Root component with SafeAreaProvider
└── index.ts              # Entry point
```

## Navigation Structure

### Custom Navigator Hierarchy
```
SafeAreaProvider
└── NavigationProvider (Custom)
    └── AppContent
        ├── Home (HomeScreen) + Header
        ├── Library (LibraryScreen) + Header with Back
        └── Reader (ReaderScreen) + Custom Header
```

### Navigation Flow
```
Home Screen
├── "Import Book" → File picker → Process book → Library Screen
└── "My Library" → Library Screen
    └── Tap book → Reader Screen
        └── "← Back" → Library Screen
```

## Screen Specifications

### 1. Home Screen (`HomeScreen.tsx`)
**Purpose**: Welcome page and primary entry point

**Components**:
- App title and subtitle
- Primary action: "Import Book" button
- Secondary action: "My Library" button  
- Feature overview list
- Consistent branding

**Navigation**:
- "Import Book" → Opens file picker → Processes file → Navigates to Library
- "My Library" → Navigates to Library Screen

**State**: 
- No persistent state (stateless welcome page)

### 2. Library Screen (`LibraryScreen.tsx`)
**Purpose**: Display and manage user's book collection

**Components**:
- Book list (FlatList)
- Book items with:
  - Title, author, language
  - Reading progress bar
  - Last read date
- Empty state with import prompt
- Header with back navigation

**Navigation**:
- Book item tap → Reader Screen (with book ID parameter)
- "Import Book" (empty state) → Home Screen
- Back → Home Screen (via header)

**State**:
- Books list (currently mock data)
- Reading progress per book
- Last read timestamps

**Future Features**:
- Search/filter books
- Sort options (recent, alphabetical, progress)
- Delete/archive books
- Book covers

### 3. Reader Screen (`ReaderScreen.tsx`)  
**Purpose**: Primary reading interface with translation features

**Components**:
- Header:
  - Back button
  - Book title
  - Settings button (future)
- Content area:
  - Chapter title
  - Scrollable text with tappable words
  - Word/sentence interaction overlay
- Bottom controls:
  - TTS button
  - Reading mode toggle
  - Translation speed toggle

**Navigation**:
- "← Back" → Previous screen (Library)
- Header hidden for immersive reading

**State**:
- Current book content
- Reading position
- Selected words/sentences
- Translation cache
- Reading settings

**Interaction Model**:
- Tap word → Translation popup
- Tap sentence → Sentence translation
- Long press → Text selection (future)
- Swipe → Page/chapter navigation (future)

## Data Flow

### Current Implementation (Phase 1.2 + 1.3 - COMPLETED & STABLE)
```
Cross-Platform DB ↔ Zustand Store ↔ React Components ↔ Custom Navigation
     ↑                    ↑              ↑                    ↑
(SQLite/localStorage)  Translation    User Interface    Platform-Agnostic
File System           Cache          Interactions      Navigation
```

**Fully Implemented Features:**
- ✅ Cross-platform database (SQLite native, localStorage web)
- ✅ Zustand store with database persistence integration
- ✅ Complete database service layer with all CRUD operations
- ✅ Real book import with expo-document-picker and expo-file-system
- ✅ Persistent file storage in app document directory
- ✅ Library screen with live database data and refresh
- ✅ Custom navigation system (no react-native-screens conflicts)
- ✅ SafeAreaView using react-native-safe-area-context
- ✅ Full TypeScript integration with proper types
- ✅ Cross-platform compatibility (iOS, Android, Web)
- ✅ Optimized Zustand selectors (no infinite loops)
- ✅ Stable app initialization and navigation

### Future Enhancements
```
Advanced File Parsing → Enhanced Models → ML Translation
EPUB/PDF Readers → Content Extraction → Offline Models
```

## Styling System

### Design Principles
- **Consistent**: Unified color scheme and typography
- **Accessible**: High contrast, scalable text
- **Responsive**: Works on various screen sizes
- **Reading-focused**: Minimal distractions in reader

### Color Palette
```typescript
const colors = {
  primary: '#3498db',      // Blue - primary actions
  secondary: '#2c3e50',    // Dark blue - text
  background: '#ffffff',   // White - main background
  surface: '#f8f9fa',     // Light gray - cards/surfaces
  border: '#e9ecef',      // Gray - borders
  muted: '#7f8c8d',       // Gray - secondary text
  accent: '#95a5a6',      // Light gray - metadata
}
```

### Typography Scale
- **Title**: 32px, bold (screen titles)
- **Subtitle**: 16px, regular (descriptions)
- **Body**: 16px, regular (reading content)
- **Caption**: 14px, regular (metadata)
- **Small**: 12px, regular (timestamps, tags)

## State Management Plan

### Current: Zustand Store (Implemented)
Global state management with Zustand for:
- Books library with CRUD operations
- Reading positions and progress tracking  
- Vocabulary cards and spaced repetition
- Translation cache management
- User settings and preferences

### Implementation Details
```typescript
interface AppStore {
  // Library state
  books: Book[];
  currentBook: Book | null;
  
  // Reading state  
  currentPosition: Position;
  readingMode: ReadingMode;
  
  // Translation state
  translationCache: Map<string, Translation>;
  vocabularyLibrary: VocabularyCard[];
  
  // Settings
  userSettings: UserSettings;
  
  // Actions
  actions: {
    // Library actions
    addBook: (book: Book) => void;
    removeBook: (id: string) => void;
    updateProgress: (id: string, position: Position) => void;
    
    // Reading actions
    setCurrentBook: (book: Book) => void;
    updatePosition: (position: Position) => void;
    
    // Translation actions
    cacheTranslation: (key: string, translation: Translation) => void;
    saveVocabulary: (card: VocabularyCard) => void;
  };
}
```

## Component Architecture (Future)

### Planned Component Hierarchy
```
App
├── Navigation (React Navigation)
├── Screens/
│   ├── HomeScreen
│   ├── LibraryScreen
│   │   ├── BookList
│   │   ├── BookItem
│   │   └── EmptyLibrary
│   └── ReaderScreen
│       ├── ReaderHeader
│       ├── ReaderContent
│       │   ├── TextRenderer
│       │   └── InteractionOverlay
│       ├── TranslationPopup
│       └── ReaderControls
├── Shared Components/
│   ├── Button
│   ├── Card  
│   ├── ProgressBar
│   └── Typography
└── Providers/
    ├── ThemeProvider
    ├── TranslationProvider
    └── DatabaseProvider
```

## Feature Roadmap by Screen

### Home Screen Evolution
- [x] Basic welcome interface
- [ ] Recent books quick access
- [ ] Import progress indicator
- [ ] Onboarding for new users
- [ ] Settings access

### Library Screen Evolution
- [x] Basic book list display
- [x] SQLite integration with real-time data
- [x] Pull-to-refresh functionality  
- [x] Book metadata display (title, author, language pairs, dates)
- [x] Empty state with import flow
- [x] Progress indicators and last read timestamps
- [x] Cross-platform database compatibility
- [ ] **NEXT**: Search and filtering
- [ ] **NEXT**: Book covers and enhanced metadata extraction
- [ ] Reading statistics and progress calculation
- [ ] Import/export options
- [ ] Long-press actions (delete, edit)

### Reader Screen Evolution  
- [x] Basic text display with word tapping interface
- [x] Custom header with back navigation
- [x] Mock content rendering with Spanish text
- [x] Individual word tap detection
- [ ] **NEXT PRIORITY**: Real book content parsing (TXT/HTML → structured text)
- [ ] **NEXT**: Translation popup with dictionary lookup
- [ ] **NEXT**: Vocabulary saving to database
- [ ] Reading modes (toggle, side-by-side)
- [ ] TTS integration
- [ ] Position saving and sync
- [ ] EPUB/PDF parsing integration
- [ ] Annotations and highlights

## Navigation Enhancements (Future)

### Planned Navigation Features
- **Tab Navigation**: Bottom tabs for Home/Library/Vocabulary
- **Modal Screens**: Settings, vocabulary review, import progress
- **Deep Linking**: Direct links to specific books/chapters
- **Gesture Navigation**: Swipe between chapters
- **Reading History**: Recently read books quick access

### URL Structure (for web)
```
/                    # Home
/library             # Library
/reader/:bookId      # Reader with book ID
/reader/:bookId/:chapter  # Reader with chapter
/vocabulary          # Vocabulary review
/settings           # App settings
```

## Performance Considerations

### Current Optimizations
- FlatList for book library (virtualized scrolling)
- TouchableOpacity for responsive interactions
- StyleSheet for optimized styling

### Planned Optimizations
- React.memo for expensive components
- useMemo for computed values
- useCallback for event handlers
- Lazy loading for book content
- Image optimization for book covers
- Translation cache management

## Testing Strategy

### Current Testing
- Manual testing on web platform
- Basic navigation flow verification

### Planned Testing
- Unit tests for components (Jest + React Native Testing Library)
- Integration tests for navigation flows
- E2E tests for critical user journeys
- Performance testing for large books
- Accessibility testing

## Development Guidelines

### File Naming Conventions
- **Screens**: `NameScreen.tsx` (PascalCase + Screen suffix)
- **Components**: `ComponentName.tsx` (PascalCase)
- **Hooks**: `useHookName.ts` (camelCase with use prefix)
- **Utils**: `utilityName.ts` (camelCase)

### Code Organization Principles
- One component per file
- Export default for main component
- Named exports for related types/utilities
- TypeScript interfaces in shared types
- Consistent prop naming and structure

---

## Update Log
- **2024-10-26**: Initial frontend structure documentation created
- **2024-10-26**: React Navigation implementation completed, Expo Router removed
- **2024-10-26**: Basic three-screen navigation working (Home → Library → Reader)
- **2024-10-26**: SQLite database integration completed
  - Database service layer with comprehensive CRUD operations
  - Zustand store for global state management
  - Real book import and storage functionality
  - Library screen now uses live database data
  - Pull-to-refresh and loading states implemented
- **2024-10-26**: **MAJOR UPDATE - Navigation System Rebuilt**
  - **Fixed react-native-screens compatibility issues** (boolean/string type conflicts)
  - **Implemented custom navigation solution** - platform-agnostic, no native dependencies
  - **Cross-platform database completed** - SQLite for native, localStorage for web
  - **SafeAreaView modernized** - using react-native-safe-area-context
  - **Phase 1.2 + 1.3 COMPLETED** - Full database integration and navigation working
  - **TypeScript fully integrated** - All navigation and database operations properly typed
  - **App fully functional** on iOS, Android, and Web platforms
  - **Ready for Phase 1.4** - Book content parsing and text processing

*This document should be updated whenever significant frontend changes are made.*