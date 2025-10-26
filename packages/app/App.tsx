import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import ReaderScreen from './src/screens/ReaderScreen';
import { useAppStore } from './src/store/appStore';

const Stack = createNativeStackNavigator();

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#3498db" />
      <Text style={styles.loadingText}>Initializing PolyBook...</Text>
    </View>
  );
}

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const initialize = useAppStore(state => state.initialize);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initialize();
        setIsInitialized(true);
      } catch (error) {
        console.error('App initialization failed:', error);
        // For now, continue anyway
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, [initialize]);

  if (!isInitialized) {
    return <LoadingScreen />;
  }
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#f8f9fa',
          },
          headerTintColor: '#2c3e50',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}>
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
          options={{ title: 'PolyBook' }}
        />
        <Stack.Screen 
          name="Library" 
          component={LibraryScreen}
          options={{ title: 'My Library' }}
        />
        <Stack.Screen 
          name="Reader" 
          component={ReaderScreen}
          options={{ title: 'Reading', headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
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
});
