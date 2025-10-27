#!/usr/bin/env python3
"""
Bergamot Translation Model Scraper
Crawls available Bergamot translation models for top 10 languages
"""

import requests
import json
import re
import time

# Top 10 dominant languages (ISO 639-1 codes used by Bergamot)
TOP_LANGUAGES = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French', 
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'nl': 'Dutch',
    'pl': 'Polish',
    'tr': 'Turkish'
}

def get_translatelocally_models():
    """Get models from translateLocally registry"""
    try:
        print("📥 Fetching translateLocally model registry...")
        response = requests.get('https://translatelocally.com/models.json', timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"❌ Failed to fetch translateLocally models: {e}")
        return None

def get_opus_models():
    """Get models from OPUS-MT registry"""
    try:
        print("📥 Fetching OPUS-MT model registry...")
        response = requests.get('https://object.pouta.csc.fi/OPUS-MT-models/app/models.json', timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"❌ Failed to fetch OPUS-MT models: {e}")
        return None

def get_file_size(url):
    """Get file size without downloading"""
    try:
        response = requests.head(url, timeout=10, allow_redirects=True)
        if response.status_code == 200:
            content_length = response.headers.get('content-length')
            if content_length:
                return int(content_length)
        return None
    except:
        return None

def parse_translatelocally_models(models_data):
    """Parse translateLocally models for top languages"""
    if not models_data:
        return {}
    
    results = {}
    top_lang_codes = set(TOP_LANGUAGES.keys())
    
    for model in models_data:
        # Extract language codes from model name
        # Format examples: en-es-tiny, de-en-base, etc.
        if 'name' in model:
            name = model['name']
            
            # Parse direction (e.g., "en-es-tiny" -> "en", "es", "tiny")
            parts = name.split('-')
            if len(parts) >= 3:
                src_lang = parts[0]
                tgt_lang = parts[1]
                model_type = '-'.join(parts[2:])  # tiny, base, etc.
                
                # Check if both languages are in our top list
                if src_lang in top_lang_codes and tgt_lang in top_lang_codes:
                    pair_key = f"{src_lang}-{tgt_lang}"
                    
                    # Get file size if URL available
                    file_size = None
                    size_mb = None
                    if 'url' in model:
                        file_size = get_file_size(model['url'])
                        size_mb = round(file_size / (1024 * 1024), 1) if file_size else None
                    
                    results[pair_key] = {
                        'pair': pair_key,
                        'source_lang': {
                            'code': src_lang,
                            'name': TOP_LANGUAGES[src_lang]
                        },
                        'target_lang': {
                            'code': tgt_lang, 
                            'name': TOP_LANGUAGES[tgt_lang]
                        },
                        'source': 'translatelocally',
                        'model_type': model_type,
                        'name': name,
                        'url': model.get('url', ''),
                        'size_bytes': file_size,
                        'size_mb': size_mb,
                        'description': model.get('description', ''),
                        'license': model.get('license', '')
                    }
    
    return results

def discover_bergamot_patterns():
    """Discover Bergamot model URL patterns by testing common combinations"""
    print("🔍 Testing Bergamot URL patterns...")
    
    # Known working patterns from our previous validation
    base_urls = [
        'https://data.statmt.org/bergamot/models/',
        'https://github.com/mozilla/firefox-translations-models/releases/download/'
    ]
    
    results = {}
    
    # Test known working models first
    known_models = [
        ('en', 'es', 'enes.student.tiny11.v1.a7203a8f8e9daea8.tar.gz', 'esen'),
        ('es', 'en', 'esen.student.tiny11.v1.09576f06d0ad805e.tar.gz', 'esen'),
        ('en', 'fr', 'enfr.student.tiny11.v1.805d112122af03d0.tar.gz', 'fren'),
        ('fr', 'en', 'fren.student.tiny11.v1.dccea16d03c0a389.tar.gz', 'fren'),
        ('en', 'de', 'ende.student.tiny11.v2.93821e13b3c511b5.tar.gz', 'deen'),
        ('de', 'en', 'deen.student.tiny11.v2.8ebe3e43b6bb6cce.tar.gz', 'deen')
    ]
    
    for src_lang, tgt_lang, filename, model_dir in known_models:
        url = f"https://data.statmt.org/bergamot/models/{model_dir}/{filename}"
        
        print(f"🔍 Testing {src_lang}-{tgt_lang}...")
        file_size = get_file_size(url)
        
        if file_size:
            pair_key = f"{src_lang}-{tgt_lang}"
            size_mb = round(file_size / (1024 * 1024), 1)
            
            results[pair_key] = {
                'pair': pair_key,
                'source_lang': {
                    'code': src_lang,
                    'name': TOP_LANGUAGES[src_lang]
                },
                'target_lang': {
                    'code': tgt_lang,
                    'name': TOP_LANGUAGES[tgt_lang]
                },
                'source': 'bergamot_statmt',
                'model_type': 'tiny11',
                'url': url,
                'filename': filename,
                'size_bytes': file_size,
                'size_mb': size_mb
            }
            
            print(f"  ✅ {TOP_LANGUAGES[src_lang]} → {TOP_LANGUAGES[tgt_lang]}: {size_mb}MB")
        else:
            print(f"  ❌ Not available")
        
        time.sleep(0.5)
    
    return results

def main():
    print("🔍 Bergamot Translation Model Scraper")
    print("=" * 50)
    
    all_results = {}
    
    # 1. Get translateLocally models
    print("\n1️⃣ TRANSLATELOCALLY MODELS")
    print("-" * 30)
    translatelocally_data = get_translatelocally_models()
    translatelocally_results = parse_translatelocally_models(translatelocally_data)
    all_results.update(translatelocally_results)
    print(f"Found {len(translatelocally_results)} translateLocally models")
    
    # 2. Discover Bergamot patterns
    print("\n2️⃣ BERGAMOT STATMT MODELS")
    print("-" * 30)
    bergamot_results = discover_bergamot_patterns()
    
    # Merge results, preferring Bergamot direct URLs
    for key, value in bergamot_results.items():
        all_results[key] = value
    
    print(f"Found {len(bergamot_results)} Bergamot models")
    
    # Sort by size
    sorted_results = dict(sorted(all_results.items(), 
                                key=lambda x: x[1]['size_mb'] or 0, 
                                reverse=True))
    
    # Save results
    output = {
        'source': 'bergamot_combined',
        'scraped_at': time.strftime('%Y-%m-%d %H:%M:%S UTC'),
        'total_models_found': len(sorted_results),
        'language_pairs_covered': len(sorted_results),
        'translation_models': sorted_results
    }
    
    with open('bergamot-scraped.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Scraping complete!")
    print(f"📊 Found {len(sorted_results)} translation models")
    print(f"💾 Results saved to bergamot-scraped.json")
    
    # Print summary
    print(f"\n📈 AVAILABLE TRANSLATION MODELS:")
    for pair, data in sorted_results.items():
        size_str = f"{data['size_mb']}MB" if data['size_mb'] else "unknown"
        model_type = data.get('model_type', 'unknown')
        print(f"  {data['source_lang']['name']} → {data['target_lang']['name']} ({model_type}): {size_str}")
    
    # Coverage analysis
    print(f"\n🌍 LANGUAGE COVERAGE:")
    src_langs = set()
    tgt_langs = set()
    for data in sorted_results.values():
        src_langs.add(data['source_lang']['name'])
        tgt_langs.add(data['target_lang']['name'])
    
    print(f"  Source languages: {', '.join(sorted(src_langs))}")
    print(f"  Target languages: {', '.join(sorted(tgt_langs))}")

if __name__ == '__main__':
    main()