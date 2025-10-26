import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '../navigation/SimpleNavigator';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useAppStore } from '../store/appStore';
import { useTheme } from '../hooks/useTheme';

export default function HomeScreen() {
  const { navigate } = useNavigation();
  const { theme } = useTheme();
  const [importing, setImporting] = useState(false);

  const handleImportBook = async () => {
    if (importing) return;
    
    try {
      setImporting(true);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/epub+zip', 'application/pdf', 'text/plain', 'text/html', 'application/x-mobipocket-ebook'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        
        // Extract file info
        const fileName = file.name;
        const fileExtension = fileName.split('.').pop()?.toLowerCase();
        
        // Determine format
        let format: 'epub' | 'pdf' | 'txt' | 'html' = 'txt';
        if (fileExtension === 'epub') format = 'epub';
        else if (fileExtension === 'pdf') format = 'pdf';
        else if (fileExtension === 'html' || fileExtension === 'htm') format = 'html';
        
        // Copy file to app's document directory
        const documentsDir = FileSystem.documentDirectory;
        const newFilePath = `${documentsDir}books/${fileName}`;
        
        // Ensure books directory exists
        await FileSystem.makeDirectoryAsync(`${documentsDir}books/`, { intermediates: true });
        
        // Copy the file to permanent location
        await FileSystem.copyAsync({
          from: file.uri,
          to: newFilePath,
        });
        
        // Extract title from filename (remove extension)
        const title = fileName.replace(/\.[^/.]+$/, '');
        
        // For now, use default values - will be enhanced with actual file parsing
        const bookData = {
          title,
          author: 'Unknown Author', // Will be extracted from file metadata later
          language: 'es', // Default to Spanish for MVP
          targetLanguage: 'en', // Default to English for MVP
          format,
          filePath: newFilePath,
          addedAt: new Date(),
          lastOpenedAt: new Date(),
        };

        const bookId = await useAppStore.getState().addBook(bookData);
        
        Alert.alert(
          'Book Imported Successfully!', 
          `"${title}" has been added to your library.`,
          [
            { text: 'View Library', onPress: () => navigate('Library') },
            { text: 'Import Another', style: 'cancel' },
          ],
        );
        
      }
    } catch (error) {
      console.error('Error importing book:', error);
      Alert.alert(
        'Import Failed',
        'There was an error importing your book. Please try again.',
        [{ text: 'OK' }],
      );
    } finally {
      setImporting(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to PolyBook</Text>
        <Text style={styles.subtitle}>
          Your offline language learning book reader
        </Text>

        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={[styles.primaryButton, importing && styles.primaryButtonDisabled]} 
            onPress={handleImportBook}
            disabled={importing}
          >
            <Text style={styles.primaryButtonText}>
              {importing ? 'Importing...' : 'Import Book'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => navigate('Library')}
          >
            <Text style={styles.secondaryButtonText}>My Library</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.tertiaryButton}
            onPress={() => navigate('Vocabulary')}
          >
            <Text style={styles.tertiaryButtonText}>📚 My Vocabulary</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.tertiaryButton}
            onPress={() => navigate('Settings')}
          >
            <Text style={styles.tertiaryButtonText}>⚙️ Settings</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Features:</Text>
          <Text style={styles.featureItem}>📖 Read EPUB, TXT, and HTML files</Text>
          <Text style={styles.featureItem}>🔤 Tap words for instant translation</Text>
          <Text style={styles.featureItem}>📚 Build your vocabulary library</Text>
          <Text style={styles.featureItem}>🔊 Text-to-speech support</Text>
          <Text style={styles.featureItem}>📱 Works completely offline</Text>
        </View>
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
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: theme.colors.textSecondary,
  },
  actionContainer: {
    marginBottom: 40,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 16,
  },
  primaryButtonDisabled: {
    backgroundColor: theme.colors.textSecondary,
  },
  primaryButtonText: {
    color: theme.colors.background,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  tertiaryButton: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  tertiaryButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  featuresContainer: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 8,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: theme.colors.text,
  },
  featureItem: {
    fontSize: 14,
    marginBottom: 8,
    color: theme.colors.text,
  },
});