import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { ParsedContent } from './contentParser';

export interface EPUBMetadata {
  title: string;
  author: string;
  language: string;
  identifier: string;
  description?: string;
}

export interface EPUBChapter {
  id: string;
  title: string;
  href: string;
  content: string;
  htmlContent: string; // Keep original HTML
  order: number;
}

export interface EPUBManifest {
  items: Array<{
    id: string;
    href: string;
    mediaType: string;
  }>;
}

export interface EPUBSpine {
  items: Array<{
    idref: string;
    linear: boolean;
  }>;
}

export class EPUBParser {
  /**
   * Parse an EPUB file and extract its content
   */
  static async parseEPUB(filePath: string): Promise<ParsedContent> {
    try {
      console.log('Starting EPUB parsing for:', filePath);

      // Read EPUB file as base64
      const fileData = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Convert base64 to ArrayBuffer
      const buffer = Uint8Array.from(atob(fileData), c => c.charCodeAt(0)).buffer;
      
      // Load ZIP using JSZip
      const zip = new JSZip();
      const zipData = await zip.loadAsync(buffer);
      
      console.log('EPUB loaded successfully');

      // Parse the EPUB structure
      const metadata = await this.parseMetadataFromZip(zipData);
      const manifest = await this.parseManifestFromZip(zipData);
      const spine = await this.parseSpineFromZip(zipData);
      const chapters = await this.parseChaptersFromZip(zipData, manifest, spine);

      // Sort chapters by order
      const sortedChapters = chapters.sort((a, b) => a.order - b.order);

      // Combine all chapter content for backward compatibility
      const fullContent = sortedChapters
        .map(chapter => `\n\n# ${chapter.title}\n\n${chapter.content}`)
        .join('\n\n');

      // Calculate metrics
      const wordCount = this.countWords(fullContent);
      const estimatedReadingTime = Math.ceil(wordCount / 200); // 200 words per minute

      console.log(`📚 EPUBParser: Extracted ${chapters.length} chapters from ${spine.items.length} spine items`);
      console.log(`📚 EPUBParser: Chapter titles:`, chapters.map(c => c.title));
      console.log(`EPUB parsed successfully: ${chapters.length} chapters, ${wordCount} words`);

      return {
        content: fullContent.trim(),
        title: metadata.title,
        author: metadata.author,
        language: metadata.language,
        wordCount,
        estimatedReadingTime,
        chapters: sortedChapters, // Include chapters for new rendering
        metadata: {
          format: 'epub' as const,
          chapters: chapters.length,
          identifier: metadata.identifier,
          description: metadata.description,
        },
      };

    } catch (error) {
      console.error('Error parsing EPUB:', error);
      throw new Error(`Failed to parse EPUB file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse metadata from ZIP data
   */
  private static async parseMetadataFromZip(zipData: JSZip): Promise<EPUBMetadata> {
    try {
      // Read container.xml to find the content.opf file
      const containerFile = zipData.file('META-INF/container.xml');
      if (!containerFile) {
        throw new Error('META-INF/container.xml not found');
      }
      
      const containerXml = await containerFile.async('string');
      const container = this.parseXML(containerXml);
      const rootFilePath = container.container.rootfiles.rootfile['full-path'];
      
      // Read content.opf (package document)
      const contentOpfFile = zipData.file(rootFilePath);
      if (!contentOpfFile) {
        throw new Error(`content.opf file not found at ${rootFilePath}`);
      }
      
      const contentOpfXml = await contentOpfFile.async('string');
      const opf = this.parseXML(contentOpfXml);
      const packageData = opf.package;
      
      // Extract metadata
      const metadata = packageData.metadata;
      
      return {
        title: this.extractTextContent(metadata['dc:title']) || 'Unknown Title',
        author: this.extractTextContent(metadata['dc:creator']) || 'Unknown Author',
        language: this.extractTextContent(metadata['dc:language']) || 'en',
        identifier: this.extractTextContent(metadata['dc:identifier']) || 'unknown',
        description: this.extractTextContent(metadata['dc:description']),
      };

    } catch (error) {
      console.warn('Error parsing EPUB metadata:', error);
      return {
        title: 'Unknown Title',
        author: 'Unknown Author',
        language: 'en',
        identifier: 'unknown',
      };
    }
  }

  /**
   * Parse the manifest from ZIP data
   */
  private static async parseManifestFromZip(zipData: JSZip): Promise<EPUBManifest> {
    try {
      // Read container.xml to find content.opf
      const containerFile = zipData.file('META-INF/container.xml');
      if (!containerFile) {
        throw new Error('META-INF/container.xml not found');
      }
      
      const containerXml = await containerFile.async('string');
      const container = this.parseXML(containerXml);
      const rootFilePath = container.container.rootfiles.rootfile['full-path'];
      
      // Read content.opf
      const contentOpfFile = zipData.file(rootFilePath);
      if (!contentOpfFile) {
        throw new Error(`content.opf file not found at ${rootFilePath}`);
      }
      
      const contentOpfXml = await contentOpfFile.async('string');
      const opf = this.parseXML(contentOpfXml);
      const manifest = opf.package.manifest;
      
      const items = Array.isArray(manifest.item) 
        ? manifest.item.map((item: any) => ({
            id: item.id,
            href: item.href,
            mediaType: item['media-type'],
          }))
        : [{
            id: manifest.item.id,
            href: manifest.item.href,
            mediaType: manifest.item['media-type'],
          }];
      
      return { items };

    } catch (error) {
      console.error('Error parsing EPUB manifest:', error);
      return { items: [] };
    }
  }

  /**
   * Parse the spine from ZIP data
   */
  private static async parseSpineFromZip(zipData: JSZip): Promise<EPUBSpine> {
    try {
      // Read container.xml to find content.opf
      const containerFile = zipData.file('META-INF/container.xml');
      if (!containerFile) {
        throw new Error('META-INF/container.xml not found');
      }
      
      const containerXml = await containerFile.async('string');
      const container = this.parseXML(containerXml);
      const rootFilePath = container.container.rootfiles.rootfile['full-path'];
      
      // Read content.opf
      const contentOpfFile = zipData.file(rootFilePath);
      if (!contentOpfFile) {
        throw new Error(`content.opf file not found at ${rootFilePath}`);
      }
      
      const contentOpfXml = await contentOpfFile.async('string');
      const opf = this.parseXML(contentOpfXml);
      const spine = opf.package.spine;
      
      const items = Array.isArray(spine.itemref)
        ? spine.itemref.map((itemref: any) => ({
            idref: itemref.idref,
            linear: itemref.linear !== 'no',
          }))
        : [{
            idref: spine.itemref.idref,
            linear: spine.itemref.linear !== 'no',
          }];
      
      return { items };

    } catch (error) {
      console.error('Error parsing EPUB spine:', error);
      return { items: [] };
    }
  }

  /**
   * Parse chapters from ZIP data based on manifest and spine
   */
  private static async parseChaptersFromZip(
    zipData: JSZip,
    manifest: EPUBManifest,
    spine: EPUBSpine,
  ): Promise<EPUBChapter[]> {
    const chapters: EPUBChapter[] = [];
    
    // Get the base directory for content files
    const containerFile = zipData.file('META-INF/container.xml');
    if (!containerFile) {
      throw new Error('META-INF/container.xml not found');
    }
    
    const containerXml = await containerFile.async('string');
    const container = this.parseXML(containerXml);
    const rootFilePath = container.container.rootfiles.rootfile['full-path'];
    const baseDir = rootFilePath.includes('/') ? rootFilePath.substring(0, rootFilePath.lastIndexOf('/') + 1) : '';
    
    let chapterCount = 0;
    
    for (let i = 0; i < spine.items.length; i++) {
      const spineItem = spine.items[i];
      const manifestItem = manifest.items.find(item => item.id === spineItem.idref);
      
      if (!manifestItem || !manifestItem.mediaType.includes('html')) {
        continue; // Skip non-HTML items
      }
      
      // Skip likely non-chapter files based on filename patterns
      const href = manifestItem.href.toLowerCase();
      if (this.shouldSkipFile(href)) {
        console.log(`📚 EPUBParser: Skipping non-chapter file: ${href}`);
        continue;
      }
      
      try {
        const chapterFilePath = `${baseDir}${manifestItem.href}`;
        const chapterFile = zipData.file(chapterFilePath);
        
        if (!chapterFile) {
          console.warn(`Chapter file not found: ${chapterFilePath}`);
          continue;
        }
        
        const chapterHtml = await chapterFile.async('string');
        
        // Extract text content from HTML
        const textContent = this.extractTextFromHTML(chapterHtml);
        
        // Skip if content is too short (likely not a real chapter)
        if (textContent.length < 100) {
          console.log(`📚 EPUBParser: Skipping short content file: ${href} (${textContent.length} chars)`);
          continue;
        }
        
        const title = this.extractTitleFromHTML(chapterHtml) || `Chapter ${chapterCount + 1}`;
        
        chapters.push({
          id: manifestItem.id,
          title,
          href: manifestItem.href,
          content: textContent,
          htmlContent: chapterHtml, // Keep original HTML
          order: chapterCount,
        });
        
        chapterCount++;
        
      } catch (error) {
        console.warn(`Error parsing chapter ${manifestItem.href}:`, error);
      }
    }
    
    return chapters;
  }

  /**
   * Parse XML string using fast-xml-parser
   */
  private static parseXML(xmlString: string): any {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        textNodeName: '_text',
        ignoreNameSpace: false,
        parseAttributeValue: true,
        trimValues: true,
      });
      return parser.parse(xmlString);
    } catch (error) {
      throw new Error(`XML parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text content from XML metadata
   */
  private static extractTextContent(metadataItem: any): string | undefined {
    if (!metadataItem) {
      return undefined;
    }
    
    // Handle different formats from fast-xml-parser
    if (typeof metadataItem === 'string') {
      return metadataItem;
    }
    
    if (Array.isArray(metadataItem)) {
      return metadataItem.length > 0 ? this.extractTextContent(metadataItem[0]) : undefined;
    }
    
    if (metadataItem._text) {
      return metadataItem._text;
    }
    
    if (typeof metadataItem === 'object' && metadataItem.constructor === Object) {
      // If it's an object with no _text property, it might be the text content itself
      const keys = Object.keys(metadataItem);
      if (keys.length === 0) {
        return undefined;
      }
      // Return the first non-attribute value
      for (const key of keys) {
        if (!key.startsWith('@') && typeof metadataItem[key] === 'string') {
          return metadataItem[key];
        }
      }
    }
    
    return undefined;
  }

  /**
   * Extract text content from HTML
   */
  private static extractTextFromHTML(html: string): string {
    // Remove HTML tags and extract text content
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/&[^;]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Extract title from HTML
   */
  private static extractTitleFromHTML(html: string): string | null {
    // Try multiple strategies to extract chapter title
    
    // 1. Look for h1-h3 tags (most common for chapter titles)
    const headerMatch = html.match(/<(h[1-3])[^>]*>([^<]+)<\/\1>/i);
    if (headerMatch) {
      const title = headerMatch[2].trim();
      if (title && title.length > 0 && title.length < 100) {
        return title;
      }
    }
    
    // 2. Look for title tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1].trim();
      if (title && title.length > 0 && title.length < 100) {
        return title;
      }
    }
    
    // 3. Look for class="chapter-title" or similar
    const classTitleMatch = html.match(/<[^>]*class="[^"]*(?:chapter|title)[^"]*"[^>]*>([^<]+)</i);
    if (classTitleMatch) {
      const title = classTitleMatch[1].trim();
      if (title && title.length > 0 && title.length < 100) {
        return title;
      }
    }
    
    // 4. Look for first paragraph or div with text content (as fallback)
    const textMatch = html.match(/<(?:p|div)[^>]*>([^<]{5,50})</i);
    if (textMatch) {
      const title = textMatch[1].trim();
      if (title && title.length > 0 && !title.includes('\n')) {
        return title;
      }
    }
    
    return null;
  }

  /**
   * Determine if a file should be skipped based on common EPUB patterns
   */
  private static shouldSkipFile(href: string): boolean {
    const skipPatterns = [
      'cover', 'titlepage', 'title-page', 'title_page',
      'toc', 'table-of-contents', 'tableofcontents', 'contents',
      'copyright', 'legal', 'colophon', 'acknowledgment', 'dedication',
      'index', 'bibliography', 'notes', 'footnotes', 'endnotes',
      'glossary', 'appendix', 'about', 'author', 'publisher',
      'nav.xhtml', 'nav.html', 'navigation'
    ];
    
    // Check if href contains any skip patterns
    for (const pattern of skipPatterns) {
      if (href.includes(pattern)) {
        return true;
      }
    }
    
    // Skip very short filenames that are likely structural
    const filename = href.split('/').pop() || '';
    const nameWithoutExt = filename.replace(/\.(html|xhtml)$/, '');
    if (nameWithoutExt.length <= 2) {
      return true;
    }
    
    return false;
  }

  /**
   * Count words in text
   */
  private static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}

export default EPUBParser;