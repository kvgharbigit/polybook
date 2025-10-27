#!/bin/bash

# Build Script: Convert FreeDict .tar.xz to SQLite.zip for mobile deployment
# Run this in CI/build environment, not on device

set -e

WORK_DIR="./dict-build"
OUTPUT_DIR="./public/dict-packs" # Serve from your CDN

echo "🔧 Building dictionary packs for mobile deployment..."

# Ensure directories exist
mkdir -p "$WORK_DIR" "$OUTPUT_DIR"
cd "$WORK_DIR"

# Function to process a FreeDict language pack
process_dict() {
    local lang_code="$1"
    local download_url="$2"
    local output_name="$3"
    
    echo "📦 Processing $lang_code dictionary..."
    
    # 1. Download FreeDict .tar.xz
    echo "  ⬇️  Downloading from FreeDict..."
    curl -LO "$download_url"
    
    # 2. Extract .tar.xz
    echo "  📂 Extracting archive..."
    local archive_name=$(basename "$download_url")
    tar -xJf "$archive_name"
    
    # 3. Find .dict, .idx, .ifo files
    local dict_dir=$(find . -name "*.ifo" | head -1 | xargs dirname)
    local base_name=$(find . -name "*.ifo" | head -1 | xargs basename -s .ifo)
    
    echo "  🔍 Found dictionary files: $base_name"
    
    # 4. Convert to SQLite using PyGlossary
    echo "  🔄 Converting to SQLite..."
    pyglossary \
        --read-format=stardict \
        --write-format=sqlite \
        "$dict_dir/$base_name" \
        "$output_name.sqlite"
    
    # 5. Optimize SQLite
    echo "  ⚡ Optimizing SQLite..."
    sqlite3 "$output_name.sqlite" "
        VACUUM;
        CREATE INDEX IF NOT EXISTS idx_word ON entries(word);
        CREATE INDEX IF NOT EXISTS idx_lemma ON entries(lemma);
        ANALYZE;
    "
    
    # 6. Zip the SQLite file
    echo "  📦 Creating ZIP package..."
    zip -9 "$OUTPUT_DIR/$output_name.sqlite.zip" "$output_name.sqlite"
    
    # 7. Report size
    local zip_size=$(stat -c%s "$OUTPUT_DIR/$output_name.sqlite.zip" 2>/dev/null || stat -f%z "$OUTPUT_DIR/$output_name.sqlite.zip")
    echo "  ✅ Created $output_name.sqlite.zip ($(numfmt --to=iec "$zip_size"))"
    
    # Clean up
    rm -f "$archive_name" "$output_name.sqlite"
    rm -rf "$dict_dir"
}

echo "🌍 Processing language packs..."

# English-Spanish
process_dict "en-es" \
    "https://download.freedict.org/dictionaries/eng-spa/2024.10.10/freedict-eng-spa-2024.10.10.stardict.tar.xz" \
    "en-dict"

# Spanish-English  
process_dict "es-en" \
    "https://download.freedict.org/dictionaries/spa-eng/0.3.1/freedict-spa-eng-0.3.1.stardict.tar.xz" \
    "es-dict"

# English-French
process_dict "en-fr" \
    "https://download.freedict.org/dictionaries/eng-fra/2024.10.10/freedict-eng-fra-2024.10.10.stardict.tar.xz" \
    "fr-dict"

# English-German
process_dict "en-de" \
    "https://download.freedict.org/dictionaries/eng-deu/2024.10.10/freedict-eng-deu-2024.10.10.stardict.tar.xz" \
    "de-dict"

cd ..
rm -rf "$WORK_DIR"

echo "✅ Dictionary pack build complete!"
echo "📁 Packages are in: $OUTPUT_DIR"
echo "🌐 Upload these to your CDN and update the URLs in starDictProcessor.ts"

# List final packages
echo ""
echo "📦 Final packages:"
ls -lh "$OUTPUT_DIR"/*.zip | awk '{print "  " $9 " (" $5 ")"}'