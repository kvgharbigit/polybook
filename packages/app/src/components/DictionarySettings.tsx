import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import LanguageSelector from './LanguageSelector';
import LanguagePackSettings from './LanguagePackSettings';

interface DictionarySettingsProps {
  onClose?: () => void;
}

export const DictionarySettings: React.FC<DictionarySettingsProps> = ({
  onClose,
}) => {
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [showLanguagePackSettings, setShowLanguagePackSettings] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dictionary Settings</Text>
        <Text style={styles.subtitle}>
          Configure languages and manage offline dictionaries
        </Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => setShowLanguageSelector(true)}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>🌍 Language Preferences</Text>
            <Text style={styles.settingDescription}>
              Set your home language and target languages for translation
            </Text>
          </View>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => {
            console.log('🔄 DictionarySettings: Opening Language Packs...');
            setShowLanguagePackSettings(true);
            console.log('📦 showLanguagePackSettings set to true');
          }}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>📦 Language Packs</Text>
            <Text style={styles.settingDescription}>
              Download or remove offline dictionaries
            </Text>
          </View>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>💡 How It Works</Text>
        <Text style={styles.infoText}>
          1. Choose your home language (native language){'\n'}
          2. Select target languages you want to learn{'\n'}
          3. Download language packs for offline use{'\n'}
          4. Tap any word while reading for instant translation
        </Text>
      </View>

      {onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Done</Text>
        </TouchableOpacity>
      )}

      {/* Language Selector Modal */}
      <Modal
        visible={showLanguageSelector}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <LanguageSelector
          onClose={() => setShowLanguageSelector(false)}
          onLanguageChange={() => {
            // Could refresh parent state if needed
          }}
        />
      </Modal>

      {/* Language Pack Settings Modal */}
      <Modal
        visible={showLanguagePackSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onShow={() => console.log('📦 Language Pack Modal opened')}
        onDismiss={() => console.log('📦 Language Pack Modal dismissed')}
      >
        <LanguagePackSettings
          onClose={() => {
            console.log('🔄 Closing Language Pack Settings...');
            setShowLanguagePackSettings(false);
          }}
        />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  settingArrow: {
    fontSize: 24,
    color: '#ccc',
    fontWeight: '300',
  },
  infoSection: {
    backgroundColor: '#e8f4f8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0891b2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#0891b2',
    lineHeight: 20,
  },
  closeButton: {
    backgroundColor: '#2196f3',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DictionarySettings;