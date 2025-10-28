import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

export interface EPUBMetadata {
  title: string;
  author: string;
  language: string;
  identifier: string;
  description?: string;
}

/**
 * Extract metadata from EPUB file for book import
 * This is a lightweight version that only extracts metadata, not full content
 */
export async function extractEPUBMetadata(filePath: string): Promise<EPUBMetadata | null> {
  console.log('📚 EPUBMetadataExtractor: Starting metadata extraction');
  
  // Extract filename as fallback
  const filename = filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Untitled';
  
  try {
    // Read the EPUB file
    const fileContent = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.Base64 });
    const arrayBuffer = Uint8Array.from(atob(fileContent), c => c.charCodeAt(0)).buffer;
    
    // Load ZIP data
    const zipData = await new JSZip().loadAsync(arrayBuffer);
    console.log('📚 EPUBMetadataExtractor: ZIP loaded successfully');
    
    // Extract metadata
    const metadata = await extractMetadataFromZip(zipData, filename);
    console.log('📚 EPUBMetadataExtractor: Metadata extracted:', metadata);
    
    return metadata;
    
  } catch (error) {
    console.error('📚 EPUBMetadataExtractor: Error extracting metadata:', error);
    return null;
  }
}

/**
 * Extract metadata from EPUB zip
 */
async function extractMetadataFromZip(zipData: JSZip, fallbackTitle: string): Promise<EPUBMetadata> {
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
    
    console.log('📚 EPUBMetadataExtractor: Found content.opf at:', rootFilePath);
    
    // Read content.opf
    const contentOpfFile = zipData.file(rootFilePath);
    if (!contentOpfFile) {
      throw new Error(`content.opf file not found at ${rootFilePath}`);
    }
    
    const contentOpfXml = await contentOpfFile.async('string');
    const opfParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    const opf = opfParser.parse(contentOpfXml);
    const metadata = opf.package.metadata;
    
    console.log('📚 EPUBMetadataExtractor: Raw metadata:', metadata);
    
    // Extract and clean metadata
    const title = extractTextContent(metadata['dc:title']) || fallbackTitle;
    const author = extractTextContent(metadata['dc:creator']) || 'Unknown Author';
    const language = extractTextContent(metadata['dc:language']) || 'en';
    const identifier = extractTextContent(metadata['dc:identifier']) || 'unknown';
    const description = extractTextContent(metadata['dc:description']);
    
    console.log('📚 EPUBMetadataExtractor: Cleaned metadata:', { title, author, language, identifier });
    
    return {
      title: cleanTitle(title, fallbackTitle),
      author: cleanAuthor(author),
      language: language.toLowerCase(),
      identifier,
      description,
    };
  } catch (error) {
    console.warn('📚 EPUBMetadataExtractor: Error extracting metadata:', error);
    return {
      title: fallbackTitle,
      author: 'Unknown Author',
      language: 'en',
      identifier: 'unknown',
    };
  }
}

/**
 * Extract text content from metadata item
 */
function extractTextContent(item: any): string | undefined {
  if (typeof item === 'string') return item;
  if (Array.isArray(item) && item.length > 0) return extractTextContent(item[0]);
  if (item?._text) return item._text;
  if (item?.['#text']) return item['#text'];
  return undefined;
}

/**
 * Clean and validate title
 */
function cleanTitle(title: string, fallback: string): string {
  if (!title) return fallback;
  
  // Remove common unwanted patterns
  let cleaned = title
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[\r\n\t]/g, ' ') // Remove line breaks and tabs
    .trim();
  
  // Remove file extensions if they somehow got in
  cleaned = cleaned.replace(/\.(epub|html?|txt|pdf)$/i, '');
  
  // Remove common prefixes/suffixes
  cleaned = cleaned
    .replace(/^(the\s+)?project\s+gutenberg\s+(ebook\s+of\s+)?/i, '')
    .replace(/\s+by\s+project\s+gutenberg$/i, '')
    .replace(/\s*[\-\|]\s*project\s+gutenberg.*$/i, '')
    .replace(/\s*[\-\|]\s*free\s+ebook.*$/i, '')
    .trim();
  
  // If cleaned title is too short or generic, use fallback
  if (!cleaned || cleaned.length < 2 || cleaned.toLowerCase() === 'untitled') {
    return fallback;
  }
  
  // Capitalize first letter of each word if it's all lowercase or all uppercase
  if (cleaned === cleaned.toLowerCase() || cleaned === cleaned.toUpperCase()) {
    cleaned = cleaned.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }
  
  return cleaned;
}

/**
 * Clean and validate author
 */
function cleanAuthor(author: string): string {
  if (!author) return 'Unknown Author';
  
  let cleaned = author
    .replace(/\s+/g, ' ')
    .replace(/[\r\n\t]/g, ' ')
    .trim();
  
  // Remove common unwanted patterns
  cleaned = cleaned
    .replace(/^by\s+/i, '')
    .replace(/,?\s*project\s+gutenberg.*$/i, '')
    .replace(/,?\s*et\.?\s*al\.?$/i, ' et al.')
    .trim();
  
  // Capitalize if all lowercase or uppercase
  if (cleaned === cleaned.toLowerCase() || cleaned === cleaned.toUpperCase()) {
    cleaned = cleaned.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }
  
  return cleaned || 'Unknown Author';
}