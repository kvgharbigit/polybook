# PolyBook - Language Learning Book Reader

An offline-first, cross-platform book reader designed for language learners. Read books in your target language with instant word/sentence translation, vocabulary building, and spaced repetition.

## 🚀 Quick Start

PolyBook is currently in development. This README will be updated with installation and usage instructions once the MVP is complete.

## 📋 Project Status

**Current Phase**: Planning Complete → Implementation Starting
- ✅ Architecture design finalized
- ✅ Implementation plan created
- ✅ Technical feasibility validated
- 🚧 **Next**: Project setup and MVP development

## 🎯 Core Features

### MVP (Spanish ↔ English)
- **Multi-format support**: EPUB, PDF, TXT reading
- **Offline translation**: Tap words/sentences for instant translation
- **Smart dictionary**: Lemmatization and frequency-based definitions
- **Vocabulary building**: Save words to personal library with context
- **Text-to-speech**: System TTS integration
- **Export capability**: CSV export for Anki decks
- **Reading modes**: Toggle, side-by-side, and overlay translation views

### Future Features
- Additional language pairs (French, German, etc.)
- Cross-device sync with E2E encryption
- Advanced spaced repetition system
- Full-book LLM translation (premium)
- Classroom/organization features

## 🏗 Architecture

### Tech Stack
- **Frontend**: React Native + Expo (Bare workflow)
- **Database**: SQLite with offline-first design
- **ML Models**: Bergamot/Marian for offline translation
- **Backend**: Supabase (auth + payments only)
- **State Management**: Zustand
- **Styling**: NativeWind (Tailwind for RN)

### Storage Requirements
- **Base app**: <50MB
- **Spanish language pack**: ~250MB total
  - Dictionary (FreeDict): ~80MB
  - Translation models: ~180MB (90MB each direction)

### Performance Targets
- App startup: <2s
- Word lookup: <80ms
- Sentence translation: 100-300ms (modern devices)
- Memory usage: <500MB peak

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

## 📊 Development Roadmap

### Phase 1: MVP Foundation (6 weeks)
- Basic reading functionality
- Spanish ↔ English dictionary and translation
- Local storage and vocabulary library
- System TTS integration

### Phase 2: Monetization (4 weeks)
- User authentication and subscriptions
- Language pack download system
- Performance optimization
- App store preparation

### Phase 3: Scale & Sync (6 weeks)
- Cross-device synchronization
- Additional language pairs
- Advanced features and analytics
- Production scaling

## 🛠 Development Setup

*Coming soon - will include setup instructions for:*
- Development environment
- Language pack building
- Local testing
- Contributing guidelines

## 📄 License

*License to be determined*

## 🤝 Contributing

*Contributing guidelines coming soon*

---

**Project Structure:**
```
polybook/
├── packages/
│   ├── app/                 # React Native app
│   ├── shared/              # Shared utilities and types
│   └── server/              # Supabase functions
├── language-packs/          # Language pack build tools
├── docs/                    # Documentation
└── scripts/                 # Build and deployment scripts
```

For detailed technical documentation, see the `docs/` directory.