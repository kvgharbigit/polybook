import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '../navigation/SimpleNavigator';
import { useTheme } from '../hooks/useTheme';
import { UserLanguageProfile, DictionaryLookupResponse, BilingualWordDefinition } from '@polybook/shared/src/types';
import SQLiteDictionaryService from '../services/sqliteDictionaryService';
import { Translation } from '../services';
import UserLanguageProfileService from '../services/userLanguageProfileService';

export default function DictionaryTestScreen() {
  const { goBack } = useNavigation();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [userProfile, setUserProfile] = useState<UserLanguageProfile | null>(null);
  const [searchWord, setSearchWord] = useState('');
  const [sentenceText, setSentenceText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<DictionaryLookupResponse | null>(null);
  const [translationResult, setTranslationResult] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<{
    sqliteReady: boolean;
    translationReady: boolean;
    availableLanguages: string[];
  }>({
    sqliteReady: false,
    translationReady: false,
    availableLanguages: []
  });

  useEffect(() => {
    initializeServices();
  }, []);

  const initializeServices = async () => {
    try {
      console.log('🧪 DictionaryTestScreen: Initializing services...');
      
      // Load user profile first
      const profile = await UserLanguageProfileService.getUserProfile();
      setUserProfile(profile);
      
      // Initialize SQLite dictionary service
      await SQLiteDictionaryService.initialize([profile.nativeLanguage, ...profile.targetLanguages]);
      
      // Translation service is ready immediately with new unified service
      
      // Get service status
      const availableLanguages = SQLiteDictionaryService.getAvailableLanguages();
      
      setServiceStatus({
        sqliteReady: true,
        translationReady: true, // Translation service is always ready
        availableLanguages
      });
      
      setInitialized(true);
      console.log('🧪 DictionaryTestScreen: Services initialized successfully');
      console.log('🧪 User profile:', profile);
      console.log('🧪 Available languages:', availableLanguages);
    } catch (error) {
      console.error('🧪 DictionaryTestScreen: Initialization error:', error);
      Alert.alert('Error', 'Failed to initialize dictionary services');
    }
  };

  const handleLookupWord = async () => {
    if (!searchWord.trim() || !userProfile) return;

    try {
      setIsLoading(true);
      setLookupResult(null);

      console.log(`🧪 Looking up "${searchWord}" for ${userProfile.nativeLanguage} user`);

      const result = await SQLiteDictionaryService.lookupWord({
        word: searchWord.trim(),
        userProfile
      });

      setLookupResult(result);
      console.log('🧪 Lookup result:', result);

    } catch (error) {
      console.error('🧪 DictionaryTestScreen: Lookup error:', error);
      Alert.alert('Error', `Failed to lookup "${searchWord}"`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslateSentence = async () => {
    if (!sentenceText.trim() || !userProfile) return;

    try {
      setIsLoading(true);
      setTranslationResult(null);

      console.log(`🧪 Translating sentence: "${sentenceText}"`);

      // Detect source language (simplified for demo)
      const sourceLanguage = userProfile.targetLanguages[0] || 'en';
      const targetLanguage = userProfile.nativeLanguage;

      const result = await Translation.translate(sentenceText.trim(), {
        from: sourceLanguage,
        to: targetLanguage,
        timeoutMs: 8000
      });

      if (result.text) {
        setTranslationResult(result.text);
      } else {
        Alert.alert('Translation Failed', 'Translation failed');
      }

      console.log('🧪 Translation result:', result);

    } catch (error) {
      console.error('🧪 DictionaryTestScreen: Translation error:', error);
      Alert.alert('Error', `Failed to translate sentence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testWords = [
    'book', 'house', 'place', 'the', 'serendipity',  // English words
    'lugar', 'casa', 'de', 'la', 'que'               // Spanish words
  ];

  const renderUserProfile = () => {
    if (!userProfile) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Profile</Text>
        <View style={styles.profileInfo}>
          <Text style={styles.profileLabel}>Home Language:</Text>
          <Text style={styles.profileValue}>
            {UserLanguageProfileService.getLanguageDisplayName(userProfile.nativeLanguage)} ({userProfile.nativeLanguage})
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileLabel}>Learning:</Text>
          <Text style={styles.profileValue}>
            {userProfile.targetLanguages.map(lang => 
              UserLanguageProfileService.getLanguageDisplayName(lang)
            ).join(', ')}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileLabel}>Total Lookups:</Text>
          <Text style={styles.profileValue}>{userProfile.totalLookups}</Text>
        </View>
      </View>
    );
  };

  const renderLookupResult = () => {
    if (!lookupResult) return null;

    if (!lookupResult.success) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Result</Text>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{lookupResult.error}</Text>
            {lookupResult.suggestions && lookupResult.suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Did you mean:</Text>
                {lookupResult.suggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionButton}
                    onPress={() => {
                      setSearchWord(suggestion);
                      handleLookupWord();
                    }}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      );
    }

    const { primaryDefinition } = lookupResult;
    if (!primaryDefinition) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Result</Text>
        
        {/* Word Header */}
        <View style={styles.wordHeader}>
          <Text style={styles.wordTitle}>{primaryDefinition.word}</Text>
          <Text style={styles.wordLanguage}>
            {UserLanguageProfileService.getLanguageDisplayName(primaryDefinition.language, userProfile?.nativeLanguage)}
          </Text>
        </View>

        {/* Translations */}
        {primaryDefinition.translations.length > 0 && (
          <View style={styles.translationsSection}>
            <Text style={styles.subsectionTitle}>Translations to your language:</Text>
            {primaryDefinition.translations.slice(0, 3).map((translation, index) => (
              <View key={index} style={styles.translationItem}>
                <Text style={styles.translationWord}>{translation.word}</Text>
                <Text style={styles.translationConfidence}>
                  {Math.round(translation.confidence * 100)}% confident
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Definitions */}
        {primaryDefinition.definitions.length > 0 && (
          <View style={styles.definitionsSection}>
            <Text style={styles.subsectionTitle}>Definitions:</Text>
            {primaryDefinition.definitions.slice(0, 2).map((def, index) => (
              <View key={index} style={styles.definitionItem}>
                <Text style={styles.partOfSpeech}>{def.partOfSpeech}</Text>
                <Text style={styles.definitionText}>{def.definition}</Text>
                {def.example && (
                  <Text style={styles.exampleText}>Example: {def.example}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Metadata */}
        <View style={styles.metadataSection}>
          {primaryDefinition.frequency && (
            <Text style={styles.metadataText}>
              Frequency: {primaryDefinition.frequency.toLocaleString()}
            </Text>
          )}
          {primaryDefinition.difficulty && (
            <Text style={styles.metadataText}>
              Level: {primaryDefinition.difficulty}
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (!initialized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack}>
            <Text style={[styles.backButton, { color: theme.colors.primary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.headerText }]}>
            Dictionary Test
          </Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Initializing dictionary services...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Text style={[styles.backButton, { color: theme.colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.headerText }]}>
          Dictionary Test
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Service Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Status</Text>
          <View style={styles.profileInfo}>
            <Text style={styles.profileLabel}>SQLite Dictionary:</Text>
            <Text style={styles.profileValue}>
              {serviceStatus.sqliteReady ? '✅ Ready' : '❌ Not Ready'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileLabel}>Translation Service:</Text>
            <Text style={styles.profileValue}>
              {serviceStatus.translationReady ? '✅ Ready' : '❌ Not Ready'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileLabel}>Available Languages:</Text>
            <Text style={styles.profileValue}>
              {serviceStatus.availableLanguages.join(', ') || 'None'}
            </Text>
          </View>
        </View>

        {/* User Profile Info */}
        {renderUserProfile()}

        {/* Search Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search Dictionary</Text>
          
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              value={searchWord}
              onChangeText={setSearchWord}
              placeholder="Enter a word to look up..."
              placeholderTextColor={theme.colors.textSecondary}
              returnKeyType="search"
              onSubmitEditing={handleLookupWord}
            />
            <TouchableOpacity
              style={[styles.searchButton, isLoading && styles.searchButtonDisabled]}
              onPress={handleLookupWord}
              disabled={isLoading || !searchWord.trim()}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.colors.background} />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.testWordsContainer}>
            <Text style={styles.testWordsTitle}>Test with these words:</Text>
            <View style={styles.testWordsGrid}>
              {testWords.map((word) => (
                <TouchableOpacity
                  key={word}
                  style={styles.testWordButton}
                  onPress={() => {
                    setSearchWord(word);
                    // Auto-search after a brief delay
                    setTimeout(() => handleLookupWord(), 100);
                  }}
                >
                  <Text style={styles.testWordText}>{word}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Results */}
        {renderLookupResult()}

        {/* Sentence Translation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sentence Translation</Text>
          
          <View style={styles.searchContainer}>
            <TextInput
              style={[styles.searchInput, { height: 80 }]}
              value={sentenceText}
              onChangeText={setSentenceText}
              placeholder="Enter a sentence to translate..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
          
          <TouchableOpacity
            style={[styles.searchButton, { alignSelf: 'flex-start' }, isLoading && styles.searchButtonDisabled]}
            onPress={handleTranslateSentence}
            disabled={isLoading || !sentenceText.trim()}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.colors.background} />
            ) : (
              <Text style={styles.searchButtonText}>Translate</Text>
            )}
          </TouchableOpacity>

          {translationResult && (
            <View style={styles.section}>
              <Text style={styles.subsectionTitle}>Translation Result:</Text>
              <View style={styles.definitionItem}>
                <Text style={styles.definitionText}>{translationResult}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.border + '40',
    backgroundColor: theme.colors.header + 'F8',
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  profileInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginBottom: 8,
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  profileValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    height: 48,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.colors.text,
  },
  searchButton: {
    paddingHorizontal: 20,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.background,
  },
  testWordsContainer: {
    marginTop: 8,
  },
  testWordsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  testWordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  testWordButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  testWordText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 16,
  },
  wordTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  wordLanguage: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  translationsSection: {
    marginBottom: 16,
  },
  translationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginBottom: 4,
  },
  translationWord: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  translationConfidence: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  definitionsSection: {
    marginBottom: 16,
  },
  definitionItem: {
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginBottom: 8,
  },
  partOfSpeech: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  definitionText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  metadataSection: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  metadataText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: theme.colors.error + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.error + '40',
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.error,
    marginBottom: 12,
  },
  suggestionsContainer: {
    marginTop: 8,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  suggestionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 14,
    color: theme.colors.primary,
  },
});