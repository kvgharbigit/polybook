import { PDFService } from '../../services/pdfService';
import * as FileSystem from 'expo-file-system';
import * as pdfjsLib from 'pdfjs-dist';

// Mock dependencies
const mockReadAsStringAsync = FileSystem.readAsStringAsync as jest.MockedFunction<typeof FileSystem.readAsStringAsync>;
const mockGetDocument = pdfjsLib.getDocument as jest.MockedFunction<typeof pdfjsLib.getDocument>;

describe('PDFService - PolyDoc Extraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseFile', () => {
    const createMockPDFDocument = (numPages: number, pageTexts: string[], metadata: any = {}) => {
      const mockPages = pageTexts.map(text => ({
        getTextContent: jest.fn().mockResolvedValue({
          items: text.split(' ').map((word, index) => ({
            str: word,
            transform: [1, 0, 0, 1, index * 10, 100], // Mock transform matrix
            width: word.length * 6,
            height: 12
          }))
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

    it('should extract text content using PolyDoc approach', async () => {
      const pageTexts = [
        'Chapter One Introduction This is the first chapter of our book.',
        'The content continues with more detailed information about the topic.',
        'Chapter Two Advanced Topics Here we discuss more complex concepts.'
      ];
      
      const mockPDF = createMockPDFDocument(3, pageTexts, {
        Title: 'Test PolyDoc PDF',
        Author: 'Test Author'
      });

      mockReadAsStringAsync.mockResolvedValue(btoa('mock pdf binary content'));
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPDF)
      } as any);

      const result = await PDFService.parseFile('/mock/path/test.pdf');

      expect(result.title).toBe('Test PolyDoc PDF');
      expect(result.author).toBe('Test Author');
      expect(result.content).toContain('Chapter One Introduction');
      expect(result.content).toContain('Chapter Two Advanced Topics');
      expect(result.wordCount).toBeGreaterThan(20);
      expect(result.estimatedReadingTime).toBeGreaterThan(0);
      expect(result.metadata?.isPolyDoc).toBe(true);
      expect(result.metadata?.extractionMethod).toBe('text-layer');
    });

    it('should detect chapters in PolyDoc content', async () => {
      const pageTexts = [
        'CHAPTER 1 The Beginning This is a substantial chapter with enough content to be recognized as a proper chapter by the detection algorithm. We continue with more detailed information and additional paragraphs to meet the minimum requirements for chapter validation.',
        'CHAPTER 2 The Middle This is another substantial chapter with equally detailed content and multiple paragraphs that demonstrate proper chapter structure and content validation working correctly.',
        'CHAPTER 3 The End This final chapter completes our test case with sufficient content for proper chapter detection validation.'
      ];
      
      const mockPDF = createMockPDFDocument(3, pageTexts);

      mockReadAsStringAsync.mockResolvedValue(btoa('mock pdf binary content'));
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPDF)
      } as any);

      const result = await PDFService.parseFile('/mock/path/chaptered.pdf');

      expect(result.chapters).toBeDefined();
      expect(result.chapters!.length).toBeGreaterThan(0);
      // The chapter detection should find some structure
      if (result.chapters!.length > 1) {
        expect(result.chapters![0].content).toContain('Beginning');
      }
    });

    it('should handle PDFs with no clear chapter structure', async () => {
      const pageTexts = [
        'This is regular paragraph content without clear chapter markers.',
        'More content that continues the narrative without specific formatting.',
        'Additional text that represents typical document content.'
      ];
      
      const mockPDF = createMockPDFDocument(3, pageTexts);

      mockReadAsStringAsync.mockResolvedValue(btoa('mock pdf binary content'));
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPDF)
      } as any);

      const result = await PDFService.parseFile('/mock/path/no-chapters.pdf');

      expect(result.content).toContain('regular paragraph content');
      expect(result.wordCount).toBeGreaterThan(10);
      // Should either have page-based chapters or no chapters
      if (result.chapters) {
        expect(result.chapters.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should handle empty or text-less PDF pages', async () => {
      const pageTexts = ['Good content on first page', '', 'More content on third page'];
      const mockPDF = createMockPDFDocument(3, pageTexts);

      // Mock second page to have no text items
      mockPDF.getPage = jest.fn().mockImplementation((pageNum: number) => {
        if (pageNum === 2) {
          return Promise.resolve({
            getTextContent: jest.fn().mockResolvedValue({ items: [] })
          });
        }
        return Promise.resolve({
          getTextContent: jest.fn().mockResolvedValue({
            items: pageTexts[pageNum - 1].split(' ').map((word, index) => ({
              str: word,
              transform: [1, 0, 0, 1, index * 10, 100],
              width: word.length * 6,
              height: 12
            }))
          })
        });
      });

      mockReadAsStringAsync.mockResolvedValue(btoa('mock pdf binary content'));
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPDF)
      } as any);

      const result = await PDFService.parseFile('/mock/path/partial.pdf');

      expect(result.content).toContain('Good content');
      expect(result.content).toContain('More content');
      expect(result.wordCount).toBeGreaterThan(0);
    });

    it('should handle PDF metadata extraction', async () => {
      const pageTexts = ['Sample PDF content for metadata testing.'];
      const mockPDF = createMockPDFDocument(1, pageTexts, {
        Title: 'Metadata Test Document',
        Author: 'Metadata Author',
        Subject: 'Testing PDF Metadata'
      });

      mockReadAsStringAsync.mockResolvedValue(btoa('mock pdf binary content'));
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPDF)
      } as any);

      const result = await PDFService.parseFile('/mock/path/metadata-test.pdf');

      expect(result.title).toBe('Metadata Test Document');
      expect(result.author).toBe('Metadata Author');
      expect(result.metadata?.pdfInfo).toBeDefined();
    });

    it('should fallback to filename when no PDF metadata', async () => {
      const pageTexts = ['Content without metadata.'];
      const mockPDF = createMockPDFDocument(1, pageTexts, {});

      mockReadAsStringAsync.mockResolvedValue(btoa('mock pdf binary content'));
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPDF)
      } as any);

      const result = await PDFService.parseFile('/mock/path/no-metadata.pdf');

      expect(result.title).toBe('no-metadata');
      expect(result.author).toBe('Unknown Author');
    });

    it('should handle file system errors', async () => {
      mockReadAsStringAsync.mockRejectedValue(new Error('File not found'));

      await expect(PDFService.parseFile('/mock/path/missing.pdf'))
        .rejects.toThrow('Failed to parse PDF file');
    });

    it('should handle PDF parsing errors', async () => {
      mockReadAsStringAsync.mockResolvedValue('invalid-base64');
      
      const mockLoadingTask = {
        get promise() {
          return Promise.reject(new Error('Invalid PDF format'));
        }
      };
      
      mockGetDocument.mockReturnValue(mockLoadingTask as any);

      await expect(PDFService.parseFile('/mock/path/invalid.pdf'))
        .rejects.toThrow('Failed to parse PDF file');
    });

    it('should calculate word count and reading time correctly', async () => {
      const pageTexts = [
        'This is exactly ten words in this sentence here.',
        'Another sentence with exactly ten words in it.'
      ];
      
      const mockPDF = createMockPDFDocument(2, pageTexts);

      mockReadAsStringAsync.mockResolvedValue(btoa('mock pdf binary content'));
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPDF)
      } as any);

      const result = await PDFService.parseFile('/mock/path/counted.pdf');

      expect(result.wordCount).toBeGreaterThan(15);
      expect(result.estimatedReadingTime).toBeGreaterThan(0);
      // Reading time should be based on word count
      const expectedReadingTime = Math.ceil(result.wordCount / 250);
      expect(result.estimatedReadingTime).toBe(expectedReadingTime);
    });

    it('should provide PolyDoc metadata', async () => {
      const pageTexts = ['PolyDoc metadata test content.'];
      const mockPDF = createMockPDFDocument(1, pageTexts);

      mockReadAsStringAsync.mockResolvedValue(btoa('mock pdf binary content'));
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPDF)
      } as any);

      const result = await PDFService.parseFile('/mock/path/polydoc-test.pdf');

      expect(result.metadata).toEqual(
        expect.objectContaining({
          pageCount: 1,
          isPolyDoc: true,
          extractionMethod: 'text-layer'
        })
      );
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