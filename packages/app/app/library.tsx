import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { Link, router } from 'expo-router';

// Mock data for now - will be replaced with SQLite data
const mockBooks = [
  {
    id: '1',
    title: 'Don Quixote',
    author: 'Miguel de Cervantes',
    language: 'es',
    progress: 0.15,
    lastRead: '2024-10-20',
  },
  {
    id: '2', 
    title: 'La Casa de Bernarda Alba',
    author: 'Federico García Lorca',
    language: 'es',
    progress: 0.45,
    lastRead: '2024-10-18',
  }
];

export default function LibraryScreen() {
  const renderBookItem = ({ item }: { item: typeof mockBooks[0] }) => (
    <TouchableOpacity 
      style={styles.bookItem}
      onPress={() => router.push(`/reader/${item.id}`)}
    >
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle}>{item.title}</Text>
        <Text style={styles.bookAuthor}>{item.author}</Text>
        <Text style={styles.bookLanguage}>
          Language: {item.language.toUpperCase()}
        </Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { width: `${item.progress * 100}%` }]} 
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(item.progress * 100)}%
          </Text>
        </View>
        <Text style={styles.lastRead}>Last read: {item.lastRead}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {mockBooks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No books yet</Text>
            <Text style={styles.emptySubtitle}>
              Import your first book to get started
            </Text>
            <Link href="/" asChild>
              <TouchableOpacity style={styles.importButton}>
                <Text style={styles.importButtonText}>Import Book</Text>
              </TouchableOpacity>
            </Link>
          </View>
        ) : (
          <FlatList
            data={mockBooks}
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