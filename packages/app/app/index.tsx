import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Link } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

export default function HomeScreen() {
  const handleImportBook = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/epub+zip', 'application/pdf', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        console.log('Selected file:', result.assets[0]);
        // TODO: Process the selected book file
      }
    } catch (error) {
      console.error('Error picking document:', error);
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
            style={styles.primaryButton} 
            onPress={handleImportBook}
          >
            <Text style={styles.primaryButtonText}>Import Book</Text>
          </TouchableOpacity>

          <Link href="/library" asChild>
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>My Library</Text>
            </TouchableOpacity>
          </Link>
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