# PolyBook Implementation Plan

## Phase Overview

### Phase 1: MVP Foundation (4-6 weeks)
**Goal**: Basic reading app with core translation features
**Target**: Spanish ↔ English ONLY, essential functionality, local storage only
**Key Decision**: No sync, no multi-language until validation

### Phase 2: Core Features (3-4 weeks)  
**Goal**: Complete offline translation and monetization
**Target**: Production-ready app with subscription model
**Key Decision**: Defer sync to Phase 3, focus on core value

### Phase 3: Enhancement & Scale (4-6 weeks)
**Goal**: Multi-language support, advanced features, optimization
**Target**: Market-ready product with growth features

---

## Phase 1: MVP Foundation

### Week 1-2: Project Setup & Core Reading

#### 1.1 Project Structure Setup ✅ COMPLETED
```
polybook/
├── packages/
│   ├── app/                 # Expo React Native app
│   ├── web/                 # Web PWA (Expo for Web)
│   ├── shared/              # Shared utilities, types, models
│   └── server/              # Supabase functions
├── language-packs/          # Language pack build tools
└── docs/
```

**Tasks:**
- [x] Initialize Expo managed workflow project structure
- [x] Set up TypeScript configuration
- [x] Create monorepo structure with shared package
- [x] Define core types and schemas with Zod validation
- [x] Set up basic folder structure
- [x] **RESOLVED**: Replaced Expo Router with custom navigation solution
- [x] **COMPLETED**: Custom navigation working without react-native-screens conflicts
- [x] Set up Zustand for state management with database integration
- [x] Configure basic styling and SafeAreaView

**Lessons Learned:**
- **React Navigation Compatibility**: react-native-screens has boolean/string type conflicts with current Expo SDK
- **Solution**: Custom navigation implementation eliminates native module dependencies
- **Platform Database Strategy**: SQLite for native, localStorage for web provides full compatibility
- **State Management**: Zustand + database service layer provides clean architecture
- **Package Management**: Resolved npm cache issues, all dependencies working
- **Cross-platform Development**: Need to test both native and web regularly
- **TypeScript Integration**: Proper typing essential for navigation and database operations

**Implementation Status:**
✅ **Completed (Phase 1.1 + 1.2 + 1.3):**
- Project structure with monorepo setup
- Shared package with TypeScript types and Zod schemas  
- Core data models (Book, VocabularyCard, Position, TranslationCache)
- Cross-platform database abstraction (SQLite + localStorage)
- Custom navigation solution (no react-native-screens dependency)
- Full CRUD operations with Zustand state management
- File import system with expo-document-picker
- Book library with real database persistence
- Basic reader screen with word interaction
- Cross-platform SafeAreaView implementation
- All TypeScript types properly configured

🚧 **Ready for Phase 1.4 (Text Processing):**
- App fully functional and stable
- Database operations working on all platforms
- Navigation system custom and reliable
- Ready to implement book content parsing

📋 **Current Status (FULLY WORKING - Phase 1.2+1.3 Complete):**
✅ **Major Progress Completed (Latest Session):**
- **Fixed critical navigation compatibility issues** with react-native-screens
- **Implemented custom navigation solution** to avoid native module conflicts
- **Completed Phase 1.2+1.3**: Full SQLite database integration with Zustand state management
- **Platform compatibility**: Both web (localStorage) and native (SQLite) working
- **Real data integration**: Replaced all mock data with persistent database storage
- **File import working**: Book import flow with expo-document-picker and expo-file-system
- **Cross-platform SafeAreaView**: Updated to react-native-safe-area-context
- **TypeScript fully working**: All navigation and database operations properly typed
- **Fixed infinite loops**: Optimized Zustand store selectors to prevent re-render loops
- **Persistent file storage**: Books copied to permanent app document directory

🚧 **Ready for Phase 1.5 - Next Immediate Steps:**
1. ✅ App fully functional and stable on iOS/Android/Web
2. ✅ **COMPLETED**: Book content parsing (TXT/HTML → structured text)
3. **Next Priority**: Build word-tap translation popup UI
4. Create vocabulary saving system  
5. Add basic translation lookup (start with simple dictionary)

**Technical Architecture Now Stable:**
- Custom navigation (no react-native-screens dependency issues)
- Cross-platform database (SQLite native, localStorage web)
- Proper TypeScript integration
- Zustand state management working
- File system operations functional

#### 1.2 Basic Book Reader ✅ COMPLETED
**Tasks:**
- [x] Implement file picker (expo-document-picker)
- [x] Create basic book import flow with database storage
- [x] Book library listing with real SQLite data
- [x] Reading position persistence (SQLite + cross-platform fallback)
- [x] Basic reader screen with word tapping interface
- [ ] **NEXT**: TXT/HTML content parsing and structured text rendering
- [ ] **NEXT**: EPUB reader integration
- [ ] **NEXT**: PDF reader with tap detection
- [ ] **Text interaction**: Enhanced tap-to-select implementation

#### 1.3 Local Database Setup ✅ COMPLETED
**Tasks:**
- [x] Set up SQLite with expo-sqlite (native) + localStorage (web)
- [x] **Platform abstraction**: Automatic platform detection and database selection
- [x] Create comprehensive schema (books, positions, vocabulary_cards, translation_cache)
- [x] Full CRUD operations for books, positions, and vocabulary
- [x] Zustand integration with database service layer
- [x] **Cross-platform compatibility**: Works on iOS, Android, and Web
- [x] **No sync schema** in MVP (as planned)

### Week 3-4: Translation Foundation

#### 1.4 Text Interaction Layer ✅ COMPLETED
**Tasks:**
- [x] **Real book content parsing** (TXT and HTML files)
- [x] **Content caching system** with database storage
- [x] **Word-level tap detection** with proper text segmentation
- [x] **Cross-platform file parsing** working on iOS/Android/Web
- [x] **Error handling** for unsupported formats (PDF/EPUB deferred to Phase 2)
- [x] **Loading states and retry functionality**

#### 1.5 Basic Dictionary (Spanish ↔ English)
**Tasks:**
- [ ] **Download and process FreeDict Spanish-English**
- [ ] Create SQLite FTS dictionary database (~80MB)
- [ ] Spanish lemmatization tables (verb conjugations, plurals)
- [ ] Word lookup popup UI with clear size/storage info
- [ ] Save words to personal library
- [ ] **Test dictionary completeness** for common Spanish texts

#### 1.6 System TTS Integration
**Tasks:**
- [ ] Integrate with iOS AVSpeechSynthesizer
- [ ] Integrate with Android TextToSpeech
- [ ] Web Speech API for web version
- [ ] TTS controls and settings

### Week 5-6: MVP Polish

#### 1.7 Personal Library & Export
**Tasks:**
- [ ] Saved words/sentences management
- [ ] Basic spaced repetition system
- [ ] CSV export for Anki
- [ ] Review interface

#### 1.8 Basic UI/UX
**Tasks:**
- [ ] Reading themes (light/dark/sepia)
- [ ] Font size and spacing controls
- [ ] Basic settings screen
- [ ] Onboarding flow

#### 1.9 Testing & Polish
**Tasks:**
- [ ] Unit tests for core functions
- [ ] Integration tests for reading flow
- [ ] Performance testing on target devices
- [ ] Bug fixes and optimization

**MVP Deliverables:**
- Functional book reader (EPUB, PDF, TXT) with tap interaction
- Word lookup with Spanish ↔ English dictionary (~80MB)
- System text-to-speech functionality
- Personal vocabulary library (local only)
- CSV export capability
- **No sync, no sentence translation yet**
- Clear storage usage indicators

---

## Phase 2: Core Features

### Week 7-8: Offline Translation Engine

#### 2.1 Language Pack Infrastructure
**Tasks:**
- [ ] Design language pack manifest (version, size, checksums)
- [ ] Create download manager with progress indicators
- [ ] **Clear storage warnings** before download (~250MB total)
- [ ] Easy pack deletion and management UI
- [ ] Implement pack versioning and updates

#### 2.2 Offline Sentence Translation
**Tasks:**
- [ ] **Integrate Bergamot models** (Spanish ↔ English, ~90MB each)
- [ ] Model loading with pre-warming (~2s startup)
- [ ] **Fast mode toggle**: Quality vs speed (beam=1 vs beam=4)
- [ ] Translation caching by sentence hash
- [ ] **Multiple bilingual modes**: Toggle, side-by-side, overlay
- [ ] Synchronized scrolling for parallel view
- [ ] **Performance testing**: Target 100-300ms on modern devices

#### 2.3 Enhanced Dictionary
**Tasks:**
- [ ] Extended dictionary with examples and frequency
- [ ] Morphological analysis for better lemmatization
- [ ] Dictionary popup with full details
- [ ] Audio pronunciation support

### Week 9: Authentication & Monetization

#### 2.4 User Authentication
**Tasks:**
- [ ] Supabase Auth integration
- [ ] Email magic link authentication
- [ ] Apple/Google Sign-In for mobile
- [ ] Anonymous user migration

#### 2.5 Subscription System (No Sync Yet)
**Tasks:**
- [ ] **RevenueCat integration** for mobile IAP
- [ ] Stripe integration for web payments
- [ ] 7-day free trial logic
- [ ] **Feature gating**: Offline translation requires subscription
- [ ] **Defer sync to Phase 3**

### Week 10: Monetization

#### 2.6 Subscription System
**Tasks:**
- [ ] Supabase entitlements table
- [ ] RevenueCat integration for mobile IAP
- [ ] Stripe integration for web payments
- [ ] Free trial logic (7 days)
- [ ] Subscription status checking

#### 2.7 Feature Gating
**Tasks:**
- [ ] Trial limitations implementation
- [ ] Language pack download restrictions
- [ ] Premium feature toggles
- [ ] Subscription prompts and upsells

**Phase 2 Deliverables:**
- Offline sentence translation (Spanish ↔ English only)
- Bilingual quick toggle mode with performance optimization
- User accounts and authentication
- Subscription model with free trial
- Language pack download system with clear storage management
- **Sync deferred to Phase 3** for complexity management

---

## Phase 3: Enhancement & Scale

### Week 11-12: Advanced Features

#### 3.1 Additional Language Support
**Tasks:**
- [ ] French ↔ English language pack
- [ ] German ↔ English language pack
- [ ] Enhanced tokenization for target languages
- [ ] Language-specific UI considerations

#### 3.2 Advanced Reading Features
**Tasks:**
- [ ] Highlights and annotations sync
- [ ] Reading statistics and progress tracking
- [ ] Advanced typography options
- [ ] Accessibility improvements

#### 3.3 Enhanced TTS
**Tasks:**
- [ ] Piper voice integration as fallback
- [ ] Voice selection and customization
- [ ] Reading speed controls
- [ ] Continuous reading mode

### Week 13-14: Performance & Quality

#### 3.4 Performance Optimization
**Tasks:**
- [ ] Model loading optimization
- [ ] Memory usage optimization
- [ ] Translation speed improvements
- [ ] Background pre-translation

#### 3.5 Advanced Sync Features
**Tasks:**
- [ ] Full library sync with encryption
- [ ] Conflict resolution UI
- [ ] Selective sync options
- [ ] Sync status indicators

#### 3.6 Enhanced Export
**Tasks:**
- [ ] Direct Anki .apkg export
- [ ] Multiple export formats
- [ ] Batch operations
- [ ] Export scheduling

### Week 15-16: Production Readiness

#### 3.7 Testing & Quality Assurance
**Tasks:**
- [ ] Comprehensive testing suite
- [ ] Performance testing on various devices
- [ ] Load testing for sync system
- [ ] Security audit

#### 3.8 Analytics & Monitoring
**Tasks:**
- [ ] Privacy-focused analytics
- [ ] Error reporting and crash analytics
- [ ] Performance monitoring
- [ ] User feedback system

#### 3.9 Documentation & Support
**Tasks:**
- [ ] User documentation and help system
- [ ] Developer documentation
- [ ] Support ticketing system
- [ ] Community guidelines

#### 3.10 Launch Preparation
**Tasks:**
- [ ] App store optimization
- [ ] Beta testing program
- [ ] Marketing materials
- [ ] Launch strategy

**Phase 3 Deliverables:**
- Multi-language support (EN, ES, FR, DE)
- Advanced reading and annotation features
- Complete sync system with conflict resolution
- Production-ready infrastructure
- Analytics and monitoring
- Ready for app store submission

---

## Implementation Strategy

### Development Approach
1. **Offline-first development**: Build and test all features locally first
2. **Incremental complexity**: Start with simple implementations, then enhance
3. **Cross-platform testing**: Regular testing on iOS, Android, and web
4. **Performance focus**: Continuous monitoring of memory and speed
5. **User feedback integration**: Early user testing for UX validation

### Technology Decisions

#### Core Stack
- **React Native + Expo**: Maximum code reuse, rapid iteration
- **TypeScript**: Type safety and better developer experience
- **WatermelonDB**: Offline-first database with sync capabilities
- **Zustand**: Lightweight state management
- **Supabase**: Minimal backend infrastructure

#### Language Processing
- **Bergamot/Marian**: Open-source neural machine translation
- **FreeDict/Wiktionary**: Open-source dictionary data
- **Custom tokenizers**: Language-specific text processing
- **System TTS**: Native text-to-speech APIs

#### Build Tools
- **PNPM**: Efficient package management for monorepo
- **Expo EAS**: Build and deployment pipeline
- **GitHub Actions**: CI/CD automation
- **Sentry**: Error monitoring and performance tracking

### Risk Mitigation

#### Technical Risks
- **Model performance**: Extensive testing on target devices
- **Storage constraints**: Modular language packs with user choice
- **Platform limitations**: Fallback strategies for each platform
- **Sync complexity**: Gradual rollout with conflict detection

#### Business Risks
- **User acquisition**: Focus on unique value proposition
- **Competition**: Emphasize offline capabilities and privacy
- **Monetization**: Flexible pricing with clear value demonstration
- **Legal issues**: Clear DRM stance and copyright compliance

### Success Metrics

#### Technical KPIs
- App startup time < 2 seconds
- Translation response time < 300ms
- Crash-free sessions > 99.5%
- Memory usage < 500MB peak

#### Business KPIs
- User retention: 40% after 7 days, 20% after 30 days
- Conversion rate: 15% trial to paid conversion
- Monthly churn: < 5%
- Customer satisfaction: > 4.5/5 rating

### Resource Requirements

#### Development Team
- **Lead Developer**: Full-stack with React Native expertise
- **ML Engineer**: Language processing and model optimization
- **UI/UX Designer**: Mobile-first design experience
- **QA Engineer**: Cross-platform testing expertise

#### Infrastructure
- **Development**: Expo, Supabase free tiers
- **Production**: Supabase Pro, CDN for language packs
- **Monitoring**: Sentry, analytics platform
- **Legal**: Copyright and privacy compliance review

### Timeline Summary

| Phase | Duration | Key Milestones |
|-------|----------|----------------|
| Phase 1 | 6 weeks | MVP with basic translation |
| Phase 2 | 4 weeks | Offline translation + monetization |
| Phase 3 | 6 weeks | Multi-language + production ready |
| **Total** | **16 weeks** | **Market-ready product** |

This plan provides a structured approach to building PolyBook from concept to market-ready product, with clear milestones and deliverables at each phase.