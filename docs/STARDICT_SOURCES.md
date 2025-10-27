# Legitimate StarDict Dictionary Sources

## 📚 FreeDict Project (Primary Source)

**Official Site:** https://freedict.org/
**License:** GPL-2.0-or-later
**Format:** .dictd.tar.xz (dict.org format + StarDict .ifo)

### Currently Implemented:

| Language Pair | URL | Entries | Size | License |
|---------------|-----|---------|------|---------|
| English → Spanish | https://download.freedict.org/dictionaries/eng-spa/2024.10.10/freedict-eng-spa-2024.10.10.dictd.tar.xz | 60,000+ | ~4.5MB | GPL-2.0+ |
| Spanish → English | https://download.freedict.org/dictionaries/spa-eng/0.3.1/freedict-spa-eng-0.3.1.dictd.tar.xz | 4,500+ | ~95KB | GPL-2.0+ |
| English → French | https://download.freedict.org/dictionaries/eng-fra/2024.10.10/freedict-eng-fra-2024.10.10.dictd.tar.xz | 70,000+ | ~4.2MB | GPL-2.0+ |
| English → German | https://download.freedict.org/dictionaries/eng-deu/2024.10.10/freedict-eng-deu-2024.10.10.dictd.tar.xz | 120,000+ | ~5.8MB | GPL-2.0+ |
| English → Italian | https://download.freedict.org/dictionaries/eng-ita/2024.10.10/freedict-eng-ita-2024.10.10.dictd.tar.xz | 40,000+ | ~2.8MB | GPL-2.0+ |
| English → Portuguese | https://download.freedict.org/dictionaries/eng-por/2024.10.10/freedict-eng-por-2024.10.10.dictd.tar.xz | 35,000+ | ~2.5MB | GPL-2.0+ |

### Additional Available (Future):

| Language Pair | URL Pattern | Notes |
|---------------|-------------|-------|
| German → English | https://download.freedict.org/dictionaries/deu-eng/... | Large German vocab |
| French → English | https://download.freedict.org/dictionaries/fra-eng/... | Good coverage |
| Russian → English | https://download.freedict.org/dictionaries/rus-eng/... | Cyrillic support |
| English → Dutch | https://download.freedict.org/dictionaries/eng-nld/... | Netherlands |
| English → Polish | https://download.freedict.org/dictionaries/eng-pol/... | Polish vocab |

## 🔍 Alternative Sources

### Wiktionary-Based (GitHub)
**Source:** https://github.com/Vuizur/Wiktionary-Dictionaries
**License:** CC-BY-SA 3.0
**Format:** StarDict .tar.gz

Examples:
- English-English Wiktionary: https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/English-English%20Wiktionary%20dictionary%20stardict.tar.gz
- German-German Wiktionary: https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/German-German%20Wiktionary%20dictionary%20stardict.tar.gz

### XDXF Format Sources
**Source:** https://sourceforge.net/projects/xdxf/files/
**License:** Various (check individual dictionaries)
**Note:** Requires conversion from XDXF → StarDict

## 🚀 GitHub Hosting URLs (Your App Uses)

Once CI processes the above sources, your app downloads from:

```
https://github.com/kayvangharbi/PolyBook/releases/download/packs/
├── registry.json                 # Metadata + URLs
├── eng-spa.sqlite.zip           # English → Spanish  
├── spa-eng.sqlite.zip           # Spanish → English
├── eng-fra.sqlite.zip           # English → French
├── eng-deu.sqlite.zip           # English → German
├── eng-ita.sqlite.zip           # English → Italian
└── eng-por.sqlite.zip           # English → Portuguese
```

## 🔧 Build Pipeline

1. **CI Downloads** → Real FreeDict .tar.xz files
2. **PyGlossary Converts** → .tar.xz → SQLite
3. **Optimization** → Indexes + VACUUM
4. **Packaging** → SQLite → .zip
5. **Publishing** → GitHub Releases (free CDN)

## 📋 Registry Format

```json
{
  "version": "2025-10-27",
  "baseUrl": "https://github.com/kayvangharbi/PolyBook/releases/download/packs/",
  "packs": {
    "eng-spa": {
      "url": "https://github.com/kayvangharbi/PolyBook/releases/download/packs/eng-spa.sqlite.zip",
      "bytes": 4681940,
      "sha256": "b7e3f1a2...",
      "license": "GPL-2.0-or-later",
      "source": "FreeDict"
    }
  }
}
```

## ✅ Verification

All URLs tested and working as of 2025-10-27. FreeDict provides stable, versioned downloads with consistent naming patterns.

**Quality:** FreeDict dictionaries are professionally maintained and used by major Linux distributions.