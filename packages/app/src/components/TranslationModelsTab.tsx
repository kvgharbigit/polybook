import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { 
  BergamotModelService, 
  BergamotLanguagePair, 
  BergamotModelDownload,
  BergamotModelStats,
  InstalledBergamotModel
} from '../services/bergamotModelService';

interface TranslationModelsTabProps {
  onRefresh?: () => void;
}

export default function TranslationModelsTab({ onRefresh }: TranslationModelsTabProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // State
  const [languagePairs, setLanguagePairs] = useState<BergamotLanguagePair[]>([]);
  const [installedModels, setInstalledModels] = useState<InstalledBergamotModel[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<Map<string, BergamotModelDownload>>(new Map());
  const [stats, setStats] = useState<BergamotModelStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await BergamotModelService.initialize();
      
      const [pairs, installed, modelStats] = await Promise.all([
        BergamotModelService.getLanguagePairs(),
        BergamotModelService.getInstalledModels(),
        BergamotModelService.getStorageStats()
      ]);

      setLanguagePairs(pairs);
      setInstalledModels(installed);
      setStats(modelStats);
      setActiveDownloads(BergamotModelService.getActiveDownloads());
    } catch (error) {
      console.error('TranslationModelsTab: Error loading data:', error);
      Alert.alert('Error', 'Failed to load translation models');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPair = async (pair: BergamotLanguagePair) => {
    try {
      // Check if any models in the pair are already installed
      const pairModels = pair.models.map(m => m.id);
      const alreadyInstalled = installedModels.filter(m => pairModels.includes(m.id));
      
      if (alreadyInstalled.length > 0) {
        Alert.alert(
          'Already Installed',
          `Some models for ${pair.displayName} are already installed. Download anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Download', onPress: () => startPairDownload(pair) }
          ]
        );
        return;
      }

      // Check storage space
      if (stats && stats.availableSpace < pair.totalSize) {
        Alert.alert(
          'Insufficient Storage',
          `Need ${pair.totalSize}MB but only ${stats.availableSpace}MB available. Free up space and try again.`,
          [{ text: 'OK' }]
        );
        return;
      }

      await startPairDownload(pair);
    } catch (error) {
      console.error('TranslationModelsTab: Download error:', error);
      Alert.alert('Download Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const startPairDownload = async (pair: BergamotLanguagePair) => {
    // Download both models in the pair
    for (const model of pair.models) {
      try {
        await BergamotModelService.startDownload(model.id, (download) => {
          setActiveDownloads(prev => new Map(prev.set(model.id, download)));
          
          // Reload data when download completes
          if (download.status === 'completed') {
            setTimeout(loadData, 500);
          }
        });
      } catch (error) {
        console.error(`Failed to download ${model.id}:`, error);
      }
    }
  };

  const handleDeletePair = async (pair: BergamotLanguagePair) => {
    Alert.alert(
      'Delete Translation Models',
      `Remove ${pair.displayName} translation models? This will free up ${pair.totalSize}MB.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              for (const model of pair.models) {
                const isInstalled = installedModels.some(m => m.id === model.id);
                if (isInstalled) {
                  await BergamotModelService.deleteModel(model.id);
                }
              }
              await loadData();
              onRefresh?.();
            } catch (error) {
              Alert.alert('Delete Failed', error instanceof Error ? error.message : 'Unknown error');
            }
          }
        }
      ]
    );
  };

  const renderLanguagePair = ({ item: pair }: { item: BergamotLanguagePair }) => {
    const installedCount = pair.models.filter(model => 
      installedModels.some(installed => installed.id === model.id)
    ).length;
    
    const isFullyInstalled = installedCount === pair.models.length;
    const isPartiallyInstalled = installedCount > 0 && installedCount < pair.models.length;
    
    const hasActiveDownloads = pair.models.some(model => activeDownloads.has(model.id));
    const activeDownload = pair.models.find(model => activeDownloads.has(model.id));
    const downloadProgress = activeDownload ? activeDownloads.get(activeDownload.id) : null;

    return (
      <View style={styles.pairContainer}>
        <View style={styles.pairHeader}>
          <View style={styles.pairInfo}>
            <Text style={styles.pairFlags}>{pair.flags}</Text>
            <View style={styles.pairText}>
              <Text style={styles.pairTitle}>{pair.displayName}</Text>
              <Text style={styles.pairSubtitle}>
                {pair.tier === 'tiny' ? 'Fast & Compact' : 'High Quality'} • {pair.totalSize}MB • 
                {pair.averageBleu ? ` BLEU ${pair.averageBleu}` : ' Quality Optimized'}
              </Text>
            </View>
          </View>
          
          <View style={styles.pairActions}>
            {hasActiveDownloads && downloadProgress ? (
              <View style={styles.downloadProgress}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.progressText}>{Math.round(downloadProgress.progress)}%</Text>
              </View>
            ) : isFullyInstalled ? (
              <TouchableOpacity 
                style={[styles.actionButton, styles.deleteButton]} 
                onPress={() => handleDeletePair(pair)}
              >
                <Text style={styles.deleteButtonText}>Remove</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.actionButton, styles.downloadButton]} 
                onPress={() => handleDownloadPair(pair)}
              >
                <Text style={styles.downloadButtonText}>
                  {isPartiallyInstalled ? 'Complete' : 'Download'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {isPartiallyInstalled && (
          <View style={styles.partialWarning}>
            <Text style={styles.partialWarningText}>
              ⚠️ Partially installed ({installedCount}/{pair.models.length} models)
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading translation models...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Translation Models</Text>
        <Text style={styles.subtitle}>
          Offline translation powered by Bergamot
        </Text>
      </View>

      {stats && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            {stats.totalInstalled} of {stats.supportedPairs} language pairs installed • 
            {stats.totalSize}MB used • {stats.availableSpace}MB free
          </Text>
        </View>
      )}

      <FlatList
        data={languagePairs}
        keyExtractor={(item) => item.id}
        renderItem={renderLanguagePair}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          • Tiny models: Fast, 32MB per language pair{'\n'}
          • Base models: High quality, 82-114MB per pair{'\n'}
          • All translation happens offline on your device
        </Text>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  statsContainer: {
    padding: 16,
    backgroundColor: theme.colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  statsText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  pairContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pairHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pairInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pairFlags: {
    fontSize: 24,
    marginRight: 12,
  },
  pairText: {
    flex: 1,
  },
  pairTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  pairSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  pairActions: {
    marginLeft: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  downloadButton: {
    backgroundColor: theme.colors.primary,
  },
  downloadButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: theme.colors.error,
  },
  deleteButtonText: {
    color: theme.colors.onError,
    fontSize: 14,
    fontWeight: '600',
  },
  downloadProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  partialWarning: {
    marginTop: 12,
    padding: 8,
    backgroundColor: theme.colors.warningBackground,
    borderRadius: 6,
  },
  partialWarningText: {
    fontSize: 12,
    color: theme.colors.warning,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    backgroundColor: theme.colors.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
});