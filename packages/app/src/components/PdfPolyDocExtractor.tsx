import React, { useRef, useCallback, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';

interface PolyDocBlock {
  type: 'paragraph' | 'heading';
  text: string;
  page: number;
  level?: number;
}

interface PolyDocChapter {
  id: string;
  title: string;
  content: string;
  order: number;
}

interface PdfPolyDocExtractorProps {
  uri: string;
  onProgress?: (stage: string, progress?: number) => void;
  onChunk?: (blocks: PolyDocBlock[]) => void;
  onChapters?: (chapters: PolyDocChapter[]) => void;
  onMetadata?: (metadata: any) => void;
  onDone?: (result: { success: boolean; totalPages: number; totalBlocks: number }) => void;
  onError?: (error: string) => void;
}

export function PdfPolyDocExtractor({
  uri,
  onProgress,
  onChunk,
  onChapters,
  onMetadata,
  onDone,
  onError
}: PdfPolyDocExtractorProps) {
  const webViewRef = useRef<WebView>(null);
  const [status, setStatus] = useState('Initializing...');
  const [isLoading, setIsLoading] = useState(true);

  const startExtraction = useCallback(async () => {
    try {
      console.log('📄 PdfPolyDocExtractor: Starting extraction for', uri);
      setStatus('Reading PDF file...');
      
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('📄 PdfPolyDocExtractor: File read, sending to WebView');
      const message = {
        cmd: 'extract',
        base64: base64.substring(0, 100) + '...', // Log truncated base64 for privacy
        opts: {}
      };
      console.log('📄 PdfPolyDocExtractor: Sending message to WebView:', message);
      webViewRef.current?.postMessage(JSON.stringify({
        cmd: 'extract',
        base64,
        opts: {}
      }));
    } catch (error) {
      console.error('📄 PdfPolyDocExtractor: Error reading file:', error);
      onError?.(`Failed to read PDF file: ${error}`);
    }
  }, [uri, onError]);

  const handleMessage = useCallback((event: any) => {
    try {
      console.log('📄 PdfPolyDocExtractor: Raw message data:', event.nativeEvent.data);
      const message = JSON.parse(event.nativeEvent.data);
      console.log('📄 PdfPolyDocExtractor: Parsed message:', JSON.stringify(message, null, 2));

      switch (message.type) {
        case 'status':
          setStatus(message.message);
          onProgress?.(message.message);
          break;

        case 'meta':
          console.log(`📄 PdfPolyDocExtractor: PDF has ${message.pageCount} pages`);
          onProgress?.(`Processing ${message.pageCount} pages...`);
          break;

        case 'metadata':
          console.log('📄 PdfPolyDocExtractor: Received metadata');
          onMetadata?.(message.info);
          break;

        case 'chunk':
          console.log(`📄 PdfPolyDocExtractor: Received chunk with ${message.blocks.length} blocks`);
          console.log('📄 PdfPolyDocExtractor: Chunk content:', message.blocks.map((block: any, i: number) => 
            `Block ${i}: "${block.text?.substring(0, 100)}${block.text?.length > 100 ? '...' : ''}"`
          ));
          onChunk?.(message.blocks);
          break;

        case 'chapters':
          console.log(`📄 PdfPolyDocExtractor: Detected ${message.chapters.length} chapters`);
          onChapters?.(message.chapters);
          break;

        case 'done':
          console.log('📄 PdfPolyDocExtractor: Extraction complete');
          setStatus('✅ Extraction complete!');
          setIsLoading(false);
          onDone?.(message);
          break;

        case 'error':
          console.error('📄 PdfPolyDocExtractor: Extraction error:', message.message);
          setStatus('❌ Extraction failed');
          setIsLoading(false);
          onError?.(message.message);
          break;

        default:
          console.log('📄 PdfPolyDocExtractor: Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('📄 PdfPolyDocExtractor: Error parsing message:', error);
      onError?.(`Message parsing error: ${error}`);
    }
  }, [onProgress, onChunk, onChapters, onMetadata, onDone, onError]);

  const handleWebViewLoad = useCallback(() => {
    console.log('📄 PdfPolyDocExtractor: WebView loaded, starting extraction');
    startExtraction();
  }, [startExtraction]);

  const handleWebViewError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('📄 PdfPolyDocExtractor: WebView error:', nativeEvent);
    onError?.(`WebView error: ${nativeEvent.description}`);
  }, [onError]);

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}
      
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={require('../../assets/pdf-extractor.html')}
        onLoadEnd={handleWebViewLoad}
        onMessage={handleMessage}
        onError={handleWebViewError}
        javaScriptEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        setSupportMultipleWindows={false}
        style={[styles.webView, { opacity: isLoading ? 0 : 1 }]}
        injectedJavaScriptBeforeContentLoaded="true;"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1,
  },
  statusText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  webView: {
    flex: 1,
  },
});