import { ContentParser } from '../../services/contentParser';
import * as FileSystem from 'expo-file-system';

// Mock file system
const mockReadAsStringAsync = FileSystem.readAsStringAsync as jest.MockedFunction<typeof FileSystem.readAsStringAsync>;

describe('ContentParser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseTxtFile', () => {
    it('should parse simple text file correctly', async () => {
      const mockContent = 'This is a test book.\n\nWith multiple paragraphs and some content.';
      mockReadAsStringAsync.mockResolvedValue(mockContent);

      const result = await ContentParser.parseTxtFile('/mock/path/test.txt');

      expect(result.title).toBe('test');
      expect(result.content).toBe(mockContent);
      expect(result.wordCount).toBe(11);
      expect(result.estimatedReadingTime).toBe(1);
      expect(result.chapters).toBeUndefined(); // No chapters for simple text
    });

    it('should extract title from first line if it looks like a title', async () => {
      const mockContent = 'The Great Novel\n\nThis is the content of the book with multiple paragraphs.';
      mockReadAsStringAsync.mockResolvedValue(mockContent);

      const result = await ContentParser.parseTxtFile('/mock/path/test.txt');

      expect(result.title).toBe('The Great Novel');
      expect(result.content).toBe('This is the content of the book with multiple paragraphs.');
    });

    it('should detect chapters with Roman numerals', async () => {
      const mockContent = `I. FIRST CHAPTER

This is the content of the first chapter with substantial text content that goes on for quite a while and contains multiple sentences and paragraphs to make it substantial enough for chapter detection algorithms.

The first chapter continues with more content and additional paragraphs to ensure it meets the minimum length requirements for proper chapter validation.

II. SECOND CHAPTER

This is the content of the second chapter with equally substantial text content that demonstrates the chapter detection functionality working properly across multiple chapters.

The second chapter also has multiple paragraphs and sufficient content to be recognized as a valid chapter by the parsing algorithms.

III. THIRD CHAPTER

This is the content of the third chapter which completes our test case for chapter detection with Roman numerals and proper chapter structure validation.`;

      mockReadAsStringAsync.mockResolvedValue(mockContent);

      const result = await ContentParser.parseTxtFile('/mock/path/book.txt');

      expect(result.chapters).toBeDefined();
      expect(result.chapters!.length).toBe(3);
      expect(result.chapters![0].title).toBe('I. FIRST CHAPTER');
      expect(result.chapters![1].title).toBe('II. SECOND CHAPTER');
      expect(result.chapters![2].title).toBe('III. THIRD CHAPTER');
    });

    it('should handle files with no clear chapter structure', async () => {
      const mockContent = 'A simple story without chapters. Just a continuous narrative that flows from beginning to end without any clear structural divisions.';
      mockReadAsStringAsync.mockResolvedValue(mockContent);

      const result = await ContentParser.parseTxtFile('/mock/path/simple.txt');

      expect(result.chapters).toBeUndefined();
      expect(result.content).toBe(mockContent);
    });

    it('should handle file system errors gracefully', async () => {
      mockReadAsStringAsync.mockRejectedValue(new Error('File not found'));

      await expect(ContentParser.parseTxtFile('/mock/path/missing.txt'))
        .rejects.toThrow('Failed to parse text file');
    });
  });

  describe('parseHtmlFile', () => {
    it('should extract text from HTML and preserve structure', async () => {
      const mockHtml = `<html>
        <head><title>Test HTML Book</title></head>
        <body>
          <h1>Chapter One</h1>
          <p>This is the first paragraph.</p>
          <p>This is the second paragraph with <strong>bold text</strong>.</p>
        </body>
      </html>`;

      mockReadAsStringAsync.mockResolvedValue(mockHtml);

      const result = await ContentParser.parseHtmlFile('/mock/path/test.html');

      expect(result.title).toBe('Test HTML Book');
      expect(result.content).toContain('Chapter One');
      expect(result.content).toContain('This is the first paragraph.');
      expect(result.content).toContain('bold text');
      expect(result.content).not.toContain('<p>'); // HTML tags should be removed
    });

    it('should fall back to filename if no HTML title', async () => {
      const mockHtml = `<html><body><p>Content without title</p></body></html>`;
      mockReadAsStringAsync.mockResolvedValue(mockHtml);

      const result = await ContentParser.parseHtmlFile('/mock/path/untitled.html');

      expect(result.title).toBe('untitled');
    });

    it('should handle malformed HTML gracefully', async () => {
      const mockHtml = '<p>Broken HTML without proper structure<div>Mixed tags';
      mockReadAsStringAsync.mockResolvedValue(mockHtml);

      const result = await ContentParser.parseHtmlFile('/mock/path/broken.html');

      expect(result.content).toContain('Broken HTML without proper structure');
      expect(result.content).toContain('Mixed tags');
    });
  });

  describe('splitIntoChunks', () => {
    it('should split text into appropriately sized chunks', () => {
      const text = 'This is a test text that should be split into multiple chunks based on the specified chunk size parameter.';
      
      const chunks = ContentParser.splitIntoChunks(text, 50);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.text.length).toBeLessThanOrEqual(60); // Allow some flexibility for word boundaries
        expect(chunk.id).toMatch(/^chunk_\d+$/);
        expect(chunk.startPosition).toBeGreaterThanOrEqual(0);
        expect(chunk.endPosition).toBeGreaterThan(chunk.startPosition);
      });
    });

    it('should preserve word boundaries when splitting', () => {
      const text = 'Word1 Word2 Word3 Word4 Word5';
      
      const chunks = ContentParser.splitIntoChunks(text, 10);

      chunks.forEach(chunk => {
        // Should not split in the middle of words
        expect(chunk.text).not.toMatch(/^\w/); // Should not start mid-word
        expect(chunk.text).not.toMatch(/\w$/); // Should not end mid-word (except for last chunk)
      });
    });

    it('should handle empty text', () => {
      const chunks = ContentParser.splitIntoChunks('', 100);
      expect(chunks).toHaveLength(0);
    });
  });

  describe('parseFile', () => {
    it('should route to correct parser based on format', async () => {
      const mockContent = 'Test content';
      mockReadAsStringAsync.mockResolvedValue(mockContent);

      // Test TXT routing
      const txtResult = await ContentParser.parseFile('/mock/test.txt', 'txt');
      expect(txtResult.content).toBe(mockContent);

      // Test HTML routing
      const htmlResult = await ContentParser.parseFile('/mock/test.html', 'html');
      expect(htmlResult.content).toContain('Test content');
    });

    it('should throw error for unsupported formats', async () => {
      await expect(ContentParser.parseFile('/mock/test.doc', 'doc'))
        .rejects.toThrow('Unsupported file format: doc');
    });

    it('should handle case insensitive format detection', async () => {
      mockReadAsStringAsync.mockResolvedValue('Test content');

      await expect(ContentParser.parseFile('/mock/test.txt', 'TXT'))
        .resolves.toBeDefined();
      
      await expect(ContentParser.parseFile('/mock/test.html', 'HTML'))
        .resolves.toBeDefined();
    });
  });

  describe('countWords', () => {
    it('should count words correctly', () => {
      // Access private method through bracket notation for testing
      const countWords = (ContentParser as any).countWords;
      
      expect(countWords('Hello world')).toBe(2);
      expect(countWords('One two three four five')).toBe(5);
      expect(countWords('  Multiple   spaces   between  words  ')).toBe(4);
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
    });
  });
});