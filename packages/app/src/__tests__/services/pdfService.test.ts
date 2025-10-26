import { PDFService } from '../../services/pdfService';
import * as FileSystem from 'expo-file-system';
import * as pdfjsLib from 'pdfjs-dist';

// Mock dependencies
const mockReadAsStringAsync = FileSystem.readAsStringAsync as jest.MockedFunction<typeof FileSystem.readAsStringAsync>;
const mockGetDocument = pdfjsLib.getDocument as jest.MockedFunction<typeof pdfjsLib.getDocument>;

describe('PDFService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseFile', () => {
    const createMockPDFDocument = (numPages: number, pageTexts: string[], metadata: any = {}) => {
      const mockPages = pageTexts.map(text => ({
        getTextContent: jest.fn().mockResolvedValue({
          items: text.split(' ').map(word => ({ str: word }))
        })
      }));

      return {
        numPages,
        getPage: jest.fn().mockImplementation((pageNum: number) => 
          Promise.resolve(mockPages[pageNum - 1])
        ),
        getMetadata: jest.fn().mockResolvedValue({
          info: metadata
        })
      };
    };

    it('should parse PDF with multiple pages successfully', async () => {
      const pageTexts = [
        'This is the content of page one with several words.',
        'This is page two with different content and more text.',
        'Final page three with concluding content and summary.'
      ];
      
      const mockPDF = createMockPDFDocument(3, pageTexts, {
        Title: 'Test PDF Document',
        Author: 'Test Author'
      });

      mockReadAsStringAsync.mockResolvedValue('base64content');
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPDF)
      } as any);

      const result = await PDFService.parseFile('/mock/path/test.pdf');

      expect(result.title).toBe('Test PDF Document');
      expect(result.author).toBe('Test Author');
      expect(result.content).toContain('This is the content of page one');
      expect(result.content).toContain('This is page two');
      expect(result.content).toContain('Final page three');
      expect(result.wordCount).toBeGreaterThan(20);
      expect(result.estimatedReadingTime).toBeGreaterThan(0);
      expect(result.metadata?.pageCount).toBe(3);
    });

    it('should handle PDF without metadata gracefully', async () => {
      const pageTexts = ['Simple page content without metadata.'];
      const mockPDF = createMockPDFDocument(1, pageTexts, {});

      mockReadAsStringAsync.mockResolvedValue('base64content');
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPDF)
      } as any);

      const result = await PDFService.parseFile('/mock/path/untitled.pdf');

      expect(result.title).toBe('untitled'); // Should fall back to filename
      expect(result.author).toBe('Unknown Author');
      expect(result.content).toContain('Simple page content');
    });

    it('should extract chapters from PDF with chapter patterns', async () => {
      const pageTexts = [
        'CHAPTER 1\n\nThis is the first chapter with substantial content that goes on for several paragraphs and contains enough text to be recognized as a proper chapter by the parsing algorithms. The content continues with more detailed information and additional paragraphs to meet the minimum requirements.',
        'CHAPTER 2\n\nThis is the second chapter with equally substantial content and multiple paragraphs that demonstrate the chapter detection working properly across different pages. The chapter contains enough content to be validated as a legitimate chapter structure.',
        'CHAPTER 3\n\nThis is the third chapter that completes our test case for chapter detection in PDF files with proper chapter patterns and sufficient content validation.'
      ];
      
      const mockPDF = createMockPDFDocument(3, pageTexts);

      mockReadAsStringAsync.mockResolvedValue('base64content');
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPDF)
      } as any);

      const result = await PDFService.parseFile('/mock/path/chaptered.pdf');

      expect(result.chapters).toBeDefined();
      expect(result.chapters!.length).toBe(3);
      expect(result.chapters![0].title).toBe('CHAPTER 1');
      expect(result.chapters![1].title).toBe('CHAPTER 2');
      expect(result.chapters![2].title).toBe('CHAPTER 3');
    });

    it('should handle PDFs with page-based chapters for smaller documents', async () => {
      const pageTexts = [
        'Introduction\n\nThis is the introduction page with substantial content that explains the purpose and scope of the document.',
        'Main Content\n\nThis is the main content page with detailed information and comprehensive coverage of the topic.',
        'Conclusion\n\nThis is the conclusion page that summarizes the key points and provides final thoughts.'
      ];
      
      const mockPDF = createMockPDFDocument(3, pageTexts);

      mockReadAsStringAsync.mockResolvedValue('base64content');
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPDF)
      } as any);

      const result = await PDFService.parseFile('/mock/path/short.pdf');

      expect(result.chapters).toBeDefined();
      expect(result.chapters!.length).toBe(3);
      expect(result.chapters![0].title).toBe('Introduction');
      expect(result.chapters![1].title).toBe('Main Content');
      expect(result.chapters![2].title).toBe('Conclusion');
    });

    it('should handle empty or corrupted PDF pages', async () => {
      const pageTexts = ['Good content', '', 'More good content'];
      const mockPDF = createMockPDFDocument(3, pageTexts);

      // Mock one page to throw an error
      mockPDF.getPage = jest.fn().mockImplementation((pageNum: number) => {
        if (pageNum === 2) {
          return Promise.reject(new Error('Corrupted page'));
        }
        return Promise.resolve({
          getTextContent: jest.fn().mockResolvedValue({
            items: pageTexts[pageNum - 1].split(' ').map(word => ({ str: word }))
          })
        });
      });

      mockReadAsStringAsync.mockResolvedValue('base64content');
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPDF)
      } as any);

      const result = await PDFService.parseFile('/mock/path/partial.pdf');

      expect(result.content).toContain('Good content');
      expect(result.content).toContain('More good content');
      // Should continue processing despite error on page 2
      expect(result.wordCount).toBeGreaterThan(0);
    });

    it('should handle file system errors', async () => {
      mockReadAsStringAsync.mockRejectedValue(new Error('File not found'));

      await expect(PDFService.parseFile('/mock/path/missing.pdf'))
        .rejects.toThrow('Failed to parse PDF file');
    });

    it('should handle PDF parsing errors', async () => {
      mockReadAsStringAsync.mockResolvedValue('invalid-base64');
      mockGetDocument.mockReturnValue({
        promise: Promise.reject(new Error('Invalid PDF format'))
      } as any);

      await expect(PDFService.parseFile('/mock/path/invalid.pdf'))
        .rejects.toThrow('Failed to parse PDF file');
    });

    it('should handle large PDFs efficiently', async () => {
      const pageTexts = Array(50).fill('Page content with multiple words and substantial text.');
      const mockPDF = createMockPDFDocument(50, pageTexts);

      mockReadAsStringAsync.mockResolvedValue('base64content');
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPDF)
      } as any);

      const startTime = Date.now();
      const result = await PDFService.parseFile('/mock/path/large.pdf');
      const endTime = Date.now();

      expect(result.content).toBeDefined();
      expect(result.wordCount).toBeGreaterThan(100);
      expect(result.metadata?.pageCount).toBe(50);
      
      // Should complete within reasonable time (adjust as needed)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should properly encode and decode base64 content', async () => {
      const mockPDF = createMockPDFDocument(1, ['Test content']);

      mockReadAsStringAsync.mockResolvedValue(btoa('mock pdf binary data'));
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPDF)
      } as any);

      const result = await PDFService.parseFile('/mock/path/test.pdf');

      expect(result.content).toContain('Test content');
      expect(mockGetDocument).toHaveBeenCalledWith({
        data: expect.any(Uint8Array)
      });
    });

    it('should calculate word count and reading time correctly', async () => {
      const pageTexts = [
        'This is exactly ten words in this test sentence here.',
        'Another sentence with exactly ten words in it too.'
      ];
      
      const mockPDF = createMockPDFDocument(2, pageTexts);

      mockReadAsStringAsync.mockResolvedValue('base64content');
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPDF)
      } as any);

      const result = await PDFService.parseFile('/mock/path/counted.pdf');

      expect(result.wordCount).toBe(20); // 10 words per page * 2 pages
      expect(result.estimatedReadingTime).toBe(1); // 20 words / 250 WPM = 0.08 minutes, rounded up to 1
    });
  });

  describe('error handling', () => {
    it('should provide meaningful error messages', async () => {
      mockReadAsStringAsync.mockRejectedValue(new Error('Permission denied'));

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