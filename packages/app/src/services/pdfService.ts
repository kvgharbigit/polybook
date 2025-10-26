import * as FileSystem from 'expo-file-system';
import * as pdfjsLib from 'pdfjs-dist';
import { ParsedContent, Chapter } from './contentParser';

// Configure PDF.js for React Native environment
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

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
   * Parse a PDF file and extract text content
   */
  static async parseFile(filePath: string): Promise<ParsedContent> {
    try {
      console.log('📄 PDFService: Starting PDF parsing...');
      
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
      
      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument({ data: bytes });
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
      
      // Extract text from all pages
      let fullText = '';
      const pageTexts: string[] = [];
      
      console.log('📄 PDFService: Extracting text from pages...');
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Combine text items into readable text
          const pageText = textContent.items
            .map((item: any) => {
              if ('str' in item) {
                return item.str;
              }
              return '';
            })
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (pageText.length > 0) {
            pageTexts.push(pageText);
            fullText += pageText + '\n\n';
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
      
      // Clean up the extracted text
      const cleanText = fullText
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log(`📄 PDFService: Extracted ${cleanText.length} characters from PDF`);
      
      // Try to extract chapters from the PDF text
      const chapters = this.extractChaptersFromPDF(pageTexts, title);
      
      // Calculate reading stats
      const wordCount = this.countWords(cleanText);
      const estimatedReadingTime = Math.ceil(wordCount / 250); // 250 WPM average
      
      return {
        title,
        content: cleanText,
        wordCount,
        estimatedReadingTime,
        author,
        chapters: chapters.length > 1 ? chapters : undefined,
        metadata: {
          pageCount: pdf.numPages,
          pdfInfo: metadata.info,
        },
      };
    } catch (error) {
      console.error('📄 PDFService: Error parsing PDF:', error);
      throw new Error(`Failed to parse PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Extract chapters from PDF content using page breaks and text patterns
   */
  private static extractChaptersFromPDF(pageTexts: string[], bookTitle: string): Chapter[] {
    console.log('📄 PDFService: Attempting to extract chapters from PDF...');
    
    if (pageTexts.length === 0) {
      return [];
    }
    
    // Strategy 1: Look for chapter patterns in the text
    const fullText = pageTexts.join('\n\n');
    const textChapters = this.extractChaptersFromText(fullText);
    
    if (textChapters.length > 1) {
      console.log(`📄 PDFService: Found ${textChapters.length} text-based chapters`);
      return textChapters;
    }
    
    // Strategy 2: Use page breaks as chapter boundaries for smaller PDFs
    if (pageTexts.length >= 3 && pageTexts.length <= 50) {
      const pageBasedChapters = this.createPageBasedChapters(pageTexts);
      
      // Validate page-based chapters
      const avgPageLength = pageTexts.reduce((sum, text) => sum + text.length, 0) / pageTexts.length;
      
      if (avgPageLength > 1000) { // Each page has substantial content
        console.log(`📄 PDFService: Using ${pageBasedChapters.length} page-based chapters`);
        return pageBasedChapters;
      }
    }
    
    console.log('📄 PDFService: No clear chapter structure found');
    return [];
  }
  
  /**
   * Extract chapters from text using pattern matching
   */
  private static extractChaptersFromText(content: string): Chapter[] {
    // Use similar patterns as ContentParser but adapted for PDF
    const chapterPatterns = [
      /^(CHAPTER|Chapter)\s+([IVXLCDM]+|\d+)[^\n]*$/gm,
      /^(PART|Part)\s+([IVXLCDM]+|\d+)[^\n]*$/gm,
      /^([IVXLCDM]+)\.\s*[A-Z][^\n]{5,50}$/gm,
      /^\d+\.\s*[A-Z][^\n]{5,50}$/gm,
    ];
    
    for (const pattern of chapterPatterns) {
      const matches = Array.from(content.matchAll(pattern));
      
      if (matches.length >= 2 && matches.length <= 30) {
        const sections = content.split(pattern);
        const titles = matches.map(match => match[0].trim());
        
        // Validate that we have meaningful chapters
        const validSections = sections.filter(s => s.trim().length > 500);
        
        if (validSections.length === titles.length && validSections.length >= 2) {
          const chapters: Chapter[] = [];
          
          validSections.forEach((section, index) => {
            if (index < titles.length) {
              chapters.push({
                id: `pdf-chapter-${index}`,
                title: titles[index],
                content: section.trim(),
                htmlContent: `<div>${section.trim().replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>`,
                order: index,
              });
            }
          });
          
          return chapters;
        }
      }
    }
    
    return [];
  }
  
  /**
   * Create chapters based on page breaks
   */
  private static createPageBasedChapters(pageTexts: string[]): Chapter[] {
    const chapters: Chapter[] = [];
    
    pageTexts.forEach((pageText, index) => {
      if (pageText.trim().length > 100) {
        // Try to extract a title from the first line of the page
        const lines = pageText.trim().split('\n');
        const firstLine = lines[0].trim();
        
        let title = `Page ${index + 1}`;
        
        // If first line looks like a title (short, capitalized, etc.)
        if (firstLine.length < 80 && firstLine.length > 3) {
          const words = firstLine.split(' ');
          const capitalizedWords = words.filter(word => 
            word.length > 0 && word[0] === word[0].toUpperCase()
          );
          
          // If most words are capitalized, it might be a title
          if (capitalizedWords.length / words.length > 0.5) {
            title = firstLine;
          }
        }
        
        chapters.push({
          id: `pdf-page-${index}`,
          title,
          content: pageText.trim(),
          htmlContent: `<div>${pageText.trim().replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>`,
          order: index,
        });
      }
    });
    
    return chapters;
  }
  
  /**
   * Count words in text
   */
  private static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}