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
  timeoutMs: number = 5000
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!WEBVIEW_REF) {
      reject(new Error('TranslatorHost not initialized'));
      return;
    }

    const timer = setTimeout(() => {
      PENDING.delete(request.id);
      reject(new Error('Translation timeout'));
    }, timeoutMs);

    PENDING.set(request.id, {
      resolve: (value: string) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error: Error) => {
        clearTimeout(timer);
        reject(error);
      }
    });

    WEBVIEW_REF.postMessage(JSON.stringify({
      type: 'translate',
      id: request.id,
      text: request.text,
      from: request.from,
      to: request.to
    }));
  });
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
        
        // TODO: Copy initial assets (index.html + worker + wasm) if not present
        // For now, we'll create a minimal index.html for testing
        const indexPath = `${runtimeDir}index.html`;
        const indexExists = await FileSystem.getInfoAsync(indexPath);
        
        if (!indexExists.exists) {
          await FileSystem.writeAsStringAsync(indexPath, `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta http-equiv="X-Content-Type-Options" content="nosniff" />
  <script>
    let ready = false;
    let engine;

    function post(obj){
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }

    async function init(){
      if (ready) return;
      try {
        // Mock initialization for testing
        ready = true;
        post({ type: 'ready' });
      } catch (e) {
        post({ type: 'error', id: 'init', error: String(e?.message || e) });
      }
    }

    async function translate({id, text, from, to}){
      try {
        if (!ready) await init();
        
        // Mock translation for testing
        const mockTranslation = text.replace(/hello/gi, 'hola')
                                    .replace(/world/gi, 'mundo')
                                    .replace(/good/gi, 'bueno')
                                    .replace(/morning/gi, 'mañana');
        
        const qualityHint = -2.5; // Mock quality hint
        post({ type: 'result', id, text: mockTranslation, qualityHint });
      } catch (e) {
        post({ type: 'error', id, error: String(e?.message || e) });
      }
    }

    window.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data || '{}');
        if (msg.type === 'translate') translate(msg);
        if (msg.type === 'warmup') init();
      } catch {}
    });

    // Warm start
    init();
  </script>
</head>
<body></body>
</html>
          `);
        }

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