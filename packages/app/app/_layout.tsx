import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack
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
          name="index" 
          options={{ 
            title: 'PolyBook',
            headerShown: true 
          }} 
        />
        <Stack.Screen 
          name="library" 
          options={{ 
            title: 'My Library',
            presentation: 'modal' 
          }} 
        />
        <Stack.Screen 
          name="reader/[id]" 
          options={{ 
            title: 'Reading',
            headerShown: false 
          }} 
        />
      </Stack>
    </>
  );
}