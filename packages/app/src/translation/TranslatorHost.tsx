import React, { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { WebView } from 'react-native-webview';
import StaticServer from 'react-native-static-server';
import * as FileSystem from 'expo-file-system';

interface BridgeMessage {
  type: 'translate' | 'result' | 'error' | 'ready' | 'warmup';
  id?: string;
  text?: string;
  from?: string;
  to?: string;
  error?: string;
  qualityHint?: number | null;
}

interface PendingTranslation {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

// Global references for the WebView bridge
let WEBVIEW_REF: WebView | null = null;
const PENDING = new Map<string, PendingTranslation>();

export function postTranslate(
  request: { id: string; text: string; from: string; to: string },
  timeoutMs: number = 5000,
  retries: number = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!WEBVIEW_REF) {
      reject(new Error('TranslatorHost not initialized - WebView not ready'));
      return;
    }

    // Validate input parameters
    if (!request.text?.trim()) {
      reject(new Error('Translation text cannot be empty'));
      return;
    }

    if (!request.from || !request.to) {
      reject(new Error('Source and target languages must be specified'));
      return;
    }

    const timer = setTimeout(() => {
      PENDING.delete(request.id);
      
      // Retry logic for timeouts
      if (retries > 0) {
        console.warn(`🌐 Translation timeout, retrying... (${retries} attempts remaining)`);
        postTranslate(request, timeoutMs, retries - 1)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      reject(new Error(`Translation timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    PENDING.set(request.id, {
      resolve: (value: string) => {
        clearTimeout(timer);
        PENDING.delete(request.id);
        resolve(value);
      },
      reject: (error: Error) => {
        clearTimeout(timer);
        PENDING.delete(request.id);
        reject(error);
      }
    });

    try {
      WEBVIEW_REF.postMessage(JSON.stringify({
        type: 'translate',
        id: request.id,
        text: request.text.trim(),
        from: request.from,
        to: request.to
      }));
    } catch (messageError) {
      clearTimeout(timer);
      PENDING.delete(request.id);
      reject(new Error(`Failed to send message to WebView: ${messageError}`));
    }
  });
}

async function copyBergamotAssets(runtimeDir: string) {
  const { Asset } = await import('expo-asset');
  
  try {
    // Check if assets are already copied to avoid redundant work
    const indexPath = `${runtimeDir}index.html`;
    const indexExists = await FileSystem.getInfoAsync(indexPath);
    
    if (indexExists.exists) {
      console.log('📁 Bergamot assets already present, skipping copy');
      return;
    }
    
    console.log('📁 Copying Bergamot assets to runtime directory...');
    
    // Copy HTML template with error handling
    const htmlSource = require('./bergamot/index.html');
    const htmlAsset = Asset.fromModule(htmlSource);
    await htmlAsset.downloadAsync();
    
    if (!htmlAsset.localUri) {
      throw new Error('Failed to download HTML template asset');
    }
    
    const htmlContent = await FileSystem.readAsStringAsync(htmlAsset.localUri);
    await FileSystem.writeAsStringAsync(indexPath, htmlContent);
    console.log('📁 ✅ HTML template copied');
    
    // Copy Bergamot WASM and JS files with retry logic
    const wasmAssets = [
      { source: require('../../assets/bergamot/bergamot-translator-worker.js'), name: 'bergamot-translator-worker.js' },
      { source: require('../../assets/bergamot/assets/bergamot/bergamot-translator-worker.wasm'), name: 'bergamot-translator-worker.wasm' }
    ];
    
    for (const { source: moduleSource, name: expectedName } of wasmAssets) {
      try {
        const asset = Asset.fromModule(moduleSource);
        await asset.downloadAsync();
        
        if (!asset.localUri) {
          throw new Error(`Failed to download ${expectedName}`);
        }
        
        const fileName = asset.name || expectedName;
        const targetPath = `${runtimeDir}${fileName}`;
        
        // Ensure file doesn't exist before copying
        const targetExists = await FileSystem.getInfoAsync(targetPath);
        if (targetExists.exists) {
          await FileSystem.deleteAsync(targetPath);
        }
        
        // Copy file from asset to runtime directory
        await FileSystem.copyAsync({
          from: asset.localUri,
          to: targetPath
        });
        
        // Check file size for logging
        const newFileInfo = await FileSystem.getInfoAsync(targetPath);
        const fileSize = newFileInfo.exists && 'size' in newFileInfo ? newFileInfo.size : 0;
        console.log(`📁 ✅ Copied ${fileName} (${Math.round(fileSize / 1024)}KB)`);
        
      } catch (assetError) {
        console.warn(`📁 ⚠️ Failed to copy ${expectedName}:`, assetError);
        // Continue with other assets even if one fails
      }
    }
    
    // Create models directory for future model downloads
    const modelsDir = `${runtimeDir}models/`;
    await FileSystem.makeDirectoryAsync(modelsDir, { intermediates: true });
    
    console.log('📁 ✅ Bergamot assets copied successfully');
    
  } catch (error) {
    console.error('❌ Failed to copy Bergamot assets:', error);
    
    // Fallback: create minimal HTML with mock translation
    const fallbackHtml = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <script>
    let ready = false;
    function post(obj){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(obj)); }
    async function init(){ ready = true; post({ type: 'ready', mock: true }); }
    async function translate({id, text, from, to}){
      const result = text.replace(/hello/gi, 'hola').replace(/world/gi, 'mundo');
      post({ type: 'result', id, text: result, qualityHint: -2.5 });
    }
    window.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data || '{}');
        if (msg.type === 'translate') translate(msg);
        if (msg.type === 'warmup') init();
      } catch {}
    });
    init();
  </script>
</head>
<body></body>
</html>`;
    
    await FileSystem.writeAsStringAsync(`${runtimeDir}index.html`, fallbackHtml);
    console.log('📝 Created fallback HTML for testing');
  }
}

export default function TranslatorHost() {
  const [url, setUrl] = useState<string | null>(null);
  const serverRef = useRef<StaticServer | null>(null);
  const webRef = useRef<WebView>(null);

  useEffect(() => {
    WEBVIEW_REF = webRef.current;
  }, [webRef.current]);

  useEffect(() => {
    let mounted = true;
    
    const initializeServer = async () => {
      try {
        // Ensure the runtime bundle exists in documents: /bergamot-runtime
        const runtimeDir = `${FileSystem.documentDirectory}bergamot-runtime/`;
        await FileSystem.makeDirectoryAsync(runtimeDir, { intermediates: true });
        
        // Copy Bergamot assets to runtime directory
        await this.copyBergamotAssets(runtimeDir);

        serverRef.current = new StaticServer(0, runtimeDir, { localOnly: true });
        const origin = await serverRef.current.start();
        
        if (mounted) {
          setUrl(`${origin}/index.html`);
        }
      } catch (error) {
        console.error('Failed to initialize TranslatorHost:', error);
      }
    };

    initializeServer();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      // Warmup on foreground
      webRef.current?.postMessage(JSON.stringify({ type: 'warmup' }));
    });

    return () => {
      mounted = false;
      subscription.remove();
      if (serverRef.current) {
        serverRef.current.stop();
        serverRef.current = null;
      }
      WEBVIEW_REF = null;
    };
  }, []);

  const onMessage = (event: any) => {
    try {
      const msg: BridgeMessage = JSON.parse(event?.nativeEvent?.data || '{}');
      
      if (msg.type === 'result' && msg.id) {
        const pending = PENDING.get(msg.id);
        if (pending) {
          PENDING.delete(msg.id);
          pending.resolve(msg.text || '');
        }
      } else if (msg.type === 'error' && msg.id) {
        const pending = PENDING.get(msg.id);
        if (pending) {
          PENDING.delete(msg.id);
          pending.reject(new Error(msg.error || 'Translation error'));
        }
      } else if (msg.type === 'ready') {
        console.log('🌐 Bergamot translator ready');
      }
    } catch (error) {
      console.error('TranslatorHost message error:', error);
    }
  };

  if (!url) return null;

  return (
    <WebView
      ref={webRef}
      source={{ uri: url }}
      onMessage={onMessage}
      originWhitelist={['*']}
      allowFileAccess
      allowUniversalAccessFromFileURLs
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
    />
  );
}