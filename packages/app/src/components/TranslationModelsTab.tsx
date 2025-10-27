import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  TextInput,
  Modal
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Translation, MlkitUtils, getServiceInfo } from '../services';

interface LanguagePair {
  id: string;
  displayName: string;
  languages: [string, string];
  flags: string;
  description: string;
  size: string;
  isInstalled?: boolean;
}

interface TranslationModelsTabProps {
  onRefresh?: () => void;
}

export default function TranslationModelsTab({ onRefresh }: TranslationModelsTabProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // State
  const [serviceInfo, setServiceInfo] = useState<any>(null);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(new Set());
  
  // Custom test modal state
  const [showCustomTest, setShowCustomTest] = useState(false);
  const [customTestText, setCustomTestText] = useState('');
  const [selectedTestPair, setSelectedTestPair] = useState<{lang1: string, lang2: string, pairName: string} | null>(null);

  // Popular language pairs for ML Kit
  const popularLanguagePairs: LanguagePair[] = [
    { id: 'en-es', displayName: 'English ↔ Spanish', languages: ['en', 'es'], flags: '🇺🇸 🇪🇸', description: 'Most popular pair', size: '~25MB each' },
    { id: 'en-fr', displayName: 'English ↔ French', languages: ['en', 'fr'], flags: '🇺🇸 🇫🇷', description: 'High quality', size: '~25MB each' },
    { id: 'en-de', displayName: 'English ↔ German', languages: ['en', 'de'], flags: '🇺🇸 🇩🇪', description: 'Business essential', size: '~25MB each' },
    { id: 'en-it', displayName: 'English ↔ Italian', languages: ['en', 'it'], flags: '🇺🇸 🇮🇹', description: 'Travel ready', size: '~25MB each' },
    { id: 'en-pt', displayName: 'English ↔ Portuguese', languages: ['en', 'pt'], flags: '🇺🇸 🇵🇹', description: 'Brazil & Portugal', size: '~25MB each' },
    { id: 'en-ru', displayName: 'English ↔ Russian', languages: ['en', 'ru'], flags: '🇺🇸 🇷🇺', description: 'Cyrillic support', size: '~25MB each' },
    { id: 'en-zh', displayName: 'English ↔ Chinese', languages: ['en', 'zh'], flags: '🇺🇸 🇨🇳', description: 'Simplified Chinese', size: '~25MB each' },
    { id: 'en-ja', displayName: 'English ↔ Japanese', languages: ['en', 'ja'], flags: '🇺🇸 🇯🇵', description: 'Hiragana & Katakana', size: '~25MB each' },
    { id: 'en-ko', displayName: 'English ↔ Korean', languages: ['en', 'ko'], flags: '🇺🇸 🇰🇷', description: 'Hangul support', size: '~25MB each' },
    { id: 'en-ar', displayName: 'English ↔ Arabic', languages: ['en', 'ar'], flags: '🇺🇸 🇸🇦', description: 'Right-to-left', size: '~25MB each' },
    { id: 'en-hi', displayName: 'English ↔ Hindi', languages: ['en', 'hi'], flags: '🇺🇸 🇮🇳', description: 'Devanagari script', size: '~25MB each' },
    { id: 'es-fr', displayName: 'Spanish ↔ French', languages: ['es', 'fr'], flags: '🇪🇸 🇫🇷', description: 'Romance languages', size: '~25MB each' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      const info = getServiceInfo();
      setServiceInfo(info);
      
      if (MlkitUtils.isAvailable()) {
        const installed = await MlkitUtils.getInstalledModels();
        setInstalledModels(installed);
      } else {
        setInstalledModels([]);
      }
    } catch (error) {
      console.error('TranslationModelsTab: Error loading data:', error);
      Alert.alert('Error', 'Failed to load translation service info');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadModel = async (lang: string, pairName: string) => {
    if (!MlkitUtils.isAvailable()) {
      Alert.alert(
        'Development Mode',
        'You\'re using Expo Go for development. Translation works automatically online - no downloads needed!\n\nTo test offline features, use the production app.',
        [{ text: 'Got it!' }]
      );
      return;
    }

    try {
      setDownloadingModels(prev => new Set(prev).add(lang));
      
      Alert.alert(
        'Downloading Model...',
        `Downloading ${lang.toUpperCase()} model for ${pairName}`,
        [],
        { cancelable: false }
      );

      await Translation.ensureModel(lang);
      
      // Refresh installed models
      const installed = await MlkitUtils.getInstalledModels();
      setInstalledModels(installed);
      
      Alert.alert(
        '✅ Download Complete',
        `${lang.toUpperCase()} model for ${pairName} is now ready for offline translation.`,
        [{ text: 'Great!' }]
      );
      
    } catch (error) {
      console.error('Model download error:', error);
      Alert.alert(
        'Download Failed', 
        error instanceof Error ? error.message : 'Failed to download model'
      );
    } finally {
      setDownloadingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(lang);
        return newSet;
      });
    }
  };

  const handleRemoveModel = async (lang: string, pairName: string) => {
    if (!MlkitUtils.isAvailable()) return;

    Alert.alert(
      'Remove Model',
      `Remove ${lang.toUpperCase()} model for ${pairName}?\n\nThis will free up ~25MB of storage but require re-download for offline use.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              await MlkitUtils.removeModel(lang);
              
              // Refresh installed models
              const installed = await MlkitUtils.getInstalledModels();
              setInstalledModels(installed);
              
              Alert.alert(
                'Model Removed',
                `${lang.toUpperCase()} model has been removed. Translation will use online service until re-downloaded.`,
                [{ text: 'OK' }]
              );
            } catch (error) {
              Alert.alert('Remove Failed', error instanceof Error ? error.message : 'Failed to remove model');
            }
          }
        }
      ]
    );
  };

  const handleTestPair = async (pair: LanguagePair) => {
    const [lang1, lang2] = pair.languages;
    const testSentences = [
      { text: 'Hello, how are you?', lang: 'en' },
      { text: 'The weather is beautiful today.', lang: 'en' },
      { text: 'Thank you very much.', lang: 'en' },
      { text: 'Hola, ¿cómo estás?', lang: 'es' },
      { text: 'El clima está hermoso hoy.', lang: 'es' },
      { text: 'Bonjour, comment allez-vous?', lang: 'fr' },
      { text: 'Guten Tag, wie geht es Ihnen?', lang: 'de' },
      { text: 'Buongiorno, come sta?', lang: 'it' },
      { text: 'Olá, como está?', lang: 'pt' },
      { text: 'Привет, как дела?', lang: 'ru' },
      { text: '你好，你好吗？', lang: 'zh' },
      { text: 'こんにちは、元気ですか？', lang: 'ja' },
      { text: '안녕하세요, 어떻게 지내세요?', lang: 'ko' },
      { text: 'مرحبا، كيف حالك؟', lang: 'ar' },
      { text: 'नमस्ते, कैसे हैं आप?', lang: 'hi' }
    ];

    // Find test sentences for this language pair
    const availableTests = testSentences.filter(test => 
      test.lang === lang1 || test.lang === lang2
    );

    if (availableTests.length === 0) {
      Alert.alert(
        'No Test Available',
        `No test sentences available for ${pair.displayName}`,
        [{ text: 'OK' }]
      );
      return;
    }

    const testSentence = availableTests.find(test => test.lang === lang1) || availableTests[0];
    const targetLang = testSentence.lang === lang1 ? lang2 : lang1;

    Alert.alert(
      `Testing ${pair.displayName}`,
      `Test sentence: "${testSentence.text}"\n\nTranslating from ${testSentence.lang.toUpperCase()} → ${targetLang.toUpperCase()}...`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Custom Test', 
          onPress: () => showCustomTestPrompt(lang1, lang2, pair.displayName)
        },
        { 
          text: 'Quick Test', 
          onPress: () => performTranslationTest(testSentence.text, testSentence.lang, targetLang, pair.displayName)
        }
      ]
    );
  };

  const showCustomTestPrompt = (lang1: string, lang2: string, pairName: string) => {
    setSelectedTestPair({ lang1, lang2, pairName });
    setCustomTestText('');
    setShowCustomTest(true);
  };

  const handleCustomTest = () => {
    if (!customTestText.trim() || !selectedTestPair) return;

    const { lang1, lang2, pairName } = selectedTestPair;
    
    Alert.alert(
      'Choose Translation Direction',
      `Text: "${customTestText}"\n\nWhich direction?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: `${lang1.toUpperCase()} → ${lang2.toUpperCase()}`, 
          onPress: () => {
            setShowCustomTest(false);
            performTranslationTest(customTestText, lang1, lang2, pairName);
          }
        },
        { 
          text: `${lang2.toUpperCase()} → ${lang1.toUpperCase()}`, 
          onPress: () => {
            setShowCustomTest(false);
            performTranslationTest(customTestText, lang2, lang1, pairName);
          }
        }
      ]
    );
  };

  const performTranslationTest = async (text: string, fromLang: string, toLang: string, pairName: string) => {
    try {
      console.log(`🧪 Testing translation: "${text}" (${fromLang} → ${toLang})`);
      
      Alert.alert(
        'Testing Translation...',
        `Translating "${text}"\nFrom ${fromLang.toUpperCase()} to ${toLang.toUpperCase()}\n\nUsing ${serviceInfo?.currentEngine} engine...`,
        [],
        { cancelable: false }
      );

      const startTime = Date.now();
      const result = await Translation.translate(text, { 
        from: fromLang, 
        to: toLang, 
        timeoutMs: 10000 
      });
      const duration = Date.now() - startTime;

      console.log(`🧪 Translation result:`, result);

      if (result.text && result.text !== text) {
        const engineInfo = serviceInfo?.currentEngine === 'online' ? 
          'Online (Google Translate)' : 'Offline (ML Kit)';
          
        Alert.alert(
          '✅ Translation Test Successful',
          `Original: "${text}"\n\n` +
          `Translated: "${result.text}"\n\n` +
          `Language: ${fromLang.toUpperCase()} → ${toLang.toUpperCase()}\n` +
          `Engine: ${engineInfo}\n` +
          `Speed: ${duration}ms\n` +
          `Pair: ${pairName}`,
          [{ text: 'Great!' }]
        );
      } else {
        Alert.alert(
          '⚠️ Translation Issue',
          `Translation returned same text or empty result.\n\n` +
          `Original: "${text}"\n` +
          `Result: "${result.text}"\n\n` +
          `This might indicate the languages aren't supported or there was an error.`,
          [
            { text: 'OK' },
            { 
              text: 'Retry', 
              onPress: () => performTranslationTest(text, fromLang, toLang, pairName)
            }
          ]
        );
      }
    } catch (error) {
      console.error('🧪 Translation test error:', error);
      Alert.alert(
        '❌ Translation Test Error',
        `Failed to test translation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [
          { text: 'OK' },
          { 
            text: 'Retry', 
            onPress: () => performTranslationTest(text, fromLang, toLang, pairName)
          }
        ]
      );
    }
  };

  const renderLanguagePair = ({ item: pair }: { item: LanguagePair }) => {
    const [lang1, lang2] = pair.languages;
    const lang1Installed = installedModels.includes(lang1);
    const lang2Installed = installedModels.includes(lang2);
    const fullyInstalled = lang1Installed && lang2Installed;
    const partiallyInstalled = lang1Installed || lang2Installed;
    
    const lang1Downloading = downloadingModels.has(lang1);
    const lang2Downloading = downloadingModels.has(lang2);
    const anyDownloading = lang1Downloading || lang2Downloading;
    
    const isOnlineMode = serviceInfo?.currentEngine === 'online';

    return (
      <View style={styles.pairContainer}>
        <View style={styles.pairHeader}>
          <View style={styles.pairInfo}>
            <Text style={styles.pairFlags}>{pair.flags}</Text>
            <View style={styles.pairText}>
              <Text style={styles.pairTitle}>{pair.displayName}</Text>
              <Text style={styles.pairSubtitle}>
                {pair.description} • {pair.size}
                {isOnlineMode && ' • Online Mode'}
              </Text>
            </View>
          </View>
          
          <View style={styles.pairActions}>
            {isOnlineMode ? (
              // Expo Go: Online mode - just show test button
              <TouchableOpacity 
                style={[styles.actionButton, styles.testButton]} 
                onPress={() => handleTestPair(pair)}
              >
                <Text style={styles.testButtonText}>Test Online</Text>
              </TouchableOpacity>
            ) : anyDownloading ? (
              // Dev Client: Show downloading state
              <View style={styles.downloadProgressContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.progressText}>Downloading...</Text>
              </View>
            ) : fullyInstalled ? (
              // Dev Client: Both models installed
              <View style={styles.installedActions}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.testButton]} 
                  onPress={() => handleTestPair(pair)}
                >
                  <Text style={styles.testButtonText}>Test Offline</Text>
                </TouchableOpacity>
                <View style={styles.modelButtons}>
                  <TouchableOpacity 
                    style={[styles.modelButton, styles.removeButton]} 
                    onPress={() => handleRemoveModel(lang1, pair.displayName)}
                  >
                    <Text style={styles.removeButtonText}>{lang1.toUpperCase()}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modelButton, styles.removeButton]} 
                    onPress={() => handleRemoveModel(lang2, pair.displayName)}
                  >
                    <Text style={styles.removeButtonText}>{lang2.toUpperCase()}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Dev Client: Show download options
              <View style={styles.downloadActions}>
                <TouchableOpacity 
                  style={[styles.modelButton, lang1Installed ? styles.installedButton : styles.downloadButton]} 
                  onPress={lang1Installed ? undefined : () => handleDownloadModel(lang1, pair.displayName)}
                  disabled={lang1Installed}
                >
                  <Text style={lang1Installed ? styles.installedButtonText : styles.downloadButtonText}>
                    {lang1.toUpperCase()} {lang1Installed ? '✓' : '↓'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modelButton, lang2Installed ? styles.installedButton : styles.downloadButton]} 
                  onPress={lang2Installed ? undefined : () => handleDownloadModel(lang2, pair.displayName)}
                  disabled={lang2Installed}
                >
                  <Text style={lang2Installed ? styles.installedButtonText : styles.downloadButtonText}>
                    {lang2.toUpperCase()} {lang2Installed ? '✓' : '↓'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        
        {!isOnlineMode && partiallyInstalled && !fullyInstalled && (
          <View style={styles.partialWarning}>
            <Text style={styles.partialWarningText}>
              ⚠️ Download both models for full offline support
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading translation service...</Text>
      </View>
    );
  }

  const isOnlineMode = serviceInfo?.currentEngine === 'online';
  const engineName = isOnlineMode ? 'Online Translation' : 'ML Kit Offline';
  const engineDescription = isOnlineMode ? 
    'Free cloud translation via Google Translate' : 
    'On-device translation with Google ML Kit';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{engineName}</Text>
        <Text style={styles.subtitle}>{engineDescription}</Text>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          {isOnlineMode ? (
            `🌐 Engine: Online • Requires internet • No storage used`
          ) : (
            `📱 Engine: Offline • ${installedModels.length} models installed • ~${installedModels.length * 25}MB used`
          )}
        </Text>
      </View>

      <FlatList
        data={popularLanguagePairs}
        keyExtractor={(item) => item.id}
        renderItem={renderLanguagePair}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {isOnlineMode ? (
            `• Online translation works instantly in Expo Go\n• No model downloads needed\n• Requires internet connection\n• Powered by Google Translate (unofficial API)`
          ) : (
            `• Offline translation after model download\n• Each model ~25MB, works without internet\n• Download individually per language\n• Powered by Google ML Kit`
          )}
        </Text>
      </View>

      {/* Custom Test Modal */}
      <Modal
        visible={showCustomTest}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCustomTest(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.customTestModal}>
            <Text style={styles.modalTitle}>Custom Translation Test</Text>
            <Text style={styles.modalSubtitle}>
              {selectedTestPair && `Testing ${selectedTestPair.pairName}`}
            </Text>
            
            <TextInput
              style={styles.testInput}
              placeholder="Enter text to translate..."
              placeholderTextColor={theme.colors.textSecondary}
              value={customTestText}
              onChangeText={setCustomTestText}
              multiline
              numberOfLines={3}
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => setShowCustomTest(false)}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.testModalButton]}
                onPress={handleCustomTest}
                disabled={!customTestText.trim()}
              >
                <Text style={[styles.testModalButtonText, !customTestText.trim() && styles.disabledButtonText]}>
                  Test Translation
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  statusContainer: {
    padding: 16,
    backgroundColor: theme.colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  statusText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  pairContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pairHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pairInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pairFlags: {
    fontSize: 24,
    marginRight: 12,
  },
  pairText: {
    flex: 1,
  },
  pairTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  pairSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  pairActions: {
    marginLeft: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  downloadButton: {
    backgroundColor: theme.colors.primary,
  },
  downloadButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  installedButton: {
    backgroundColor: theme.colors.success + '20',
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  installedButtonText: {
    color: theme.colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: theme.colors.error + '20',
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  removeButtonText: {
    color: theme.colors.error,
    fontSize: 10,
    fontWeight: '500',
  },
  downloadProgressContainer: {
    alignItems: 'center',
    gap: 4,
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  installedActions: {
    alignItems: 'center',
    gap: 8,
  },
  downloadActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modelButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  modelButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: theme.colors.success + '20',
    borderWidth: 1,
    borderColor: theme.colors.success,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  testButtonText: {
    color: theme.colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  partialWarning: {
    marginTop: 12,
    padding: 8,
    backgroundColor: theme.colors.warningBackground,
    borderRadius: 6,
  },
  partialWarningText: {
    fontSize: 12,
    color: theme.colors.warning,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    backgroundColor: theme.colors.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  // Custom test modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customTestModal: {
    backgroundColor: theme.colors.surface,
    margin: 20,
    padding: 24,
    borderRadius: 16,
    minWidth: 320,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  testInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelModalButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelModalButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  testModalButton: {
    backgroundColor: theme.colors.success,
  },
  testModalButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButtonText: {
    opacity: 0.5,
  },
});