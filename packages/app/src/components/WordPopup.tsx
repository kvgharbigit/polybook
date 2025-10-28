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
  Linking,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { BilingualWordDefinition, DictionaryLookupResponse } from '@polybook/shared/src/types';
import SQLiteDictionaryService from '../services/sqliteDictionaryService';
import { Translation } from '../services';
import { getDictionaryUrls, getLanguageName as getLangName } from '../utils/dictionaries';

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
  sentenceContext?: string; // Full sentence containing the word
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
  sentenceContext,
}) => {
  const [lookupResult, setLookupResult] = useState<DictionaryLookupResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [translationResult, setTranslationResult] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedTranslation, setSelectedTranslation] = useState<string | null>(null);
  const [selectedPartOfSpeech, setSelectedPartOfSpeech] = useState<string | null>(null);
  const [wordDefinitions, setWordDefinitions] = useState<any[]>([]);
  const [currentPartOfSpeechIndex, setCurrentPartOfSpeechIndex] = useState(0);
  const [currentSynonymIndex, setCurrentSynonymIndex] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  useEffect(() => {
    if (visible) {
      // Reset translation state for new word lookup
      setTranslationResult(null);
      setIsTranslating(false);
      setSelectedTranslation(null);
      setSelectedPartOfSpeech(null);
      setWordDefinitions([]);
      setCurrentPartOfSpeechIndex(0);
      setCurrentSynonymIndex(0);
      
      setLoading(true);
      performAllTranslations();
      
      // Fast, smooth animation in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Quick exit animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, word]);

  // Note: Sentence translation now happens automatically in performAllTranslations()

  const getAlternativeTranslations = async (word: string): Promise<string[]> => {
    try {
      // Try to get alternatives from our local WikiDict database
      const sourceLanguage = userProfile.targetLanguages[0] || 'en';
      const targetLanguage = userProfile.nativeLanguage;
      
      console.log(`🔄 Fetching alternative translations for "${word}" from local database`);
      
      const response = await SQLiteDictionaryService.lookupWord({
        word: word.trim(),
        sourceLanguage,
        userProfile
      });
      
      if (response.success && response.primaryDefinition?.translations) {
        const alternatives = response.primaryDefinition.translations
          .map(t => t.word)
          .filter(t => t && t.length > 0)
          .slice(0, 5); // Limit to 5 alternatives
        
        console.log(`🔄 Found ${alternatives.length} alternative translations:`, alternatives);
        return alternatives;
      }
    } catch (error) {
      console.log(`🔄 Could not fetch alternatives from local database:`, error.message);
    }
    
    // Fallback: return empty array if no alternatives found
    return [];
  };

  const performAllTranslations = async () => {
    try {
      console.log(`🎯 WordPopup: Starting comprehensive translation for "${word}"`);
      
      // Get source and target languages
      const sourceLanguage = userProfile.targetLanguages[0] || 'en';
      const targetLanguage = userProfile.nativeLanguage;
      
      console.log(`🎯 WordPopup: Using WikiDict for word translation, ML for sentence`);
      
      // 1. Try WikiDict first for single word (structured data with parts of speech)
      let wordLookupSuccess = false;
      try {
        console.log(`🎯 WordPopup: Attempting WikiDict lookup for "${word.trim()}"`);
        const wikiResponse = await SQLiteDictionaryService.lookupWord({
          word: word.trim(),
          sourceLanguage,
          userProfile
        });
        
        console.log(`🎯 WordPopup: Full WikiDict response structure:`, JSON.stringify(wikiResponse, null, 2));
        
        if (wikiResponse.success) {
          console.log(`🎯 WordPopup: WikiDict SUCCESS - analyzing structure...`);
          console.log(`🎯 WordPopup: - Has primaryDefinition:`, !!wikiResponse.primaryDefinition);
          console.log(`🎯 WordPopup: - Has definitions:`, !!wikiResponse.primaryDefinition?.definitions);
          console.log(`🎯 WordPopup: - Has translations:`, !!wikiResponse.primaryDefinition?.translations);
          console.log(`🎯 WordPopup: - Has alternatives:`, !!wikiResponse.alternatives);
          
          if (wikiResponse.primaryDefinition) {
            console.log(`🎯 WordPopup: Primary definition keys:`, Object.keys(wikiResponse.primaryDefinition));
            console.log(`🎯 WordPopup: Primary definition:`, JSON.stringify(wikiResponse.primaryDefinition, null, 2));
          }
        } else {
          console.log(`🎯 WordPopup: WikiDict FAILED:`, wikiResponse.error);
        }
        
        if (wikiResponse.success && wikiResponse.primaryDefinition?.definitions) {
          console.log(`🎯 WordPopup: ✅ WikiDict lookup successful for "${word}"`);
          console.log(`🎯 WordPopup: WikiDict response:`, JSON.stringify(wikiResponse.primaryDefinition, null, 2));
          
          // Get all translations from the top level for cycling
          const allTranslations = wikiResponse.primaryDefinition.translations || [];
          const mainTranslations = allTranslations
            .map((t: any) => t.word)
            .filter((w: string) => w && w.length > 0)
            .slice(0, 5);
          
          console.log(`🔍 Found ${mainTranslations.length} main translations:`, mainTranslations);
          
          // Create semantic meaning groups - each definition is a different meaning
          const meaningGroups: any[] = [];
          
          wikiResponse.primaryDefinition.definitions.forEach((def: any, index: number) => {
            const partOfSpeech = def.partOfSpeech || 'general';
            console.log(`🔍 Processing definition ${index + 1}: ${partOfSpeech}`, def);
            
            // For this specific meaning, get appropriate synonyms
            let meaningSynonyms: string[] = [];
            
            // Each meaning gets the main translation as primary option
            if (mainTranslations.length > 0) {
              meaningSynonyms.push(mainTranslations[0]); // "frío" for all meanings
            }
            
            // Add definition-specific synonyms if available
            if (def.synonyms && Array.isArray(def.synonyms)) {
              meaningSynonyms.push(...def.synonyms.filter((s: string) => s && s.length > 0));
            }
            
            // If this meaning doesn't have specific synonyms, add other main translations
            if (meaningSynonyms.length <= 1 && mainTranslations.length > 1) {
              meaningSynonyms.push(...mainTranslations.slice(1)); // Add "algente", "frígido"
            }
            
            // Remove duplicates and the original word
            meaningSynonyms = [...new Set(meaningSynonyms)]
              .filter(s => s !== word && s.length > 0)
              .slice(0, 5);
            
            console.log(`🔍 Meaning ${index + 1} synonyms:`, meaningSynonyms);
            
            if (meaningSynonyms.length > 0) {
              meaningGroups.push({
                partOfSpeech: partOfSpeech,
                definitions: [{
                  synonyms: meaningSynonyms,
                  definition: def.definition || `${partOfSpeech} form of "${word}"`,
                  example: def.example
                }],
                emoji: getPartOfSpeechIcon(partOfSpeech),
                meaningIndex: index + 1,
                meaningDescription: def.definition ? def.definition.split('-')[1]?.trim() || def.definition : `meaning ${index + 1}`
              });
            }
          });
          
          // Remove duplicate meanings that show identical UI content
          const deduplicatedMeanings = meaningGroups.filter((meaning, index) => {
            // Check if this meaning is identical to any previous meaning
            for (let i = 0; i < index; i++) {
              const prevMeaning = meaningGroups[i];
              
              // Compare primary translation (first synonym)
              const currentPrimaryTranslation = meaning.definitions[0].synonyms[0];
              const prevPrimaryTranslation = prevMeaning.definitions[0].synonyms[0];
              
              // Compare synonym sets
              const currentSynonyms = meaning.definitions[0].synonyms.sort().join(',');
              const prevSynonyms = prevMeaning.definitions[0].synonyms.sort().join(',');
              
              // If primary translation and synonym set are identical, this is a duplicate
              if (currentPrimaryTranslation === prevPrimaryTranslation && currentSynonyms === prevSynonyms) {
                console.log(`🔍 Removing duplicate meaning ${index + 1}: identical to meaning ${i + 1}`);
                console.log(`🔍 - Same primary: "${currentPrimaryTranslation}"`);
                console.log(`🔍 - Same synonyms: [${currentSynonyms}]`);
                return false; // Remove this duplicate
              }
            }
            return true; // Keep this meaning
          });
          
          console.log(`🔍 Deduplicated ${meaningGroups.length} → ${deduplicatedMeanings.length} meanings`);
          meaningGroups.length = 0;
          meaningGroups.push(...deduplicatedMeanings);
          
          // Fallback to general translations if no specific definitions found
          if (meaningGroups.length === 0 && wikiResponse.primaryDefinition.translations) {
            const generalTranslations = wikiResponse.primaryDefinition.translations
              .map((t: any) => t.word)
              .filter((w: string) => w && w.length > 0 && w !== word)
              .slice(0, 5);
              
            if (generalTranslations.length > 0) {
              meaningGroups.push({
                partOfSpeech: 'general',
                definitions: [{
                  synonyms: generalTranslations,
                  definition: `Translations for "${word}"`,
                  example: null
                }],
                emoji: '📝'
              });
            }
          }
          
          if (meaningGroups.length > 0) {
            setWordDefinitions(meaningGroups);
            setCurrentPartOfSpeechIndex(0);
            setCurrentSynonymIndex(0);
            
            // Set initial translation from first meaning's first synonym
            const firstTranslation = meaningGroups[0]?.definitions[0]?.synonyms[0] || word;
            setLookupResult({
              success: true,
              word: word.trim(),
              sourceLanguage,
              translation: firstTranslation,
              confidence: 0.9
            });
            
            // Mark loading as complete for word translation immediately
            setLoading(false);
            
            wordLookupSuccess = true;
            console.log(`🎯 WordPopup: ✅ INSTANT word translation ready - Set up ${meaningGroups.length} meanings with synonyms:`, 
              meaningGroups.map(g => `${g.emoji} ${g.partOfSpeech}: [${g.definitions[0].synonyms.join(', ')}]`).join(' | '));
          }
        }
      } catch (wikiError) {
        console.log(`🎯 WordPopup: WikiDict lookup failed, falling back to ML translation:`, wikiError.message);
      }
      
      // 2. Fallback to ML translation if WikiDict failed
      if (!wordLookupSuccess) {
        console.log(`🎯 WordPopup: Using ML translation as fallback`);
        const mlResult = await Translation.translate(word.trim(), {
          from: sourceLanguage,
          to: targetLanguage,
          timeoutMs: 5000
        });
        
        if (mlResult?.text) {
          console.log(`🎯 WordPopup: ✅ ML translation: "${word}" → "${mlResult.text}"`);
          
          const mlTranslation = mlResult.text;
          
          // For ML fallback, don't create fake cycling - just show the translation
          setWordDefinitions([]); // Empty array disables cycling UI
          setCurrentPartOfSpeechIndex(0);
          setCurrentSynonymIndex(0);
          
          setLookupResult({
            success: true,
            word: word.trim(),
            sourceLanguage,
            translation: mlTranslation,
            confidence: 0.95
          });
          
          // Mark loading as complete for ML translation immediately
          setLoading(false);
          
          console.log(`🎯 WordPopup: ✅ INSTANT ML fallback translation ready: "${word}" → "${mlTranslation}"`);
        } else {
          throw new Error('Both WikiDict and ML translation failed');
        }
      }
      
      // 3. Sentence translation (always use ML for sentences)
      const promises = [];
      
      // 2. Sentence translation (if available and not metadata)
      let sentencePromise = null;
      if (sentenceContext) {
        const isMetadata = sentenceContext.includes('Project Gutenberg') || 
                          sentenceContext.includes('ebook') ||
                          sentenceContext.includes('United States') ||
                          sentenceContext.includes('copyright') ||
                          sentenceContext.includes('gutenberg.org') ||
                          sentenceContext.length > 600;  // Increased limit for long sentences
        
        if (!isMetadata) {
          const cleanedSentence = sentenceContext
            .replace(/^CHAPTER\s+[IVX]+\s*/i, '')
            .trim();
          
          console.log(`🎯 WordPopup: Also translating sentence: "${cleanedSentence.substring(0, 100)}..."`);
          console.log(`🎯 WordPopup: Full sentence to translate (${cleanedSentence.length} chars): "${cleanedSentence}"`);
          console.log(`🎯 WordPopup: Translation params: ${sourceLanguage} → ${targetLanguage}, timeout: 8000ms`);
          
          sentencePromise = Translation.translate(cleanedSentence, {
            from: sourceLanguage,
            to: targetLanguage,
            timeoutMs: 8000
          });
          promises.push(sentencePromise);
        } else {
          console.log(`🎯 WordPopup: Skipping sentence translation (metadata detected)`);
        }
      }
      
      // Handle sentence translation if we have one
      if (sentencePromise) {
        try {
          const sentenceResult = await sentencePromise;
          if (sentenceResult?.text) {
            setTranslationResult(sentenceResult.text);
            console.log(`🎯 WordPopup: ✅ Sentence translation completed: "${sentenceResult.text}"`);
          }
        } catch (sentenceError) {
          console.log(`🎯 WordPopup: ❌ Sentence translation failed:`, sentenceError.message);
        }
      }
    } catch (error) {
      console.error('🎯 WordPopup: ❌ Translation failed:', error);
      setLookupResult({
        success: false,
        word,
        sourceLanguage: 'unknown',
        error: 'Translation failed',
      });
    } finally {
      // Only set loading to false if no word translation was found
      // (WordDefinitions or ML translation would have already set loading to false)
      if (!lookupResult?.success) {
        setLoading(false);
      }
    }
  };

  const handleSaveWord = () => {
    if (lookupResult?.success && lookupResult.primaryDefinition && onSaveWord) {
      onSaveWord(word, lookupResult.primaryDefinition);
    }
  };

  const handleTranslationSelect = (translationWord: string) => {
    console.log(`🎨 WordPopup UI: User selected translation: "${translationWord}"`);
    setSelectedTranslation(translationWord);
    
    // Find matching definitions for this translation
    const definition = lookupResult?.primaryDefinition;
    if (definition?.definitions) {
      const matchingDefs = definition.definitions.filter(def => 
        def.synonyms?.includes(translationWord) || 
        def.definition.toLowerCase().includes(translationWord.toLowerCase())
      );
      console.log(`🎨 WordPopup UI: Found ${matchingDefs.length} definitions matching "${translationWord}"`);
    }
  };

  const handleSemanticTranslationSelect = (translationWord: string, partOfSpeech: string) => {
    console.log(`🎨 WordPopup UI: User selected semantic translation: "${translationWord}" (${partOfSpeech})`);
    setSelectedTranslation(translationWord);
    setSelectedPartOfSpeech(partOfSpeech);
    
    // Find matching definitions for this translation and part of speech
    const definition = lookupResult?.primaryDefinition;
    if (definition?.definitions) {
      const matchingDefs = definition.definitions.filter(def => 
        def.partOfSpeech === partOfSpeech && (
          def.synonyms?.includes(translationWord) || 
          def.definition.toLowerCase().includes(translationWord.toLowerCase())
        )
      );
      console.log(`🎨 WordPopup UI: Found ${matchingDefs.length} semantic definitions for "${translationWord}" (${partOfSpeech})`);
    }
  };

  const getPartOfSpeechIcon = (partOfSpeech: string) => {
    const icons: Record<string, string> = {
      noun: '🏷️',
      verb: '⚡',
      adjective: '🎨',
      adverb: '🔄',
      pronoun: '👤',
      preposition: '🔗',
      conjunction: '🤝',
      interjection: '❗',
      unknown: '❓',
      general: '📝'
    };
    return icons[partOfSpeech.toLowerCase()] || icons.general;
  };

  const handleTranslateSentence = async () => {
    if (!sentenceContext || isTranslating) {
      console.log(`🎨 WordPopup UI: Skipping translation - sentenceContext: ${!!sentenceContext}, isTranslating: ${isTranslating}`);
      return;
    }
    
    console.log(`🎨 WordPopup UI: Starting sentence translation...`);
    console.log(`🎨 WordPopup UI: Raw sentence context length: ${sentenceContext.length} chars`);
    console.log(`🎨 WordPopup UI: Raw sentence context: "${sentenceContext}"`);
    
    // Check if this is metadata rather than actual content
    const isMetadata = sentenceContext.includes('Project Gutenberg') || 
                      sentenceContext.includes('ebook') ||
                      sentenceContext.includes('United States') ||
                      sentenceContext.includes('copyright') ||
                      sentenceContext.includes('gutenberg.org') ||
                      sentenceContext.length > 600;
    
    if (isMetadata) {
      console.log(`🎨 WordPopup UI: Detected metadata instead of sentence, skipping translation`);
      setTranslationResult('Context not available - this appears to be document metadata');
      return;
    }
    
    // For actual content, do minimal cleaning
    const cleanedSentence = sentenceContext
      .replace(/^CHAPTER\s+[IVX]+\s*/i, '') // Remove chapter headers
      .trim();
    
    console.log(`🎨 WordPopup UI: Using sentence: "${cleanedSentence}"`);
    
    setIsTranslating(true);
    try {
      // Detect source language from user profile
      const sourceLanguage = userProfile.targetLanguages[0] || 'en';
      const targetLanguage = userProfile.nativeLanguage;
      
      console.log(`🎨 WordPopup UI: Translating sentence: "${cleanedSentence}" from ${sourceLanguage} to ${targetLanguage}`);
      
      const result = await Translation.translate(cleanedSentence, {
        from: sourceLanguage,
        to: targetLanguage,
        timeoutMs: 8000
      });
      
      console.log(`🎨 WordPopup UI: Translation service returned:`, result);
      
      if (result.text) {
        console.log(`🎨 WordPopup UI: ✅ Sentence translation success: "${result.text}"`);
        setTranslationResult(result.text);
      } else {
        console.log(`🎨 WordPopup UI: ❌ Translation result has no text`);
        throw new Error('Translation failed - no text returned');
      }
    } catch (error) {
      console.error('🎨 WordPopup UI: ❌ Sentence translation error:', error);
      setTranslationResult('Translation failed. Please try again.');
    } finally {
      setIsTranslating(false);
      console.log(`🎨 WordPopup UI: Translation process completed`);
    }
  };

  // Compact overlay that fits all content
  const getMinimalOverlayStyle = () => {
    return {
      width: screenWidth * 0.94,
      maxHeight: screenHeight * 0.80,
      left: screenWidth * 0.03,
      top: screenHeight * 0.12,
      minHeight: screenHeight * 0.3,
    };
  };

  const renderContent = () => {
    if (loading) {
      console.log(`🎨 WordPopup UI: Rendering loading state for "${word}"`);
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Looking up "{word}"...</Text>
        </View>
      );
    }

    if (!lookupResult || !lookupResult.success) {
      console.log(`🎨 WordPopup UI: Rendering error state for "${word}"`, {
        hasResult: !!lookupResult,
        success: lookupResult?.success,
        error: lookupResult?.error,
        missingLanguages: lookupResult?.missingLanguages
      });
      
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

    // 🎯 SIMPLE TRANSLATION LOGGING
    console.log(`🎯 WordPopup UI: ===== RENDERING TRANSLATION SUCCESS =====`);
    console.log(`🎯 WordPopup UI: Word: "${lookupResult.word}"`);
    console.log(`🎯 WordPopup UI: Translation: "${lookupResult.translation}"`);
    console.log(`🎯 WordPopup UI: Source Language: ${lookupResult.sourceLanguage}`);
    console.log(`🎯 WordPopup UI: Confidence: ${lookupResult.confidence}`);
    console.log(`🎯 WordPopup UI: Sentence context: "${sentenceContext}"`);
    console.log(`🎯 WordPopup UI: Sentence translation: "${translationResult}"`);
    console.log(`🎯 WordPopup UI: ===== END TRANSLATION DATA =====`);
    
    return (
      <View style={styles.readingFlowContent}>
        
        {/* Word Translation - Clean and prominent */}
        <View style={styles.wordSection}>
          <View style={styles.wordTranslationContainer}>
            <TouchableOpacity onPress={() => openOnlineDictionary(lookupResult.word)}>
              <Text style={styles.wordTranslation}>{lookupResult.word}</Text>
            </TouchableOpacity>
            <Text style={styles.wordTranslation}> → </Text>
            
            {wordDefinitions.length > 0 ? (
              <View style={styles.translationCyclingContainer}>
                <TouchableOpacity onPress={cyclePartOfSpeech}>
                  <Text style={styles.partOfSpeechEmoji}>
                    {wordDefinitions[currentPartOfSpeechIndex]?.emoji || '📝'}
                    {wordDefinitions.length > 1 && (
                      <Text style={styles.cycleIndicator}> ({currentPartOfSpeechIndex + 1}/{wordDefinitions.length})</Text>
                    )}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={cycleSynonym}>
                  <Text style={styles.wordTranslation}>
                    {lookupResult.translation}
                    {wordDefinitions[currentPartOfSpeechIndex]?.definitions[0]?.synonyms?.length > 1 && (
                      <Text style={styles.cycleIndicator}> ({currentSynonymIndex + 1}/{wordDefinitions[currentPartOfSpeechIndex].definitions[0].synonyms.length})</Text>
                    )}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.wordTranslation}>{lookupResult.translation}</Text>
            )}
          </View>
        </View>

        {/* Full Sentence Context - Always show when available */}
        {sentenceContext && !sentenceContext.includes('Project Gutenberg') && (
          <View style={styles.contextSection}>
            
            {/* Spanish Translation - Primary for Spanish reader */}
            {translationResult ? (
              <View style={styles.translationBlock}>
                <Text style={styles.translationText}>{translationResult}</Text>
              </View>
            ) : (
              <View style={styles.translationBlock}>
                <Text style={styles.loadingText}>Translating...</Text>
              </View>
            )}
            
            {/* English Original - Always show for context */}
            <View style={styles.originalBlock}>
              {renderClickableText(sentenceContext)}
            </View>
            
          </View>
        )}
        
      </View>
    );
  };


  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '#4CAF50';
      case 'intermediate': return '#FF9800';
      case 'advanced': return '#F44336';
      default: return '#757575';
    }
  };

  const openOnlineDictionary = (rawWord: string) => {
    // Clean the word using Unicode-safe regex for international words
    const cleanWord = rawWord.replace(/[^\p{L}\p{N}'-]/gu, '').toLowerCase();
    if (!cleanWord) return;

    // Get source and target languages
    const sourceLanguage = userProfile.targetLanguages[0] || 'en';
    const nativeLanguage = userProfile.nativeLanguage;
    
    // Get ordered dictionary URLs with fallbacks
    const dictionaryUrls = getDictionaryUrls({
      sourceLang: sourceLanguage,
      nativeLang: nativeLanguage,
      word: cleanWord
    });

    console.log(`🔗 Opening dictionary for "${cleanWord}" (${sourceLanguage} → ${nativeLanguage})`);

    // Try to open the first (best) URL immediately without canOpenURL check
    const primaryUrl = dictionaryUrls[0];
    
    Linking.openURL(primaryUrl)
      .then(() => {
        console.log(`✅ Successfully opened dictionary for "${cleanWord}": ${primaryUrl}`);
      })
      .catch((error) => {
        console.log(`⚠️ Primary dictionary failed: ${error.message}`);
        // Fallback to second option if available
        if (dictionaryUrls[1]) {
          console.log(`🔗 Trying fallback dictionary: ${dictionaryUrls[1]}`);
          Linking.openURL(dictionaryUrls[1])
            .then(() => console.log(`✅ Fallback dictionary opened successfully`))
            .catch((fallbackError) => {
              console.log(`❌ All dictionary options failed: ${fallbackError.message}`);
            });
        }
      });
  };

  const cyclePartOfSpeech = () => {
    if (wordDefinitions.length <= 1) return;
    
    const nextPosIndex = (currentPartOfSpeechIndex + 1) % wordDefinitions.length;
    setCurrentPartOfSpeechIndex(nextPosIndex);
    setCurrentSynonymIndex(0); // Reset to first synonym of new part of speech
    
    // Update translation with first synonym of new part of speech
    const newDefinition = wordDefinitions[nextPosIndex];
    const newTranslation = newDefinition?.definitions[0]?.synonyms[0] || lookupResult?.word || '';
    
    if (lookupResult) {
      setLookupResult({
        ...lookupResult,
        translation: newTranslation
      });
    }
    
    console.log(`🔄 Cycled to part of speech ${nextPosIndex + 1}/${wordDefinitions.length}: ${newDefinition.partOfSpeech} → "${newTranslation}"`);
  };

  const cycleSynonym = () => {
    console.log(`🔄 cycleSynonym called - wordDefinitions.length: ${wordDefinitions.length}`);
    
    if (wordDefinitions.length === 0) {
      console.log(`🔄 No word definitions available`);
      return;
    }
    
    const currentDefinition = wordDefinitions[currentPartOfSpeechIndex];
    console.log(`🔄 Current definition:`, currentDefinition);
    
    if (!currentDefinition?.definitions[0]?.synonyms) {
      console.log(`🔄 No synonyms in current definition`);
      return;
    }
    
    const synonyms = currentDefinition.definitions[0].synonyms;
    console.log(`🔄 Available synonyms:`, synonyms);
    
    if (synonyms.length <= 1) {
      console.log(`🔄 Only ${synonyms.length} synonyms available, cannot cycle`);
      return;
    }
    
    const nextSynIndex = (currentSynonymIndex + 1) % synonyms.length;
    setCurrentSynonymIndex(nextSynIndex);
    
    // Update translation with new synonym
    const newTranslation = synonyms[nextSynIndex];
    if (lookupResult) {
      setLookupResult({
        ...lookupResult,
        translation: newTranslation
      });
    }
    
    console.log(`🔄 Cycled to synonym ${nextSynIndex + 1}/${synonyms.length}: "${newTranslation}"`);
  };

  const renderClickableText = (text: string) => {
    // Split text into words while preserving spaces and punctuation
    const words = text.split(/(\s+)/);
    
    return (
      <Text style={styles.originalText}>
        {words.map((segment, index) => {
          // If it's whitespace, render as normal text
          if (/^\s+$/.test(segment)) {
            return <Text key={index} style={styles.originalText}>{segment}</Text>;
          }
          
          // If it's a word (contains letters), make it clickable
          if (/[a-zA-Z]/.test(segment)) {
            return (
              <Text 
                key={index} 
                style={styles.clickableWord}
                onPress={() => openOnlineDictionary(segment)}
              >
                {segment}
              </Text>
            );
          }
          
          // Otherwise (punctuation), render as normal text
          return <Text key={index} style={styles.originalText}>{segment}</Text>;
        })}
      </Text>
    );
  };

  if (!visible) return null;

  const overlayStyle = getMinimalOverlayStyle();

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
      
      <Animated.View
        style={[
          styles.readingPopup,
          overlayStyle,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <BlurView intensity={95} style={styles.readingBlurContainer}>
          <ScrollView 
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {renderContent()}
          </ScrollView>
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
    marginBottom: 16,
    alignItems: 'center',
  },
  word: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 6,
    textAlign: 'center',
  },
  translation: {
    fontSize: 22,
    fontWeight: '600',
    color: '#4a90e2',
    marginBottom: 10,
    textAlign: 'center',
  },
  languages: {
    fontSize: 11,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'center',
  },
  quickTranslationsSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4a90e2',
  },
  quickTranslationsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4a90e2',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickTranslationsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickTranslationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.2)',
  },
  quickTranslationWord: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
  },
  quickTranslationConfidence: {
    fontSize: 10,
    color: '#4a90e2',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    fontWeight: '600',
  },
  quickTranslationPillSelected: {
    backgroundColor: '#4a90e2',
    borderColor: '#2c5aa0',
    transform: [{ scale: 1.05 }],
  },
  quickTranslationWordSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  quickTranslationConfidenceSelected: {
    color: '#4a90e2',
    backgroundColor: '#ffffff',
  },
  quickTranslationHint: {
    fontSize: 12,
    color: '#4a90e2',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  semanticTranslationsSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8fafe',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6c5ce7',
  },
  semanticTranslationsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6c5ce7',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  semanticGroup: {
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    shadowColor: '#6c5ce7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.1)',
  },
  semanticGroupHeader: {
    marginBottom: 10,
  },
  semanticGroupLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6c5ce7',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  semanticGroupDefinition: {
    fontSize: 12,
    color: '#5a6c7d',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  semanticTranslationsList: {
    flexDirection: 'column',
    gap: 6,
  },
  semanticTranslationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.2)',
  },
  semanticTranslationWord: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
  },
  semanticTranslationConfidence: {
    fontSize: 9,
    color: '#6c5ce7',
    backgroundColor: '#f1f0ff',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    fontWeight: '600',
  },
  semanticTranslationPillSelected: {
    backgroundColor: '#6c5ce7',
    borderColor: '#5a4fcf',
    transform: [{ scale: 1.05 }],
  },
  semanticTranslationWordSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  semanticTranslationConfidenceSelected: {
    color: '#6c5ce7',
    backgroundColor: '#ffffff',
  },
  semanticTranslationHint: {
    fontSize: 12,
    color: '#6c5ce7',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
    backgroundColor: '#f1f0ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  definitionSection: {
    marginBottom: 18,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(74, 144, 226, 0.1)',
    backgroundColor: '#fafbfc',
    borderRadius: 12,
    padding: 16,
  },
  definitionSectionHighlighted: {
    backgroundColor: '#e8f4fd',
    borderWidth: 2,
    borderColor: '#4a90e2',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  partOfSpeech: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e74c3c',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.8,
    backgroundColor: '#fff5f4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  definition: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
    marginBottom: 14,
    fontWeight: '400',
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
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: 'rgba(74, 144, 226, 0.1)',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  metadataItem: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  metadataLabel: {
    fontSize: 10,
    color: '#7f8c8d',
    textTransform: 'uppercase',
    marginBottom: 4,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  metadataValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
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
  translationsSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4a90e2',
  },
  translationsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4a90e2',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  translationsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  translationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  translationWord: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
  },
  translationConfidence: {
    fontSize: 10,
    color: '#4a90e2',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    fontWeight: '600',
  },
  culturalNotesContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#fff9e6',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  culturalNotesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e67e22',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  culturalNote: {
    fontSize: 14,
    color: '#8b4513',
    lineHeight: 20,
    marginBottom: 6,
    fontWeight: '400',
  },
  translationSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: 'rgba(74, 144, 226, 0.15)',
    backgroundColor: '#f8fafe',
    borderRadius: 12,
    padding: 16,
  },
  translationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  translationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4a90e2',
    flex: 1,
  },
  sentenceContainer: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  sentenceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sentenceText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  translationContainer: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  translationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  translationText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    fontWeight: '500',
  },
  translateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  translateButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  translateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#4a90e2',
    marginTop: 12,
  },
  retryButtonText: {
    color: '#4a90e2',
    fontSize: 13,
    fontWeight: '600',
  },
  expandedDefinitionsSection: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#6c5ce7',
    shadowColor: '#6c5ce7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  expandedDefinitionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#f1f0ff',
  },
  expandedDefinitionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6c5ce7',
    flex: 1,
    marginRight: 12,
    lineHeight: 22,
  },
  collapseButton: {
    backgroundColor: '#f1f0ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6c5ce7',
  },
  collapseButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c5ce7',
  },
  expandedDefinitionItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  expandedDefinition: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
    marginBottom: 12,
    fontWeight: '500',
  },
  expandedExampleContainer: {
    marginTop: 12,
    paddingLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#6c5ce7',
    backgroundColor: '#f8f7ff',
    borderRadius: 8,
    padding: 12,
  },
  expandedExampleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6c5ce7',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expandedExample: {
    fontSize: 14,
    color: '#5a4fcf',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  expandedSynonymsContainer: {
    marginTop: 12,
    backgroundColor: '#f8fafe',
    borderRadius: 8,
    padding: 12,
  },
  expandedSynonymsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6c5ce7',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expandedSynonyms: {
    fontSize: 14,
    color: '#5a6c7d',
    lineHeight: 20,
    fontWeight: '500',
  },
  inlineDefinition: {
    marginTop: 8,
    marginLeft: 12,
    padding: 12,
    backgroundColor: '#f8f7ff',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6c5ce7',
  },
  inlineDefinitionText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
    marginBottom: 6,
  },
  inlineExample: {
    fontSize: 12,
    color: '#6c5ce7',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  clearSelectionButton: {
    alignSelf: 'center',
    backgroundColor: '#f1f0ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#6c5ce7',
  },
  clearSelectionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6c5ce7',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  translationPillsSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8fafe',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6c5ce7',
  },
  pillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  translationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
    shadowColor: '#6c5ce7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.2)',
  },
  translationPillSelected: {
    backgroundColor: '#6c5ce7',
    borderColor: '#5a4fcf',
    transform: [{ scale: 1.05 }],
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  translationPillText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
  },
  translationPillTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  translationPillConfidence: {
    fontSize: 9,
    color: '#6c5ce7',
    backgroundColor: '#f1f0ff',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    fontWeight: '600',
  },
  translationPillConfidenceSelected: {
    color: '#6c5ce7',
    backgroundColor: '#ffffff',
  },
  definitionCard: {
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#6c5ce7',
    shadowColor: '#6c5ce7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  definitionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#f1f0ff',
  },
  definitionCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6c5ce7',
    flex: 1,
  },
  definitionCardPartOfSpeech: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6c5ce7',
    backgroundColor: '#f1f0ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  definitionCardText: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
    marginBottom: 16,
    fontWeight: '500',
  },
  definitionCardExample: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f7ff',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6c5ce7',
  },
  definitionCardExampleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6c5ce7',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  definitionCardExampleText: {
    fontSize: 14,
    color: '#5a4fcf',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  definitionCardSynonyms: {
    padding: 12,
    backgroundColor: '#f8fafe',
    borderRadius: 8,
  },
  definitionCardSynonymsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6c5ce7',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  definitionCardSynonymsText: {
    fontSize: 14,
    color: '#5a6c7d',
    lineHeight: 20,
    fontWeight: '500',
  },
  sentenceTranslationSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4a90e2',
  },
  sentenceTranslationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  sentenceTranslationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4a90e2',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sentenceOriginal: {
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 8,
    marginBottom: 8,
  },
  sentenceOriginalText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  sentenceTranslated: {
    padding: 10,
    backgroundColor: 'rgba(74, 144, 226, 0.08)',
    borderRadius: 8,
  },
  sentenceTranslatedText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
    fontWeight: '500',
  },
  wordTranslationSection: {
    marginBottom: 24,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#4a90e2',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  wordPair: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 16,
  },
  sourceWord: {
    fontSize: 24,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
    textAlign: 'right',
  },
  arrow: {
    fontSize: 20,
    color: '#4a90e2',
    fontWeight: 'bold',
  },
  translatedWord: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4a90e2',
    flex: 1,
    textAlign: 'left',
  },
  languagePair: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  languageLabels: {
    fontSize: 11,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceScore: {
    fontSize: 10,
    color: '#4a90e2',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    fontWeight: '600',
  },
  completeTranslationSection: {
    gap: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  wordTranslationCard: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#4a90e2',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    alignItems: 'center',
  },
  sentenceContextCard: {
    padding: 20,
    backgroundColor: '#f8fafe',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#6c5ce7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  translatedSentenceContainer: {
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  translatedSentenceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  translatedSentenceText: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
    fontWeight: '500',
  },
  originalSentenceContainer: {
    padding: 14,
    backgroundColor: '#f0f4f8',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4a90e2',
  },
  originalSentenceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4a90e2',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  originalSentenceText: {
    fontSize: 15,
    color: '#5a6c7d',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  // Full Screen Styles
  fullScreenPopup: {
    position: 'absolute',
    borderRadius: 0,
    overflow: 'hidden',
  },
  fullScreenBlurContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    padding: 40,
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: 60,
    right: 30,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    padding: 4,
  },
  fullScreenContent: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  wordTranslationSection: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 40,
    marginBottom: 30,
    alignItems: 'center',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 3,
    borderColor: '#4a90e2',
  },
  sentenceSection: {
    backgroundColor: '#f8fafe',
    borderRadius: 24,
    padding: 30,
    borderLeftWidth: 6,
    borderLeftColor: '#6c5ce7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  translatedSentenceArea: {
    backgroundColor: '#e8f5e8',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  originalSentenceArea: {
    backgroundColor: '#f0f4f8',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4a90e2',
  },
  sentenceLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  translatedSentence: {
    fontSize: 18,
    color: '#2c3e50',
    lineHeight: 28,
    fontWeight: '500',
  },
  originalSentence: {
    fontSize: 17,
    color: '#5a6c7d',
    lineHeight: 26,
    fontStyle: 'italic',
  },
  
  // Reading Flow Optimized Styles
  readingPopup: {
    position: 'absolute',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  readingBlurContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
    minHeight: '100%',
  },
  readingFlowContent: {
    gap: 10,
  },
  wordSection: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4a90e2',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 60,
    width: '100%',
  },
  wordTranslationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  wordTranslation: {
    fontSize: 19,
    fontWeight: '700',
    color: '#2c3e50',
    textAlign: 'center',
    lineHeight: 24,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  translationCyclingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partOfSpeechEmoji: {
    fontSize: 16,
    fontWeight: '700',
  },
  cycleIndicator: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    opacity: 0.7,
  },
  contextSection: {
    gap: 8,
    width: '100%',
  },
  translationBlock: {
    backgroundColor: '#e8f5e8',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
    width: '100%',
    minHeight: 50,
  },
  translationText: {
    fontSize: 15,
    color: '#2c3e50',
    lineHeight: 21,
    fontWeight: '500',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  originalBlock: {
    backgroundColor: '#f0f4f8',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4a90e2',
    width: '100%',
    minHeight: 50,
  },
  originalText: {
    fontSize: 14,
    color: '#5a6c7d',
    lineHeight: 20,
    fontStyle: 'italic',
    flexWrap: 'wrap',
    flexShrink: 1,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    opacity: 0.8,
  },
  clickableWordContainer: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderRadius: 4,
    paddingHorizontal: 2,
    paddingVertical: 1,
    marginHorizontal: 1,
  },
  clickableWord: {
    fontSize: 14,
    color: '#4a90e2',
    lineHeight: 20,
    fontStyle: 'italic',
    textDecorationLine: 'underline',
    textDecorationColor: '#4a90e2',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});

export default WordPopup;