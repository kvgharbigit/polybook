import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '../navigation/SimpleNavigator';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useAppStore } from '../store/appStore';

export default function HomeScreen() {
  const { navigate } = useNavigation();
  const [importing, setImporting] = useState(false);

  const handleImportBook = async () => {
    if (importing) return;
    
    try {
      setImporting(true);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/epub+zip', 'application/pdf', 'text/plain', 'text/html'],
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
        const title = fileName.replace(/\.[^/.]+$/, "");
        
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
            { text: 'Import Another', style: 'cancel' }
          ]
        );
        
      }
    } catch (error) {
      console.error('Error importing book:', error);
      Alert.alert(
        'Import Failed',
        'There was an error importing your book. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setImporting(false);
    }
  };

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
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Features:</Text>
          <Text style={styles.featureItem}>📖 Read EPUB, PDF, and TXT files</Text>
          <Text style={styles.featureItem}>🔤 Tap words for instant translation</Text>
          <Text style={styles.featureItem}>📚 Build your vocabulary library</Text>
          <Text style={styles.featureItem}>🔊 Text-to-speech support</Text>
          <Text style={styles.featureItem}>📱 Works completely offline</Text>
        </View>
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
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#7f8c8d',
  },
  actionContainer: {
    marginBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#3498db',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 16,
  },
  primaryButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#ecf0f1',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bdc3c7',
  },
  secondaryButtonText: {
    color: '#2c3e50',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  tertiaryButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  tertiaryButtonText: {
    color: '#34495e',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  featuresContainer: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 8,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#2c3e50',
  },
  featureItem: {
    fontSize: 14,
    marginBottom: 8,
    color: '#34495e',
  },
});