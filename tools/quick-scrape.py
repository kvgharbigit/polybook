#!/usr/bin/env python3
"""
Quick scraper for top 10 language dictionaries
Focuses on the most important pairs and tests them efficiently
"""

import requests
import json
import time

# Top 7 languages with their ISO codes
TOP_7_LANGUAGES = {
    'eng': 'English',
    'spa': 'Spanish', 
    'fra': 'French',
    'deu': 'German',
    'ita': 'Italian',
    'por': 'Portuguese',
    'rus': 'Russian'
}

def test_url(url, timeout=5):
    """Test if URL exists and get size"""
    try:
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        if response.status_code == 200:
            size = response.headers.get('content-length')
            return int(size) if size else None
        return None
    except:
        return None

def main():
    print("🚀 Quick Dictionary Discovery for Top 7 Languages")
    print("=" * 54)
    
    results = {
        'metadata': {
            'created': time.strftime('%Y-%m-%d %H:%M:%S UTC'),
            'languages_target': list(TOP_7_LANGUAGES.keys())
        },
        'freedict': {},
        'wiktionary': {},
        'bergamot': {},
        'summary': {}
    }
    
    # 1. Test key FreeDict pairs (known working from our validation)
    print("\n1️⃣ TESTING FREEDICT PAIRS")
    print("-" * 30)
    
    freedict_tests = [
        ('eng-spa', 'https://download.freedict.org/dictionaries/eng-spa/2024.10.10/freedict-eng-spa-2024.10.10.stardict.tar.xz'),
        ('spa-eng', 'https://download.freedict.org/dictionaries/spa-eng/0.3.1/freedict-spa-eng-0.3.1.stardict.tar.xz'),
        ('eng-fra', 'https://download.freedict.org/dictionaries/eng-fra/0.1.6/freedict-eng-fra-0.1.6.stardict.tar.xz'),
        ('fra-eng', 'https://download.freedict.org/dictionaries/fra-eng/0.4.1/freedict-fra-eng-0.4.1.stardict.tar.xz'),
        ('eng-deu', 'https://download.freedict.org/dictionaries/eng-deu/1.9-fd1/freedict-eng-deu-1.9-fd1.stardict.tar.xz'),
        ('deu-eng', 'https://download.freedict.org/dictionaries/deu-eng/1.9-fd1/freedict-deu-eng-1.9-fd1.stardict.tar.xz'),
        ('eng-rus', 'https://download.freedict.org/dictionaries/eng-rus/0.3/freedict-eng-rus-0.3.stardict.tar.xz'),
        ('rus-eng', 'https://download.freedict.org/dictionaries/rus-eng/0.2/freedict-rus-eng-0.2.stardict.tar.xz'),
        ('eng-ara', 'https://download.freedict.org/dictionaries/eng-ara/0.6.3/freedict-eng-ara-0.6.3.stardict.tar.xz'),
        ('ara-eng', 'https://download.freedict.org/dictionaries/ara-eng/0.6.3/freedict-ara-eng-0.6.3.stardict.tar.xz')
    ]
    
    for pair, url in freedict_tests:
        print(f"Testing {pair}...", end=' ')
        size = test_url(url)
        if size:
            size_mb = round(size / (1024 * 1024), 1)
            results['freedict'][pair] = {
                'url': url,
                'size_mb': size_mb,
                'status': 'verified'
            }
            print(f"✅ {size_mb}MB")
        else:
            print("❌")
    
    # 2. Test Wiktionary pairs (from Vuizur)
    print("\n2️⃣ TESTING WIKTIONARY PAIRS")
    print("-" * 30)
    
    wiktionary_tests = [
        ('eng-eng', 'https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/English-English%20Wiktionary%20dictionary%20stardict.tar.gz'),
        ('fra-eng', 'https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/French-English%20Wiktionary%20dictionary%20stardict.tar.gz'),
        ('deu-eng', 'https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/German-English%20Wiktionary%20dictionary%20stardict.tar.gz'),
        ('ita-eng', 'https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/Italian-English%20Wiktionary%20dictionary%20stardict.tar.gz'),
        ('por-eng', 'https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/Portuguese-English%20Wiktionary%20dictionary%20stardict.tar.gz'),
        ('rus-eng', 'https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/Russian-English%20Wiktionary%20dictionary%20stardict.tar.gz'),
        ('ara-eng', 'https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/Arabic-English%20Wiktionary%20dictionary%20stardict.tar.gz'),
        ('hin-eng', 'https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/Hindi-English%20Wiktionary%20dictionary%20stardict.tar.gz'),
        ('zho-eng', 'https://github.com/Vuizur/Wiktionary-Dictionaries/raw/master/Chinese-English%20Wiktionary%20dictionary%20stardict.tar.gz')
    ]
    
    for pair, url in wiktionary_tests:
        print(f"Testing {pair}...", end=' ')
        size = test_url(url)
        if size:
            size_mb = round(size / (1024 * 1024), 1)
            results['wiktionary'][pair] = {
                'url': url,
                'size_mb': size_mb,
                'status': 'verified'
            }
            print(f"✅ {size_mb}MB")
        else:
            print("❌")
    
    # 3. Test Bergamot models
    print("\n3️⃣ TESTING BERGAMOT MODELS")
    print("-" * 30)
    
    bergamot_tests = [
        ('en-es', 'https://data.statmt.org/bergamot/models/esen/enes.student.tiny11.v1.a7203a8f8e9daea8.tar.gz'),
        ('es-en', 'https://data.statmt.org/bergamot/models/esen/esen.student.tiny11.v1.09576f06d0ad805e.tar.gz'),
        ('en-fr', 'https://data.statmt.org/bergamot/models/fren/enfr.student.tiny11.v1.805d112122af03d0.tar.gz'),
        ('fr-en', 'https://data.statmt.org/bergamot/models/fren/fren.student.tiny11.v1.dccea16d03c0a389.tar.gz'),
        ('en-de', 'https://data.statmt.org/bergamot/models/deen/ende.student.tiny11.v2.93821e13b3c511b5.tar.gz'),
        ('de-en', 'https://data.statmt.org/bergamot/models/deen/deen.student.tiny11.v2.8ebe3e43b6bb6cce.tar.gz')
    ]
    
    for pair, url in bergamot_tests:
        print(f"Testing {pair}...", end=' ')
        size = test_url(url)
        if size:
            size_mb = round(size / (1024 * 1024), 1)
            results['bergamot'][pair] = {
                'url': url,
                'size_mb': size_mb,
                'status': 'verified'
            }
            print(f"✅ {size_mb}MB")
        else:
            print("❌")
    
    # 4. Generate summary
    print("\n4️⃣ GENERATING SUMMARY")
    print("-" * 25)
    
    # Calculate language coverage
    coverage = {}
    for lang_code, lang_name in TOP_7_LANGUAGES.items():
        dictionaries = 0
        translations = 0
        
        # Count dictionaries involving this language
        for source in ['freedict', 'wiktionary']:
            for pair in results[source].keys():
                if lang_code[:3] in pair or lang_code in pair:
                    dictionaries += 1
        
        # Count translation models involving this language
        for pair in results['bergamot'].keys():
            lang_codes = pair.replace('-', ' ').split()
            if lang_code[:2] in lang_codes or lang_code in lang_codes:
                translations += 1
        
        coverage[lang_code] = {
            'name': lang_name,
            'dictionaries': dictionaries,
            'translations': translations,
            'total': dictionaries + translations
        }
    
    results['summary'] = {
        'total_freedict': len(results['freedict']),
        'total_wiktionary': len(results['wiktionary']),
        'total_bergamot': len(results['bergamot']),
        'language_coverage': coverage
    }
    
    # Save results
    with open('quick-discovery-results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ DISCOVERY COMPLETE!")
    print(f"📊 RESULTS:")
    print(f"  - FreeDict dictionaries: {len(results['freedict'])}")
    print(f"  - Wiktionary dictionaries: {len(results['wiktionary'])}")
    print(f"  - Bergamot models: {len(results['bergamot'])}")
    
    print(f"\n🏆 LANGUAGE SUPPORT RANKING:")
    sorted_coverage = sorted(coverage.items(), key=lambda x: x[1]['total'], reverse=True)
    for lang_code, data in sorted_coverage:
        print(f"  {data['name']}: {data['total']} total ({data['dictionaries']} dicts, {data['translations']} models)")
    
    print(f"\n💾 Results saved to quick-discovery-results.json")

if __name__ == '__main__':
    main()