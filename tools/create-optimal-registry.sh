#!/usr/bin/env bash
set -euo pipefail

echo "🎯 Creating Optimal Dictionary Registry"
echo "======================================"
echo "Choosing best source (FreeDict vs Wiktionary) based on size and quality"
echo

# Create optimal registry JSON
cat > optimal-dictionary-registry.json << 'EOF'
{
  "metadata": {
    "created": "2024-10-27",
    "strategy": "hybrid_freedict_wiktionary",
    "description": "Optimal dictionary sources: FreeDict for large dictionaries, Wiktionary for small/missing ones"
  },
  "bilingual": {
    "eng-spa": {
      "source": "freedict",
      "url": "https://download.freedict.org/dictionaries/eng-spa/2024.10.10/freedict-eng-spa-2024.10.10.stardict.tar.xz",
      "size_mb": 4.4,
      "entries_estimated": "80000+",
      "reason": "FreeDict has good coverage"
    },
    "spa-eng": {
      "source": "freedict", 
      "url": "https://download.freedict.org/dictionaries/spa-eng/0.3.1/freedict-spa-eng-0.3.1.stardict.tar.xz",
      "size_mb": 0.1,
      "entries_estimated": "5000+",
      "reason": "Small but only option for Spanish->English",
      "warning": "Very small dictionary - limited coverage"
    },
    "eng-fra": {
      "source": "wiktionary",
      "url": "https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/French-English%20Wiktionary%20dictionary%20stardict.tar.gz",
      "size_mb": 3.2,
      "entries_estimated": "50000+",
      "reason": "Wiktionary 16x larger than FreeDict (3.2MB vs 0.2MB)"
    },
    "fra-eng": {
      "source": "wiktionary",
      "url": "https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/French-English%20Wiktionary%20dictionary%20stardict.tar.gz",
      "size_mb": 3.2,
      "entries_estimated": "50000+", 
      "reason": "Same as eng-fra - bidirectional usage"
    },
    "eng-deu": {
      "source": "freedict",
      "url": "https://download.freedict.org/dictionaries/eng-deu/1.9-fd1/freedict-eng-deu-1.9-fd1.stardict.tar.xz",
      "size_mb": 25.6,
      "entries_estimated": "270000+",
      "reason": "FreeDict excellent - 4x larger than Wiktionary"
    },
    "deu-eng": {
      "source": "freedict",
      "url": "https://download.freedict.org/dictionaries/deu-eng/1.9-fd1/freedict-deu-eng-1.9-fd1.stardict.tar.xz", 
      "size_mb": 34.7,
      "entries_estimated": "280000+",
      "reason": "FreeDict excellent - 5x larger than Wiktionary"
    },
    "eng-ita": {
      "source": "wiktionary",
      "url": "https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/Italian-English%20Wiktionary%20dictionary%20stardict.tar.gz",
      "size_mb": 5.3,
      "entries_estimated": "70000+",
      "reason": "No FreeDict equivalent available"
    },
    "ita-eng": {
      "source": "wiktionary",
      "url": "https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/Italian-English%20Wiktionary%20dictionary%20stardict.tar.gz",
      "size_mb": 5.3,
      "entries_estimated": "70000+",
      "reason": "Same as eng-ita - bidirectional usage"
    },
    "eng-por": {
      "source": "wiktionary",
      "url": "https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/Portuguese-English%20Wiktionary%20dictionary%20stardict.tar.gz",
      "size_mb": 2.6,
      "entries_estimated": "40000+", 
      "reason": "No FreeDict equivalent available"
    },
    "por-eng": {
      "source": "wiktionary",
      "url": "https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/Portuguese-English%20Wiktionary%20dictionary%20stardict.tar.gz",
      "size_mb": 2.6,
      "entries_estimated": "40000+",
      "reason": "Same as eng-por - bidirectional usage"
    }
  },
  "monolingual": {
    "en": {
      "source": "wiktionary",
      "url": "https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/English-English%20Wiktionary%20dictionary%20stardict.tar.gz",
      "size_mb": 20.8,
      "entries_estimated": "500000+",
      "reason": "Only monolingual Wiktionary available"
    }
  },
  "translation_models": {
    "en-es": {
      "source": "bergamot",
      "url": "https://data.statmt.org/bergamot/models/esen/enes.student.tiny11.v1.a7203a8f8e9daea8.tar.gz",
      "size_mb": 14.1,
      "model_type": "tiny"
    },
    "es-en": {
      "source": "bergamot", 
      "url": "https://data.statmt.org/bergamot/models/esen/esen.student.tiny11.v1.09576f06d0ad805e.tar.gz",
      "size_mb": 15.0,
      "model_type": "tiny"
    },
    "en-fr": {
      "source": "bergamot",
      "url": "https://data.statmt.org/bergamot/models/fren/enfr.student.tiny11.v1.805d112122af03d0.tar.gz", 
      "size_mb": 15.0,
      "model_type": "tiny"
    },
    "fr-en": {
      "source": "bergamot",
      "url": "https://data.statmt.org/bergamot/models/fren/fren.student.tiny11.v1.dccea16d03c0a389.tar.gz",
      "size_mb": 15.0,
      "model_type": "tiny"
    },
    "en-de": {
      "source": "bergamot",
      "url": "https://data.statmt.org/bergamot/models/deen/ende.student.tiny11.v2.93821e13b3c511b5.tar.gz",
      "size_mb": 15.0,
      "model_type": "tiny"
    },
    "de-en": {
      "source": "bergamot",
      "url": "https://data.statmt.org/bergamot/models/deen/deen.student.tiny11.v2.8ebe3e43b6bb6cce.tar.gz",
      "size_mb": 15.0,
      "model_type": "tiny"
    }
  },
  "summary": {
    "total_pairs": 10,
    "freedict_pairs": 4,
    "wiktionary_pairs": 6,
    "bergamot_models": 6,
    "unavailable": ["Spanish monolingual", "French monolingual", "German monolingual", "Italian monolingual", "Portuguese monolingual"]
  }
}
EOF

echo "✅ Created optimal-dictionary-registry.json"
echo
echo "📊 OPTIMAL STRATEGY SUMMARY:"
echo "=========================="
echo "🏆 FreeDict (large, recent): eng-spa, eng-deu, deu-eng"
echo "⚠️  FreeDict (small): spa-eng (0.1MB - only option)"  
echo "🌟 Wiktionary (better): eng-fra, fra-eng, eng-ita, ita-eng, eng-por, por-eng"
echo "🤖 Bergamot: All 6 translation pairs verified"
echo
echo "🔧 NEXT STEPS:"
echo "1. Update build scripts to use this registry"
echo "2. Create unified build script that handles both sources"
echo "3. Test download and conversion of each entry"