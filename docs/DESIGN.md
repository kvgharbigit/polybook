# PolyBook - Language Learning Book Reader

## Overview
PolyBook is an offline-first, cross-platform book reader designed for language learners. Users can tap words/sentences for instant translation, save vocabulary, and export to Anki decks.

## Core Features
- Multi-format book support (EPUB, PDF, TXT, HTML, FB2)
- Offline word & sentence translation
- Text-to-speech (TTS) functionality
- Personal vocabulary library with spaced repetition
- Anki deck export
- Cross-device sync with position saving
- Subscription model with 7-day free trial
- Future: Full book LLM translation capability

## Architecture

### Tech Stack
**Frontend:** React Native + Expo (iOS/Android/Web PWA)
- Single codebase with maximum code reuse
- Expo Router for navigation
- Zustand for state management
- NativeWind for styling

**Backend:** Supabase (minimal cloud footprint)
- Authentication & user management
- Postgres with Row Level Security
- Object storage for sync data
- Edge functions for webhooks

**Local Storage:** SQLite with WatermelonDB
- Offline-first data persistence
- Efficient syncing capabilities

### Core Components

#### 1. Book Reader Engine
- **EPUB**: Convert to XHTML, render in WebView with CSS pagination
- **PDF**: react-native-pdf (mobile), pdf.js (web)
- **TXT/HTML/FB2**: Normalize to internal HTML format
- **Position Tracking**: EPUB CFI for EPUB, page+offset for PDF

#### 2. Offline Language Packs (Modular Downloads)
**MVP Focus: Spanish ↔ English only** (expand after validation)

Each language pack contains:
- **Tokenizer & Lemmatizer**: Rule-based for Latin languages (~2-8MB), morphological tables for complex languages (~10-30MB)
- **Dictionary**: SQLite FTS database from FreeDict/Wiktionary (~80MB)
- **MT Model**: Bergamot/Marian quantized models (~70-90MB per direction)
- **Total per language pair**: ~250MB maximum
- **TTS**: System voices preferred, optional Piper voices as fallback

**Storage Management:**
- Clear size indicators before download
- Easy pack deletion and management
- User chooses translation directions needed

#### 3. Translation Pipeline
**Word Translation:**
```
tap → tokenize → lemmatize → SQLite FTS lookup → display popup → save to library
```

**Sentence Translation:**
```
tap → sentence boundary detection → offline NMT → cache result → display
```

**Bilingual Modes:**
```
Mode 1 (Toggle): tap → toggle sentence text in place
Mode 2 (Side-by-side): parallel panes with synchronized scrolling
Mode 3 (Overlay): translation appears as overlay on original
```

#### 4. Text Interaction Layer
- **Tap-to-translate only** (not arbitrary text selection)
- Pre-segmented sentence spans in HTML
- Word boundary detection for precise targeting
- Background pre-translation for smooth toggling
- **Fast mode toggle**: Speed vs quality trade-off

### Data Models

#### Local Database Schema
```sql
-- Core entities
User(id, email, createdAt, plan, e2ePubKey)
Book(id, title, author, hash, sourceFormat, storageUri, coverUri, addedAt)
BookLocal(id, localPath, bytes, lastOpenedAt)
Position(id, bookId, spineId, cfi_or_page, yOffset, updatedAt)
Highlight(id, bookId, spineId, anchorCFI, text, note, color, createdAt)

-- Learning components
Card(id, bookId, headword, lemma, sentence, translation, langPair, addedAt, srsState)
DictIndex(id, langPair, lemma, jsonEntry)
MTCache(id, langPair, modelId, sourceHash, targetText, createdAt)

-- System
Settings(theme, fontSize, lineHeight, ttsVoice, ttsRate, quickToggleMode)
Entitlement(userId, plan, expiresAt, platform, receiptRef)
SyncLog(id, entity, entityId, op, payloadHash, ts)
```

### Monetization & Subscriptions

#### Payment Integration
- **Mobile**: Native IAP (StoreKit 2/Play Billing v6) via RevenueCat
- **Web**: Stripe Checkout + Billing Portal
- **Trial**: 7-day free trial, then subscription required

#### Subscription Tiers
- **Free Trial**: Full access for 7 days
- **Pro**: Unlimited language packs, saved items, Anki export, sync
- **Future Org**: Classroom features

### Cross-Device Sync

#### Sync Strategy
- **Local-first**: Everything works offline
- **Encrypted sync**: E2E encryption for sensitive data
- **Conflict resolution**: Timestamp-based with user choice for conflicts
- **Synced data**: Library metadata, positions, highlights, saved words, settings

#### Sync Transport
```
Local changes → Change log → Encrypted payload → Supabase → Other devices
```

### Performance Targets
- App cold start: <2s
- Book opening: <1s
- Word lookup: <80ms
- Sentence translation: 100-300ms (modern devices), 400-800ms (older devices)
- Memory usage: <500MB peak
- Storage: Base app <50MB, single language pack ~250MB
- Model loading: <2s with pre-warming

### Privacy & Security
- Offline-first by design
- E2E encryption for sync data
- No analytics by default
- Clear DRM stance (no DRM support)
- Minimal cloud storage of user content

### Future Extensibility

#### LLM Translation Infrastructure
- Job queue system for full-book translation
- GPU/LLM API integration points
- Object storage for translated artifacts
- Pay-per-book pricing model

#### Language Pack Expansion
- Modular architecture supports easy addition
- Automated pipeline for new language pairs
- Community contribution framework

## Technical Decisions & Justifications

### Why React Native + Expo?
- Maximum code reuse across platforms
- Rapid development and deployment
- Strong ecosystem and community
- **Expo Bare workflow** for ML model integration
- Maintains most Expo benefits while enabling native modules

### Why Offline-First?
- Privacy and data control
- Works without internet
- Minimal ongoing costs
- Fast response times

### Why Supabase?
- Generous free tier
- Built-in auth and RLS
- Easy scaling path
- Minimal backend code needed

### Why Modular Language Packs?
- Keeps base app lightweight
- Users download only what they need
- Easier updates and maintenance
- Better storage management

## Cost Structure

### Development Costs
- Primary: Developer time
- Tools: Expo/Supabase free tiers
- Models: Open source Marian/Bergamot

### Operational Costs (at scale)
- Supabase: ~$25/month for 50k MAU
- Stripe: 2.9% + 30¢ per transaction
- RevenueCat: 1% of revenue (optional)
- CDN for language packs: ~$10-50/month

### Revenue Model
- Subscription: $4.99/month or $49.99/year
- Target: 1000 paying users = $60k ARR
- Break-even: ~200 paying users

## Risk Assessment

### Technical Risks (Updated Assessment)
- **Model performance on older devices** (mitigated by fast mode)
- Translation quality vs Google Translate expectations
- **WebView text interaction complexity** (mitigated by tap-only approach)
- File format compatibility issues

### Risk Mitigation Updates
- **Start with single language pair** to validate approach
- **Defer complex sync** until user base proven
- **Clear storage expectations** and easy pack management
- **Performance testing** on target device range

### Business Risks
- Competition from established players
- Copyright/legal issues with book formats
- User acquisition costs
- Platform policy changes (App Store/Play Store)

### Mitigation Strategies
- Extensive testing on target devices
- Clear legal positioning on DRM/copyright
- Focus on unique value proposition (offline + learning)
- Multiple platform distribution strategy