# PolyBook - Design Overview

## Vision
PolyBook is an offline-first, cross-platform language learning application that provides instant multilingual dictionary services, advanced PDF text processing, and comprehensive language pack management for serious language learners.

## Current Implementation (Production Ready)
- **Multi-format support**: PDF (WebView-based), TXT, HTML reading
- **Offline translation**: Comprehensive multilingual dictionary system (EN/ES/FR/DE)
- **Advanced PDF processing**: WebView + PDF.js integration with real-time text extraction
- **Language pack management**: Download and install language pairs on-demand
- **User profile system**: Personalized language learning preferences
- **Cross-platform**: Full iOS, Android, and Web support

## Architecture (As Implemented)

### Tech Stack
**Frontend:** React Native + Expo (Cross-platform)
- Cross-platform compatibility (iOS/Android/Web)
- Custom navigation solution (no react-native-screens)
- Zustand for state management with persistence
- React Native StyleSheet with SafeAreaView

**Local Storage:** SQLite with Cross-Platform Abstraction
- SQLite for native platforms (iOS/Android)
- localStorage fallback for web platform
- StarDict → SQLite conversion for dictionaries
- Offline-first data persistence

**Services:** Production-Grade Service Architecture
- Comprehensive error handling and input validation
- Service abstraction layers for maintainability
- Runtime type safety with type guards
- Centralized logging and monitoring

### Core Components (Implemented)

#### 1. Dictionary Services Architecture
- **BilingualDictionaryService**: Central coordinator for multilingual lookups
- **SQLiteDictionaryService**: High-performance StarDict → SQLite engine (~5ms lookups)
- **LightweightDictionaryService**: Compatibility layer with ML Kit integration ready
- **Performance**: Optimized SQLite FTS with sub-5ms response times

#### 2. Language Pack Management (Production Ready)
- **LanguagePackManager**: GitHub registry integration with download tracking
- **PackManager**: Pure JavaScript implementation for Expo compatibility  
- **StarDictProcessor**: Format conversion and database optimization
- **Storage**: Compressed SQLite databases (5-15MB per language pair)
- **Languages**: English, Spanish, French, German (Italian/Portuguese ready)

#### 3. PDF Processing System
- **PdfPolyDocExtractor**: WebView + PDF.js with multi-CDN fallback
- **NativePdfExtractor**: Base64 processing fallback for offline scenarios
- **Features**: Real-time text extraction, progress tracking, chapter detection
- **Integration**: Structured content output for reading interface
#### 4. User Management & Profiles
- **UserLanguageProfileService**: Language preferences and learning profiles
- **Cache Management**: Smart caching with TTL validation
- **Cross-Platform Storage**: AsyncStorage with JSON serialization

#### 5. Error Handling & Quality (Production Grade)
- **Centralized Error Management**: Comprehensive error framework with logging
- **Input Validation**: 100% coverage on external interfaces
- **Type Safety**: Runtime type guards throughout application
- **Performance Monitoring**: Service-level metrics and health checking

## Design Principles

### 1. Offline-First Architecture
- **Core Functionality**: All essential features work without internet connection
- **Data Persistence**: SQLite for reliable local storage with web fallbacks
- **Language Packs**: Download once, use indefinitely offline
- **Performance**: Sub-5ms dictionary lookups with optimized FTS

### 2. Cross-Platform Compatibility  
- **React Native + Expo**: Single codebase for iOS, Android, and Web
- **Platform Abstraction**: Service layer abstracts platform differences
- **Progressive Enhancement**: Web features gracefully degrade for mobile
- **Consistent UX**: Unified interface across all platforms

### 3. Production-Grade Quality
- **Error Handling**: Comprehensive error management with graceful fallbacks
- **Input Validation**: Security-focused validation at all service boundaries
- **Type Safety**: Runtime type guards complement TypeScript static checking
- **Monitoring**: Built-in logging and health checking for production readiness

### 4. Developer Experience
- **Service Architecture**: Clean separation of concerns with dependency injection
- **Testing**: Built-in testing interfaces for service validation
- **Documentation**: Comprehensive inline documentation and external guides
- **Maintainability**: Centralized configuration and reusable utility functions

## Future Vision

### Planned Enhancements
- **Neural Translation**: Bergamot/Marian offline models for sentence translation
- **Vocabulary Management**: Spaced repetition system with learning analytics  
- **Cross-Device Sync**: E2E encrypted synchronization across devices
- **Advanced TTS**: Enhanced text-to-speech with voice selection
- **Reading Modes**: Toggle, side-by-side, and overlay translation views

### Performance Goals (Current vs Target)
- **Dictionary Lookup**: ~5ms achieved (target: <80ms) ✅ **Exceeded**
- **Language Packs**: 5-15MB achieved (target: ~250MB) ✅ **Exceeded**  
- **Error Handling**: 90%+ coverage achieved ✅ **Production Ready**
- **Cross-Platform**: Full compatibility achieved ✅ **Complete**

### Extensibility Architecture
- **Language Pack System**: Easily add new language pairs via GitHub registry
- **Service Architecture**: Plugin-style services for easy feature addition
- **Type System**: Comprehensive type definitions for maintainable growth
- **Error Framework**: Standardized error handling for reliable operation

## Key Technical Decisions

### Architecture Choices
- **React Native + Expo**: Cross-platform development with native performance
- **SQLite + Cross-Platform Abstraction**: Reliable offline storage with web fallbacks
- **StarDict → SQLite Conversion**: Leveraging existing dictionary resources with optimization
- **Service Layer Architecture**: Clean separation of concerns for maintainability

### Implementation Decisions  
- **Offline-First**: All core functionality works without internet for privacy and performance
- **Language Pack Strategy**: Modular downloads keep base app lightweight (5-15MB vs 250MB)
- **Error-First Development**: Comprehensive error handling from day one
- **Type-Safe Runtime**: Runtime type guards complement static TypeScript checking

---

*For detailed technical implementation, see [Technical Specification](TECHNICAL_SPEC.md)*  
*For current implementation status, see [Implementation Status](IMPLEMENTATION_STATUS.md)*  
*For service architecture details, see [Services Documentation](SERVICES_DOCUMENTATION.md)*

