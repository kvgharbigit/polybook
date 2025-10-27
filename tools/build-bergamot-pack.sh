#!/usr/bin/env bash
set -euo pipefail

DIRECTION="${1:?usage: build-bergamot-pack.sh en-es|es-en|en-fr|fr-en|en-de|de-en}"
OUT_DIR="dist/packs"
WORK_DIR="tmp-bergamot-${DIRECTION}"
mkdir -p "$OUT_DIR" "$WORK_DIR"

echo "🔧 Building Bergamot translation pack: $DIRECTION"
cd "$WORK_DIR"

# Parse direction
IFS='-' read -r SOURCE_LANG TARGET_LANG <<< "$DIRECTION"

# Bergamot translation model URLs (VERIFIED URLs from translatelocally.com)
case "$DIRECTION" in
  "en-es")
    MODEL_URL="https://data.statmt.org/bergamot/models/esen/enes.student.tiny11.v1.a7203a8f8e9daea8.tar.gz"
    MODEL_SIZE="14.1MB"
    ;;
  "es-en")
    MODEL_URL="https://data.statmt.org/bergamot/models/esen/esen.student.tiny11.v1.09576f06d0ad805e.tar.gz"
    MODEL_SIZE="~15MB"
    ;;
  "en-fr")
    MODEL_URL="https://data.statmt.org/bergamot/models/fren/enfr.student.tiny11.v1.805d112122af03d0.tar.gz"
    MODEL_SIZE="~15MB"
    ;;
  "fr-en")
    MODEL_URL="https://data.statmt.org/bergamot/models/fren/fren.student.tiny11.v1.dccea16d03c0a389.tar.gz"
    MODEL_SIZE="~15MB"
    ;;
  "en-de")
    MODEL_URL="https://data.statmt.org/bergamot/models/deen/ende.student.tiny11.v2.93821e13b3c511b5.tar.gz"
    MODEL_SIZE="~15MB"
    ;;
  "de-en")
    MODEL_URL="https://data.statmt.org/bergamot/models/deen/deen.student.tiny11.v2.8ebe3e43b6bb6cce.tar.gz"
    MODEL_SIZE="~15MB"
    ;;
  *)
    echo "❌ Translation direction not supported: $DIRECTION"
    echo "Available: en-es, es-en, en-fr, fr-en, en-de, de-en"
    exit 1
    ;;
esac

echo "📥 Fetching Bergamot models for $DIRECTION..."
echo "📡 Registry: $MODEL_URL"

# For now, create a placeholder structure while we set up the real Bergamot integration
echo "⚠️  Creating Bergamot placeholder pack (real integration coming next)"

# Create Bergamot pack structure
mkdir -p bergamot-${DIRECTION}
cd bergamot-${DIRECTION}

# Create placeholder files that match the expected Bergamot structure
cat > bergamot.js << 'EOF'
/**
 * Bergamot Translation Runtime
 * Firefox Translations WASM integration for React Native WebView
 */

class BergamotTranslator {
  constructor() {
    this.isInitialized = false;
    this.models = new Map();
  }

  async initialize(modelPath, wasmPath) {
    console.log('🤖 Initializing Bergamot WASM...');
    
    // TODO: Load actual WASM module
    // const wasmModule = await import(wasmPath);
    // this.bergamotEngine = await wasmModule.initialize();
    
    this.isInitialized = true;
    console.log('✅ Bergamot initialized');
  }

  async loadModel(sourceLanguage, targetLanguage, modelFiles) {
    const pair = `${sourceLanguage}-${targetLanguage}`;
    console.log(`📚 Loading model: ${pair}`);
    
    // TODO: Load actual model files
    // this.models.set(pair, await this.bergamotEngine.loadModel(modelFiles));
    
    this.models.set(pair, { loaded: true, pair });
    console.log(`✅ Model loaded: ${pair}`);
  }

  async translate(text, sourceLanguage, targetLanguage) {
    const pair = `${sourceLanguage}-${targetLanguage}`;
    
    if (!this.models.has(pair)) {
      throw new Error(`Model not loaded: ${pair}`);
    }

    console.log(`🔄 Translating: "${text}" (${pair})`);
    
    // TODO: Use actual Bergamot translation
    // const model = this.models.get(pair);
    // return await model.translate(text);
    
    // Placeholder translation
    return `[${targetLanguage.toUpperCase()}] ${text}`;
  }
}

// WebView integration
if (typeof window !== 'undefined') {
  window.BergamotTranslator = BergamotTranslator;
  
  // React Native bridge
  window.addEventListener('message', async (event) => {
    const { type, id, payload } = JSON.parse(event.data);
    
    try {
      switch (type) {
        case 'initialize':
          await translator.initialize();
          window.ReactNativeWebView.postMessage(JSON.stringify({ id, success: true }));
          break;
          
        case 'translate':
          const { text, sourceLanguage, targetLanguage } = payload;
          const result = await translator.translate(text, sourceLanguage, targetLanguage);
          window.ReactNativeWebView.postMessage(JSON.stringify({ id, success: true, result }));
          break;
          
        default:
          throw new Error(`Unknown message type: ${type}`);
      }
    } catch (error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ id, success: false, error: error.message }));
    }
  });
  
  // Global translator instance
  const translator = new BergamotTranslator();
}
EOF

# Create placeholder HTML wrapper
cat > index.html << EOF
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bergamot Translation Engine</title>
</head>
<body>
    <div id="status">Bergamot ${DIRECTION} Ready</div>
    <script src="bergamot.js"></script>
</body>
</html>
EOF

# Create model metadata
cat > model-info.json << EOF
{
  "direction": "${DIRECTION}",
  "sourceLanguage": "${SOURCE_LANG}",
  "targetLanguage": "${TARGET_LANG}",
  "version": "1.0.0-placeholder",
  "files": {
    "wasm": "bergamot.wasm",
    "model": "model.bin", 
    "vocabulary": "vocab.spm",
    "shortlist": "lex.50.50.bin"
  },
  "size": "${MODEL_SIZE}",
  "license": "MPL-2.0",
  "source": "Firefox Translations"
}
EOF

# Create placeholder binary files (for size estimation)
echo "Creating placeholder model files..."
dd if=/dev/zero of=bergamot.wasm bs=1024 count=2048   # 2MB WASM
dd if=/dev/zero of=model.bin bs=1024 count=81920      # 80MB model
dd if=/dev/zero of=vocab.spm bs=1024 count=512        # 512KB vocab
dd if=/dev/zero of=lex.50.50.bin bs=1024 count=1024   # 1MB shortlist

cd ..

echo "📦 Creating Bergamot package..."
zip -9 "../$OUT_DIR/bergamot-${DIRECTION}.zip" -r bergamot-${DIRECTION}/

# Generate metadata
bytes=$(stat -f%z "../$OUT_DIR/bergamot-${DIRECTION}.zip" 2>/dev/null || stat -c%s "../$OUT_DIR/bergamot-${DIRECTION}.zip")
sha=$(shasum -a 256 "../$OUT_DIR/bergamot-${DIRECTION}.zip" | awk '{print $1}')

cat > "../$OUT_DIR/bergamot-${DIRECTION}.json" << JSON
{
  "id": "bergamot-${DIRECTION}",
  "type": "translation",
  "sourceLanguage": "${SOURCE_LANG}",
  "targetLanguage": "${TARGET_LANG}", 
  "bytes": ${bytes},
  "sha256": "${sha}",
  "version": "1.0.0-placeholder",
  "source": "Firefox Translations",
  "license": "MPL-2.0",
  "isPlaceholder": true
}
JSON

echo "✅ Built: bergamot-${DIRECTION}.zip ($(numfmt --to=iec $bytes))"
echo "📄 Metadata: bergamot-${DIRECTION}.json"
echo "⚠️  Note: This is a placeholder. Real Bergamot models will be integrated in Phase 2"

# Cleanup
cd ..
rm -rf "$WORK_DIR"

echo "🎯 Bergamot pack ready: $DIRECTION"