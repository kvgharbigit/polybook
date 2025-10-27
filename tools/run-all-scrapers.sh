#!/usr/bin/env bash
set -euo pipefail

echo "🕷️ Running All Dictionary Source Scrapers"
echo "========================================="
echo "Discovering dictionaries for top 10 dominant languages"
echo

# Make sure we have Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install requests beautifulsoup4 > /dev/null 2>&1 || {
    echo "⚠️ Failed to install dependencies. Continuing anyway..."
}

# Create output directory
mkdir -p scraped-data
cd scraped-data

echo
echo "1️⃣ SCRAPING FREEDICT DICTIONARIES"
echo "================================="
python3 ../scrape-freedict.py

echo
echo "2️⃣ SCRAPING WIKTIONARY DICTIONARIES" 
echo "===================================="
python3 ../scrape-wiktionary.py

echo
echo "3️⃣ SCRAPING BERGAMOT TRANSLATION MODELS"
echo "========================================"
python3 ../scrape-bergamot.py

echo
echo "4️⃣ CREATING UNIFIED REGISTRY"
echo "============================"

# Create a unified registry from all scraped data
python3 << 'EOF'
import json
import time
from collections import defaultdict

print("📊 Creating unified registry from scraped data...")

# Load all scraped data
try:
    with open('freedict-scraped.json', 'r') as f:
        freedict_data = json.load(f)
except:
    freedict_data = {'dictionaries': {}}

try:
    with open('wiktionary-scraped.json', 'r') as f:
        wiktionary_data = json.load(f)
except:
    wiktionary_data = {'dictionaries': {}}

try:
    with open('bergamot-scraped.json', 'r') as f:
        bergamot_data = json.load(f)
except:
    bergamot_data = {'translation_models': {}}

# Create unified registry
unified = {
    'metadata': {
        'created': time.strftime('%Y-%m-%d %H:%M:%S UTC'),
        'sources': ['freedict', 'wiktionary_vuizur', 'bergamot'],
        'strategy': 'top_10_languages_comprehensive'
    },
    'bilingual_dictionaries': {},
    'monolingual_dictionaries': {},
    'translation_models': {},
    'language_coverage': {},
    'recommendations': {}
}

# Process FreeDict data
print(f"📖 Processing {len(freedict_data.get('dictionaries', {}))} FreeDict dictionaries...")
for pair, data in freedict_data.get('dictionaries', {}).items():
    unified['bilingual_dictionaries'][pair] = {
        'source': 'freedict',
        'pair': pair,
        'url': data['url'],
        'size_mb': data.get('size_mb'),
        'language_1': data['lang1'],
        'language_2': data['lang2'],
        'version': data.get('version'),
        'quality_score': min(10, (data.get('size_mb', 0) / 5) + 5)  # Size-based quality
    }

# Process Wiktionary data  
print(f"📚 Processing {len(wiktionary_data.get('dictionaries', {}))} Wiktionary dictionaries...")
for pair, data in wiktionary_data.get('dictionaries', {}).items():
    if data['type'] == 'monolingual':
        unified['monolingual_dictionaries'][pair] = {
            'source': 'wiktionary_vuizur',
            'language': data['lang1']['code'],
            'url': data['url'],
            'size_mb': data.get('size_mb'),
            'quality_score': 9  # Wiktionary generally high quality
        }
    else:
        # For bilingual, prefer larger dictionaries
        existing = unified['bilingual_dictionaries'].get(pair)
        if not existing or (data.get('size_mb', 0) > existing.get('size_mb', 0)):
            unified['bilingual_dictionaries'][pair] = {
                'source': 'wiktionary_vuizur', 
                'pair': pair,
                'url': data['url'],
                'size_mb': data.get('size_mb'),
                'language_1': data['lang1'],
                'language_2': data['lang2'],
                'quality_score': min(10, (data.get('size_mb', 0) / 3) + 6)  # Wiktionary bonus
            }

# Process Bergamot data
print(f"🤖 Processing {len(bergamot_data.get('translation_models', {}))} Bergamot models...")
for pair, data in bergamot_data.get('translation_models', {}).items():
    unified['translation_models'][pair] = {
        'source': data['source'],
        'pair': pair,
        'url': data['url'],
        'size_mb': data.get('size_mb'),
        'model_type': data.get('model_type'),
        'source_language': data['source_lang'],
        'target_language': data['target_lang']
    }

# Calculate language coverage
print("🌍 Calculating language coverage...")
coverage = defaultdict(lambda: {'dictionaries': 0, 'translations': 0, 'total_pairs': []})

for pair in unified['bilingual_dictionaries'].keys():
    lang1, lang2 = pair.split('-')
    coverage[lang1]['dictionaries'] += 1
    coverage[lang1]['total_pairs'].append(pair)
    coverage[lang2]['dictionaries'] += 1  
    coverage[lang2]['total_pairs'].append(pair)

for pair in unified['translation_models'].keys():
    lang1, lang2 = pair.split('-')
    coverage[lang1]['translations'] += 1
    coverage[lang2]['translations'] += 1

unified['language_coverage'] = dict(coverage)

# Create recommendations
print("💡 Generating recommendations...")
recommendations = {}

for lang_code, data in coverage.items():
    score = data['dictionaries'] * 2 + data['translations']
    recommendations[lang_code] = {
        'support_level': 'excellent' if score >= 8 else 'good' if score >= 4 else 'limited',
        'dictionary_pairs': data['dictionaries'],
        'translation_pairs': data['translations'],
        'total_score': score
    }

unified['recommendations'] = recommendations

# Save unified registry
with open('unified-dictionary-registry.json', 'w', encoding='utf-8') as f:
    json.dump(unified, f, indent=2, ensure_ascii=False)

print(f"✅ Unified registry created!")
print(f"📊 Summary:")
print(f"  - Bilingual dictionaries: {len(unified['bilingual_dictionaries'])}")
print(f"  - Monolingual dictionaries: {len(unified['monolingual_dictionaries'])}")
print(f"  - Translation models: {len(unified['translation_models'])}")
print(f"  - Languages covered: {len(unified['language_coverage'])}")

# Print top recommendations
print(f"\n🏆 TOP LANGUAGE SUPPORT:")
sorted_recs = sorted(recommendations.items(), key=lambda x: x[1]['total_score'], reverse=True)[:10]
for lang, rec in sorted_recs:
    print(f"  {lang}: {rec['support_level']} ({rec['dictionary_pairs']} dicts, {rec['translation_pairs']} models)")

EOF

echo
echo "✅ ALL SCRAPERS COMPLETE!"
echo "========================"
echo "📁 Output files:"
echo "  - freedict-scraped.json"
echo "  - wiktionary-scraped.json" 
echo "  - bergamot-scraped.json"
echo "  - unified-dictionary-registry.json"
echo
echo "🎯 Next steps:"
echo "  1. Review unified-dictionary-registry.json"
echo "  2. Update build scripts with discovered URLs"
echo "  3. Test download and conversion of top dictionaries"