import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { BilingualWordDefinition, DictionaryLookupResponse } from '@polybook/shared/src/types';
import SQLiteDictionaryService from '../services/sqliteDictionaryService';

interface WordPopupProps {
  word: string;
  visible: boolean;
  onClose: () => void;
  position?: { x: number; y: number };
  userProfile: {
    nativeLanguage: string;
    targetLanguages: string[];
  };
  onSaveWord?: (word: string, definition: BilingualWordDefinition) => void;
  onNavigateToLanguagePacks?: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const WordPopup: React.FC<WordPopupProps> = ({
  word,
  visible,
  onClose,
  position = { x: screenWidth / 2, y: screenHeight / 2 },
  userProfile,
  onSaveWord,
  onNavigateToLanguagePacks,
}) => {
  const [lookupResult, setLookupResult] = useState<DictionaryLookupResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  useEffect(() => {
    if (visible) {
      setLoading(true);
      performLookup();
      
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, word]);

  const performLookup = async () => {
    try {
      // Get fresh user profile if the passed one seems wrong or missing
      let actualUserProfile = userProfile;
      
      if (!userProfile || (!userProfile.nativeLanguage || userProfile.nativeLanguage === 'en')) {
        console.log('📚 WordPopup: Getting fresh user profile...');
        try {
          const UserLanguageProfileService = (await import('../services/userLanguageProfileService')).default;
          const freshProfile = await UserLanguageProfileService.getUserProfile();
          console.log('📚 WordPopup: Fresh profile loaded:', freshProfile);
          actualUserProfile = freshProfile;
        } catch (error) {
          console.error('📚 WordPopup: Failed to load fresh profile:', error);
        }
      }
      
      console.log('📚 WordPopup: Using profile for lookup:', actualUserProfile);
      
      const result = await SQLiteDictionaryService.lookupWord({
        word: word.trim(),
        userProfile: actualUserProfile,
      });
      
      setLookupResult(result);
    } catch (error) {
      console.error('Word lookup failed:', error);
      setLookupResult({
        success: false,
        word,
        sourceLanguage: 'unknown',
        error: 'Lookup failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWord = () => {
    if (lookupResult?.success && lookupResult.primaryDefinition && onSaveWord) {
      onSaveWord(word, lookupResult.primaryDefinition);
    }
  };

  const calculatePopupPosition = () => {
    const popupWidth = Math.min(screenWidth * 0.9, 350);
    const popupHeight = 400;
    
    let x = position.x - popupWidth / 2;
    let y = position.y - popupHeight / 2;
    
    // Keep popup on screen
    x = Math.max(20, Math.min(x, screenWidth - popupWidth - 20));
    y = Math.max(50, Math.min(y, screenHeight - popupHeight - 50));
    
    return { x, y, width: popupWidth, height: popupHeight };
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Looking up "{word}"...</Text>
        </View>
      );
    }

    if (!lookupResult || !lookupResult.success) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={48} color="#FF6B6B" />
          <Text style={styles.errorTitle}>Word not found</Text>
          <Text style={styles.errorMessage}>
            {lookupResult?.error || `Could not find definition for "${word}"`}
          </Text>
          
          {lookupResult?.missingLanguages && lookupResult.missingLanguages.length > 0 && (
            <View style={styles.missingLanguagesContainer}>
              <Text style={styles.missingLanguagesTitle}>Missing language packs:</Text>
              {lookupResult.missingLanguages.map((lang) => (
                <Text key={lang} style={styles.missingLanguage}>
                  • {getLanguageName(lang)}
                </Text>
              ))}
              <Text style={styles.missingLanguagesHint}>
                Download these packs to enable dictionary lookup
              </Text>
              
              {onNavigateToLanguagePacks && (
                <TouchableOpacity 
                  style={styles.downloadButton}
                  onPress={() => {
                    onClose();
                    onNavigateToLanguagePacks();
                  }}
                >
                  <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.downloadButtonText}>Download Language Packs</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      );
    }

    const definition = lookupResult.primaryDefinition!;
    
    return (
      <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
        {/* Word Header */}
        <View style={styles.wordHeader}>
          <Text style={styles.word}>{definition.word}</Text>
          {definition.translations && definition.translations.length > 0 && (
            <Text style={styles.translation}>
              {definition.translations[0].word}
            </Text>
          )}
          <Text style={styles.languages}>
            {getLanguageName(definition.language)} → {getLanguageName(userProfile.nativeLanguage)}
          </Text>
        </View>

        {/* Definitions */}
        {definition.definitions && definition.definitions.map((def, index) => (
          <View key={index} style={styles.definitionSection}>
            {def.partOfSpeech && def.partOfSpeech !== 'unknown' && (
              <Text style={styles.partOfSpeech}>{def.partOfSpeech}</Text>
            )}
            <Text style={styles.definition}>{def.definition}</Text>
            
            {def.example && (
              <View style={styles.exampleContainer}>
                <Text style={styles.exampleLabel}>Example:</Text>
                <Text style={styles.example}>"{def.example}"</Text>
              </View>
            )}
            
            {def.synonyms && def.synonyms.length > 0 && (
              <View style={styles.synonymsContainer}>
                <Text style={styles.synonymsLabel}>Synonyms:</Text>
                <Text style={styles.synonyms}>{def.synonyms.join(', ')}</Text>
              </View>
            )}
          </View>
        ))}

        {/* Cross-language data */}
        {definition.crossLanguageData && (
          <View style={styles.crossLanguageSection}>
            {definition.crossLanguageData.targetSynonyms && 
             definition.crossLanguageData.targetSynonyms.length > 0 && (
              <View style={styles.synonymsContainer}>
                <Text style={styles.synonymsLabel}>
                  {getLanguageName(userProfile.nativeLanguage)} synonyms:
                </Text>
                <Text style={styles.synonyms}>
                  {definition.crossLanguageData.targetSynonyms.join(', ')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Etymology */}
        {definition.etymology && (
          <View style={styles.etymologySection}>
            <Text style={styles.etymologyLabel}>Etymology:</Text>
            <Text style={styles.etymology}>{definition.etymology.text}</Text>
          </View>
        )}

        {/* Frequency and Difficulty */}
        <View style={styles.metadataContainer}>
          {definition.frequency && (
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Frequency:</Text>
              <Text style={styles.metadataValue}>#{definition.frequency}</Text>
            </View>
          )}
          {definition.difficulty && (
            <View style={styles.metadataItem}>
              <Text style={styles.metadataLabel}>Level:</Text>
              <Text style={[styles.metadataValue, { color: getDifficultyColor(definition.difficulty) }]}>
                {definition.difficulty}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const getLanguageName = (code: string) => {
    const names: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      zh: 'Mandarin',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      ja: 'Japanese',
      ko: 'Korean',
      ar: 'Arabic',
      hi: 'Hindi',
    };
    return names[code] || code;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '#4CAF50';
      case 'intermediate': return '#FF9800';
      case 'advanced': return '#F44336';
      default: return '#757575';
    }
  };

  if (!visible) return null;

  const popupStyle = calculatePopupPosition();

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
      
      <Animated.View
        style={[
          styles.popup,
          {
            left: popupStyle.x,
            top: popupStyle.y,
            width: popupStyle.width,
            height: popupStyle.height,
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <BlurView intensity={100} style={styles.blurContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Dictionary</Text>
            <View style={styles.headerActions}>
              {lookupResult?.success && onSaveWord && (
                <TouchableOpacity onPress={handleSaveWord} style={styles.saveButton}>
                  <Ionicons name="bookmark-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {renderContent()}
          </View>
        </BlurView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  popup: {
    position: 'absolute',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  blurContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveButton: {
    padding: 8,
    marginRight: 4,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contentScroll: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF6B6B',
    marginTop: 12,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  missingLanguagesContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 8,
    alignSelf: 'stretch',
  },
  missingLanguagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
    marginBottom: 8,
  },
  missingLanguage: {
    fontSize: 14,
    color: '#FF6B6B',
    marginBottom: 4,
  },
  missingLanguagesHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  wordHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  word: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  translation: {
    fontSize: 20,
    fontWeight: '500',
    color: '#007AFF',
    marginBottom: 8,
  },
  languages: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  definitionSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  partOfSpeech: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  definition: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    marginBottom: 12,
  },
  exampleContainer: {
    marginTop: 8,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#E0E0E0',
  },
  exampleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  example: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  synonymsContainer: {
    marginTop: 12,
  },
  synonymsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  synonyms: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  crossLanguageSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  etymologySection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    borderRadius: 8,
  },
  etymologyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 6,
  },
  etymology: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  metadataContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  metadataItem: {
    alignItems: 'center',
  },
  metadataLabel: {
    fontSize: 10,
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metadataValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default WordPopup;