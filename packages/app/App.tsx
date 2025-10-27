import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationProvider, useNavigation, Header } from './src/navigation/SimpleNavigator';
import HomeScreen from './src/screens/HomeScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import ReaderScreen from './src/screens/ReaderScreen';
import VocabularyScreen from './src/screens/VocabularyScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LanguageProfileScreen from './src/screens/LanguageProfileScreen';
import LanguagePacksScreen from './src/screens/LanguagePacksScreen';
import DictionaryTestScreen from './src/screens/DictionaryTestScreen';
import TranslationPerfHarness from './src/screens/TranslationPerfHarness';
import TranslationModelsScreen from './src/screens/TranslationModelsScreen';
import { useAppStore } from './src/store/appStore';

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size={40} color="#3498db" />
      <Text style={styles.loadingText}>Initializing PolyBook...</Text>
    </View>
  );
}

export default function App() {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Starting app initialization...');
        await useAppStore.getState().initialize();
        console.log('App initialization completed');
        setIsInitialized(true);
      } catch (error) {
        console.error('App initialization failed:', error);
        console.error('Error details:', error);
        // For now, continue anyway to see the app
        console.log('Continuing despite initialization error...');
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, []);

  if (!isInitialized) {
    return <LoadingScreen />;
  }
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationProvider initialScreen="Home">
          <AppContent />
        </NavigationProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
  const { navigationState } = useNavigation();
  
  const renderScreen = () => {
    switch (navigationState.currentScreen) {
      case 'Home':
        return (
          <View style={styles.screenContainer}>
            <Header title="PolyBook" />
            <HomeScreen />
          </View>
        );
      case 'Library':
        return (
          <View style={styles.screenContainer}>
            <Header title="My Library" showBackButton />
            <LibraryScreen />
          </View>
        );
      case 'Reader':
        return (
          <View style={styles.screenContainer}>
            <ReaderScreen />
          </View>
        );
      case 'Vocabulary':
        return (
          <View style={styles.screenContainer}>
            <VocabularyScreen />
          </View>
        );
      case 'Settings':
        return (
          <View style={styles.screenContainer}>
            <SettingsScreen />
          </View>
        );
      case 'LanguageProfileScreen':
        return (
          <View style={styles.screenContainer}>
            <LanguageProfileScreen />
          </View>
        );
      case 'LanguagePacksScreen':
        return (
          <View style={styles.screenContainer}>
            <LanguagePacksScreen />
          </View>
        );
      case 'DictionaryTestScreen':
        return (
          <View style={styles.screenContainer}>
            <DictionaryTestScreen />
          </View>
        );
      case 'TranslationPerfHarness':
        return (
          <View style={styles.screenContainer}>
            <TranslationPerfHarness />
          </View>
        );
      case 'TranslationModelsScreen':
        return (
          <View style={styles.screenContainer}>
            <TranslationModelsScreen />
          </View>
        );
      default:
        return (
          <View style={styles.screenContainer}>
            <Header title="PolyBook" />
            <HomeScreen />
          </View>
        );
    }
  };

  return renderScreen();
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#2c3e50',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
