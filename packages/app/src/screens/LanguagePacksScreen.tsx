import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '../navigation/SimpleNavigator';
import { useTheme } from '../hooks/useTheme';
import { LanguagePackService } from '../services/languagePackService';
import { 
  LanguagePackManifest, 
  LanguagePackDownload, 
  InstalledLanguagePack,
  LanguagePackStats,
  formatPackSize 
} from '@polybook/shared/src/types/languagePacks';
import TranslationModelsTab from '../components/TranslationModelsTab';
import TranslationSettingsScreen from '../components/TranslationSettingsScreen';

type TabType = 'packs' | 'models' | 'settings';

export default function LanguagePacksScreen() {
  const { goBack } = useNavigation();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Main state
  const [activeTab, setActiveTab] = useState<TabType>('packs');
  const [isLoading, setIsLoading] = useState(true);

  // Language Packs state
  const [availablePacks, setAvailablePacks] = useState<LanguagePackManifest[]>([]);
  const [installedPacks, setInstalledPacks] = useState<InstalledLanguagePack[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<Map<string, LanguagePackDownload>>(new Map());
  const [storageStats, setStorageStats] = useState<LanguagePackStats | null>(null);
  const [showStorageWarning, setShowStorageWarning] = useState(false);
  const [selectedPack, setSelectedPack] = useState<LanguagePackManifest | null>(null);

  // Initialize and load data
  useEffect(() => {
    initializeService();
  }, []);

  const initializeService = async () => {
    try {
      console.log('📦 LanguagePacksScreen: Initializing service...');
      
      await LanguagePackService.initialize();
      await loadData();
      
      console.log('📦 LanguagePacksScreen: Service initialized successfully');
    } catch (error) {
      console.error('📦 LanguagePacksScreen: Initialization error:', error);
      Alert.alert('Error', 'Failed to initialize language pack service');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle tab refresh from child components
  const handleRefresh = () => {
    if (activeTab === 'packs') {
      loadData();
    }
    // Models tab handles its own refresh internally
  };

  const loadData = async () => {
    try {
      const [available, installed, stats] = await Promise.all([
        LanguagePackService.getAvailablePacks(),
        LanguagePackService.getInstalledPacks(),
        LanguagePackService.getStorageStats()
      ]);

      // Filter out hidden companion packs from UI
      const visiblePacks = available.filter(pack => !pack.hidden);
      
      setAvailablePacks(visiblePacks);
      setInstalledPacks(installed);
      setStorageStats(stats);
    } catch (error) {
      console.error('📦 LanguagePacksScreen: Error loading data:', error);
    }
  };

  const handleDownload = async (pack: LanguagePackManifest) => {
    try {
      // Check storage space first (include companion pack if exists)
      let totalSizeNeeded = pack.totalSize;
      let companionPack = null;
      
      if (pack.companionPackId) {
        const allPacks = await LanguagePackService.getAvailablePacks();
        companionPack = allPacks.find(p => p.id === pack.companionPackId);
        if (companionPack) {
          totalSizeNeeded += companionPack.totalSize;
        }
      }
      
      const storage = await LanguagePackService.checkStorageSpace(pack.id);
      
      if (!storage) {
        console.error('Failed to check storage space');
        // Continue with download but warn user
      }
      
      if (!storage.hasSpace) {
        setSelectedPack(pack);
        setShowStorageWarning(true);
        return;
      }

      console.log(`📦 LanguagePacksScreen: Starting download for ${pack.name}`);

      // Download the main pack
      await LanguagePackService.startDownload(pack.id, (download) => {
        setActiveDownloads(prev => new Map(prev.set(pack.id, download)));
        
        // When main pack completes, start companion pack download
        if (download.status === 'completed' && pack.companionPackId) {
          downloadCompanionPack(pack.companionPackId);
        } else if (download.status === 'completed') {
          // No companion pack, just reload data
          setTimeout(() => {
            loadData();
          }, 1000);
        }
      });

    } catch (error) {
      console.error(`📦 LanguagePacksScreen: Download error for ${pack.id}:`, error);
      Alert.alert('Download Failed', String(error));
    }
  };

  const downloadCompanionPack = async (companionPackId: string) => {
    try {
      console.log(`📦 LanguagePacksScreen: Starting companion pack download for ${companionPackId}`);
      
      await LanguagePackService.startDownload(companionPackId, (download) => {
        setActiveDownloads(prev => new Map(prev.set(companionPackId, download)));
        
        // Reload data when companion download completes
        if (download.status === 'completed') {
          setTimeout(() => {
            loadData();
          }, 1000);
        }
      });
    } catch (error) {
      console.error(`📦 LanguagePacksScreen: Companion download error for ${companionPackId}:`, error);
      // Don't show alert for companion pack failures, just log
    }
  };

  const handleDelete = async (packId: string) => {
    const pack = installedPacks.find(p => p.id === packId);
    if (!pack) return;

    Alert.alert(
      'Delete Language Pack',
      `Are you sure you want to delete ${pack.manifest.name}? This will free up ${formatPackSize(pack.manifest.totalSize)} of storage.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await LanguagePackService.deletePack(packId);
              await loadData();
              console.log(`📦 LanguagePacksScreen: Deleted pack ${packId}`);
            } catch (error) {
              console.error(`📦 LanguagePacksScreen: Delete error for ${packId}:`, error);
              Alert.alert('Error', 'Failed to delete language pack');
            }
          }
        }
      ]
    );
  };

  const handleCancelDownload = async (packId: string) => {
    try {
      await LanguagePackService.cancelDownload(packId);
      setActiveDownloads(prev => {
        const newMap = new Map(prev);
        newMap.delete(packId);
        return newMap;
      });
    } catch (error) {
      console.error(`📦 LanguagePacksScreen: Cancel error for ${packId}:`, error);
    }
  };

  const handleTestDatabase = async (packId: string) => {
    const installedPack = installedPacks.find(p => p.id === packId);
    if (!installedPack) {
      Alert.alert('Error', 'Language pack not found');
      return;
    }

    try {
      console.log(`📦 Testing database for ${packId}...`);
      
      // Import SQLite dynamically to test the database
      const SQLite = await import('expo-sqlite');
      const FileSystem = await import('expo-file-system');
      
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(installedPack.dictionaryPath);
      console.log(`📦 Database file info:`, fileInfo);
      
      if (!fileInfo.exists) {
        Alert.alert('Test Failed', `Database file does not exist:\n${installedPack.dictionaryPath}`);
        return;
      }

      // Try to open database and check tables
      console.log(`📦 Opening database at: ${installedPack.dictionaryPath}`);
      
      let tables = [];
      let allObjects = [];
      let db = null;
      
      try {
        // Use filename only (same fix as languagePackService) to access the real database
        const dbName = installedPack.manifest.dictionary.filename;
        console.log(`📦 Opening database with filename: ${dbName} (instead of full path)`);
        db = await SQLite.openDatabaseAsync(dbName);
        console.log(`📦 Database opened successfully`);
        
        // Check if this is a valid SQLite database
        const version = await db.getAllAsync("SELECT sqlite_version()");
        console.log(`📦 SQLite version:`, version);
        
        tables = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'");
        console.log(`📦 Database tables:`, tables);
        
        // Also check for any objects in the database
        allObjects = await db.getAllAsync("SELECT type, name FROM sqlite_master");
        console.log(`📦 All database objects:`, allObjects);
        
      } catch (dbError) {
        console.error(`📦 Database error:`, dbError);
        Alert.alert('Database Error', `Failed to open or query database: ${dbError}`);
        return;
      }
      
      let entryCount = 0;
      let sampleEntries = [];
      
      // Try different table formats
      if (tables.some(t => t.name === 'dict')) {
        const rows = await db.getAllAsync('SELECT COUNT(*) as count FROM dict');
        entryCount = rows[0].count;
        const samples = await db.getAllAsync('SELECT lemma, def FROM dict LIMIT 3');
        sampleEntries = samples.map(r => `${r.lemma}: ${r.def.substring(0, 50)}...`);
      } else if (tables.some(t => t.name === 'word')) {
        const rows = await db.getAllAsync('SELECT COUNT(*) as count FROM word');
        entryCount = rows[0].count;
        const samples = await db.getAllAsync('SELECT w, m FROM word LIMIT 3');
        sampleEntries = samples.map(r => `${r.w}: ${r.m.substring(0, 50)}...`);
      }

      Alert.alert(
        'Database Test Results', 
        `File Size: ${(fileInfo.size / 1024).toFixed(1)} KB\n` +
        `Tables: ${tables.map(t => t.name).join(', ') || 'None'}\n` +
        `Objects: ${allObjects.length}\n` +
        `Entries: ${entryCount}\n\n` +
        (sampleEntries.length > 0 ? `Sample entries:\n${sampleEntries.join('\n')}` : 'No entries found')
      );
      
    } catch (error) {
      console.error(`📦 Database test failed for ${packId}:`, error);
      Alert.alert('Test Failed', `Database test failed:\n${error}`);
    }
  };

  const isPackInstalled = (packId: string): boolean => {
    return installedPacks.some(p => p.id === packId);
  };

  const isPackDownloading = (packId: string): boolean => {
    const download = activeDownloads.get(packId);
    return download && ['pending', 'downloading', 'extracting'].includes(download.status);
  };

  const renderPackItem = ({ item: pack }: { item: LanguagePackManifest }) => {
    const installed = isPackInstalled(pack.id);
    const downloading = isPackDownloading(pack.id);
    const download = activeDownloads.get(pack.id);
    const installedPack = installedPacks.find(p => p.id === pack.id);

    return (
      <View style={styles.packItem}>
        <View style={styles.packInfo}>
          <Text style={styles.packName}>{pack.name}</Text>
          <Text style={styles.packDescription}>{pack.description}</Text>
          <View style={styles.packDetails}>
            <Text style={styles.packSize}>{formatPackSize(pack.totalSize)}</Text>
            <Text style={styles.packEntries}>{pack.dictionary.entries.toLocaleString()} entries</Text>
            <Text style={styles.packVersion}>v{pack.version}</Text>
          </View>
          
          {/* Debug Information */}
          {installed && installedPack && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugTitle}>📊 Debug Info:</Text>
              <Text style={styles.debugText}>
                Dict Path: {installedPack.dictionaryPath ? 'OK' : 'MISSING'}
              </Text>
              <Text style={styles.debugText}>
                Installed: {installedPack.installedAt.toLocaleDateString()}
              </Text>
              <Text style={styles.debugText}>
                Lookups: {installedPack.dictionaryLookups}
              </Text>
            </View>
          )}
          
          {downloading && download && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugTitle}>📥 Download Status:</Text>
              <Text style={styles.debugText}>
                Status: {download.status}
              </Text>
              <Text style={styles.debugText}>
                Progress: {download.downloadedBytes}/{download.totalBytes} bytes
              </Text>
              {download.error && (
                <Text style={[styles.debugText, styles.errorText]}>
                  Error: {download.error}
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.packActions}>
          {installed ? (
            <>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>✅ Installed</Text>
              </View>
              <TouchableOpacity
                style={styles.testButton}
                onPress={() => handleTestDatabase(pack.id)}
              >
                <Text style={styles.testButtonText}>Test DB</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(pack.id)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </>
          ) : downloading ? (
            <View style={styles.downloadProgress}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.progressText}>
                {download?.status === 'downloading' ? `${download.progress}%` : 
                 download?.status === 'extracting' ? 'Installing...' : 'Starting...'}
              </Text>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => handleCancelDownload(pack.id)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => handleDownload(pack)}
            >
              <Text style={styles.downloadButtonText}>Download</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderStorageWarning = () => (
    <Modal
      visible={showStorageWarning}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowStorageWarning(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Insufficient Storage</Text>
          <Text style={styles.modalText}>
            Not enough storage space to download {selectedPack?.name}.{'\n\n'}
            Required: {selectedPack ? formatPackSize(selectedPack.totalSize) : 'Unknown'}{'\n'}
            Language packs are large but enable high-quality offline translation.
          </Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowStorageWarning(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderTabButton = (tab: TabType, label: string, icon: string) => (
    <TouchableOpacity
      key={tab}
      style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabIcon, activeTab === tab && styles.activeTabIcon]}>
        {icon}
      </Text>
      <Text style={[styles.tabLabel, activeTab === tab && styles.activeTabLabel]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderTabContent = () => {
    if (isLoading && activeTab === 'packs') {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading language packs...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'packs':
        return renderLanguagePacksTab();
      case 'models':
        return <TranslationModelsTab onRefresh={handleRefresh} />;
      case 'settings':
        return <TranslationSettingsScreen onBack={() => setActiveTab('packs')} />;
      default:
        return null;
    }
  };

  const renderLanguagePacksTab = () => (
    <>
      {/* Storage Stats */}
      {storageStats && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Storage Usage</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Installed Packs:</Text>
            <Text style={styles.statsValue}>{storageStats.totalInstalled}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Total Size:</Text>
            <Text style={styles.statsValue}>{formatPackSize(storageStats.totalSize)}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Dictionary Lookups:</Text>
            <Text style={styles.statsValue}>{storageStats.totalDictionaryLookups.toLocaleString()}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Translations:</Text>
            <Text style={styles.statsValue}>{storageStats.totalTranslations.toLocaleString()}</Text>
          </View>
        </View>
      )}

      {/* Available Packs */}
      <Text style={styles.sectionTitle}>Available Language Packs</Text>
      <Text style={styles.sectionSubtitle}>
        Download packs for high-quality offline translation
      </Text>

      <FlatList
        data={availablePacks}
        renderItem={renderPackItem}
        keyExtractor={(item) => item.id}
        style={styles.packsList}
        showsVerticalScrollIndicator={false}
      />

      {renderStorageWarning()}
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Text style={[styles.backButton, { color: theme.colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.headerText }]}>
          Language & Translation
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {renderTabButton('packs', 'Dictionary', '📚')}
        {renderTabButton('models', 'Translation', '🌐')}
        {renderTabButton('settings', 'Settings', '⚙️')}
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {renderTabContent()}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.border + '40',
    backgroundColor: theme.colors.header + 'F8',
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  statsContainer: {
    margin: 20,
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statsLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  statsValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  packsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  packItem: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  packInfo: {
    flex: 1,
    marginRight: 16,
  },
  packName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  packDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  packDetails: {
    flexDirection: 'row',
    gap: 12,
  },
  packSize: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  packEntries: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  packVersion: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  debugInfo: {
    marginTop: 12,
    padding: 8,
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  debugTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  debugText: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginBottom: 2,
    fontFamily: 'monospace',
  },
  errorText: {
    color: theme.colors.error,
  },
  packActions: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  statusBadge: {
    backgroundColor: theme.colors.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    color: theme.colors.success,
    fontWeight: '500',
  },
  downloadButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  downloadButtonText: {
    color: theme.colors.background,
    fontSize: 14,
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 4,
  },
  testButtonText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: theme.colors.error + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: theme.colors.error,
    fontSize: 12,
    fontWeight: '500',
  },
  downloadProgress: {
    alignItems: 'center',
    gap: 4,
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '500',
  },
  cancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelButtonText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    margin: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  modalButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  // Tab navigation styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  activeTabButton: {
    backgroundColor: theme.colors.primary + '15',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  activeTabIcon: {
    fontSize: 20,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  activeTabLabel: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
});