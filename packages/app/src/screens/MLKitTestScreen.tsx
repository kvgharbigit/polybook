import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Translation, MlkitUtils, getServiceInfo } from '../services';

// Language pair definitions for better UX
interface LanguagePair {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
  label: string;
  estimatedMB: number;
}

const LANGUAGE_PAIRS: LanguagePair[] = [
  { id: 'en-es', sourceLanguage: 'en', targetLanguage: 'es', label: 'English ↔ Spanish', estimatedMB: 45 },
  { id: 'en-fr', sourceLanguage: 'en', targetLanguage: 'fr', label: 'English ↔ French', estimatedMB: 48 },
  { id: 'en-de', sourceLanguage: 'en', targetLanguage: 'de', label: 'English ↔ German', estimatedMB: 47 },
  { id: 'en-it', sourceLanguage: 'en', targetLanguage: 'it', label: 'English ↔ Italian', estimatedMB: 44 },
  { id: 'fr-es', sourceLanguage: 'fr', targetLanguage: 'es', label: 'French ↔ Spanish', estimatedMB: 52 },
  { id: 'de-es', sourceLanguage: 'de', targetLanguage: 'es', label: 'German ↔ Spanish', estimatedMB: 50 },
];

interface TestResult {
  id: string;
  phrase: string;
  from: string;
  to: string;
  result: string;
  duration: number;
  status: 'success' | 'error';
  timestamp: number;
}

const TEST_PHRASES = [
  { text: 'Hello world', from: 'en', to: 'es' },
  { text: 'Good morning', from: 'en', to: 'fr' }, 
  { text: 'Thank you', from: 'en', to: 'de' },
  { text: 'How are you?', from: 'en', to: 'it' },
  { text: 'I love reading books', from: 'en', to: 'es' },
  { text: 'The weather is beautiful today', from: 'en', to: 'fr' },
  { text: 'Buenos días', from: 'es', to: 'en' },
  { text: 'Merci beaucoup', from: 'fr', to: 'en' },
  { text: 'Guten Tag', from: 'de', to: 'en' },
  { text: 'Come stai?', from: 'it', to: 'en' },
];

export default function MLKitTestScreen() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [mlkitStatus, setMlkitStatus] = useState<string>('checking...');
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [pairStatuses, setPairStatuses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    checkMLKitStatus();
  }, []);

  const checkMLKitStatus = async () => {
    try {
      const serviceInfo = getServiceInfo();
      console.log(`🔧 Translation Service: ${serviceInfo.engine} (${serviceInfo.description})`);
      
      const isAvailable = MlkitUtils.isAvailable();
      
      if (isAvailable) {
        setMlkitStatus(`✅ ML Kit Available - Using ${serviceInfo.engine} engine`);
        const models = await MlkitUtils.getInstalledModels();
        setInstalledModels(models);
        
        // Check status for each language pair
        const statuses: Record<string, boolean> = {};
        for (const pair of LANGUAGE_PAIRS) {
          try {
            const isReady = await MlkitUtils.isLanguagePairReady(pair.sourceLanguage, pair.targetLanguage);
            statuses[pair.id] = isReady;
          } catch (error) {
            statuses[pair.id] = false;
          }
        }
        setPairStatuses(statuses);
      } else {
        setMlkitStatus(`❌ ML Kit Not Available - Currently using ${serviceInfo.engine} engine (Use Dev Client for ML Kit)`);
      }
    } catch (error) {
      setMlkitStatus(`❌ Error: ${error.message}`);
    }
  };

  const addResult = (result: Omit<TestResult, 'id' | 'timestamp'>) => {
    const newResult: TestResult = {
      ...result,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };
    setResults(prev => [newResult, ...prev]);
  };

  const runSingleTest = async (phrase: typeof TEST_PHRASES[0]) => {
    const startTime = Date.now();
    
    try {
      const serviceInfo = getServiceInfo();
      console.log(`🧪 Testing: "${phrase.text}" (${phrase.from} → ${phrase.to}) using ${serviceInfo.engine}`);
      
      const result = await Translation.translate(phrase.text, {
        from: phrase.from,
        to: phrase.to,
        timeoutMs: 10000
      });
      
      const duration = Date.now() - startTime;
      
      if (result.text) {
        addResult({
          phrase: phrase.text,
          from: phrase.from,
          to: phrase.to,
          result: result.text,
          duration,
          status: 'success'
        });
        
        console.log(`✅ ${duration}ms: "${result.text}"`);
      } else {
        addResult({
          phrase: phrase.text,
          from: phrase.from,
          to: phrase.to,
          result: 'No translation returned',
          duration,
          status: 'error'
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      addResult({
        phrase: phrase.text,
        from: phrase.from,
        to: phrase.to,
        result: error.message,
        duration,
        status: 'error'
      });
      
      console.error(`❌ ${duration}ms: ${error.message}`);
    }
  };

  const runAllTests = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setResults([]);
    
    try {
      console.log('🚀 Starting ML Kit translation tests...');
      
      for (const phrase of TEST_PHRASES) {
        await runSingleTest(phrase);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log('🏁 All tests completed!');
      
    } catch (error) {
      console.error('Test suite failed:', error);
      Alert.alert('Test Failed', error.message);
    } finally {
      setIsRunning(false);
    }
  };

  const downloadLanguagePair = async (pair: LanguagePair) => {
    try {
      console.log(`📥 Downloading language pair: ${pair.label}...`);
      
      const result = await MlkitUtils.ensureLanguagePair(pair.sourceLanguage, pair.targetLanguage);
      
      let message = `${pair.label} is ready for translation!`;
      if (result.newlyDownloaded.length > 0) {
        message = `Downloaded ${result.newlyDownloaded.join(', ')} models. ${pair.label} is now ready!`;
      } else {
        message = `${pair.label} was already available.`;
      }
      
      console.log(`✅ ${pair.label} ready`);
      
      // Refresh status
      await checkMLKitStatus();
      Alert.alert('Success', message);
    } catch (error) {
      console.error(`Failed to download language pair ${pair.label}:`, error);
      Alert.alert('Download Failed', `Failed to download ${pair.label}: ${error.message}`);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  const renderResult = (result: TestResult) => {
    return (
      <View key={result.id} style={[
        styles.resultItem,
        result.status === 'success' ? styles.successItem : styles.errorItem
      ]}>
        <Text style={styles.resultPhrase}>
          "{result.phrase}" ({result.from} → {result.to})
        </Text>
        <Text style={styles.resultTranslation}>
          {result.status === 'success' ? '✅' : '❌'} {result.result}
        </Text>
        <Text style={styles.resultTiming}>
          {result.duration}ms • {new Date(result.timestamp).toLocaleTimeString()}
        </Text>
      </View>
    );
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>ML Kit Translation Test</Text>
      
      <View style={styles.statusSection}>
        <Text style={styles.statusText}>{mlkitStatus}</Text>
        
        {installedModels.length > 0 && (
          <Text style={styles.modelsText}>
            Installed Models: {installedModels.join(', ')}
          </Text>
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, isRunning && styles.disabledButton]}
          onPress={runAllTests}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>
            {isRunning ? '⏱️ Testing...' : '🧪 Run All Tests'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={clearResults}
        >
          <Text style={styles.buttonText}>🗑️ Clear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.languagePairControls}>
        <Text style={styles.sectionTitle}>Download Translation Pairs:</Text>
        <ScrollView style={styles.pairsList} showsVerticalScrollIndicator={false}>
          {LANGUAGE_PAIRS.map(pair => {
            const isReady = pairStatuses[pair.id] || false;
            return (
              <TouchableOpacity
                key={pair.id}
                style={[
                  styles.pairButton,
                  isReady && styles.readyPair
                ]}
                onPress={() => downloadLanguagePair(pair)}
              >
                <View style={styles.pairInfo}>
                  <Text style={styles.pairLabel}>
                    {pair.label} {isReady ? '✅' : '📥'}
                  </Text>
                  <Text style={styles.pairSize}>
                    ~{pair.estimatedMB}MB {isReady ? '• Ready' : '• Download needed'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {results.length > 0 && (
        <View style={styles.statsSection}>
          <Text style={styles.statsText}>
            Results: {successCount} ✅ / {errorCount} ❌ / {results.length} total
          </Text>
          {successCount > 0 && (
            <Text style={styles.statsText}>
              Avg Speed: {Math.round(
                results
                  .filter(r => r.status === 'success')
                  .reduce((sum, r) => sum + r.duration, 0) / successCount
              )}ms
            </Text>
          )}
        </View>
      )}

      <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
        {results.map(renderResult)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  statusSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  modelsText: {
    fontSize: 14,
    color: '#666',
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#666',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  languagePairControls: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    maxHeight: 200,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  pairsList: {
    flex: 1,
  },
  pairButton: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  readyPair: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4CAF50',
  },
  pairInfo: {
    flex: 1,
  },
  pairLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  pairSize: {
    fontSize: 12,
    color: '#666',
  },
  statsSection: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    backgroundColor: 'white',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  successItem: {
    borderLeftColor: '#4CAF50',
  },
  errorItem: {
    borderLeftColor: '#F44336',
  },
  resultPhrase: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
  },
  resultTranslation: {
    fontSize: 14,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  resultTiming: {
    fontSize: 12,
    color: '#666',
  },
});