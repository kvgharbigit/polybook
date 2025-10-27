import * as FileSystem from 'expo-file-system';
import * as CryptoJS from 'react-native-crypto-js';

export type ModelFile = { 
  name: string; 
  sha256: string; 
  bytes: number; 
};

export type ModelManifest = {
  pair: string; // e.g., "en-es"
  version: string;
  files: ModelFile[];
  engine: { simd: boolean; threads: boolean };
  license: string;
};

const BASE_DIR = `${FileSystem.documentDirectory}bergamot-runtime/`;

export async function ensureDir(dir: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

export async function sha256(path: string): Promise<string> {
  const b64 = await FileSystem.readAsStringAsync(path, { 
    encoding: FileSystem.EncodingType.Base64 
  });
  const wordArray = CryptoJS.enc.Base64.parse(b64);
  const hash = CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex);
  return hash;
}

export async function downloadWithResume(
  url: string, 
  dest: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const downloadResumable = FileSystem.createDownloadResumable(
    url,
    dest,
    {},
    onProgress ? (downloadProgress) => {
      const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
      onProgress(progress);
    } : undefined
  );
  
  const result = await downloadResumable.downloadAsync();
  if (!result?.uri) {
    throw new Error(`Download failed for ${url}`);
  }
  
  return result.uri;
}

export async function installModel(
  manifest: ModelManifest, 
  baseUrl: string,
  onProgress?: (progress: number, file: string) => void
): Promise<string> {
  const pairDir = `${BASE_DIR}models/${manifest.pair}/`;
  await ensureDir(pairDir);

  let filesCompleted = 0;
  const totalFiles = manifest.files.length;

  for (const file of manifest.files) {
    const url = `${baseUrl}/${manifest.pair}/${file.name}`;
    const dest = `${pairDir}${file.name}`;
    
    // Check if file already exists and has correct size
    const exists = await FileSystem.getInfoAsync(dest);
    if (!exists.exists || exists.size !== file.bytes) {
      await downloadWithResume(url, dest, (fileProgress) => {
        const totalProgress = (filesCompleted + fileProgress) / totalFiles;
        onProgress?.(totalProgress, file.name);
      });
    }
    
    // Verify file integrity
    const hash = await sha256(dest);
    if (hash.toLowerCase() !== file.sha256.toLowerCase()) {
      await FileSystem.deleteAsync(dest, { idempotent: true });
      throw new Error(`Integrity check failed for ${file.name}: expected ${file.sha256}, got ${hash}`);
    }
    
    filesCompleted++;
    onProgress?.(filesCompleted / totalFiles, file.name);
  }

  // Mark model as installed
  await FileSystem.writeAsStringAsync(
    `${pairDir}installed.json`,
    JSON.stringify({ 
      pair: manifest.pair, 
      version: manifest.version, 
      installedAt: Date.now() 
    })
  );

  return pairDir;
}

export async function isModelInstalled(pair: string): Promise<boolean> {
  try {
    const installedPath = `${BASE_DIR}models/${pair}/installed.json`;
    const exists = await FileSystem.getInfoAsync(installedPath);
    return exists.exists;
  } catch {
    return false;
  }
}

export async function getInstalledModels(): Promise<string[]> {
  try {
    const modelsDir = `${BASE_DIR}models/`;
    const exists = await FileSystem.getInfoAsync(modelsDir);
    if (!exists.exists) return [];
    
    const directories = await FileSystem.readDirectoryAsync(modelsDir);
    const installedModels: string[] = [];
    
    for (const dir of directories) {
      const isInstalled = await isModelInstalled(dir);
      if (isInstalled) {
        installedModels.push(dir);
      }
    }
    
    return installedModels;
  } catch {
    return [];
  }
}

export async function removeModel(pair: string): Promise<void> {
  const pairDir = `${BASE_DIR}models/${pair}/`;
  await FileSystem.deleteAsync(pairDir, { idempotent: true });
}

export async function getModelSize(pair: string): Promise<number> {
  try {
    const pairDir = `${BASE_DIR}models/${pair}/`;
    const exists = await FileSystem.getInfoAsync(pairDir);
    if (!exists.exists) return 0;
    
    const files = await FileSystem.readDirectoryAsync(pairDir);
    let totalSize = 0;
    
    for (const file of files) {
      const filePath = `${pairDir}${file}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists && fileInfo.size) {
        totalSize += fileInfo.size;
      }
    }
    
    return totalSize;
  } catch {
    return 0;
  }
}

// Sample model manifests for testing
export const SAMPLE_MANIFESTS: Record<string, ModelManifest> = {
  'en-es': {
    pair: 'en-es',
    version: '1.0.0',
    files: [
      {
        name: 'model.enes.intgemm.alphas.bin',
        sha256: 'placeholder-hash-model-enes',
        bytes: 87361504
      },
      {
        name: 'lex.50.50.enes.s2t.bin',
        sha256: 'placeholder-hash-lex-enes',
        bytes: 5242880
      },
      {
        name: 'vocab.enes.spm',
        sha256: 'placeholder-hash-vocab-enes',
        bytes: 732114
      }
    ],
    engine: { simd: true, threads: false },
    license: 'CC-BY 4.0'
  },
  'es-en': {
    pair: 'es-en',
    version: '1.0.0',
    files: [
      {
        name: 'model.esen.intgemm.alphas.bin',
        sha256: 'placeholder-hash-model-esen',
        bytes: 89123456
      },
      {
        name: 'lex.50.50.esen.s2t.bin',
        sha256: 'placeholder-hash-lex-esen',
        bytes: 5678912
      },
      {
        name: 'vocab.esen.spm',
        sha256: 'placeholder-hash-vocab-esen',
        bytes: 798765
      }
    ],
    engine: { simd: true, threads: false },
    license: 'CC-BY 4.0'
  }
};