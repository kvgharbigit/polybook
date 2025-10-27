#!/usr/bin/env bash
set -euo pipefail

echo "🧪 Testing Unified Build Process for Top 7 Languages"
echo "====================================================="

# Test high-priority language pairs first
TEST_PAIRS=(
    "eng-spa"    # High priority - good FreeDict coverage
    "eng-deu"    # High priority - excellent FreeDict coverage  
    "eng-fra"    # Medium priority - Wiktionary better than tiny FreeDict
    "eng-ita"    # Medium priority - Wiktionary only option
)

# Create test output directory
TEST_DIR="test-build-output"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Make sure we have dependencies
echo "📦 Checking dependencies..."
if ! command -v pyglossary &> /dev/null; then
    echo "⚠️ PyGlossary not found. Installing..."
    pip3 install pyglossary
fi

# Test each priority pair
for pair in "${TEST_PAIRS[@]}"; do
    echo
    echo "🔧 Testing build: $pair"
    echo "========================"
    
    # Run unified build
    if ../build-unified-pack.sh "$pair"; then
        echo "✅ Build successful: $pair"
        
        # Check outputs
        if [[ -f "dist/packs/${pair}.sqlite.zip" && -f "dist/packs/${pair}.json" ]]; then
            # Get file size
            size=$(stat -f%z "dist/packs/${pair}.sqlite.zip" 2>/dev/null || stat -c%s "dist/packs/${pair}.sqlite.zip")
            size_mb=$(echo "scale=1; $size / 1024 / 1024" | bc -l)
            
            # Get entry count from metadata
            entries=$(jq -r '.entries' "dist/packs/${pair}.json")
            source=$(jq -r '.source' "dist/packs/${pair}.json")
            
            echo "📊 Result: ${size_mb}MB, ${entries} entries, source: ${source}"
            
            # Quick SQLite validation
            if command -v sqlite3 &> /dev/null; then
                unzip -q "dist/packs/${pair}.sqlite.zip"
                if sqlite3 "${pair}.sqlite" "SELECT COUNT(*) FROM dict;" > /dev/null 2>&1; then
                    actual_entries=$(sqlite3 "${pair}.sqlite" "SELECT COUNT(*) FROM dict;")
                    echo "✅ SQLite validation: ${actual_entries} entries accessible"
                    rm "${pair}.sqlite"
                else
                    echo "❌ SQLite validation failed"
                fi
            fi
        else
            echo "❌ Missing output files"
        fi
    else
        echo "❌ Build failed: $pair"
    fi
    
    echo "---"
done

echo
echo "📈 BUILD TEST SUMMARY"
echo "===================="

if [[ -d "dist/packs" ]]; then
    echo "📁 Generated packs:"
    for pack in dist/packs/*.zip; do
        if [[ -f "$pack" ]]; then
            basename "$pack"
            size=$(stat -f%z "$pack" 2>/dev/null || stat -c%s "$pack")
            echo "  Size: $(numfmt --to=iec $size)"
        fi
    done
    
    echo
    echo "📄 Metadata files:"
    for meta in dist/packs/*.json; do
        if [[ -f "$meta" ]]; then
            basename "$meta"
            echo "  Source: $(jq -r '.source' "$meta")"
            echo "  Entries: $(jq -r '.entries' "$meta")"
        fi
    done
else
    echo "❌ No output directory created"
fi

echo
echo "🎯 NEXT STEPS:"
echo "1. Review generated packs in $TEST_DIR/dist/packs/"
echo "2. Test dictionary loading in React Native app"
echo "3. Validate lookup functionality with sample words"

cd ..
echo "✅ Test complete! Check $TEST_DIR for results."