import * as FileSystem from 'expo-file-system';
import { EPUBParser } from './epubParser';

export interface ParsedContent {
  title: string;
  content: string;
  wordCount: number;
  estimatedReadingTime: number; // in minutes
  author?: string;
  language?: string;
  metadata?: any;
  chapters?: import('./epubParser').EPUBChapter[]; // For EPUB files
}

export interface ContentChunk {
  id: string;
  text: string;
  startPosition: number;
  endPosition: number;
}

export class ContentParser {
  
  /**
   * Parse a text file and return structured content
   */
  static async parseTxtFile(filePath: string): Promise<ParsedContent> {
    try {
      const content = await FileSystem.readAsStringAsync(filePath);
      
      // Clean up the content
      const cleanContent = content
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double
        .trim();

      // Extract title from first line if it looks like a title
      const lines = cleanContent.split('\n');
      let title = 'Untitled';
      let mainContent = cleanContent;

      if (lines.length > 0) {
        const firstLine = lines[0].trim();
        // If first line is short and not part of a paragraph, use as title
        if (firstLine.length < 100 && firstLine.length > 0 && 
            (lines.length === 1 || lines[1].trim() === '')) {
          title = firstLine;
          mainContent = lines.slice(2).join('\n').trim();
        }
      }

      const wordCount = this.countWords(mainContent);
      const estimatedReadingTime = Math.ceil(wordCount / 250); // 250 WPM average

      return {
        title,
        content: mainContent,
        wordCount,
        estimatedReadingTime,
      };
    } catch (error) {
      console.error('Error parsing TXT file:', error);
      throw new Error('Failed to parse text file');
    }
  }

  /**
   * Parse an HTML file and extract text content
   */
  static async parseHtmlFile(filePath: string): Promise<ParsedContent> {
    try {
      const htmlContent = await FileSystem.readAsStringAsync(filePath);
      
      // Extract title from HTML
      const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

      // Extract text content from HTML
      const content = this.extractTextFromHtml(htmlContent);
      const wordCount = this.countWords(content);
      const estimatedReadingTime = Math.ceil(wordCount / 250);

      return {
        title,
        content,
        wordCount,
        estimatedReadingTime,
      };
    } catch (error) {
      console.error('Error parsing HTML file:', error);
      throw new Error('Failed to parse HTML file');
    }
  }

  /**
   * Extract text content from HTML string
   */
  private static extractTextFromHtml(html: string): string {
    // Remove script and style elements
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');

    // Convert common HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");

    // Add line breaks for block elements
    text = text
      .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
      .replace(/<\/?(ul|ol|dl|table|blockquote)[^>]*>/gi, '\n\n');

    // Remove all remaining HTML tags
    text = text.replace(/<[^>]*>/g, '');

    // Clean up whitespace
    text = text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    return text;
  }

  /**
   * Count words in text
   */
  private static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Split content into manageable chunks for rendering
   */
  static splitIntoChunks(content: string, chunkSize: number = 1000): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    const words = content.split(/(\s+)/); // Split but keep separators
    let currentChunk = '';
    let chunkIndex = 0;
    let position = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const nextChunkLength = currentChunk.length + word.length;

      if (nextChunkLength > chunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          id: `chunk_${chunkIndex}`,
          text: currentChunk.trim(),
          startPosition: position - currentChunk.length,
          endPosition: position,
        });

        chunkIndex++;
        currentChunk = word;
      } else {
        currentChunk += word;
      }

      position += word.length;
    }

    // Add the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        text: currentChunk.trim(),
        startPosition: position - currentChunk.length,
        endPosition: position,
      });
    }

    return chunks;
  }

  /**
   * Parse file based on its format
   */
  static async parseFile(filePath: string, format: string): Promise<ParsedContent> {
    switch (format.toLowerCase()) {
      case 'txt':
        return this.parseTxtFile(filePath);
      case 'html':
      case 'htm':
        return this.parseHtmlFile(filePath);
      case 'epub':
        return EPUBParser.parseEPUB(filePath);
      case 'pdf':
        throw new Error('PDF files are not yet supported. Coming in Phase 2! Please use TXT, HTML, or EPUB files for now.');
      default:
        throw new Error(`Unsupported file format: ${format}. Currently supported: TXT, HTML, EPUB. PDF coming soon!`);
    }
  }
}