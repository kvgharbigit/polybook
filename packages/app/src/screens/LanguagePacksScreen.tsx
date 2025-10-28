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

      // Immediately set download state to show UI feedback
      const initialDownload: LanguagePackDownload = {
        id: pack.id,
        status: 'pending',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: pack.totalSize,
        retryCount: 0,
        startedAt: new Date()
      };
      
      setActiveDownloads(prev => {
        const newMap = new Map(prev);
        newMap.set(pack.id, initialDownload);
        return newMap;
      });

      // Download the main pack
      await LanguagePackService.startDownload(pack.id, (download) => {
        console.log(`📱 UI: Download progress update for ${pack.id}:`, download.status, download.progress);
        setActiveDownloads(prev => {
          const newMap = new Map(prev);
          newMap.set(pack.id, download);
          return newMap;
        });
        
        // When main pack completes, start companion pack download
        if (download.status === 'completed' && pack.companionPackId) {
          console.log(`📱 UI: Main pack ${pack.id} completed, starting companion pack ${pack.companionPackId}`);
          downloadCompanionPack(pack.companionPackId);
          
          // Clean up main pack download state after a delay
          setTimeout(() => {
            setActiveDownloads(prev => {
              const newMap = new Map(prev);
              newMap.delete(pack.id);
              return newMap;
            });
          }, 2000);
        } else if (download.status === 'completed') {
          // No companion pack, just reload data and clean up
          console.log(`📱 UI: Main pack ${pack.id} completed, no companion pack`);
          setTimeout(() => {
            loadData();
            setActiveDownloads(prev => {
              const newMap = new Map(prev);
              newMap.delete(pack.id);
              return newMap;
            });
          }, 1000);
        }
      });

    } catch (error) {
      console.error(`📦 LanguagePacksScreen: Download error for ${pack.id}:`, error);
      
      // Remove download state on error
      setActiveDownloads(prev => {
        const newMap = new Map(prev);
        newMap.delete(pack.id);
        return newMap;
      });
      
      Alert.alert('Download Failed', String(error));
    }
  };

  const downloadCompanionPack = async (companionPackId: string) => {
    try {
      console.log(`📦 LanguagePacksScreen: Starting companion pack download for ${companionPackId}`);
      
      await LanguagePackService.startDownload(companionPackId, (download) => {
        console.log(`📱 UI: Companion download progress update for ${companionPackId}:`, download.status, download.progress);
        setActiveDownloads(prev => {
          const newMap = new Map(prev);
          newMap.set(companionPackId, download);
          return newMap;
        });
        
        // Reload data when companion download completes
        if (download.status === 'completed') {
          setTimeout(() => {
            loadData();
            // Clean up companion download state
            setActiveDownloads(prev => {
              const newMap = new Map(prev);
              newMap.delete(companionPackId);
              return newMap;
            });
          }, 1000);
        }
      });
    } catch (error) {
      console.error(`📦 LanguagePacksScreen: Companion download error for ${companionPackId}:`, error);
      
      // Remove download state on actual errors
      setActiveDownloads(prev => {
        const newMap = new Map(prev);
        newMap.delete(companionPackId);
        return newMap;
      });
      
      // Don't show alert for companion pack failures, just log
    }
  };

  const handleDelete = async (packId: string) => {
    const pack = installedPacks.find(p => p.id === packId);
    if (!pack) return;

    // Check if this pack has a companion pack that also needs deletion
    const companionPackId = pack.manifest.companionPackId;
    const companionPack = companionPackId ? installedPacks.find(p => p.id === companionPackId) : null;
    
    // Calculate total storage freed (main + companion)
    let totalSize = pack.manifest.totalSize;
    if (companionPack) {
      totalSize += companionPack.manifest.totalSize;
    }

    const deleteMessage = companionPack ? 
      `Are you sure you want to delete ${pack.manifest.name}? This will delete both directions (${pack.manifest.sourceLanguage.toUpperCase()} ↔ ${pack.manifest.targetLanguage.toUpperCase()}) and free up ${formatPackSize(totalSize)} of storage.` :
      `Are you sure you want to delete ${pack.manifest.name}? This will free up ${formatPackSize(pack.manifest.totalSize)} of storage.`;

    Alert.alert(
      'Delete Language Pack',
      deleteMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log(`📦 LanguagePacksScreen: Deleting main pack ${packId}`);
              await LanguagePackService.deletePack(packId);
              
              // Also delete companion pack if it exists
              if (companionPack) {
                console.log(`📦 LanguagePacksScreen: Deleting companion pack ${companionPackId}`);
                try {
                  await LanguagePackService.deletePack(companionPackId);
                  console.log(`📦 LanguagePacksScreen: Successfully deleted both packs: ${packId} and ${companionPackId}`);
                } catch (companionError) {
                  console.error(`📦 LanguagePacksScreen: Failed to delete companion pack ${companionPackId}:`, companionError);
                  // Continue - main pack was deleted successfully
                }
              }
              
              await loadData();
              
              const successMessage = companionPack ? 
                `Deleted both directions of ${pack.manifest.name}` :
                `Deleted ${pack.manifest.name}`;
              Alert.alert('Success', successMessage);
              
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

    // Check companion pack progress too
    const companionDownloading = pack.companionPackId ? isPackDownloading(pack.companionPackId) : false;
    const companionDownload = pack.companionPackId ? activeDownloads.get(pack.companionPackId) : null;
    const anyDownloading = downloading || companionDownloading;

    // Check if any download has completed but UI hasn't refreshed yet
    const mainCompleted = Boolean(download && download.status === 'completed');
    const companionCompleted = Boolean(companionDownload && companionDownload.status === 'completed');
    const downloadJustCompleted = mainCompleted || companionCompleted;
    
    // For bidirectional packs, consider installed only when both are truly available
    // Use Boolean() to ensure we never get undefined values
    const effectivelyInstalled = installed || (pack.companionPackId ? (mainCompleted && companionCompleted) : mainCompleted);

    // Debug logging for UI state
    if (anyDownloading || download || companionDownload || downloadJustCompleted) {
      console.log(`📱 UI: Rendering ${pack.id} - main downloading: ${downloading}, companion downloading: ${companionDownloading}, main completed: ${mainCompleted}, companion completed: ${companionCompleted}, effectively installed: ${effectivelyInstalled}`);
    }

    return (
      <View style={styles.packItem}>
        <View style={styles.packInfo}>
          {/* Header */}
          <View style={styles.packHeader}>
            <Text style={styles.packName}>{pack.name}</Text>
            {pack.companionPackId && (
              <View style={styles.bidirectionalBadge}>
                <Text style={styles.bidirectionalBadgeText}>↔ Bidirectional</Text>
              </View>
            )}
          </View>
          
          {/* Quick Stats */}
          <View style={styles.packStats}>
            <Text style={styles.packSize}>{formatPackSize(pack.totalSize)}</Text>
            <Text style={styles.packDivider}>•</Text>
            <Text style={styles.packEntries}>{pack.dictionary.entries.toLocaleString()} entries</Text>
            {installed && installedPack && (
              <>
                <Text style={styles.packDivider}>•</Text>
                <Text style={styles.packUsage}>{installedPack.dictionaryLookups} lookups</Text>
              </>
            )}
          </View>
          
          {/* Installation Status */}
          {effectivelyInstalled && (
            <View style={styles.installedInfo}>
              <Text style={styles.installedText}>
                ✅ {downloadJustCompleted && !installed ? 'Installing...' : `Installed ${installedPack?.installedAt.toLocaleDateString()}`}
                {pack.companionPackId ? ' (both directions)' : ''}
              </Text>
            </View>
          )}
          
          {/* Download Progress */}
          {anyDownloading && (
            <View style={styles.downloadStatusCard}>
              <View style={styles.progressHeader}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.progressTitle}>
                  {downloading && !companionDownloading ? 'Installing main pack' :
                   !downloading && companionDownloading ? 'Installing companion pack' :
                   downloading && companionDownloading ? 'Installing both directions' :
                   'Preparing installation'}
                </Text>
              </View>
              
              <View style={styles.progressBars}>
                {downloading && download && (
                  <View style={styles.progressRow}>
                    <Text style={styles.progressLabel}>Main</Text>
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBar, { width: `${download.progress || 0}%` }]} />
                    </View>
                    <Text style={styles.progressPercent}>{download.progress || 0}%</Text>
                  </View>
                )}
                
                {pack.companionPackId && (
                  <View style={styles.progressRow}>
                    <Text style={styles.progressLabel}>Companion</Text>
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBar, { 
                        width: companionDownload ? `${companionDownload.progress || 0}%` : '0%' 
                      }]} />
                    </View>
                    <Text style={styles.progressPercent}>
                      {companionDownload ? (companionDownload.progress || 0) : 0}%
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.packActions}>
          {installed ? (
            <View style={styles.installedActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleTestDatabase(pack.id)}
              >
                <Text style={styles.actionButtonText}>Test</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteActionButton]}
                onPress={() => handleDelete(pack.id)}
              >
                <Text style={[styles.actionButtonText, styles.deleteActionButtonText]}>Delete</Text>
              </TouchableOpacity>
            </View>
          ) : anyDownloading ? (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => handleCancelDownload(pack.id)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
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
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  packInfo: {
    flex: 1,
  },
  packHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  packName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  bidirectionalBadge: {
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
  },
  bidirectionalBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  packStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  packSize: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  packDivider: {
    fontSize: 12,
    color: theme.colors.border,
    fontWeight: '500',
  },
  packEntries: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  packUsage: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  installedInfo: {
    marginBottom: 8,
  },
  installedText: {
    fontSize: 12,
    color: theme.colors.success,
    fontWeight: '500',
  },
  downloadStatusCard: {
    backgroundColor: theme.colors.primary + '08',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary + '20',
    marginBottom: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  progressBars: {
    gap: 6,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    width: 60,
  },
  progressBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  progressPercent: {
    fontSize: 10,
    color: theme.colors.text,
    fontWeight: '500',
    width: 35,
    textAlign: 'right',
  },
  packActions: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  installedActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.text,
  },
  deleteActionButton: {
    borderColor: theme.colors.error + '50',
    backgroundColor: theme.colors.error + '10',
  },
  deleteActionButtonText: {
    color: theme.colors.error,
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