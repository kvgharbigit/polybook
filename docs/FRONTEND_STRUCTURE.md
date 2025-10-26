# PolyBook Frontend Structure & Navigation Flow

## Overview
This document maintains the high-level frontend architecture, page structure, and navigation flow for the PolyBook app. This serves as a reference for development and should be updated as the app evolves.

## Tech Stack
- **Framework**: React Native + Expo (Managed Workflow)
- **Navigation**: React Navigation v6 (Native Stack)
- **State Management**: Zustand
- **Styling**: React Native StyleSheet
- **Language**: TypeScript

## App Structure

```
packages/app/
├── src/
│   ├── screens/           # Main app screens
│   │   ├── HomeScreen.tsx         # Landing/welcome page
│   │   ├── LibraryScreen.tsx      # Book library management
│   │   └── ReaderScreen.tsx       # Book reading interface
│   ├── components/        # Reusable components (future)
│   ├── hooks/            # Custom React hooks (future)
│   ├── services/         # API/database services (future)
│   ├── store/            # Zustand store setup (future)
│   └── utils/            # App-specific utilities (future)
├── App.tsx               # Root component with navigation
└── index.ts              # Entry point
```

## Navigation Structure

### Stack Navigator Hierarchy
```
NavigationContainer
└── Stack.Navigator
    ├── Home (HomeScreen)
    ├── Library (LibraryScreen)
    └── Reader (ReaderScreen)
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

### Current Implementation (MVP)
```
Mock Data → Screens → Display
```

### Future Implementation (Full)
```
SQLite DB ↔ Zustand Store ↔ React Components
     ↑              ↑              ↑
File System    Translation    User Interface
Language Packs    Cache        Interactions
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

### Current: Component State
Each screen manages its own state with React hooks.

### Future: Zustand Store
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
- [x] Basic book list with mock data
- [ ] SQLite integration
- [ ] Search and filtering
- [ ] Book covers and metadata
- [ ] Reading statistics
- [ ] Import/export options

### Reader Screen Evolution  
- [x] Basic text display with word tapping
- [ ] Real book content parsing (EPUB/PDF)
- [ ] Translation popup with dictionary
- [ ] Vocabulary saving
- [ ] Reading modes (toggle, side-by-side)
- [ ] TTS integration
- [ ] Position saving and sync
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

*This document should be updated whenever significant frontend changes are made.*