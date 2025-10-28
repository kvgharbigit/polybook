import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Book } from '@polybook/shared';

export interface SampleBook {
  filename: string;
  title: string;
  author: string;
  language: string;
  description: string;
}

export const SAMPLE_BOOKS: SampleBook[] = [
  {
    filename: 'pg37106.txt',
    title: 'Little Women',
    author: 'Louisa May Alcott',
    language: 'en',
    description: 'Classic American novel about four sisters growing up during the Civil War era.'
  },
  {
    filename: 'pg77133-images-3.epub',
    title: 'Sample EPUB Book',
    author: 'Various',
    language: 'en',
    description: 'Sample EPUB with images for testing.'
  }
];

export async function preloadSampleBooks(): Promise<Book[]> {
  console.log('📚 Preloading sample books...');
  const preloadedBooks: Book[] = [];
  
  for (const sampleBook of SAMPLE_BOOKS) {
    try {
      console.log(`📖 Loading sample book: ${sampleBook.title}`);
      
      // Create target path in documents directory
      const documentsDir = FileSystem.documentDirectory;
      if (!documentsDir) {
        console.error('❌ Documents directory not available');
        continue;
      }
      
      const targetPath = `${documentsDir}${sampleBook.filename}`;
      
      // Check if file already exists in documents
      const fileInfo = await FileSystem.getInfoAsync(targetPath);
      let fileSizeBytes = 0;
      
      if (!fileInfo.exists) {
        console.log(`📁 Loading asset ${sampleBook.filename}...`);
        
        try {
          // Try direct bundle directory access (assets should be bundled by assetBundlePatterns)
          const bundleAssetPath = `${FileSystem.bundleDirectory}assets/sampleBooks/${sampleBook.filename}`;
          console.log(`🔍 Checking bundle path: ${bundleAssetPath}`);
          
          const bundleFileInfo = await FileSystem.getInfoAsync(bundleAssetPath);
          console.log(`📁 Bundle file exists: ${bundleFileInfo.exists}, size: ${bundleFileInfo.size || 0}`);
          
          if (bundleFileInfo.exists && bundleFileInfo.size && bundleFileInfo.size > 0) {
            await FileSystem.copyAsync({
              from: bundleAssetPath,
              to: targetPath
            });
            console.log(`✅ Successfully loaded ${sampleBook.filename} from bundle directory`);
            fileSizeBytes = bundleFileInfo.size;
          } else {
            throw new Error(`Bundle file not found or empty: ${bundleAssetPath}`);
          }
          
        } catch (copyError) {
          console.error(`❌ Failed to load ${sampleBook.filename}:`, copyError);
          // Create sample content as fallback
          let sampleContent: string;
          
          if (sampleBook.filename === 'pg37106.txt') {
            sampleContent = `LITTLE WOMEN
by Louisa May Alcott

Chapter 1 - Playing Pilgrims

"Christmas won't be Christmas without any presents," grumbled Jo, lying on the rug.

"It's so dreadful to be poor!" sighed Meg, looking down at her old dress.

[This is a sample excerpt. The full text would normally be loaded from the bundled asset file.]`;
          } else {
            sampleContent = `Sample EPUB Content

This is a placeholder for the sample EPUB book. 

The actual EPUB file with images and proper formatting would normally be loaded from the bundled assets.

You can test the reading interface with this sample content.`;
          }
          
          await FileSystem.writeAsStringAsync(targetPath, sampleContent);
          fileSizeBytes = sampleContent.length;
          console.log(`📝 Created sample content for ${sampleBook.filename} (${fileSizeBytes} bytes)`);
        }
      } else {
        console.log(`📄 ${sampleBook.filename} already exists in documents`);
        fileSizeBytes = fileInfo.size || 0;
      }
      
      // Create book object
      const book: Omit<Book, 'id'> = {
        title: sampleBook.title,
        author: sampleBook.author,
        language: sampleBook.language,
        targetLanguage: sampleBook.language === 'en' ? 'es' : 'en', // Default translation target
        format: sampleBook.filename.endsWith('.epub') ? 'epub' : 'txt',
        filePath: targetPath,
        coverPath: null,
        addedAt: new Date(),
        lastOpenedAt: new Date()
      };
      
      preloadedBooks.push(book as Book);
      console.log(`✅ Successfully prepared sample book: ${sampleBook.title} (${fileSizeBytes} bytes)`);
      
    } catch (error) {
      console.error(`❌ Failed to preload ${sampleBook.filename}:`, error);
      console.error('Error details:', error);
    }
  }
  
  console.log(`📚 Prepared ${preloadedBooks.length} sample books for loading`);
  return preloadedBooks;
}

export async function ensureSampleBooksExist(): Promise<void> {
  console.log('🔍 Checking if sample books need to be loaded...');
  
  // This function can be called from the app store to check if we need to add sample books
  // The actual loading will be handled by the app store's addBook method
}