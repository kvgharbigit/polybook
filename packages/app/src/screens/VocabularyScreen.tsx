import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '../navigation/SimpleNavigator';
import { db } from '../services/databaseInterface';
import type { VocabularyCard } from '@polybook/shared';

export default function VocabularyScreen() {
  const { goBack } = useNavigation();
  const [vocabularyCards, setVocabularyCards] = useState<VocabularyCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVocabularyCards();
  }, []);

  const loadVocabularyCards = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Load all vocabulary cards
      const cards = await db.getVocabularyCards();
      setVocabularyCards(cards);
      
      console.log('Loaded vocabulary cards:', cards.length);
    } catch (error) {
      console.error('Error loading vocabulary cards:', error);
      setError('Failed to load vocabulary');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCard = (cardId: string, word: string) => {
    Alert.alert(
      'Delete Word',
      `Are you sure you want to delete "${word}" from your vocabulary?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.deleteVocabularyCard(cardId);
              await loadVocabularyCards(); // Refresh the list
              console.log('Vocabulary card deleted:', cardId);
            } catch (error) {
              console.error('Error deleting vocabulary card:', error);
              Alert.alert('Error', 'Failed to delete word');
            }
          },
        },
      ],
    );
  };

  const renderVocabularyCard = ({ item }: { item: VocabularyCard }) => {
    const createdDate = item.createdAt.toLocaleDateString();
    
    return (
      <View style={styles.cardContainer}>
        <View style={styles.cardHeader}>
          <Text style={styles.headword}>{item.headword}</Text>
          <View style={styles.languageBadge}>
            <Text style={styles.languageText}>
              {item.sourceLanguage.toUpperCase()} → {item.targetLanguage.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.translation}>{item.translation}</Text>
        
        {item.definition && (
          <Text style={styles.definition}>{item.definition}</Text>
        )}

        <View style={styles.contextContainer}>
          <Text style={styles.contextLabel}>Context:</Text>
          <Text style={styles.context}>"{item.sourceContext}"</Text>
        </View>

        {item.examples && item.examples.length > 0 && (
          <View style={styles.examplesContainer}>
            <Text style={styles.examplesLabel}>Examples:</Text>
            {item.examples.slice(0, 2).map((example, index) => (
              <Text key={index} style={styles.example}>• {example}</Text>
            ))}
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.metadata}>
            Added: {createdDate} • {item.srsState}
            {item.frequency && ` • ${item.frequency > 1000 ? 'Common' : 'Rare'}`}
          </Text>
          
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteCard(item.id, item.headword)}
          >
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No vocabulary yet</Text>
      <Text style={styles.emptySubtitle}>
        Start saving words by tapping them while reading books
      </Text>
      <TouchableOpacity 
        style={styles.emptyButton}
        onPress={() => goBack()}
      >
        <Text style={styles.emptyButtonText}>Start Reading</Text>
      </TouchableOpacity>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Error Loading Vocabulary</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={loadVocabularyCards}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Vocabulary</Text>
        <View style={styles.headerRight}>
          <Text style={styles.wordCount}>{vocabularyCards.length} words</Text>
        </View>
      </View>

      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading vocabulary...</Text>
          </View>
        ) : error ? (
          renderError()
        ) : vocabularyCards.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={vocabularyCards}
            renderItem={renderVocabularyCard}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            onRefresh={loadVocabularyCards}
            refreshing={isLoading}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  wordCount: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#e74c3c',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 20,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2c3e50',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    marginBottom: 32,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 20,
  },
  cardContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headword: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  languageBadge: {
    backgroundColor: '#3498db',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  languageText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  translation: {
    fontSize: 16,
    color: '#27ae60',
    fontWeight: '600',
    marginBottom: 8,
  },
  definition: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  contextContainer: {
    backgroundColor: '#ecf0f1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  contextLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#7f8c8d',
    marginBottom: 4,
  },
  context: {
    fontSize: 14,
    color: '#2c3e50',
    fontStyle: 'italic',
  },
  examplesContainer: {
    marginBottom: 12,
  },
  examplesLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#7f8c8d',
    marginBottom: 4,
  },
  example: {
    fontSize: 13,
    color: '#34495e',
    marginBottom: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metadata: {
    fontSize: 11,
    color: '#95a5a6',
    flex: 1,
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 16,
  },
});