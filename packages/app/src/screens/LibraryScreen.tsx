import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '../navigation/SimpleNavigator';
import { useAppStore } from '../store/appStore';
import { useTheme } from '../hooks/useTheme';
import type { Book } from '@polybook/shared';

export default function LibraryScreen() {
  const { navigate } = useNavigation();
  const { theme } = useTheme();
  const books = useAppStore(state => state.books);
  const isLoading = useAppStore(state => state.isLoading);

  // Load books when component mounts
  useEffect(() => {
    useAppStore.getState().loadBooks();
  }, []);

  const handleDeleteBook = async (book: Book) => {
    console.log('🗑️ LibraryScreen: Delete requested for book:', book.title);
    
    Alert.alert(
      'Delete Book',
      `Are you sure you want to delete "${book.title}" from your library? This will also delete the book file and cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => console.log('🗑️ LibraryScreen: Delete cancelled'),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ LibraryScreen: Deleting book:', book.id);
              await useAppStore.getState().deleteBook(book.id);
              console.log('🗑️ LibraryScreen: Book deleted successfully');
              Alert.alert('Success', `"${book.title}" has been deleted from your library.`);
            } catch (error) {
              console.error('🗑️ LibraryScreen: Error deleting book:', error);
              Alert.alert('Error', 'Failed to delete the book. Please try again.');
            }
          },
        },
      ],
    );
  };

  const renderBookItem = ({ item }: { item: Book }) => {
    // Calculate progress from position data (mock for now)
    const progress = item.lastPosition ? 0.25 : 0; // Will be calculated properly later
    const lastReadDate = item.lastPosition 
      ? item.lastPosition.updatedAt.toLocaleDateString()
      : item.addedAt.toLocaleDateString();

    return (
      <View style={styles.bookItem}>
        <TouchableOpacity 
          style={styles.bookContent}
          onPress={() => navigate('Reader', { id: item.id })}
        >
          <View style={styles.bookInfo}>
            <Text style={styles.bookTitle}>{item.title}</Text>
            <Text style={styles.bookAuthor}>{item.author}</Text>
            <Text style={styles.bookLanguage}>
              {item.language.toUpperCase()} → {item.targetLanguage.toUpperCase()} • {item.format.toUpperCase()}
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
        
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => handleDeleteBook(item)}
        >
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const styles = createStyles(theme);

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
              onPress={() => navigate('Home')}
            >
              <Text style={styles.importButtonText}>Import Book</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={books}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={() => useAppStore.getState().loadBooks()} />
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

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    color: theme.colors.text,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    color: theme.colors.textSecondary,
  },
  importButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  importButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingBottom: 20,
  },
  bookItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookContent: {
    flex: 1,
    padding: 16,
  },
  bookInfo: {
    flex: 1,
  },
  deleteButton: {
    padding: 16,
    paddingLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 20,
    opacity: 0.6,
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: theme.colors.text,
  },
  bookAuthor: {
    fontSize: 14,
    marginBottom: 8,
    color: theme.colors.textSecondary,
  },
  bookLanguage: {
    fontSize: 12,
    marginBottom: 8,
    color: theme.colors.textSecondary,
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
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    width: 40,
    textAlign: 'right',
  },
  lastRead: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});