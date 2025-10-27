import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TranslatorHost from '../translation/TranslatorHost';
import BergamotService from '../translation/BergamotService';

const TEST_SENTENCES = [
  'This is a short sentence.',
  'He said he would come after lunch, but I am not sure.',
  'Machine translation quality varies depending on domain and sentence length.',
  'The quick brown fox jumps over the lazy dog while humming a tune.',
  'In the context of mobile devices, performance and memory constraints matter a lot.'
];

interface LogEntry {
  id: string;
  message: string;
  timestamp: number;
  type: 'info' | 'success' | 'error' | 'timing';
}

export default function TranslationPerfHarness() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      message,
      timestamp: Date.now(),
      type
    };
    setLogs(prevLogs => [entry, ...prevLogs]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const runPerformanceTest = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    clearLogs();
    
    try {
      addLog('🚀 Starting Bergamot performance test...', 'info');
      
      // Warmup phase
      addLog('⏱️ Warmup phase...', 'info');
      const warmupStart = Date.now();
      
      await new Promise(resolve => setTimeout(resolve, 500)); // Give WebView time to initialize
      
      const warmupEnd = Date.now();
      addLog(`✅ Warmup completed in ${warmupEnd - warmupStart}ms`, 'timing');

      // Single translation tests
      addLog('📝 Testing individual sentence translations...', 'info');
      const times: number[] = [];
      
      for (let i = 0; i < TEST_SENTENCES.length; i++) {
        const sentence = TEST_SENTENCES[i];
        addLog(`Translating sentence ${i + 1}/${TEST_SENTENCES.length}...`, 'info');
        
        const startTime = Date.now();
        
        try {
          const result = await BergamotService.translateSentence(
            sentence, 
            'en', 
            'es', 
            { timeoutMs: 8000 }
          );
          
          const endTime = Date.now();
          const duration = endTime - startTime;
          times.push(duration);
          
          if (result.success) {
            addLog(`✅ ${duration}ms → "${result.translatedText}"`, 'success');
          } else {
            addLog(`❌ ${duration}ms → Error: ${result.error}`, 'error');
          }
        } catch (error) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          addLog(`❌ ${duration}ms → Exception: ${error}`, 'error');
        }
      }

      // Calculate statistics
      if (times.length > 0) {
        times.sort((a, b) => a - b);
        const average = times.reduce((sum, time) => sum + time, 0) / times.length;
        const median = times[Math.floor(times.length / 2)];
        const p95Index = Math.floor(times.length * 0.95) - 1;
        const p95 = times[Math.max(0, p95Index)] || times[times.length - 1];
        
        addLog('📊 Performance Statistics:', 'info');
        addLog(`   Average: ${Math.round(average)}ms`, 'timing');
        addLog(`   Median: ${median}ms`, 'timing');
        addLog(`   P95: ${p95}ms`, 'timing');
        addLog(`   Min: ${Math.min(...times)}ms`, 'timing');
        addLog(`   Max: ${Math.max(...times)}ms`, 'timing');
        
        // Performance assessment
        if (p95 <= 2000) {
          addLog(`🎉 SUCCESS: P95 (${p95}ms) meets target (<2000ms)`, 'success');
        } else {
          addLog(`⚠️ WARNING: P95 (${p95}ms) exceeds target (2000ms)`, 'error');
        }
      }

      // Batch translation test
      addLog('🔄 Testing batch translation...', 'info');
      const batchStart = Date.now();
      
      try {
        const batchResults = await BergamotService.translateSentences(
          TEST_SENTENCES.slice(0, 3), // First 3 sentences
          'en',
          'es',
          { timeoutMs: 15000 }
        );
        
        const batchEnd = Date.now();
        const batchDuration = batchEnd - batchStart;
        
        const successCount = batchResults.filter(r => r.success).length;
        addLog(`✅ Batch completed: ${successCount}/${batchResults.length} successful in ${batchDuration}ms`, 'success');
      } catch (error) {
        const batchEnd = Date.now();
        const batchDuration = batchEnd - batchStart;
        addLog(`❌ Batch failed after ${batchDuration}ms: ${error}`, 'error');
      }

      addLog('🏁 Performance test completed!', 'success');
      
    } catch (error) {
      addLog(`💥 Test failed: ${error}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const runStressTest = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    addLog('🔥 Starting stress test (20 concurrent requests)...', 'info');
    
    try {
      const stressStart = Date.now();
      const promises = [];
      
      // Create 20 concurrent translation requests
      for (let i = 0; i < 20; i++) {
        const sentence = TEST_SENTENCES[i % TEST_SENTENCES.length];
        const promise = BergamotService.translateSentence(
          `${sentence} (request ${i + 1})`,
          'en',
          'es',
          { timeoutMs: 10000 }
        );
        promises.push(promise);
      }
      
      const results = await Promise.allSettled(promises);
      const stressEnd = Date.now();
      const stressDuration = stressEnd - stressStart;
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;
      
      addLog(`🔥 Stress test completed in ${stressDuration}ms`, 'timing');
      addLog(`   Successful: ${successful}/20`, successful === 20 ? 'success' : 'error');
      addLog(`   Failed: ${failed}/20`, failed === 0 ? 'success' : 'error');
      addLog(`   Average per request: ${Math.round(stressDuration / 20)}ms`, 'timing');
      
      if (successful >= 18) {
        addLog('✅ Stress test PASSED (≥90% success rate)', 'success');
      } else {
        addLog('❌ Stress test FAILED (<90% success rate)', 'error');
      }
      
    } catch (error) {
      addLog(`💥 Stress test failed: ${error}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    addLog('🎯 Translation Performance Harness ready', 'info');
    addLog('Tap RUN PERFORMANCE TEST to begin', 'info');
  }, []);

  const renderLogEntry = ({ item }: { item: LogEntry }) => {
    const getLogStyle = (type: LogEntry['type']) => {
      switch (type) {
        case 'success':
          return styles.logSuccess;
        case 'error':
          return styles.logError;
        case 'timing':
          return styles.logTiming;
        default:
          return styles.logInfo;
      }
    };

    return (
      <View style={[styles.logEntry, getLogStyle(item.type)]}>
        <Text style={styles.logText}>{item.message}</Text>
        <Text style={styles.logTimestamp}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <TranslatorHost />
      
      <View style={styles.header}>
        <Text style={styles.title}>Bergamot Performance Test</Text>
      </View>
      
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, isRunning && styles.buttonDisabled]}
          onPress={runPerformanceTest}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>
            {isRunning ? '⏱️ RUNNING...' : '🚀 RUN PERFORMANCE TEST'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.stressButton, isRunning && styles.buttonDisabled]}
          onPress={runStressTest}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>
            {isRunning ? '⏱️ RUNNING...' : '🔥 RUN STRESS TEST'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearLogs}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>🧹 CLEAR LOGS</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderLogEntry}
        style={styles.logsList}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#2196F3',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  controls: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  stressButton: {
    backgroundColor: '#FF9800',
  },
  clearButton: {
    backgroundColor: '#757575',
  },
  buttonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  logsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  logEntry: {
    backgroundColor: 'white',
    padding: 12,
    marginVertical: 2,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  logInfo: {
    borderLeftColor: '#2196F3',
  },
  logSuccess: {
    borderLeftColor: '#4CAF50',
  },
  logError: {
    borderLeftColor: '#F44336',
  },
  logTiming: {
    borderLeftColor: '#FF9800',
  },
  logText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
  },
  logTimestamp: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
});