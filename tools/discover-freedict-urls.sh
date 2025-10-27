#!/usr/bin/env bash
set -euo pipefail

echo "🔍 Discovering FreeDict StarDict URLs"
echo "====================================="

# Function to get latest version and test URL
discover_pair() {
    local pair="$1"
    echo -n "Checking $pair: "
    
    # Get latest version directory
    if latest_version=$(curl -s "https://download.freedict.org/dictionaries/$pair/" | grep -o 'href="[0-9][^"]*/"' | sed 's/href="//;s/\/"//' | sort -V | tail -1); then
        if [[ -n "$latest_version" ]]; then
            url="https://download.freedict.org/dictionaries/$pair/$latest_version/freedict-$pair-$latest_version.stardict.tar.xz"
            
            # Test the URL
            if response=$(curl -s -I -L --max-time 10 "$url" 2>/dev/null); then
                if echo "$response" | grep -q "HTTP/[12].[01] 200"; then
                    size=$(echo "$response" | grep -i "content-length:" | awk '{print $2}' | tr -d '\r\n' || echo "0")
                    if [[ "$size" -gt 0 ]]; then
                        size_mb=$(echo "scale=1; $size / 1024 / 1024" | bc -l 2>/dev/null || echo "?")
                        echo "✅ v$latest_version ($size_mb MB)"
                        echo "URL: $url"
                    else
                        echo "⚠️  v$latest_version (size unknown)"
                        echo "URL: $url"
                    fi
                else
                    echo "❌ v$latest_version (HTTP error)"
                fi
            else
                echo "❌ v$latest_version (connection failed)"
            fi
        else
            echo "❌ No versions found"
        fi
    else
        echo "❌ Directory not accessible"
    fi
    echo
}

# Test our target language pairs
discover_pair "eng-spa"
discover_pair "spa-eng" 
discover_pair "eng-fra"
discover_pair "fra-eng"
discover_pair "eng-deu"
discover_pair "deu-eng"

echo "🎯 Summary: Update build-pack.sh with working URLs from above"