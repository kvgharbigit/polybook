import * as FileSystem from 'expo-file-system';
import { ParsedContent, Chapter } from './contentParser';

export class PDFService {
  /**
   * Parse a PDF file and extract basic metadata
   * Note: Text extraction from PDFs in React Native is limited
   */
  static async parseFile(filePath: string): Promise<ParsedContent> {
    try {
      console.log('📄 PDFService: Starting PDF parsing...');
      
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error('PDF file not found');
      }
      
      // Extract filename for title
      const filename = filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Untitled PDF';
      
      console.log(`📄 PDFService: PDF file found (${Math.round((fileInfo.size || 0) / 1024)}KB)`);
      
      // For now, we'll create a placeholder content since text extraction
      // from PDFs in React Native requires native modules with complex setup
      const placeholderContent = `PDF Document: ${filename}

This PDF file has been imported into PolyBook.

Note: Full text extraction from PDF files is currently limited in the mobile version of PolyBook. You can view the PDF file, but text-based features like word lookup and vocabulary cards may not be available.

To get the full reading experience with text extraction, consider:
1. Converting the PDF to EPUB format using external tools
2. Using the web version of PolyBook (if available)
3. Extracting text manually and importing as a TXT file

File Information:
- Format: PDF
- Size: ${Math.round((fileInfo.size || 0) / 1024)}KB
- Location: ${filePath}`;

      // Calculate estimated stats
      const wordCount = this.countWords(placeholderContent);
      const estimatedReadingTime = Math.ceil(wordCount / 250);
      
      console.log('📄 PDFService: Created placeholder content for PDF');
      
      return {
        title: filename,
        content: placeholderContent,
        wordCount,
        estimatedReadingTime,
        author: 'Unknown Author',
        chapters: undefined, // No chapter detection for PDFs currently
        metadata: {
          format: 'pdf',
          fileSize: fileInfo.size,
          originalPath: filePath,
          isPlaceholder: true,
          note: 'Text extraction from PDFs is currently limited in the mobile app'
        },
      };
    } catch (error) {
      console.error('📄 PDFService: Error parsing PDF:', error);
      throw new Error(`Failed to parse PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Count words in text
   */
  private static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}