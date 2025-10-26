import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

export interface EPUBChapter {
  id: string;
  title: string;
  href: string;
  content: string;
  htmlContent: string;
  order: number;
}

export interface EPUBMetadata {
  title: string;
  author: string;
  language: string;
  identifier: string;
  description?: string;
}

export interface EPUBParseResult {
  content: string;
  title: string;
  author: string;
  language: string;
  wordCount: number;
  estimatedReadingTime: number;
  chapters: EPUBChapter[];
  metadata: {
    format: 'epub';
    chapters: number;
    identifier: string;
    description?: string;
  };
}

export class EPUBService {
  /**
   * Parse EPUB file using reliable JSZip + navigation approach
   */
  static async parseFile(filePath: string): Promise<EPUBParseResult> {
    console.log('📚 EPUBService: Starting EPUB parsing with JSZip + navigation');
    
    try {
      // Read the EPUB file
      const fileContent = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.Base64 });
      const arrayBuffer = Uint8Array.from(atob(fileContent), c => c.charCodeAt(0)).buffer;
      
      // Load ZIP data
      const zipData = await new JSZip().loadAsync(arrayBuffer);
      console.log('📚 EPUBService: ZIP loaded successfully');
      
      // Extract metadata
      const metadata = await this.extractMetadata(zipData);
      console.log('📚 EPUBService: Metadata extracted:', metadata);
      
      // Extract chapters using proper EPUB navigation
      const chapters = await this.extractChaptersFromNavigation(zipData);
      console.log(`📚 EPUBService: Extracted ${chapters.length} chapters`);
      console.log('📚 EPUBService: Chapter titles:', chapters.map((c, i) => `${i}: "${c.title}"`));
      
      // Combine all chapter content
      const fullContent = chapters
        .map(chapter => `\n\n# ${chapter.title}\n\n${chapter.content}`)
        .join('\n\n');
      
      // Performance guard: If no valid chapters but content is very large, warn about potential rendering issues
      if (chapters.length === 0 && fullContent.length > 500000) {
        console.warn(`📚 EPUBService: ⚠️  Very large EPUB with no chapters detected (${fullContent.length} chars) - will use automatic chunking for performance`);
      }
      
      // Calculate metrics
      const wordCount = this.countWords(fullContent);
      const estimatedReadingTime = Math.ceil(wordCount / 200); // 200 words per minute
      
      console.log(`📚 EPUBService: EPUB parsed successfully: ${chapters.length} chapters, ${wordCount} words, ${fullContent.length} chars`);
      
      return {
        content: fullContent.trim(),
        title: metadata.title,
        author: metadata.author,
        language: metadata.language,
        wordCount,
        estimatedReadingTime,
        chapters,
        metadata: {
          format: 'epub',
          chapters: chapters.length,
          identifier: metadata.identifier,
          description: metadata.description,
        },
      };
      
    } catch (error) {
      console.error('📚 EPUBService: Error parsing EPUB:', error);
      throw new Error(`Failed to parse EPUB file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Extract metadata from EPUB zip
   */
  private static async extractMetadata(zipData: JSZip): Promise<EPUBMetadata> {
    try {
      // Read container.xml to find content.opf location
      const containerFile = zipData.file('META-INF/container.xml');
      if (!containerFile) {
        throw new Error('META-INF/container.xml not found');
      }
      
      const containerXml = await containerFile.async('string');
      const containerParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
      const container = containerParser.parse(containerXml);
      const rootFilePath = container.container.rootfiles.rootfile['full-path'];
      
      // Read content.opf
      const contentOpfFile = zipData.file(rootFilePath);
      if (!contentOpfFile) {
        throw new Error(`content.opf file not found at ${rootFilePath}`);
      }
      
      const contentOpfXml = await contentOpfFile.async('string');
      const opfParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
      const opf = opfParser.parse(contentOpfXml);
      const metadata = opf.package.metadata;
      
      return {
        title: this.extractTextContent(metadata['dc:title']) || 'Unknown Title',
        author: this.extractTextContent(metadata['dc:creator']) || 'Unknown Author',
        language: this.extractTextContent(metadata['dc:language']) || 'en',
        identifier: this.extractTextContent(metadata['dc:identifier']) || 'unknown',
        description: this.extractTextContent(metadata['dc:description']),
      };
    } catch (error) {
      console.warn('📚 EPUBService: Error extracting metadata:', error);
      return {
        title: 'Unknown Title',
        author: 'Unknown Author',
        language: 'en',
        identifier: 'unknown',
      };
    }
  }
  
  /**
   * Extract chapters using EPUB navigation structure
   */
  private static async extractChaptersFromNavigation(zipData: JSZip): Promise<EPUBChapter[]> {
    console.log('📚 EPUBService: Attempting to extract chapters from navigation');
    
    try {
      // First get the manifest and spine to understand the structure
      const { manifest, baseDir, spine } = await this.getManifestAndBaseDir(zipData);
      
      // Try EPUB 3 navigation first - intelligent validation
      const navChapters = await this.tryParseNavXhtml(zipData, manifest, baseDir, spine);
      if (navChapters.length > 1) {
        const navValidation = this.validateChapterQuality(navChapters);
        if (navValidation.isValid) {
          console.log(`📚 EPUBService: Found quality chapters from nav.xhtml - ${navValidation.summary}`);
          return navChapters;
        } else {
          console.log(`📚 EPUBService: nav.xhtml chapters failed validation - ${navValidation.reason}`);
        }
      }
      
      // Try EPUB 2 NCX navigation - intelligent validation
      const ncxChapters = await this.tryParseNCX(zipData, manifest, baseDir, spine);
      if (ncxChapters.length > 1) {
        const ncxValidation = this.validateChapterQuality(ncxChapters);
        if (ncxValidation.isValid) {
          console.log(`📚 EPUBService: Found quality chapters from NCX - ${ncxValidation.summary}`);
          return ncxChapters;
        } else {
          console.log(`📚 EPUBService: NCX chapters failed validation - ${ncxValidation.reason}`);
        }
      }
      
      console.log('📚 EPUBService: Using improved spine-based parsing');
      return await this.parseChaptersFromSpine(zipData, manifest, baseDir, spine);
      
    } catch (error) {
      console.error('📚 EPUBService: Error in navigation parsing:', error);
      return [];
    }
  }
  
  /**
   * Get manifest, spine, and base directory
   */
  private static async getManifestAndBaseDir(zipData: JSZip): Promise<{ manifest: any[], baseDir: string, spine: any[] }> {
    const containerFile = zipData.file('META-INF/container.xml');
    if (!containerFile) throw new Error('META-INF/container.xml not found');
    
    const containerXml = await containerFile.async('string');
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    const container = parser.parse(containerXml);
    const rootFilePath = container.container.rootfiles.rootfile['full-path'];
    
    const contentOpfFile = zipData.file(rootFilePath);
    if (!contentOpfFile) throw new Error(`content.opf file not found at ${rootFilePath}`);
    
    const contentOpfXml = await contentOpfFile.async('string');
    const opf = parser.parse(contentOpfXml);
    const manifestItems = Array.isArray(opf.package.manifest.item) 
      ? opf.package.manifest.item 
      : [opf.package.manifest.item];
    
    const spineItems = Array.isArray(opf.package.spine.itemref)
      ? opf.package.spine.itemref
      : [opf.package.spine.itemref];
    
    const baseDir = rootFilePath.includes('/') ? rootFilePath.substring(0, rootFilePath.lastIndexOf('/') + 1) : '';
    
    return { manifest: manifestItems, baseDir, spine: spineItems };
  }
  
  /**
   * Try to parse EPUB 3 nav.xhtml
   */
  private static async tryParseNavXhtml(zipData: JSZip, manifest: any[], baseDir: string, spine: any[]): Promise<EPUBChapter[]> {
    try {
      const navItem = manifest.find(item => 
        item['media-type'] === 'application/xhtml+xml' && 
        item.properties && item.properties.includes('nav'),
      );
      
      if (!navItem) return [];
      
      const navFile = zipData.file(`${baseDir}${navItem.href}`);
      if (!navFile) return [];
      
      const navHtml = await navFile.async('string');
      const chapters: EPUBChapter[] = [];
      
      // Extract links from TOC nav
      const tocMatch = navHtml.match(/<nav[^>]*epub:type="toc"[^>]*>([\s\S]*?)<\/nav>/i);
      if (tocMatch) {
        const linkMatches = tocMatch[1].match(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi) || [];
        
        for (let i = 0; i < linkMatches.length; i++) {
          const linkMatch = linkMatches[i].match(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
          if (linkMatch) {
            const href = linkMatch[1].split('#')[0];
            let title = linkMatch[2].trim();
            
            // Clean up title - remove HTML entities and extra whitespace
            title = title
              .replace(/&[^;]+;/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            // If title is generic or too long, generate a better one
            if (title.length > 100 || title.toLowerCase().includes('project gutenberg') || 
                title.toLowerCase() === 'frankenstein' || title.length < 3) {
              title = this.generateChapterTitle(href, i + 1);
            }
            
            const chapter = await this.loadChapterContent(zipData, baseDir, href, title, i);
            if (chapter) chapters.push(chapter);
          }
        }
      }
      
      return chapters;
    } catch (error) {
      console.warn('📚 EPUBService: Error parsing nav.xhtml:', error);
      return [];
    }
  }
  
  /**
   * Try to parse EPUB 2 NCX
   */
  private static async tryParseNCX(zipData: JSZip, manifest: any[], baseDir: string, spine: any[]): Promise<EPUBChapter[]> {
    try {
      const ncxItem = manifest.find(item => item['media-type'] === 'application/x-dtbncx+xml');
      if (!ncxItem) return [];
      
      const ncxFile = zipData.file(`${baseDir}${ncxItem.href}`);
      if (!ncxFile) return [];
      
      const ncxXml = await ncxFile.async('string');
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
      const ncx = parser.parse(ncxXml);
      
      const chapters: EPUBChapter[] = [];
      const navPoints = Array.isArray(ncx.ncx.navMap.navPoint) 
        ? ncx.ncx.navMap.navPoint 
        : [ncx.ncx.navMap.navPoint];
      
      for (let i = 0; i < navPoints.length; i++) {
        const navPoint = navPoints[i];
        if (navPoint?.content?.src && navPoint?.navLabel) {
          const href = navPoint.content.src.split('#')[0];
          let title = this.extractTextContent(navPoint.navLabel.text) || `Chapter ${i + 1}`;
          
          // Clean up title
          title = title.replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
          
          // If title is generic, generate a better one
          if (title.length > 100 || title.toLowerCase().includes('project gutenberg') || 
              title.toLowerCase() === 'frankenstein' || title.length < 3) {
            title = this.generateChapterTitle(href, i + 1);
          }
          
          const chapter = await this.loadChapterContent(zipData, baseDir, href, title, i);
          if (chapter) chapters.push(chapter);
        }
      }
      
      return chapters;
    } catch (error) {
      console.warn('📚 EPUBService: Error parsing NCX:', error);
      return [];
    }
  }
  
  /**
   * Parse chapters from spine in proper reading order
   */
  private static async parseChaptersFromSpine(zipData: JSZip, manifest: any[], baseDir: string, spine: any[]): Promise<EPUBChapter[]> {
    console.log('📚 EPUBService: Parsing chapters from spine');
    const chapters: EPUBChapter[] = [];
    
    for (let i = 0; i < spine.length; i++) {
      const spineItem = spine[i];
      const idref = spineItem.idref;
      
      // Find the manifest item for this spine entry
      const manifestItem = manifest.find(item => item.id === idref);
      if (!manifestItem || !manifestItem['media-type']?.includes('html')) {
        continue;
      }
      
      const href = manifestItem.href.toLowerCase();
      if (this.shouldSkipFile(href)) continue;
      
      try {
        // Use a more descriptive title
        const title = this.generateChapterTitle(manifestItem.href, i + 1);
        const chapter = await this.loadChapterContent(zipData, baseDir, manifestItem.href, title, i);
        
        if (chapter) {
          // Much more conservative protection against treating pages as chapters
          const contentSize = chapter.content.length;
          const htmlSize = chapter.htmlContent.length;
          
          // Filter out oversized chapters (likely containing multiple chapters or entire book)
          if (contentSize > 50000) {
            console.log(`📚 EPUBService: 🚫 Skipping oversized chapter ${chapter.title} (${contentSize} chars) - likely contains entire book`);
            continue;
          }
          
          // Much stricter minimum size for chapters (avoid pages being treated as chapters)
          if (contentSize < 1000) {
            console.log(`📚 EPUBService: 🚫 Skipping small section ${chapter.title} (${contentSize} chars) - likely a page, not a chapter`);
            continue;
          }
          
          // Check if HTML is suspiciously large compared to text
          if (htmlSize > 100000) {
            console.log(`📚 EPUBService: 🚫 Skipping chapter with oversized HTML ${chapter.title} (HTML: ${htmlSize} chars) - likely malformed`);
            continue;
          }
          
          // Reasonable chapter count limit to prevent page explosion
          if (chapters.length >= 50) {
            console.log(`📚 EPUBService: 🚫 Stopping chapter extraction - already have ${chapters.length} chapters (likely extracting pages instead of chapters)`);
            break;
          }
          
          console.log(`📚 EPUBService: ✅ Adding chapter ${chapter.title} (${contentSize} chars)`);
          chapters.push(chapter);
        }
      } catch (error) {
        console.warn(`📚 EPUBService: Error loading spine item ${manifestItem.href}:`, error);
      }
    }
    
    console.log(`📚 EPUBService: Extracted ${chapters.length} chapters from spine`);
    
    // Smart chapter validation based on content quality, not just quantity
    const validationResult = this.validateChapterQuality(chapters);
    
    if (!validationResult.isValid) {
      console.log(`📚 EPUBService: ❌ Chapter quality validation failed: ${validationResult.reason}`);
      return [];
    }
    
    // Final safety check: if we have very few chapters but they're huge, split them
    if (chapters.length <= 3) {
      const hasOversizedChapter = chapters.some(ch => ch.content.length > 30000);
      if (hasOversizedChapter) {
        console.log('📚 EPUBService: ⚠️  Detected oversized chapters in small chapter count - attempting to split');
        return this.splitOversizedChapters(chapters);
      }
    }
    
    console.log(`📚 EPUBService: ✅ Chapter validation passed - ${validationResult.summary}`);
    return chapters;
  }
  
  /**
   * Validate chapter quality using multiple intelligent criteria
   */
  private static validateChapterQuality(chapters: EPUBChapter[]): { isValid: boolean, reason: string, summary: string } {
    if (chapters.length === 0) {
      return { isValid: false, reason: 'No chapters found', summary: '' };
    }
    
    const sizes = chapters.map(ch => ch.content.length);
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const stdDev = Math.sqrt(sizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / sizes.length);
    const coefficientOfVariation = stdDev / avgSize;
    
    console.log(`📚 EPUBService: Chapter analysis - Count: ${chapters.length}, Avg: ${Math.round(avgSize)}, Min: ${minSize}, Max: ${maxSize}, CV: ${coefficientOfVariation.toFixed(2)}`);
    
    // 1. Check if average chapter size is too small (likely pages)
    if (avgSize < 800) {
      return {
        isValid: false,
        reason: `Average chapter size too small (${Math.round(avgSize)} chars) - likely pages, not chapters`,
        summary: ''
      };
    }
    
    // 2. Check for excessive variation (mix of very small and large chapters)
    if (coefficientOfVariation > 2.0 && chapters.length > 20) {
      return {
        isValid: false,
        reason: `Excessive size variation (CV: ${coefficientOfVariation.toFixed(2)}) with many chapters - likely mix of pages and chapters`,
        summary: ''
      };
    }
    
    // 3. Check for too many tiny chapters (indicates page-level extraction)
    const tinyChapters = chapters.filter(ch => ch.content.length < 500).length;
    const tinyPercentage = tinyChapters / chapters.length;
    if (tinyPercentage > 0.5) {
      return {
        isValid: false,
        reason: `Too many tiny chapters (${Math.round(tinyPercentage * 100)}%) - likely extracting pages`,
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
        reason: `Excessive chapter count (${chapters.length}) - likely page-level extraction`,
        summary: ''
      };
    }
    
    // 6. Adaptive limits based on average chapter size (adjusted for classic literature)
    if (avgSize < 1000 && chapters.length > 60) {
      return {
        isValid: false,
        reason: `Too many small chapters (${chapters.length} chapters, avg ${Math.round(avgSize)} chars) - likely pages`,
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
   * Split oversized chapters into smaller, manageable chunks
   */
  private static splitOversizedChapters(chapters: EPUBChapter[]): EPUBChapter[] {
    const splitChapters: EPUBChapter[] = [];
    
    for (const chapter of chapters) {
      if (chapter.content.length <= 30000) {
        // Chapter is reasonable size, keep as-is
        splitChapters.push(chapter);
        continue;
      }
      
      console.log(`📚 EPUBService: Splitting oversized chapter "${chapter.title}" (${chapter.content.length} chars)`);
      
      // Split by common chapter boundaries first
      const chapterSections = this.splitChapterBySections(chapter);
      if (chapterSections.length > 1) {
        splitChapters.push(...chapterSections);
        continue;
      }
      
      // If no natural boundaries, split by size
      const chunks = this.splitChapterBySize(chapter, 15000);
      splitChapters.push(...chunks);
    }
    
    console.log(`📚 EPUBService: Split result: ${chapters.length} → ${splitChapters.length} chapters`);
    return splitChapters;
  }
  
  /**
   * Split chapter by natural section boundaries
   */
  private static splitChapterBySections(chapter: EPUBChapter): EPUBChapter[] {
    const sections: EPUBChapter[] = [];
    
    // Look for chapter/section markers in the content
    const sectionPatterns = [
      /\n\s*CHAPTER\s+[IVXLCDM0-9]+/gi,
      /\n\s*Chapter\s+\d+/gi,
      /\n\s*\d+\.\s+/gm, // Numbered sections
      /\n\s*[IVXLCDM]+\.\s+/gm, // Roman numerals
    ];
    
    let bestSplit: string[] | null = null;
    
    for (const pattern of sectionPatterns) {
      const matches = chapter.content.split(pattern);
      if (matches.length > 1 && matches.length < 20) { // Reasonable number of sections
        bestSplit = matches;
        break;
      }
    }
    
    if (bestSplit && bestSplit.length > 1) {
      bestSplit.forEach((section, index) => {
        if (section.trim().length > 100) { // Only include substantial sections
          sections.push({
            id: `${chapter.id}-section-${index}`,
            title: `${chapter.title} - Part ${index + 1}`,
            href: chapter.href,
            content: section.trim(),
            htmlContent: chapter.htmlContent, // Keep original HTML
            order: chapter.order + (index * 0.1), // Maintain order
          });
        }
      });
    }
    
    return sections;
  }
  
  /**
   * Split chapter by size when no natural boundaries exist
   */
  private static splitChapterBySize(chapter: EPUBChapter, chunkSize: number): EPUBChapter[] {
    const chunks: EPUBChapter[] = [];
    const content = chapter.content;
    
    for (let i = 0; i < content.length; i += chunkSize) {
      let end = i + chunkSize;
      
      // Try to break at a sentence or paragraph boundary
      if (end < content.length) {
        const nextPeriod = content.indexOf('.', end);
        const nextNewline = content.indexOf('\n', end);
        
        if (nextPeriod > 0 && nextPeriod < end + 500) {
          end = nextPeriod + 1;
        } else if (nextNewline > 0 && nextNewline < end + 200) {
          end = nextNewline + 1;
        }
      }
      
      const chunkContent = content.slice(i, end).trim();
      if (chunkContent.length > 100) {
        chunks.push({
          id: `${chapter.id}-chunk-${chunks.length}`,
          title: `${chapter.title} - Part ${chunks.length + 1}`,
          href: chapter.href,
          content: chunkContent,
          htmlContent: chapter.htmlContent,
          order: chapter.order + (chunks.length * 0.1),
        });
      }
    }
    
    return chunks;
  }
  
  /**
   * Generate a more descriptive chapter title from filename
   */
  private static generateChapterTitle(href: string, chapterNum: number): string {
    const filename = href.split('/').pop()?.replace(/\.(html|xhtml)$/i, '') || '';
    
    // Try to extract chapter info from filename
    const chapterMatch = filename.match(/(chapter|ch|part)[\s_-]*(\d+)/i);
    if (chapterMatch) {
      const num = chapterMatch[2];
      return `Chapter ${num}`;
    }
    
    // Look for other patterns
    if (filename.match(/^(\d+)/)) {
      const num = filename.match(/^(\d+)/)?.[1];
      return `Chapter ${num}`;
    }
    
    // Clean up filename to use as title
    const cleanTitle = filename
      .replace(/[_-]/g, ' ')
      .replace(/\d+/g, match => match.length <= 2 ? match : '')
      .trim();
    
    if (cleanTitle && cleanTitle.length > 0 && cleanTitle.length < 50) {
      return cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
    }
    
    return `Chapter ${chapterNum}`;
  }
  
  /**
   * Load chapter content from file
   */
  private static async loadChapterContent(
    zipData: JSZip, 
    baseDir: string, 
    href: string, 
    title: string, 
    order: number,
  ): Promise<EPUBChapter | null> {
    try {
      console.log(`📚 EPUBService: Loading chapter ${order}: ${href} with title "${title}"`);
      
      const chapterFile = zipData.file(`${baseDir}${href}`);
      if (!chapterFile) {
        console.warn(`📚 EPUBService: Chapter file not found: ${baseDir}${href}`);
        return null;
      }
      
      const htmlContent = await chapterFile.async('string');
      const textContent = this.extractTextFromHTML(htmlContent);
      
      console.log(`📚 EPUBService: Loaded content for ${href}: ${textContent.length} chars, HTML: ${htmlContent.length} chars`);
      
      // Try to extract a better title from the HTML content if current title is generic
      let finalTitle = title;
      const needsBetterTitle = title.toLowerCase().includes('project gutenberg') || 
                               title.toLowerCase() === 'frankenstein' ||
                               title.startsWith('Chapter ') ||
                               title === 'Untitled';
      
      if (needsBetterTitle) {
        console.log(`📚 EPUBService: Title "${title}" needs improvement, extracting from content...`);
        const contentTitle = this.extractTitleFromHTML(htmlContent);
        if (contentTitle && contentTitle.length > 0 && contentTitle.length < 100) {
          console.log(`📚 EPUBService: ✅ Improved title for ${href}: "${title}" → "${contentTitle}"`);
          finalTitle = contentTitle;
        } else {
          // Generate a fallback title based on order
          const fallbackTitle = `Chapter ${order + 1}`;
          console.log(`📚 EPUBService: ❌ No better title found for ${href}, using fallback: "${fallbackTitle}"`);
          finalTitle = fallbackTitle;
        }
      } else {
        console.log(`📚 EPUBService: ✅ Title "${title}" is acceptable, keeping it`);
      }
      
      return {
        id: `chapter-${order}`,
        title: finalTitle,
        href,
        content: textContent,
        htmlContent,
        order,
      };
    } catch (error) {
      console.warn(`📚 EPUBService: Error loading chapter ${href}:`, error);
      return null;
    }
  }
  
  /**
   * Extract chapter title from HTML content
   */
  private static extractTitleFromHTML(html: string): string | null {
    console.log('📚 EPUBService: Attempting to extract title from HTML...');
    
    // Try different patterns for chapter titles
    const patterns = [
      { name: 'h1', pattern: /<h1[^>]*>(.*?)<\/h1>/i },
      { name: 'h2', pattern: /<h2[^>]*>(.*?)<\/h2>/i },
      { name: 'h3', pattern: /<h3[^>]*>(.*?)<\/h3>/i },
      { name: 'title', pattern: /<title[^>]*>(.*?)<\/title>/i },
      { name: 'h4', pattern: /<h4[^>]*>(.*?)<\/h4>/i },
      // Look for common chapter patterns in any element
      { name: 'chapter-pattern', pattern: />(Chapter\s+\d+[^<]*)</i },
      { name: 'roman-chapter', pattern: />(Chapter\s+[IVXLCDM]+[^<]*)</i },
    ];
    
    for (const { name, pattern } of patterns) {
      const match = html.match(pattern);
      if (match) {
        let title = match[1]
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&[^;]+;/g, ' ') // Remove HTML entities
          .replace(/\s+/g, ' ')     // Normalize whitespace
          .trim();
        
        console.log(`📚 EPUBService: Found ${name} title candidate: "${title}"`);
        
        // Skip if title is too generic or contains unwanted text
        if (title.length > 2 && title.length < 150 && 
            !title.toLowerCase().includes('project gutenberg') &&
            !title.toLowerCase().includes('the full project gutenberg') &&
            title.toLowerCase() !== 'frankenstein') {
          
          // Check if it looks like a useful title
          const isChapterTitle = title.match(/^(chapter|ch\.?)\s*\d+/i) || 
                                  title.match(/^(part|section|book)\s*\d+/i) ||
                                  title.match(/^\d+\.\s*/) ||
                                  title.match(/^[IVXLCDM]+\.\s*/);
          
          const isGoodTitle = title.length > 4 && title.length < 100;
          
          if (isChapterTitle || isGoodTitle) {
            console.log(`📚 EPUBService: Accepting title: "${title}"`);
            return title;
          } else {
            console.log(`📚 EPUBService: Rejecting title (too generic): "${title}"`);
          }
        } else {
          console.log(`📚 EPUBService: Rejecting title (length/content): "${title}"`);
        }
      }
    }
    
    console.log('📚 EPUBService: No suitable title found in HTML content');
    return null;
  }
  
  /**
   * Extract text content from metadata
   */
  private static extractTextContent(item: any): string | undefined {
    if (typeof item === 'string') return item;
    if (Array.isArray(item) && item.length > 0) return this.extractTextContent(item[0]);
    if (item?._text) return item._text;
    return undefined;
  }
  
  /**
   * Check if file should be skipped
   */
  private static shouldSkipFile(href: string): boolean {
    const skipPatterns = [
      'cover', 'titlepage', 'title-page', 'title_page',
      'toc', 'table-of-contents', 'tableofcontents', 'contents',
      'copyright', 'legal', 'colophon', 'acknowledgment', 'dedication',
      'index', 'bibliography', 'notes', 'footnotes', 'endnotes',
      'glossary', 'appendix', 'about', 'author', 'publisher',
      'nav.xhtml', 'nav.html', 'navigation',
    ];
    
    return skipPatterns.some(pattern => href.includes(pattern));
  }
  
  /**
   * Extract text content from HTML
   */
  private static extractTextFromHTML(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/&[^;]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
  
  /**
   * Count words in text
   */
  private static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}

export default EPUBService;