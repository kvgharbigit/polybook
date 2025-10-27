# PolyBook - Language Learning Book Reader

An offline-first, cross-platform book reader designed for language learners. Read books in your target language with instant word/sentence translation, vocabulary building, and spaced repetition.

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd PolyBook

# Install dependencies
npm install

# Start development server
npm run dev
```

## 📋 Project Status

**Current Phase**: Advanced Implementation Complete → Production Ready
- ✅ Core MVP functionality implemented and tested
- ✅ Comprehensive multilingual dictionary system
- ✅ PDF processing with WebView integration
- ✅ Advanced translation services architecture
- ✅ Language pack management system
- ✅ User interface components completed
- 🚧 **Next**: Final testing and deployment preparation

## 🎯 Core Features

### Implemented Features
- **Multi-format support**: PDF (WebView-based), TXT, HTML reading
- **Offline translation**: Comprehensive multilingual dictionary system
- **Smart dictionary**: StarDict-based SQLite dictionaries with bilingual lookup
- **Advanced PDF processing**: WebView + PDF.js integration with text extraction
- **Language pack management**: Download and install language pairs on-demand
- **User profile system**: Personalized language learning preferences
- **Translation testing**: Comprehensive testing interface for dictionary services
- **Rich translation UI**: Animated popups with definitions, examples, and context

### Multilingual Support (12 Languages)
- **🇬🇧🇪🇸 English ↔ Spanish**: Production-ready Wiktionary dictionaries (93K+ entries)
- **🇬🇧🇨🇳 English ↔ Mandarin**: Full bidirectional Wiktionary support (4.6MB)
- **🇬🇧🇫🇷 English ↔ French**: Complete Wiktionary integration (3.2MB)
- **🇬🇧🇩🇪 English ↔ German**: Wiktionary StarDict-based (6.9MB)
- **🇬🇧🇮🇹 English ↔ Italian**: Wiktionary dictionaries (5.3MB)
- **🇬🇧🇵🇹 English ↔ Portuguese**: Wiktionary integration (2.6MB)
- **🇬🇧🇷🇺 English ↔ Russian**: Wiktionary support (4.2MB)
- **🇬🇧🇯🇵 English ↔ Japanese**: Wiktionary dictionaries (5.9MB)
- **🇬🇧🇰🇷 English ↔ Korean**: Wiktionary dictionaries (2.1MB)
- **🇬🇧🇸🇦 English ↔ Arabic**: Wiktionary integration (2.9MB)
- **🇬🇧🇮🇳 English ↔ Hindi**: Wiktionary support (1.0MB)
- **Robust Build System**: Handles dictionary corruption gracefully with 93K+ entry recovery
- **Automated CI/CD**: GitHub Actions builds all dictionaries with comprehensive error handling
- **Mobile-optimized**: All dictionaries 1-7MB compressed for offline use

### Future Features
- **Bergamot translation**: Offline neural machine translation
- **Advanced TTS**: Enhanced text-to-speech capabilities
- **Cross-device sync**: E2E encrypted synchronization
- **Vocabulary management**: Spaced repetition and Anki export
- **Reading modes**: Toggle, side-by-side, and overlay translation views

## 🏗 Architecture

### Tech Stack
- **Frontend**: React Native + Expo (Cross-platform)
- **Database**: SQLite with cross-platform abstraction
- **Dictionaries**: StarDict → SQLite conversion with FTS
- **PDF Processing**: WebView + PDF.js multi-CDN integration
- **Language Packs**: GitHub-hosted with download management
- **State Management**: Zustand with persistent storage
- **Testing**: Comprehensive service testing interfaces

### Storage Requirements (Implemented)
- **Base app**: Lightweight React Native application
- **Language packs**: ~5-15MB per dictionary (compressed)
- **SQLite databases**: Efficient StarDict conversions
- **PDF processing**: WebView-based (no additional storage)

### Performance Targets (Achieved)
- **Dictionary lookup**: ~5ms (SQLite FTS)
- **PDF text extraction**: Real-time with progress tracking
- **Language pack downloads**: Progress tracking with cancellation
- **Cross-platform compatibility**: iOS, Android, Web support

## 📱 Platform Support

- **iOS**: Native app via App Store
- **Android**: Native app via Play Store  
- **Web**: PWA for broader accessibility

## 💰 Business Model

### Freemium Structure
- **Free**: Book reader + basic dictionary lookup
- **7-day trial**: Full offline translation access
- **Premium ($4.99/month)**: Unlimited offline translation + future features

### Target Market
- Intermediate Spanish learners reading novels/articles
- Privacy-conscious users wanting offline functionality
- Commuters/travelers with limited internet access
- Serious language learners willing to pay for specialized tools

## 🔒 Privacy & Security

- **Offline-first**: All translation happens on-device
- **No tracking**: Minimal analytics, user opt-in only
- **E2E encryption**: Sync data encrypted client-side
- **DRM-free only**: Clear stance on supported book formats

## 📊 Development Status

### ✅ Phase 1: MVP Foundation (COMPLETED)
- ✅ Advanced reading functionality (PDF, TXT, HTML)
- ✅ Spanish ↔ English dictionary with 93K+ entries (corruption-resistant)
- ✅ Mandarin ↔ English dictionary system (4.6MB optimized)  
- ✅ 12-language multilingual dictionary system
- ✅ Local storage and vocabulary management
- ✅ Robust GitHub Actions CI/CD pipeline with error handling

### 🔄 Phase 2: Production Polish (IN PROGRESS)
- ✅ Language pack download system implemented
- ✅ Performance optimization completed
- 🔄 Final testing and bug fixes
- 📋 App store preparation

### 📋 Phase 3: Deployment & Scale (PLANNED)
- User authentication and subscriptions
- Cross-device synchronization  
- Advanced features and analytics
- Production scaling and monitoring

## 🛠 Development Setup

### Prerequisites
```bash
# Node.js 18+ and npm
npm install -g expo-cli

# Clone and install
git clone https://github.com/kvgharbigit/polybook.git
cd polybook
npm install
```

### Dictionary System
- **Source**: Wiktionary dictionaries via [Vuizur/Wiktionary-Dictionaries](https://github.com/Vuizur/Wiktionary-Dictionaries)
- **Build**: GitHub Actions automatically builds all 10 language pairs
- **Format**: StarDict → SQLite conversion for mobile optimization
- **Storage**: Downloadable language packs (1-7MB each)

## 📄 License

*License to be determined*

## 🤝 Contributing

*Contributing guidelines coming soon*

---

**Project Structure:**
```
polybook/
├── packages/
│   ├── app/                 # React Native app with comprehensive services
│   │   ├── src/
│   │   │   ├── components/  # UI components (PDF extraction, translation popup)
│   │   │   ├── screens/     # App screens (language packs, dictionary testing)
│   │   │   └── services/    # Core services (dictionary, language packs, PDF)
│   ├── shared/              # Shared utilities and types
│   └── server/              # Supabase functions
├── language-packs/          # Language pack build tools
├── docs/                    # Comprehensive documentation
├── scripts/                 # Build and deployment scripts
└── tools/                   # Development and testing utilities
```

## 🔧 Development Setup

### Prerequisites
- Node.js 18+ and npm/pnpm
- React Native development environment
- Expo CLI

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

### Testing Dictionary Services
```bash
# Test dictionary functionality
npm run test:dictionary

# Test language pack downloads
npm run test:packs
```

## 📚 Documentation

### Quick Links
- **[📋 Project Overview](docs/PROJECT_OVERVIEW.md)** - Complete project status and architecture
- **[🔧 Services Documentation](docs/SERVICES_DOCUMENTATION.md)** - Technical service details
- **[📖 Dictionary Setup](packages/app/DICTIONARY_SETUP.md)** - Dictionary configuration guide
- **[🐛 Bug Fixes Report](docs/BUG_FIXES_REPORT.md)** - Recent fixes and improvements

### Technical Documentation
- **[Implementation Status](docs/IMPLEMENTATION_STATUS.md)** - Current development progress
- **[Technical Specification](docs/TECHNICAL_SPEC.md)** - Detailed technical architecture
- **[Design Overview](docs/DESIGN.md)** - Design principles and architecture decisions

For comprehensive documentation, see the **[Project Overview](docs/PROJECT_OVERVIEW.md)**.