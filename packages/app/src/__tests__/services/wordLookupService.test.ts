import { WordLookupService } from '../../services/wordLookup';
import { WordDefinition } from '../../components/TranslationPopup';

describe('WordLookupService', () => {
  describe('lookupWord', () => {
    it('should return definition for known words', async () => {
      const definition = await WordLookupService.lookupWord('hello');
      
      expect(definition).toBeDefined();
      expect(definition.word).toBe('hello');
      expect(definition.definition).toBeDefined();
      expect(definition.definition.length).toBeGreaterThan(0);
      expect(definition.partOfSpeech).toBeDefined();
      expect(definition.examples).toBeDefined();
      expect(Array.isArray(definition.examples)).toBe(true);
    });

    it('should handle different word cases correctly', async () => {
      const lowerCase = await WordLookupService.lookupWord('the');
      const upperCase = await WordLookupService.lookupWord('THE');
      const mixedCase = await WordLookupService.lookupWord('The');
      
      expect(lowerCase).toBeDefined();
      expect(upperCase).toBeDefined();
      expect(mixedCase).toBeDefined();
      
      // All should return the same word in lowercase
      expect(lowerCase.word).toBe('the');
      expect(upperCase.word).toBe('the');
      expect(mixedCase.word).toBe('the');
    });

    it('should handle words with punctuation', async () => {
      const wordWithPunctuation = await WordLookupService.lookupWord('hello,');
      const wordWithQuotes = await WordLookupService.lookupWord('"world"');
      
      expect(wordWithPunctuation.word).toBe('hello');
      expect(wordWithQuotes.word).toBe('world');
    });

    it('should return appropriate response for unknown words', async () => {
      const unknownWord = await WordLookupService.lookupWord('xyzabc123');
      
      expect(unknownWord).toBeDefined();
      expect(unknownWord.word).toBe('xyzabc123');
      expect(unknownWord.definition).toContain('definition not available');
    });

    it('should handle empty or invalid input', async () => {
      await expect(WordLookupService.lookupWord('')).rejects.toThrow();
      await expect(WordLookupService.lookupWord('   ')).rejects.toThrow();
    });

    it('should handle common English words', async () => {
      const commonWords = ['and', 'the', 'is', 'at', 'which', 'on'];
      
      for (const word of commonWords) {
        const definition = await WordLookupService.lookupWord(word);
        expect(definition).toBeDefined();
        expect(definition.word).toBe(word);
        expect(definition.definition).toBeDefined();
        expect(definition.partOfSpeech).toBeDefined();
      }
    });

    it('should provide examples for words when available', async () => {
      const definition = await WordLookupService.lookupWord('good');
      
      expect(definition.examples).toBeDefined();
      expect(Array.isArray(definition.examples)).toBe(true);
      
      if (definition.examples.length > 0) {
        definition.examples.forEach(example => {
          expect(typeof example).toBe('string');
          expect(example.length).toBeGreaterThan(0);
          expect(example.toLowerCase()).toContain('good');
        });
      }
    });

    it('should return consistent results for the same word', async () => {
      const word = 'test';
      const definition1 = await WordLookupService.lookupWord(word);
      const definition2 = await WordLookupService.lookupWord(word);
      
      expect(definition1.word).toBe(definition2.word);
      expect(definition1.definition).toBe(definition2.definition);
      expect(definition1.partOfSpeech).toBe(definition2.partOfSpeech);
      expect(definition1.examples).toEqual(definition2.examples);
    });

    it('should handle special characters and numbers', async () => {
      // Should gracefully handle or reject invalid inputs
      const specialInputs = ['123', '!@#', 'word123', 'hyphen-word'];
      
      for (const input of specialInputs) {
        try {
          const definition = await WordLookupService.lookupWord(input);
          // If it returns a result, it should be well-formed
          expect(definition.word).toBeDefined();
          expect(definition.definition).toBeDefined();
        } catch (error) {
          // If it throws an error, that's also acceptable for invalid inputs
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should have reasonable performance', async () => {
      const startTime = Date.now();
      await WordLookupService.lookupWord('performance');
      const endTime = Date.now();
      
      // Lookup should complete within 1 second
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle concurrent lookups properly', async () => {
      const words = ['concurrent', 'lookup', 'test', 'performance'];
      
      const promises = words.map(word => WordLookupService.lookupWord(word));
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(words.length);
      results.forEach((result, index) => {
        expect(result.word).toBe(words[index]);
        expect(result.definition).toBeDefined();
      });
    });
  });

  describe('WordDefinition interface', () => {
    it('should have the correct structure', async () => {
      const definition = await WordLookupService.lookupWord('structure');
      
      // Check that all required properties exist
      expect(definition).toHaveProperty('word');
      expect(definition).toHaveProperty('definition');
      expect(definition).toHaveProperty('partOfSpeech');
      expect(definition).toHaveProperty('examples');
      
      // Check property types
      expect(typeof definition.word).toBe('string');
      expect(typeof definition.definition).toBe('string');
      expect(typeof definition.partOfSpeech).toBe('string');
      expect(Array.isArray(definition.examples)).toBe(true);
      
      // Check that examples array contains strings
      definition.examples.forEach(example => {
        expect(typeof example).toBe('string');
      });
    });
  });
});