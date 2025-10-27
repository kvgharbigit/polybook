#!/usr/bin/env python3
"""
FreeDict Dictionary Scraper
Crawls freedict.org to find all available StarDict dictionaries
Focuses on top 10 dominant languages + English pairs
"""

import requests
import json
import re
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import time

# Top 10 dominant languages by speakers + usage
TOP_LANGUAGES = {
    'eng': 'English',
    'spa': 'Spanish', 
    'fra': 'French',
    'deu': 'German',
    'ita': 'Italian',
    'por': 'Portuguese',
    'rus': 'Russian',
    'ara': 'Arabic',
    'hin': 'Hindi',
    'zho': 'Chinese (Mandarin)',
    'jpn': 'Japanese'
}

def get_freedict_database():
    """Fetch the official FreeDict database JSON"""
    try:
        print("📥 Fetching FreeDict database...")
        response = requests.get('https://freedict.org/freedict-database.json', timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"❌ Failed to fetch FreeDict database: {e}")
        return None

def scrape_freedict_directory():
    """Scrape the FreeDict downloads directory for available language pairs"""
    try:
        print("🕷️ Scraping FreeDict directory...")
        response = requests.get('https://download.freedict.org/dictionaries/', timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        pairs = []
        
        # Find all directory links that look like language pairs
        for link in soup.find_all('a', href=True):
            href = link['href']
            if re.match(r'^[a-z]{3}-[a-z]{3}/$', href):
                pair = href.rstrip('/')
                pairs.append(pair)
        
        return sorted(pairs)
    except Exception as e:
        print(f"❌ Failed to scrape FreeDict directory: {e}")
        return []

def get_pair_details(pair):
    """Get details for a specific language pair"""
    try:
        # Get available versions
        response = requests.get(f'https://download.freedict.org/dictionaries/{pair}/', timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        versions = []
        
        for link in soup.find_all('a', href=True):
            href = link['href']
            # Match version directories (numbers, dots, hyphens)
            if re.match(r'^[\d\.-]+[a-z]*[\d]*/$', href):
                versions.append(href.rstrip('/'))
        
        if not versions:
            return None
            
        # Get latest version
        latest_version = sorted(versions, key=lambda x: [int(i) if i.isdigit() else i for i in re.split(r'(\d+)', x)])[-1]
        
        # Check for StarDict format in latest version
        version_url = f'https://download.freedict.org/dictionaries/{pair}/{latest_version}/'
        response = requests.get(version_url, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        stardict_file = None
        file_size = None
        
        for row in soup.find_all('tr'):
            cells = row.find_all('td')
            if len(cells) >= 4:
                filename = cells[1].get_text().strip()
                if filename.endswith('.stardict.tar.xz'):
                    stardict_file = filename
                    size_text = cells[3].get_text().strip()
                    # Parse size (e.g., "4.3M", "125K", "1.2G")
                    if size_text and size_text not in ['-', '']:
                        try:
                            if 'M' in size_text:
                                file_size = float(size_text.replace('M', '')) * 1024 * 1024
                            elif 'K' in size_text:
                                file_size = float(size_text.replace('K', '')) * 1024
                            elif 'G' in size_text:
                                file_size = float(size_text.replace('G', '')) * 1024 * 1024 * 1024
                        except:
                            pass
                    break
        
        if stardict_file:
            return {
                'version': latest_version,
                'filename': stardict_file,
                'url': f'https://download.freedict.org/dictionaries/{pair}/{latest_version}/{stardict_file}',
                'size_bytes': file_size,
                'size_mb': round(file_size / (1024 * 1024), 1) if file_size else None
            }
        
        return None
        
    except Exception as e:
        print(f"⚠️ Failed to get details for {pair}: {e}")
        return None

def main():
    print("🔍 FreeDict Dictionary Scraper")
    print("=" * 50)
    
    # Get all available pairs
    all_pairs = scrape_freedict_directory()
    print(f"📋 Found {len(all_pairs)} total language pairs")
    
    # Filter for pairs involving our top languages
    top_language_codes = set(TOP_LANGUAGES.keys())
    relevant_pairs = []
    
    for pair in all_pairs:
        lang1, lang2 = pair.split('-')
        if lang1 in top_language_codes or lang2 in top_language_codes:
            relevant_pairs.append(pair)
    
    print(f"🎯 Found {len(relevant_pairs)} pairs involving top 10 languages")
    
    # Get details for each relevant pair
    results = {}
    
    for i, pair in enumerate(relevant_pairs, 1):
        print(f"🔍 [{i}/{len(relevant_pairs)}] Checking {pair}...")
        details = get_pair_details(pair)
        
        if details:
            lang1, lang2 = pair.split('-')
            lang1_name = TOP_LANGUAGES.get(lang1, lang1)
            lang2_name = TOP_LANGUAGES.get(lang2, lang2)
            
            results[pair] = {
                'pair': pair,
                'lang1': {'code': lang1, 'name': lang1_name},
                'lang2': {'code': lang2, 'name': lang2_name},
                'source': 'freedict',
                **details
            }
            
            size_str = f" ({details['size_mb']}MB)" if details['size_mb'] else ""
            print(f"  ✅ {lang1_name} ↔ {lang2_name}{size_str}")
        else:
            print(f"  ❌ No StarDict format available")
        
        # Rate limiting
        time.sleep(0.5)
    
    # Sort by size (largest first)
    sorted_results = dict(sorted(results.items(), 
                                key=lambda x: x[1]['size_mb'] or 0, 
                                reverse=True))
    
    # Save results
    output = {
        'source': 'freedict',
        'scraped_at': time.strftime('%Y-%m-%d %H:%M:%S UTC'),
        'total_pairs_found': len(sorted_results),
        'languages_covered': list(set([pair.split('-')[0] for pair in sorted_results.keys()] + 
                                    [pair.split('-')[1] for pair in sorted_results.keys()])),
        'dictionaries': sorted_results
    }
    
    with open('freedict-scraped.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Scraping complete!")
    print(f"📊 Found {len(sorted_results)} usable dictionaries")
    print(f"💾 Results saved to freedict-scraped.json")
    
    # Print summary
    print(f"\n📈 TOP DICTIONARIES BY SIZE:")
    for pair, data in list(sorted_results.items())[:10]:
        size_str = f"{data['size_mb']}MB" if data['size_mb'] else "unknown"
        print(f"  {data['lang1']['name']} ↔ {data['lang2']['name']}: {size_str}")

if __name__ == '__main__':
    main()