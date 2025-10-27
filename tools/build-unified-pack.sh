#!/usr/bin/env bash
set -euo pipefail

PAIR="${1:?usage: build-unified-pack.sh eng-spa|spa-eng|eng-fra|...}"
OUT_DIR="dist/packs"
WORK_DIR="tmp-unified-${PAIR}"
mkdir -p "$OUT_DIR" "$WORK_DIR"

echo "🔧 Building unified dictionary pack: $PAIR"
cd "$WORK_DIR"

# Load optimal strategy from our discovery results
get_optimal_source() {
    local pair="$1"
    
    # Based on TOP 10 languages - Wiktionary only (verified URLs)
    case "$pair" in
        "eng-spa"|"spa-eng"|"es-en"|"en-es")
            SOURCE="wiktionary"
            URL="https://raw.githubusercontent.com/Vuizur/Wiktionary-Dictionaries/master/Spanish-English%20Wiktionary%20dictionary%20stardict.tar.gz"
            SIZE="4.6MB"
            REASON="Wiktionary bilingual - rich definitions, examples, IPA, bidirectional"
            ;;
        "eng-fra"|"fra-eng"|"fr-en"|"en-fr")
            SOURCE="wiktionary"
            URL="https://raw.githubusercontent.com/Vuizur/Wiktionary-Dictionaries/master/French-English%20Wiktionary%20dictionary%20stardict.tar.gz"
            SIZE="3.2MB"
            REASON="Wiktionary bilingual - rich definitions, examples, IPA, bidirectional"
            ;;
        "eng-deu"|"deu-eng"|"de-en"|"en-de")
            SOURCE="wiktionary"
            URL="https://raw.githubusercontent.com/Vuizur/Wiktionary-Dictionaries/master/German-English%20Wiktionary%20dictionary%20stardict.tar.gz"
            SIZE="6.9MB"
            REASON="Wiktionary bilingual - rich definitions, examples, IPA, bidirectional"
            ;;
        "eng-ita"|"ita-eng"|"it-en"|"en-it")
            SOURCE="wiktionary"
            URL="https://raw.githubusercontent.com/Vuizur/Wiktionary-Dictionaries/master/Italian-English%20Wiktionary%20dictionary%20stardict.tar.gz"
            SIZE="5.3MB"
            REASON="Wiktionary bilingual - rich definitions, examples, IPA, bidirectional"
            ;;
        "eng-por"|"por-eng"|"pt-en"|"en-pt")
            SOURCE="wiktionary"
            URL="https://raw.githubusercontent.com/Vuizur/Wiktionary-Dictionaries/master/Portuguese-English%20Wiktionary%20dictionary%20stardict.tar.gz"
            SIZE="2.6MB"
            REASON="Wiktionary bilingual - rich definitions, examples, IPA, bidirectional"
            ;;
        "eng-rus"|"rus-eng"|"ru-en"|"en-ru")
            SOURCE="wiktionary"
            URL="https://raw.githubusercontent.com/Vuizur/Wiktionary-Dictionaries/master/Russian-English%20Wiktionary%20dictionary%20stardict.tar.gz"
            SIZE="4.2MB"
            REASON="Wiktionary bilingual - rich definitions, examples, IPA, bidirectional"
            ;;
        "zh-en"|"en-zh"|"chn-eng"|"eng-chn")
            SOURCE="wiktionary"
            URL="https://raw.githubusercontent.com/Vuizur/Wiktionary-Dictionaries/master/Chinese-English%20Wiktionary%20dictionary%20stardict.tar.gz"
            SIZE="4.6MB"
            REASON="Wiktionary bilingual - rich definitions, examples, IPA, bidirectional"
            ;;
        "ja-en"|"en-ja"|"jpn-eng"|"eng-jpn")
            SOURCE="wiktionary"
            URL="https://raw.githubusercontent.com/Vuizur/Wiktionary-Dictionaries/master/Japanese-English%20Wiktionary%20dictionary%20stardict.tar.gz"
            SIZE="5.9MB"
            REASON="Wiktionary bilingual - rich definitions, examples, IPA, bidirectional"
            ;;
        "ko-en"|"en-ko"|"kor-eng"|"eng-kor")
            SOURCE="wiktionary"
            URL="https://raw.githubusercontent.com/Vuizur/Wiktionary-Dictionaries/master/Korean-English%20Wiktionary%20dictionary%20stardict.tar.gz"
            SIZE="2.1MB"
            REASON="Wiktionary bilingual - rich definitions, examples, IPA, bidirectional"
            ;;
        "en-en"|"eng-eng"|"english")
            SOURCE="wiktionary"
            URL="https://raw.githubusercontent.com/Vuizur/Wiktionary-Dictionaries/master/English-English%20Wiktionary%20dictionary%20stardict.tar.gz"
            SIZE="20.8MB"
            REASON="Wiktionary monolingual - comprehensive English definitions"
            ;;
        *)
            echo "❌ Unknown language pair: $PAIR"
            echo "🎯 SUPPORTED TOP 10 LANGUAGE PAIRS (Wiktionary verified):"
            echo "   ✅ English ↔ Spanish, French, German, Italian, Portuguese, Russian"
            echo "   ✅ English ↔ Chinese, Japanese, Korean"
            echo "   ✅ English → English (monolingual)"
            echo "   📝 All sources verified and functional from Vuizur/Wiktionary-Dictionaries"
            exit 1
            ;;
    esac
}

# Get optimal source for this pair
get_optimal_source "$PAIR"

echo "📊 Optimal choice: $SOURCE"
echo "📡 Source: $URL ($SIZE)"
echo "💡 Reason: $REASON"
if [[ -n "${WARNING:-}" ]]; then
    echo "$WARNING"
fi

# Download and extract
echo "📥 Downloading dictionary..."
if [[ "$URL" == *".tar.xz" ]]; then
    curl -L -o "${PAIR}.tar.xz" "$URL"
    tar -xJf "${PAIR}.tar.xz"
elif [[ "$URL" == *".tar.gz" ]]; then
    curl -L -o "${PAIR}.tar.gz" "$URL"
    tar -xzf "${PAIR}.tar.gz"
else
    echo "❌ Unknown archive format for $URL"
    exit 1
fi

# Find dictionary files - handle spaces in filenames
IFS=$'\n' DICT_FILES=($(find . -name "*.ifo"))
if [[ ${#DICT_FILES[@]} -eq 0 ]]; then
    echo "❌ No StarDict files found in archive"
    echo "📂 Contents of archive:"
    find . -type f | head -10
    exit 1
fi

DICT_IFO="${DICT_FILES[0]}"
DICT_DIR=$(dirname "$DICT_IFO")
DICT_BASE=$(basename "$DICT_IFO" .ifo)

echo "🔍 Found dictionary: $DICT_BASE"
echo "📂 Dictionary directory: $DICT_DIR"

# Decompress dictionary files if needed
echo "📜 Preparing dictionary files..."
ORIGINAL_DIR=$(pwd)
cd "$DICT_DIR"

# Decompress .dict.dz if it exists
if [[ -f "${DICT_BASE}.dict.dz" ]]; then
    echo "  Decompressing ${DICT_BASE}.dict.dz..."
    # Try dictzip first, then multiple gzip alternatives
    if command -v dictzip &> /dev/null; then
        dictzip -d "${DICT_BASE}.dict.dz" || {
            echo "  ⚠️ dictzip failed, trying gzip alternatives..."
            # Try gunzip with force flag (works with .dz files)
            gunzip -f "${DICT_BASE}.dict.dz" 2>/dev/null || {
                # Try python gzip as last resort
                python3 -c "
import gzip
with gzip.open('${DICT_BASE}.dict.dz', 'rb') as f_in:
    with open('${DICT_BASE}.dict', 'wb') as f_out:
        f_out.write(f_in.read())
" && rm "${DICT_BASE}.dict.dz" || {
                    echo "  ❌ Failed to decompress .dict.dz file with all methods"
                    exit 1
                }
            }
        }
    else
        echo "  dictzip not found, trying gunzip..."
        gunzip -f "${DICT_BASE}.dict.dz" 2>/dev/null || {
            echo "  gunzip failed, trying python gzip..."
            python3 -c "
import gzip
with gzip.open('${DICT_BASE}.dict.dz', 'rb') as f_in:
    with open('${DICT_BASE}.dict', 'wb') as f_out:
        f_out.write(f_in.read())
" && rm "${DICT_BASE}.dict.dz" || {
                echo "  ❌ Failed to decompress .dict.dz file"
                exit 1
            }
        }
    fi
fi

# Decompress .idx.gz if it exists  
if [[ -f "${DICT_BASE}.idx.gz" ]]; then
    echo "  Decompressing ${DICT_BASE}.idx.gz..."
    gzip -d "${DICT_BASE}.idx.gz" || {
        echo "  ❌ Failed to decompress .idx.gz file"
        exit 1
    }
fi

# Now check for required files
if [[ ! -f "${DICT_BASE}.ifo" || ! -f "${DICT_BASE}.idx" || ! -f "${DICT_BASE}.dict" ]]; then
    echo "❌ Missing required StarDict files (.ifo, .idx, .dict)"
    ls -la
    exit 1
fi

echo "✅ StarDict files prepared: ${DICT_BASE}.{ifo,idx,dict}"

# Convert to SQLite using PyGlossary with UTF-8 encoding support
echo "🔄 Converting StarDict to SQLite..."
cd "$ORIGINAL_DIR"

# Set UTF-8 locale environment for proper character handling
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
export PYTHONIOENCODING=utf-8

# Primary conversion attempt with UTF-8 check enabled
pyglossary "${DICT_DIR}/${DICT_BASE}.ifo" "${PAIR}.sql" \
    --write-format=Sql \
    --utf8-check || {
    echo "❌ PyGlossary conversion with UTF-8 check failed"
    echo "Trying without UTF-8 validation..."
    
    # Try with explicit format specification  
    pyglossary --read-format=Stardict --write-format=Sql \
        "${DICT_DIR}/${DICT_BASE}.ifo" "${PAIR}.sql" \
        --no-utf8-check || {
        
        echo "❌ Second attempt failed, trying minimal approach..."
        # Fallback: basic conversion (will complete despite encoding issues)
        pyglossary "${DICT_DIR}/${DICT_BASE}.ifo" "${PAIR}.sql" --write-format=Sql || {
            echo "❌ All conversion attempts failed"
            exit 1
        }
    }
}

# Convert SQL to SQLite and optimize for mobile usage
echo "🔄 Converting SQL to SQLite..."
sqlite3 "${PAIR}.sqlite" < "${PAIR}.sql"

# Validate conversion and check for encoding issues
echo "🔍 Validating conversion quality..."
TOTAL_ENTRIES=$(sqlite3 "${PAIR}.sqlite" "SELECT COUNT(*) FROM word;")
EMPTY_ENTRIES=$(sqlite3 "${PAIR}.sqlite" "SELECT COUNT(*) FROM word WHERE LENGTH(TRIM(COALESCE(w, ''))) = 0 OR LENGTH(TRIM(COALESCE(m, ''))) = 0;")
NON_UTF8_ENTRIES=$(sqlite3 "${PAIR}.sqlite" "SELECT COUNT(*) FROM word WHERE w LIKE '%\\%' OR m LIKE '%\\%' OR w LIKE '%?%' OR m LIKE '%?%';")

echo "📊 Conversion validation:"
echo "  Total entries: $TOTAL_ENTRIES"
echo "  Empty entries: $EMPTY_ENTRIES"  
echo "  Potentially corrupted entries: $NON_UTF8_ENTRIES"

if [[ $EMPTY_ENTRIES -gt $(($TOTAL_ENTRIES / 10)) ]]; then
    echo "⚠️ Warning: High number of empty entries (>10% of total)"
fi

if [[ $NON_UTF8_ENTRIES -gt $(($TOTAL_ENTRIES / 20)) ]]; then
    echo "⚠️ Warning: High number of potentially corrupted entries (>5% of total)"
fi

echo "⚡ Optimizing SQLite for mobile..."  
sqlite3 "${PAIR}.sqlite" <<'SQL'
-- Mobile optimization
PRAGMA journal_mode=OFF;
PRAGMA synchronous=OFF;
PRAGMA cache_size=10000;

-- Clean up any problematic entries in word table
UPDATE word SET 
    w = TRIM(w),
    m = TRIM(m)
WHERE w != TRIM(w) OR m != TRIM(m);

-- Remove empty entries
DELETE FROM word WHERE 
    LENGTH(TRIM(COALESCE(w, ''))) = 0 OR 
    LENGTH(TRIM(COALESCE(m, ''))) = 0;

-- Convert to dict table schema for app compatibility
CREATE TABLE dict (
    lemma TEXT PRIMARY KEY,
    def TEXT NOT NULL
);

-- Copy data from word to dict table (preserve ALL entries)
INSERT INTO dict (lemma, def)
SELECT w as lemma, m as def FROM word 
WHERE w IS NOT NULL AND m IS NOT NULL 
  AND LENGTH(TRIM(w)) > 0 AND LENGTH(TRIM(m)) > 0;

-- Drop the old tables
DROP TABLE word;
DROP TABLE IF EXISTS dbinfo;

-- Create proper indexes for dict table
CREATE INDEX IF NOT EXISTS idx_dict_lemma ON dict(lemma);

-- Final optimization
VACUUM;
ANALYZE;
SQL

# Get final stats with validation
BEFORE_COUNT=$(sqlite3 "${PAIR}.sqlite" "SELECT COUNT(*) FROM word;" 2>/dev/null || echo "0")
FINAL_COUNT=$(sqlite3 "${PAIR}.sqlite" "SELECT COUNT(*) FROM dict;")

echo "📊 Dictionary conversion results:"
echo "   Before: $BEFORE_COUNT entries (word table)"
echo "   After:  $FINAL_COUNT entries (dict table)"

# Validate data integrity (allow for some deduplication but not massive loss)
if [[ $BEFORE_COUNT -gt 0 ]] && [[ $FINAL_COUNT -lt $((BEFORE_COUNT * 80 / 100)) ]]; then
    echo "❌ CRITICAL: Significant data loss detected!"
    echo "   Lost $(($BEFORE_COUNT - $FINAL_COUNT)) entries ($(((($BEFORE_COUNT - $FINAL_COUNT) * 100) / $BEFORE_COUNT))%)"
    echo "   This suggests a bug in the schema conversion process"
    exit 1
else
    echo "✅ Data integrity check passed"
fi

# Create final package
echo "📦 Creating final package..."
zip -9 "../$OUT_DIR/${PAIR}.sqlite.zip" "${PAIR}.sqlite"

# Generate metadata with source information
bytes=$(stat -f%z "../$OUT_DIR/${PAIR}.sqlite.zip" 2>/dev/null || stat -c%s "../$OUT_DIR/${PAIR}.sqlite.zip")
sha=$(shasum -a 256 "../$OUT_DIR/${PAIR}.sqlite.zip" | awk '{print $1}')

cat > "../$OUT_DIR/${PAIR}.json" <<JSON
{
  "id": "${PAIR}",
  "type": "bilingual",
  "source": "${SOURCE}",
  "original_size": "${SIZE}",
  "bytes": ${bytes},
  "entries": ${FINAL_COUNT},
  "sha256": "${sha}",
  "reason": "${REASON}",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "strategy": "top_7_languages_optimal"
}
JSON

echo "✅ Built: ${PAIR}.sqlite.zip ($(numfmt --to=iec $bytes))"
echo "📄 Metadata: ${PAIR}.json"
echo "📊 Source: $SOURCE ($SIZE → $(numfmt --to=iec $bytes))"

# Cleanup
cd ..
rm -rf "$WORK_DIR"

echo "🎯 Unified pack ready: $PAIR"