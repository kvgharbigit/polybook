import * as FileSystem from 'expo-file-system';
import { EPUBService } from './epubService';
import { PDFService } from './pdfService';

export interface ParsedContent {
  title: string;
  content: string;
  wordCount: number;
  estimatedReadingTime: number; // in minutes
  author?: string;
  language?: string;
  metadata?: any;
  chapters?: Chapter[]; // For all file formats that support chapters
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  htmlContent: string;
  order: number;
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
      
      // Extract filename as fallback title
      const filename = filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Untitled';
      
      // Clean up the content
      const cleanContent = content
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double
        .trim();

      // Extract title from first line if it looks like a title
      const lines = cleanContent.split('\n');
      let title = filename; // Default to filename
      let mainContent = cleanContent;

      if (lines.length > 0) {
        const firstLine = lines[0].trim();
        // If first line is short and not part of a paragraph, use as title
        if (firstLine.length < 100 && firstLine.length > 3 && 
            (lines.length === 1 || lines[1].trim() === '')) {
          title = firstLine;
          mainContent = lines.slice(2).join('\n').trim();
        }
      }

      // Try to extract chapters from text
      const chapters = this.extractChaptersFromText(mainContent, title);
      
      // Validate chapter quality using the same intelligent criteria as EPUB
      const validatedChapters = chapters.length > 1 ? this.validateAndFilterChapters(chapters) : [];
      
      // Performance guard: Warn about very large TXT files without chapters
      if (validatedChapters.length === 0 && mainContent.length > 200000) {
        console.warn(`📖 ContentParser: ⚠️  Very large TXT file with no chapters detected (${mainContent.length} chars) - will use automatic chunking for performance`);
      }
      
      const wordCount = this.countWords(mainContent);
      const estimatedReadingTime = Math.ceil(wordCount / 250); // 250 WPM average

      return {
        title,
        content: mainContent,
        wordCount,
        estimatedReadingTime,
        chapters: validatedChapters.length > 1 ? validatedChapters : undefined, // Only include if passed validation
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
      
      // Extract filename as fallback title
      const filename = filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Untitled';
      
      // Extract title from HTML
      const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch && titleMatch[1].trim().length > 3 ? titleMatch[1].trim() : filename;

      // Extract text content from HTML
      const content = this.extractTextFromHtml(htmlContent);
      
      // Try to extract chapters from HTML structure
      const chapters = this.extractChaptersFromHtml(htmlContent, title);
      
      // Validate chapter quality using the same intelligent criteria as EPUB
      const validatedChapters = chapters.length > 1 ? this.validateAndFilterChapters(chapters) : [];
      
      // Performance guard: Warn about very large HTML files without chapters
      if (validatedChapters.length === 0 && content.length > 300000) {
        console.warn(`📖 ContentParser: ⚠️  Very large HTML file with no chapters detected (${content.length} chars) - will use automatic chunking for performance`);
      }
      
      const wordCount = this.countWords(content);
      const estimatedReadingTime = Math.ceil(wordCount / 250);

      return {
        title,
        content,
        wordCount,
        estimatedReadingTime,
        chapters: validatedChapters.length > 1 ? validatedChapters : undefined, // Only include if passed validation
      };
    } catch (error) {
      console.error('Error parsing HTML file:', error);
      throw new Error('Failed to parse HTML file');
    }
  }

  /**
   * Extract chapters from text content (high confidence only)
   */
  private static extractChaptersFromText(content: string, bookTitle: string): Chapter[] {
    console.log('📖 ContentParser: Attempting to extract chapters from text...');
    
    // High-confidence chapter patterns
    const chapterPatterns = [
      /^(CHAPTER|Chapter)\s+([IVXLCDM]+|\d+)[^\n]*$/gm, // "CHAPTER I" or "Chapter 1"
      /^(PART|Part)\s+([IVXLCDM]+|\d+)[^\n]*$/gm,        // "PART I" or "Part 1" 
      /^([IVXLCDM]+)\.\s*[A-Z][^\n]{5,50}$/gm,          // "I. Chapter Title"
      /^\d+\.\s*[A-Z][^\n]{5,50}$/gm,                   // "1. Chapter Title"
      /^\s*([IVXLCDM]+)\.\s*$/gm,                       // Centered Roman numerals like "    I."
      /^\s*(Chapter|CHAPTER)\s+(\d+)\s*$/gm,            // Centered "Chapter 1"
    ];
    
    let bestSplit: { sections: string[], titles: string[] } | null = null;
    let bestConfidence = 0;
    
    for (const pattern of chapterPatterns) {
      const matches = Array.from(content.matchAll(pattern));
      
      if (matches.length >= 2 && matches.length <= 50) { // Reasonable chapter count
        // For patterns with capturing groups, we need to handle the split differently
        let sections: string[] = [];
        let titles: string[] = [];
        
        if (pattern.source.includes('([IVXLCDM]+)\\.\\s*$')) {
          // Special handling for centered Roman numerals
          let lastIndex = 0;
          
          for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const matchIndex = match.index!;
            
            // Extract the content section before this match
            if (i > 0) {
              const sectionContent = content.substring(lastIndex, matchIndex).trim();
              if (sectionContent.length > 100) { // Only include substantial sections
                sections.push(sectionContent);
              }
            }
            
            // Extract the Roman numeral and look for title
            const romanNumeral = match[1];
            const remainingContent = content.substring(matchIndex + match[0].length);
            const lines = remainingContent.split('\n').slice(0, 5);
            
            let chapterTitle = `Chapter ${romanNumeral}`;
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine.length > 3 && trimmedLine.length < 80 && 
                  trimmedLine.toUpperCase() === trimmedLine && 
                  !trimmedLine.includes('"') && 
                  trimmedLine.match(/^[A-Z\s\-'.,!]+$/)) {
                chapterTitle = `${romanNumeral}. ${trimmedLine}`;
                break;
              }
            }
            
            titles.push(chapterTitle);
            lastIndex = matchIndex;
          }
          
          // Add the final section
          const finalSection = content.substring(lastIndex).trim();
          if (finalSection.length > 100) {
            sections.push(finalSection);
          }
          
        } else {
          // Normal split for other patterns
          sections = content.split(pattern);
          titles = matches.map(match => match[0].trim());
        }
        
        // Calculate confidence score with conservative but accurate criteria
        let confidence = 0;
        
        // Only proceed if we have matching numbers of sections and titles
        if (sections.length !== titles.length && Math.abs(sections.length - titles.length) > 1) {
          console.log(`📖 ContentParser: Section/title mismatch: ${sections.length} sections, ${titles.length} titles`);
          continue; // Skip this pattern
        }
        
        // 1. Chapter count validation (25 points)
        if (matches.length >= 3 && matches.length <= 50) {
          confidence += 25;
        } else if (matches.length > 50) {
          confidence -= 20; // Penalty for too many
        }
        
        // 2. Section quality validation (35 points)
        const validSections = sections.filter(s => s.trim().length > 1000); // Stricter minimum
        const sectionQuality = validSections.length / sections.length;
        if (sectionQuality >= 0.9) confidence += 35; // 90%+ valid sections
        else if (sectionQuality >= 0.7) confidence += 25; // 70%+ valid sections
        else if (sectionQuality < 0.5) confidence -= 15; // Penalty for many invalid sections
        
        // 3. Size consistency validation (25 points)
        if (validSections.length > 0) {
          const sizes = validSections.map(s => s.trim().length);
          const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
          const stdDev = Math.sqrt(sizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / sizes.length);
          const cv = stdDev / avgSize;
          
          if (cv < 1.0 && avgSize > 2000) confidence += 25; // Very consistent, good size
          else if (cv < 1.5 && avgSize > 1500) confidence += 20; // Moderately consistent
          else if (cv > 2.5) confidence -= 10; // Penalty for high variation
        }
        
        // 4. Title quality validation (15 points)
        const hasGoodTitles = titles.every(title => 
          title.length > 3 && title.length < 80 && !title.includes('\n')
        );
        if (hasGoodTitles) confidence += 15;
        
        console.log(`📖 ContentParser: Pattern found ${matches.length} chapters, confidence: ${confidence}% (need 80%+ for acceptance)`);
        
        if (confidence > bestConfidence && confidence >= 80) { // Conservative but accurate threshold
          bestSplit = { sections, titles };
          bestConfidence = confidence;
        }
      }
    }
    
    if (bestSplit && bestConfidence >= 80) {
      console.log(`📖 ContentParser: ✅ Found high-confidence chapters (${bestConfidence}%) - creating ${bestSplit.titles.length} chapters for validation`);
      
      const chapters: Chapter[] = [];
      bestSplit.sections.forEach((section, index) => {
        if (section.trim().length > 100 && index < bestSplit!.titles.length) {
          chapters.push({
            id: `chapter-${index}`,
            title: bestSplit!.titles[index],
            content: section.trim(),
            htmlContent: `<div>${section.trim().replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>`,
            order: index,
          });
        }
      });
      
      return chapters; // Will be validated by unified validation
    }
    
    console.log(`📖 ContentParser: No clear chapter patterns found (${bestConfidence}%)`);
    return [];
  }
  
  /**
   * Extract chapters from HTML content (high confidence only)
   */
  private static extractChaptersFromHtml(htmlContent: string, bookTitle: string): Chapter[] {
    console.log('📖 ContentParser: Attempting to extract chapters from HTML...');
    
    // Look for HTML chapter structures
    const chapterSelectors = [
      /<(h1|h2)[^>]*>(Chapter|CHAPTER)\s+[IVXLCDM0-9]+[^<]*<\/\1>/gi,
      /<(h1|h2)[^>]*>(Part|PART)\s+[IVXLCDM0-9]+[^<]*<\/\1>/gi,
      /<div[^>]*class[^>]*chapter[^>]*>/gi,
      /<section[^>]*>/gi,
    ];
    
    let bestSplit: { sections: string[], titles: string[] } | null = null;
    let bestConfidence = 0;
    
    for (const selector of chapterSelectors) {
      const matches = Array.from(htmlContent.matchAll(selector));
      
      if (matches.length >= 2 && matches.length <= 50) {
        // Split content by these markers
        const sections = htmlContent.split(selector);
        const titles = matches.map((match, index) => {
          // Extract clean title from HTML
          const titleMatch = match[0].match(/>([^<]+)</);
          return titleMatch ? titleMatch[1].trim() : `Chapter ${index + 1}`;
        });
        
        // Calculate confidence with conservative criteria for HTML
        let confidence = 0;
        
        // 1. Chapter count validation (25 points)
        if (matches.length >= 3 && matches.length <= 30) {
          confidence += 25;
        } else if (matches.length > 30) {
          confidence -= 15; // Penalty for too many
        }
        
        // 2. Section content quality validation (40 points)
        const textSections = sections.map(s => this.extractTextFromHtml(s));
        const validSections = textSections.filter(text => text.trim().length > 1000); // Stricter minimum
        const sectionQuality = validSections.length / textSections.length;
        
        if (sectionQuality >= 0.85 && validSections.every(text => text.length < 50000)) {
          confidence += 40; // High quality sections
        } else if (sectionQuality >= 0.7) {
          confidence += 25; // Decent quality
        } else if (sectionQuality < 0.5) {
          confidence -= 20; // Penalty for poor sections
        }
        
        // 3. Title quality validation (20 points)
        const hasGoodTitles = titles.every(title => 
          title.length > 3 && title.length < 80
        );
        if (hasGoodTitles) confidence += 20;
        
        // 4. HTML structure bonus (15 points)
        const isWellStructured = matches.some(match => 
          match[0].includes('Chapter') || match[0].includes('CHAPTER')
        );
        if (isWellStructured) confidence += 15;
        
        console.log(`📖 ContentParser: HTML pattern found ${matches.length} chapters, confidence: ${confidence}% (need 85%+ for HTML)`);
        
        if (confidence > bestConfidence && confidence >= 85) { // Higher threshold for HTML due to complexity
          bestSplit = { sections, titles };
          bestConfidence = confidence;
        }
      }
    }
    
    if (bestSplit && bestConfidence >= 85) {
      console.log(`📖 ContentParser: ✅ Found high-confidence HTML chapters (${bestConfidence}%) - creating ${bestSplit.titles.length} chapters for validation`);
      
      const chapters: Chapter[] = [];
      bestSplit.sections.forEach((section, index) => {
        const textContent = this.extractTextFromHtml(section);
        if (textContent.trim().length > 100 && index < bestSplit!.titles.length) {
          chapters.push({
            id: `chapter-${index}`,
            title: bestSplit!.titles[index],
            content: textContent.trim(),
            htmlContent: section.trim(),
            order: index,
          });
        }
      });
      
      return chapters; // Will be validated by unified validation
    }
    
    console.log(`📖 ContentParser: No clear HTML chapter patterns found (${bestConfidence}%)`);
    return [];
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
   * Validate and filter chapters using intelligent quality criteria
   * (Unified approach across all file formats)
   */
  private static validateAndFilterChapters(chapters: Chapter[]): Chapter[] {
    console.log(`📖 ContentParser: Validating ${chapters.length} chapters using intelligent criteria`);
    
    if (chapters.length === 0) {
      return [];
    }
    
    const validationResult = this.validateChapterQuality(chapters);
    
    if (!validationResult.isValid) {
      console.log(`📖 ContentParser: ❌ Chapter validation failed: ${validationResult.reason}`);
      return [];
    }
    
    console.log(`📖 ContentParser: ✅ Chapter validation passed: ${validationResult.summary}`);
    return chapters;
  }
  
  /**
   * Unified chapter quality validation (same logic as EPUBService)
   */
  private static validateChapterQuality(chapters: Chapter[]): { isValid: boolean, reason: string, summary: string } {
    if (chapters.length === 0) {
      return { isValid: false, reason: 'No chapters found', summary: '' };
    }
    
    const sizes = chapters.map(ch => ch.content.length);
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const stdDev = Math.sqrt(sizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / sizes.length);
    const coefficientOfVariation = stdDev / avgSize;
    
    console.log(`📖 ContentParser: Chapter analysis - Count: ${chapters.length}, Avg: ${Math.round(avgSize)}, Min: ${minSize}, Max: ${maxSize}, CV: ${coefficientOfVariation.toFixed(2)}`);
    
    // 1. Check if average chapter size is too small (likely sections, not chapters)
    if (avgSize < 800) {
      return {
        isValid: false,
        reason: `Average chapter size too small (${Math.round(avgSize)} chars) - likely sections, not chapters`,
        summary: ''
      };
    }
    
    // 2. Check for excessive variation (mix of very small and large sections)
    if (coefficientOfVariation > 2.0 && chapters.length > 20) {
      return {
        isValid: false,
        reason: `Excessive size variation (CV: ${coefficientOfVariation.toFixed(2)}) with many chapters - likely mix of sections`,
        summary: ''
      };
    }
    
    // 3. Check for too many tiny chapters (indicates section-level extraction)
    const tinyChapters = chapters.filter(ch => ch.content.length < 500).length;
    const tinyPercentage = tinyChapters / chapters.length;
    if (tinyPercentage > 0.5) {
      return {
        isValid: false,
        reason: `Too many tiny chapters (${Math.round(tinyPercentage * 100)}%) - likely extracting sections`,
        summary: ''
      };
    }
    
    // 4. Check title diversity (many identical titles suggests bad parsing)
    const uniqueTitles = new Set(chapters.map(ch => ch.title)).size;
    const titleDiversity = uniqueTitles / chapters.length;
    if (titleDiversity < 0.3 && chapters.length > 10) {
      return {
        isValid: false,
        reason: `Low title diversity (${Math.round(titleDiversity * 100)}%) - many chapters have same title`,
        summary: ''
      };
    }
    
    // 5. Check for reasonable chapter count limits (adjusted for classic literature)
    if (chapters.length > 150) {
      return {
        isValid: false,
        reason: `Excessive chapter count (${chapters.length}) - likely section-level extraction`,
        summary: ''
      };
    }
    
    // 6. Adaptive limits based on average chapter size (adjusted for classic literature)
    if (avgSize < 1000 && chapters.length > 60) {
      return {
        isValid: false,
        reason: `Too many small chapters (${chapters.length} chapters, avg ${Math.round(avgSize)} chars) - likely sections`,
        summary: ''
      };
    }
    
    if (avgSize < 2000 && chapters.length > 80) {
      return {
        isValid: false,
        reason: `Too many medium chapters (${chapters.length} chapters, avg ${Math.round(avgSize)} chars) - suspicious structure`,
        summary: ''
      };
    }
    
    // All validations passed
    const summary = `${chapters.length} chapters, avg ${Math.round(avgSize)} chars, ${Math.round(titleDiversity * 100)}% title diversity`;
    return { isValid: true, reason: '', summary };
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
        return EPUBService.parseFile(filePath);
      case 'pdf':
        return PDFService.parseFile(filePath);
      default:
        throw new Error(`Unsupported file format: ${format}. Currently supported: TXT, HTML, EPUB, PDF.`);
    }
  }
}