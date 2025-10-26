import React, { useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppStore } from '../store/appStore';
import { Book } from '@polybook/shared';

export default function LibraryScreen() {
  const navigation = useNavigation();
  const { books, isLoading, loadBooks } = useAppStore(state => ({
    books: state.books,
    isLoading: state.isLoading,
    loadBooks: state.loadBooks
  }));

  // Reload books when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadBooks();
    }, [loadBooks])
  );

  const renderBookItem = ({ item }: { item: Book }) => {
    // Calculate progress from position data (mock for now)
    const progress = item.lastPosition ? 0.25 : 0; // Will be calculated properly later
    const lastReadDate = item.lastPosition 
      ? item.lastPosition.updatedAt.toLocaleDateString()
      : item.addedAt.toLocaleDateString();

    return (
    <TouchableOpacity 
      style={styles.bookItem}
      onPress={() => navigation.navigate('Reader' as never, { id: item.id } as never)}
    >
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle}>{item.title}</Text>
        <Text style={styles.bookAuthor}>{item.author}</Text>
        <Text style={styles.bookLanguage}>
          {item.language.toUpperCase()} → {item.targetLanguage.toUpperCase()}
        </Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { width: `${progress * 100}%` }]} 
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
        <Text style={styles.lastRead}>Last read: {lastReadDate}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {books.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No books yet</Text>
            <Text style={styles.emptySubtitle}>
              Import your first book to get started
            </Text>
            <TouchableOpacity 
              style={styles.importButton}
              onPress={() => navigation.navigate('Home' as never)}
            >
              <Text style={styles.importButtonText}>Import Book</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={books}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={loadBooks} />
            }
            renderItem={renderBookItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
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
  content: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2c3e50',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    color: '#7f8c8d',
  },
  importButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  importButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingBottom: 20,
  },
  bookItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#2c3e50',
  },
  bookAuthor: {
    fontSize: 14,
    marginBottom: 8,
    color: '#7f8c8d',
  },
  bookLanguage: {
    fontSize: 12,
    marginBottom: 8,
    color: '#95a5a6',
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#ecf0f1',
    borderRadius: 2,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3498db',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#7f8c8d',
    width: 40,
    textAlign: 'right',
  },
  lastRead: {
    fontSize: 12,
    color: '#95a5a6',
  },
});