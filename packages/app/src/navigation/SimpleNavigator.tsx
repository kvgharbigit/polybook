import React, { createContext, useContext, useState, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Navigation types
export type Screen = 'Home' | 'Library' | 'Reader' | 'Vocabulary' | 'Settings';

export interface NavigationState {
  currentScreen: Screen;
  params?: Record<string, any>;
}

export interface NavigationContextType {
  navigationState: NavigationState;
  navigate: (screen: Screen, params?: Record<string, any>) => void;
  goBack: () => void;
  canGoBack: () => boolean;
}

// Navigation context
const NavigationContext = createContext<NavigationContextType | null>(null);

// Navigation hook
export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

// Navigation provider
interface NavigationProviderProps {
  children: ReactNode;
  initialScreen?: Screen;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ 
  children, 
  initialScreen = 'Home', 
}) => {
  const [navigationState, setNavigationState] = useState<NavigationState>({
    currentScreen: initialScreen,
  });
  const [history, setHistory] = useState<NavigationState[]>([]);

  const navigate = (screen: Screen, params?: Record<string, any>) => {
    setHistory(prev => [...prev, navigationState]);
    setNavigationState({ currentScreen: screen, params });
  };

  const goBack = () => {
    if (history.length > 0) {
      const previousState = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setNavigationState(previousState);
    }
  };

  const canGoBack = () => history.length > 0;

  return (
    <NavigationContext.Provider value={{
      navigationState,
      navigate,
      goBack,
      canGoBack,
    }}>
      {children}
    </NavigationContext.Provider>
  );
};

// Simple header component
interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  title, 
  showBackButton = false, 
  onBackPress, 
}) => {
  const { goBack, canGoBack } = useNavigation();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      goBack();
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {(showBackButton && canGoBack()) && (
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <View style={styles.headerRight} />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 56,
    backgroundColor: '#f8f9fa',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '600',
  },
});