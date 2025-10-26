import { PDFService } from '../../services/pdfService';
import * as FileSystem from 'expo-file-system';

// Mock dependencies
const mockGetInfoAsync = FileSystem.getInfoAsync as jest.MockedFunction<typeof FileSystem.getInfoAsync>;

describe('PDFService - Basic PDF Support', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseFile', () => {
    it('should process PDF file and create informative content', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 1024000, // 1MB
        modificationTime: Date.now(),
        uri: '/mock/path/test.pdf'
      });

      const result = await PDFService.parseFile('/mock/path/test.pdf');

      expect(result.title).toBe('test');
      expect(result.content).toContain('PDF Document Ready for Processing');
      expect(result.content).toContain('Size: 1000KB');
      expect(result.author).toBe('Unknown Author');
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.estimatedReadingTime).toBeGreaterThan(0);
      expect(result.chapters).toBeUndefined();
      expect(result.metadata?.requiresWebViewExtraction).toBe(true);
      expect(result.metadata?.format).toBe('pdf');
      expect(result.metadata?.fileSize).toBe(1024000);
    });

    it('should handle PDF files without extension in filename', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 500000,
        modificationTime: Date.now(),
        uri: '/mock/path/document'
      });

      const result = await PDFService.parseFile('/mock/path/document');

      expect(result.title).toBe('document');
      expect(result.content).toContain('PDF Document Ready for Processing');
    });

    it('should handle files with no filename', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 300000,
        modificationTime: Date.now(),
        uri: '/'
      });

      const result = await PDFService.parseFile('/');

      expect(result.title).toBe('Untitled PDF');
      expect(result.content).toContain('PDF Document Ready for Processing');
    });

    it('should handle small PDF files', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 512, // Small file
        modificationTime: Date.now(),
        uri: '/mock/path/small.pdf'
      });

      const result = await PDFService.parseFile('/mock/path/small.pdf');

      expect(result.title).toBe('small');
      expect(result.content).toContain('Size: 1KB'); // Rounded up
      expect(result.metadata?.fileSize).toBe(512);
      expect(result.wordCount).toBeGreaterThanOrEqual(100); // Minimum word count
    });

    it('should handle PDF files with complex filenames', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 2048000,
        modificationTime: Date.now(),
        uri: '/mock/path/My Complex Document Name v2.1.pdf'
      });

      const result = await PDFService.parseFile('/mock/path/My Complex Document Name v2.1.pdf');

      expect(result.title).toBe('My Complex Document Name v2.1');
      expect(result.content).toContain('My Complex Document Name v2.1');
      expect(result.content).toContain('Size: 2000KB');
    });

    it('should throw error for non-existent files', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: false,
        isDirectory: false,
        uri: '/mock/path/missing.pdf'
      });

      await expect(PDFService.parseFile('/mock/path/missing.pdf'))
        .rejects.toThrow('Failed to parse PDF file: PDF file not found');
    });

    it('should handle file system errors', async () => {
      mockGetInfoAsync.mockRejectedValue(new Error('File system error'));

      await expect(PDFService.parseFile('/mock/path/error.pdf'))
        .rejects.toThrow('Failed to parse PDF file: File system error');
    });

    it('should handle files with zero size', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 0,
        modificationTime: Date.now(),
        uri: '/mock/path/empty.pdf'
      });

      const result = await PDFService.parseFile('/mock/path/empty.pdf');

      expect(result.title).toBe('empty');
      expect(result.content).toContain('Size: 0KB');
      expect(result.wordCount).toBe(100); // Minimum word count
      expect(result.metadata?.fileSize).toBe(0);
    });

    it('should provide consistent metadata structure', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 1500000,
        modificationTime: Date.now(),
        uri: '/mock/path/metadata-test.pdf'
      });

      const result = await PDFService.parseFile('/mock/path/metadata-test.pdf');

      expect(result.metadata).toEqual({
        format: 'pdf',
        fileSize: 1500000,
        originalPath: '/mock/path/metadata-test.pdf',
        requiresWebViewExtraction: true,
        extractionMethod: 'webview-polydoc',
        note: 'PDF processing via WebView for full feature support'
      });
    });

    it('should calculate estimated word count from file size', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 3000, // 3KB file
        modificationTime: Date.now(),
        uri: '/mock/path/word-count-test.pdf'
      });

      const result = await PDFService.parseFile('/mock/path/word-count-test.pdf');

      // Word count should be based on file size (PDFService uses /10 ratio)
      const expectedWordCount = Math.round(3000 / 10);
      expect(result.wordCount).toBe(expectedWordCount);
      
      // Reading time should be calculated based on word count
      const expectedReadingTime = Math.ceil(expectedWordCount / 250);
      expect(result.estimatedReadingTime).toBe(expectedReadingTime);
    });

    it('should include helpful information about PDF support', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 1000000,
        modificationTime: Date.now(),
        uri: '/mock/path/info-test.pdf'
      });

      const result = await PDFService.parseFile('/mock/path/info-test.pdf');

      expect(result.content).toContain('✅ Resizable text and custom themes');
      expect(result.content).toContain('🔄 Text extraction from all pages');
      expect(result.content).toContain('✅ Word lookup and vocabulary cards');
      expect(result.content).toContain('Processing will begin automatically');
    });
  });

  describe('error handling', () => {
    it('should provide meaningful error messages', async () => {
      mockGetInfoAsync.mockRejectedValue(new Error('Permission denied'));

      try {
        await PDFService.parseFile('/mock/path/protected.pdf');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to parse PDF file');
        expect((error as Error).message).toContain('Permission denied');
      }
    });
  });
});