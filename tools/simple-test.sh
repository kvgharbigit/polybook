#!/usr/bin/env bash
set -euo pipefail

echo "🧪 Simple Build Test"
echo "==================="

# Test just downloading and extracting
URL="https://download.freedict.org/dictionaries/eng-spa/2024.10.10/freedict-eng-spa-2024.10.10.stardict.tar.xz"

echo "📥 Downloading..."
curl -L -o "test.tar.xz" "$URL"

echo "📂 Extracting..."
tar -xJf "test.tar.xz"

echo "🔍 Checking contents..."
find . -name "*.ifo" -o -name "*.idx*" -o -name "*.dict*"

echo "✅ Test complete"