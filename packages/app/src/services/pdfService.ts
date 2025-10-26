import * as FileSystem from 'expo-file-system';
import { ParsedContent, Chapter } from './contentParser';

export class PDFService {
  /**
   * Parse a PDF file using WebView-based PolyDoc extraction
   * This method prepares the metadata and delegates actual text extraction to the WebView
   */
  static async parseFile(filePath: string): Promise<ParsedContent> {
    try {
      console.log('📄 PDFService: Starting WebView-based PolyDoc extraction...');
      
      // Get file info for metadata
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error('PDF file not found');
      }
      
      // Extract filename for title
      const filename = filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Untitled PDF';
      
      console.log(`📄 PDFService: PDF file found (${Math.round((fileInfo.size || 0) / 1024)}KB)`);
      
      // For now, return a placeholder that indicates WebView extraction is needed
      // The actual extraction will be handled by PdfPolyDocExtractor component
      const placeholderContent = `${filename}

📄 PDF Document Ready for Processing

This PDF is being processed using our advanced PolyDoc extraction system.

What happens next:
🔄 Text extraction from all pages
📖 Smart paragraph and chapter detection  
🎯 Reflow formatting for optimal reading
✨ Full integration with PolyBook features

Features available after processing:
✅ Resizable text and custom themes
✅ Word lookup and vocabulary cards
✅ Text-to-speech support
✅ Chapter navigation
✅ Search functionality

File Information:
• Format: PDF with PolyDoc extraction
• Size: ${Math.round((fileInfo.size || 0) / 1024)}KB
• Location: ${filePath}

Processing will begin automatically when you open this document.`;

      // Estimate word count based on file size
      const estimatedWordCount = Math.max(100, Math.round((fileInfo.size || 0) / 10));
      const estimatedReadingTime = Math.max(1, Math.ceil(estimatedWordCount / 250));
      
      console.log('📄 PDFService: Prepared for WebView extraction');
      
      return {
        title: filename,
        content: placeholderContent,
        wordCount: estimatedWordCount,
        estimatedReadingTime,
        author: 'Unknown Author',
        chapters: undefined, // Will be populated by WebView extraction
        metadata: {
          format: 'pdf',
          fileSize: fileInfo.size,
          originalPath: filePath,
          requiresWebViewExtraction: true,
          extractionMethod: 'webview-polydoc',
          note: 'PDF processing via WebView for full feature support'
        },
      };
    } catch (error) {
      console.error('📄 PDFService: Error preparing PDF for extraction:', error);
      throw new Error(`Failed to parse PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build ParsedContent from WebView extraction results
   */
  static buildPolyDocFromExtraction(
    originalContent: ParsedContent,
    blocks: any[],
    chapters: Chapter[],
    metadata: any
  ): ParsedContent {
    // Combine all blocks into readable content
    const extractedContent = blocks
      .map(block => block.text)
      .join('\n\n');

    // Calculate actual word count
    const wordCount = this.countWords(extractedContent);
    const estimatedReadingTime = Math.ceil(wordCount / 250);

    // Update title from PDF metadata if available
    let title = originalContent.title;
    let author = originalContent.author;

    if (metadata?.Title && typeof metadata.Title === 'string') {
      title = metadata.Title.trim();
    }
    if (metadata?.Author && typeof metadata.Author === 'string') {
      author = metadata.Author.trim();
    }

    return {
      title,
      content: extractedContent,
      wordCount,
      estimatedReadingTime,
      author,
      chapters: chapters.length > 1 ? chapters : undefined,
      metadata: {
        ...originalContent.metadata,
        pageCount: metadata?.pageCount,
        pdfInfo: metadata,
        isPolyDocExtracted: true,
        extractionMethod: 'webview-polydoc-complete',
        blocksCount: blocks.length,
        extractedAt: new Date().toISOString()
      },
    };
  }

  /**
   * Count words in text
   */
  private static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}