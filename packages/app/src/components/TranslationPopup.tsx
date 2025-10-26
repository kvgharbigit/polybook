import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';

export interface WordDefinition {
  word: string;
  pronunciation?: string;
  definitions: {
    partOfSpeech: string;
    meaning: string;
    example?: string;
  }[];
  frequency?: number;
}

interface TranslationPopupProps {
  visible: boolean;
  word: string;
  position: { x: number; y: number };
  definition?: WordDefinition;
  isLoading?: boolean;
  error?: string;
  onClose: () => void;
  onSaveWord?: (word: string) => void;
  onTranslate?: (word: string) => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function TranslationPopup({
  visible,
  word,
  position,
  definition,
  isLoading = false,
  error,
  onClose,
  onSaveWord,
  onTranslate,
}: TranslationPopupProps) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim]);

  const calculatePopupPosition = () => {
    const popupWidth = 280;
    const popupHeight = definition ? Math.min(200 + (definition.definitions.length * 40), 400) : 120;
    
    let x = position.x - popupWidth / 2;
    let y = position.y - popupHeight - 10; // Position above the word

    // Keep popup within screen bounds
    if (x < 10) x = 10;
    if (x + popupWidth > screenWidth - 10) x = screenWidth - popupWidth - 10;
    
    // If popup would go above screen, position below the word
    if (y < 50) {
      y = position.y + 30;
    }
    
    // If popup would go below screen, position higher
    if (y + popupHeight > screenHeight - 50) {
      y = screenHeight - popupHeight - 50;
    }

    return { x, y, width: popupWidth, height: popupHeight };
  };

  const popupStyle = calculatePopupPosition();

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Looking up "{word}"...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => onTranslate?.(word)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!definition) {
      return (
        <View style={styles.noDefinitionContainer}>
          <Text style={styles.noDefinitionText}>No definition found for "{word}"</Text>
          <TouchableOpacity style={styles.actionButton} onPress={() => onTranslate?.(word)}>
            <Text style={styles.actionButtonText}>Try Translation</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.definitionContainer}>
        <View style={styles.header}>
          <Text style={styles.word}>{definition.word}</Text>
          {definition.pronunciation && (
            <Text style={styles.pronunciation}>/{definition.pronunciation}/</Text>
          )}
          {definition.frequency && (
            <View style={styles.frequencyBadge}>
              <Text style={styles.frequencyText}>
                {definition.frequency > 1000 ? 'Common' : 'Rare'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.definitionsContainer}>
          {definition.definitions.slice(0, 3).map((def, index) => (
            <View key={index} style={styles.definitionItem}>
              <Text style={styles.partOfSpeech}>{def.partOfSpeech}</Text>
              <Text style={styles.meaning}>{def.meaning}</Text>
              {def.example && (
                <Text style={styles.example}>"e.g. {def.example}"</Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.saveButton} onPress={() => onSaveWord?.(word)}>
            <Text style={styles.saveButtonText}>💾 Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.translateButton} onPress={() => onTranslate?.(word)}>
            <Text style={styles.translateButtonText}>🔄 Translate</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.popup,
            {
              left: popupStyle.x,
              top: popupStyle.y,
              width: popupStyle.width,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            {renderContent()}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  popup: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  noDefinitionContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noDefinitionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  definitionContainer: {
    paddingRight: 24, // Space for close button
  },
  header: {
    marginBottom: 12,
  },
  word: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  pronunciation: {
    fontSize: 14,
    color: '#7f8c8d',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  frequencyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  frequencyText: {
    fontSize: 10,
    color: '#34495e',
    fontWeight: '600',
  },
  definitionsContainer: {
    marginBottom: 16,
  },
  definitionItem: {
    marginBottom: 12,
  },
  partOfSpeech: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 2,
  },
  meaning: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
    marginBottom: 4,
  },
  example: {
    fontSize: 12,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveButton: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  translateButton: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginLeft: 8,
  },
  translateButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});