import * as FileSystem from 'expo-file-system';
import * as pdfjsLib from 'pdfjs-dist';
import { ParsedContent, Chapter } from './contentParser';

// Configure PDF.js for React Native environment
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Mock document object for PDF.js
if (typeof global !== 'undefined' && !global.document) {
  (global as any).document = {
    createElement: () => ({}),
    getElementsByTagName: () => [],
  };
}

// Mock window for PDF.js
if (typeof global !== 'undefined' && !global.window) {
  (global as any).window = global;
}

export class PDFService {
  /**
   * Parse a PDF file and extract text content for PolyDoc conversion
   */
  static async parseFile(filePath: string): Promise<ParsedContent> {
    try {
      console.log('📄 PDFService: Starting PolyDoc extraction...');
      
      // Read the PDF file as base64
      const pdfData = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Convert base64 to ArrayBuffer
      let bytes: Uint8Array;
      try {
        const binaryString = atob(pdfData);
        bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
      } catch (error) {
        console.error('📄 PDFService: Error decoding base64:', error);
        throw new Error('Invalid base64 data');
      }
      
      // Load the PDF document with worker disabled
      const loadingTask = pdfjsLib.getDocument({ 
        data: bytes,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true
      });
      const pdf = await loadingTask.promise;
      
      console.log(`📄 PDFService: PDF loaded successfully, ${pdf.numPages} pages`);
      
      // Extract metadata
      const metadata = await pdf.getMetadata();
      const filename = filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Untitled';
      
      let title = filename;
      let author = 'Unknown Author';
      
      if (metadata.info) {
        const info = metadata.info as any;
        if (info.Title && typeof info.Title === 'string' && info.Title.trim().length > 0) {
          title = info.Title.trim();
        }
        if (info.Author && typeof info.Author === 'string' && info.Author.trim().length > 0) {
          author = info.Author.trim();
        }
      }
      
      // Extract text from all pages and build PolyDoc
      const polyDoc = await this.buildPolyDoc(pdf);
      
      console.log(`📄 PDFService: PolyDoc built successfully with ${polyDoc.content.length} characters`);
      
      return {
        title,
        content: polyDoc.content,
        wordCount: polyDoc.wordCount,
        estimatedReadingTime: polyDoc.estimatedReadingTime,
        author,
        chapters: polyDoc.chapters.length > 1 ? polyDoc.chapters : undefined,
        metadata: {
          pageCount: pdf.numPages,
          pdfInfo: metadata.info,
          isPolyDoc: true,
          extractionMethod: 'text-layer'
        },
      };
    } catch (error) {
      console.error('📄 PDFService: Error in PolyDoc extraction:', error);
      throw new Error(`Failed to parse PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Build PolyDoc from PDF pages - simple but effective text extraction
   */
  private static async buildPolyDoc(pdf: any): Promise<{
    content: string;
    wordCount: number;
    estimatedReadingTime: number;
    chapters: Chapter[];
  }> {
    const pages: string[] = [];
    const paragraphs: string[] = [];
    
    console.log('📄 PDFService: Extracting text from pages...');
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Extract text items and build readable content
        const textItems = textContent.items
          .filter((item: any) => item.str && item.str.trim().length > 0)
          .map((item: any) => ({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height
          }));
        
        if (textItems.length === 0) {
          console.log(`📄 PDFService: Page ${pageNum} has no text content (possibly scanned)`);
          continue;
        }
        
        // Simple heuristic: group text items into lines and paragraphs
        const pageText = this.buildPageText(textItems);
        
        if (pageText.trim().length > 0) {
          pages.push(pageText);
          
          // Split into paragraphs (double line breaks or significant spacing)
          const pageParagraphs = pageText
            .split(/\n\s*\n/)
            .map(p => p.trim())
            .filter(p => p.length > 0);
          
          paragraphs.push(...pageParagraphs);
        }
        
        // Log progress for large PDFs
        if (pageNum % 10 === 0 || pageNum === pdf.numPages) {
          console.log(`📄 PDFService: Processed ${pageNum}/${pdf.numPages} pages`);
        }
      } catch (error) {
        console.warn(`📄 PDFService: Error processing page ${pageNum}:`, error);
        // Continue with other pages
      }
    }
    
    // Build unified content
    const fullContent = pages.join('\n\n');
    
    // Basic chapter detection
    const chapters = this.detectChapters(paragraphs, pages);
    
    // Calculate stats
    const wordCount = this.countWords(fullContent);
    const estimatedReadingTime = Math.ceil(wordCount / 250);
    
    return {
      content: fullContent,
      wordCount,
      estimatedReadingTime,
      chapters
    };
  }
  
  /**
   * Build readable text from text items using simple heuristics
   */
  private static buildPageText(textItems: any[]): string {
    if (textItems.length === 0) return '';
    
    // Sort by Y position (top to bottom), then X position (left to right)
    const sortedItems = textItems.sort((a, b) => {
      const yDiff = b.y - a.y; // Note: PDF coordinates are bottom-up
      if (Math.abs(yDiff) > 5) return yDiff; // Different lines
      return a.x - b.x; // Same line, left to right
    });
    
    let result = '';
    let lastY = null;
    
    for (const item of sortedItems) {
      const text = item.text.trim();
      if (!text) continue;
      
      // Detect line breaks
      if (lastY !== null && Math.abs(item.y - lastY) > 5) {
        result += '\n';
      } else if (result.length > 0 && !result.endsWith(' ') && !text.startsWith(' ')) {
        result += ' ';
      }
      
      result += text;
      lastY = item.y;
    }
    
    // Clean up the result
    return result
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/(\w)-\s*\n(\w)/g, '$1$2') // Fix hyphenated words
      .trim();
  }
  
  /**
   * Simple chapter detection using common patterns
   */
  private static detectChapters(paragraphs: string[], pages: string[]): Chapter[] {
    const chapters: Chapter[] = [];
    
    // Look for chapter patterns in paragraphs
    const chapterPatterns = [
      /^(CHAPTER|Chapter)\s+([IVXLCDM]+|\d+)[^\n]*$/,
      /^([IVXLCDM]+)\.\s*[A-Z][^\n]{5,50}$/,
      /^\d+\.\s*[A-Z][^\n]{5,50}$/,
    ];
    
    let currentChapter: Chapter | null = null;
    let chapterContent = '';
    let chapterIndex = 0;
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      let isChapterStart = false;
      let chapterTitle = '';
      
      // Check if this paragraph looks like a chapter heading
      for (const pattern of chapterPatterns) {
        const match = paragraph.match(pattern);
        if (match && paragraph.length < 100) { // Chapter titles are usually short
          isChapterStart = true;
          chapterTitle = paragraph;
          break;
        }
      }
      
      if (isChapterStart) {
        // Save previous chapter
        if (currentChapter && chapterContent.trim().length > 500) {
          currentChapter.content = chapterContent.trim();
          chapters.push(currentChapter);
        }
        
        // Start new chapter
        currentChapter = {
          id: `pdf-chapter-${chapterIndex}`,
          title: chapterTitle,
          content: '',
          htmlContent: '',
          order: chapterIndex
        };
        chapterContent = '';
        chapterIndex++;
      } else if (currentChapter) {
        chapterContent += paragraph + '\n\n';
      }
    }
    
    // Add the last chapter
    if (currentChapter && chapterContent.trim().length > 500) {
      currentChapter.content = chapterContent.trim();
      chapters.push(currentChapter);
    }
    
    // If no chapters found or only one chapter, treat each page as a section
    if (chapters.length <= 1 && pages.length > 1) {
      return pages.map((pageContent, index) => ({
        id: `pdf-page-${index}`,
        title: `Page ${index + 1}`,
        content: pageContent.trim(),
        htmlContent: `<div>${pageContent.trim().replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>`,
        order: index
      })).filter(chapter => chapter.content.length > 100);
    }
    
    // Fill in HTML content for detected chapters
    chapters.forEach(chapter => {
      if (!chapter.htmlContent) {
        chapter.htmlContent = `<div>${chapter.content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>`;
      }
    });
    
    console.log(`📄 PDFService: Detected ${chapters.length} chapters/sections`);
    return chapters;
  }
  
  /**
   * Count words in text
   */
  private static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}