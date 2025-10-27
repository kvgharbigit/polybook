#!/usr/bin/env bash
set -euo pipefail

PAIR="${1:?usage: build-pack.sh eng-spa|spa-eng|...}"
DATE="${2:-2024.10.10}"  # FreeDict date
OUT_DIR="dist/packs"
mkdir -p "$OUT_DIR"

echo "🔧 Building dictionary pack: $PAIR"

# 1) Download FreeDict (bilingual) 
echo "📥 Downloading FreeDict $PAIR..."

# FreeDict URLs (VERIFIED WORKING - tested 2024-10-27)
case "$PAIR" in
  "eng-spa")
    FREEDICT_URL="https://download.freedict.org/dictionaries/eng-spa/2024.10.10/freedict-eng-spa-2024.10.10.stardict.tar.xz"
    EXPECTED_SIZE="4.4MB"
    ;;
  "spa-eng") 
    FREEDICT_URL="https://download.freedict.org/dictionaries/spa-eng/0.3.1/freedict-spa-eng-0.3.1.stardict.tar.xz"
    EXPECTED_SIZE="0.1MB (small dictionary)"
    ;;
  "eng-fra")
    FREEDICT_URL="https://download.freedict.org/dictionaries/eng-fra/0.1.6/freedict-eng-fra-0.1.6.stardict.tar.xz"
    EXPECTED_SIZE="0.2MB (small dictionary)"
    ;;
  "fra-eng")
    FREEDICT_URL="https://download.freedict.org/dictionaries/fra-eng/0.4.1/freedict-fra-eng-0.4.1.stardict.tar.xz"
    EXPECTED_SIZE="0.2MB (small dictionary)"
    ;;
  "eng-deu")
    FREEDICT_URL="https://download.freedict.org/dictionaries/eng-deu/1.9-fd1/freedict-eng-deu-1.9-fd1.stardict.tar.xz"
    EXPECTED_SIZE="25.6MB"
    ;;
  "deu-eng")
    FREEDICT_URL="https://download.freedict.org/dictionaries/deu-eng/1.9-fd1/freedict-deu-eng-1.9-fd1.stardict.tar.xz"
    EXPECTED_SIZE="34.7MB"
    ;;
  *)
    echo "❌ Unknown language pair: $PAIR"
    echo "✅ VERIFIED pairs: eng-spa, spa-eng, eng-fra, fra-eng, eng-deu, deu-eng"
    echo "❌ NOT AVAILABLE: eng-ita, eng-por (no verified URLs found)"
    exit 1
    ;;
esac

echo "📡 Source: $FREEDICT_URL ($EXPECTED_SIZE)"
curl -L -o "${PAIR}.tar.xz" "$FREEDICT_URL"

# Extract based on archive type
if [[ "$FREEDICT_URL" == *".tar.xz" ]]; then
    tar -xJf "${PAIR}.tar.xz"
elif [[ "$FREEDICT_URL" == *".tar.gz" ]]; then
    tar -xzf "${PAIR}.tar.gz"
else
    echo "❌ Unknown archive format"
    exit 1
fi

# 2) Convert to SQLite (PyGlossary)
echo "🔄 Converting to SQLite..."
INDEX=$(ls *.index 2>/dev/null || true)
IFO=$(ls *.ifo 2>/dev/null || true)
DICT_DIR=$(find . -name "*.ifo" | head -1 | xargs dirname)
DICT_BASE=$(find . -name "*.ifo" | head -1 | xargs basename -s .ifo)

if [[ -n "$INDEX" ]]; then
  echo "  Using dict_org format (.index file)"
  pyglossary --read-format=dict_org --write-format=sqlite "$INDEX" "${PAIR}.sqlite"
elif [[ -n "$IFO" ]]; then
  echo "  Using stardict format (.ifo file)"
  pyglossary --read-format=stardict --write-format=sqlite "${DICT_DIR}/${DICT_BASE}" "${PAIR}.sqlite"
else
  echo "❌ No dict_org or stardict input found"; exit 1
fi

# 3) Normalize / prune / index
echo "⚡ Optimizing SQLite..."
sqlite3 "${PAIR}.sqlite" <<'SQL'
PRAGMA journal_mode=OFF;
PRAGMA synchronous=OFF;
CREATE INDEX IF NOT EXISTS idx_lemma ON dict(lemma);
CREATE INDEX IF NOT EXISTS idx_word ON dict(word);
VACUUM;
ANALYZE;
SQL

# 4) Zip for app delivery
echo "📦 Creating final package..."
zip -9 "${OUT_DIR}/${PAIR}.sqlite.zip" "${PAIR}.sqlite"

# 5) Output metadata
bytes=$(stat -f%z "${OUT_DIR}/${PAIR}.sqlite.zip" 2>/dev/null || stat -c%s "${OUT_DIR}/${PAIR}.sqlite.zip")
sha=$(shasum -a 256 "${OUT_DIR}/${PAIR}.sqlite.zip" | awk '{print $1}')
echo "{\"id\":\"${PAIR}\",\"bytes\":${bytes},\"sha256\":\"${sha}\"}" > "${OUT_DIR}/${PAIR}.json"

echo "✅ Built: ${OUT_DIR}/${PAIR}.sqlite.zip ($(numfmt --to=iec $bytes))"
echo "📄 Metadata: ${OUT_DIR}/${PAIR}.json"

# Cleanup
rm -f "${PAIR}.tar.xz" "${PAIR}.sqlite"
rm -rf "$DICT_DIR" 2>/dev/null || true

echo "🎯 Pack ready for upload to GitHub!"