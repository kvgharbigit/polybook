import { WordDefinition } from '../components/TranslationPopup';

// Basic word definitions for common words - will be expanded to real dictionary later
const BASIC_DICTIONARY: Record<string, WordDefinition> = {
  // Most common English words
  'the': {
    word: 'the',
    definitions: [
      {
        partOfSpeech: 'article',
        meaning: 'Used to refer to a specific thing or person that has been mentioned or is understood.',
        example: 'The book on the table is mine.',
      },
    ],
    frequency: 10000,
  },
  'of': {
    word: 'of',
    definitions: [
      {
        partOfSpeech: 'preposition',
        meaning: 'Expressing the relationship between a part and a whole.',
        example: 'A piece of cake.',
      },
    ],
    frequency: 9800,
  },
  'and': {
    word: 'and',
    definitions: [
      {
        partOfSpeech: 'conjunction',
        meaning: 'Used to connect words or clauses.',
        example: 'I like coffee and tea.',
      },
    ],
    frequency: 9500,
  },
  'a': {
    word: 'a',
    definitions: [
      {
        partOfSpeech: 'article',
        meaning: 'Used when referring to someone or something for the first time.',
        example: 'I saw a bird in the garden.',
      },
    ],
    frequency: 9200,
  },
  'to': {
    word: 'to',
    definitions: [
      {
        partOfSpeech: 'preposition',
        meaning: 'Expressing motion in the direction of a particular location.',
        example: 'I am going to the store.',
      },
    ],
    frequency: 9000,
  },
  'in': {
    word: 'in',
    definitions: [
      {
        partOfSpeech: 'preposition',
        meaning: 'Expressing the situation of something that is surrounded by something else.',
        example: 'The cat is in the box.',
      },
    ],
    frequency: 8800,
  },
  'is': {
    word: 'is',
    definitions: [
      {
        partOfSpeech: 'verb',
        meaning: 'Third person singular present of "be".',
        example: 'She is happy.',
      },
    ],
    frequency: 8500,
  },
  'that': {
    word: 'that',
    definitions: [
      {
        partOfSpeech: 'pronoun',
        meaning: 'Used to identify a specific person or thing observed or heard.',
        example: 'That is my car.',
      },
    ],
    frequency: 8200,
  },
  'it': {
    word: 'it',
    definitions: [
      {
        partOfSpeech: 'pronoun',
        meaning: 'Used to refer to a thing previously mentioned or easily identified.',
        example: 'Where is my book? I left it here.',
      },
    ],
    frequency: 8000,
  },
  'was': {
    word: 'was',
    definitions: [
      {
        partOfSpeech: 'verb',
        meaning: 'Past tense of "be" (first and third person singular).',
        example: 'He was tired yesterday.',
      },
    ],
    frequency: 7800,
  },
  'for': {
    word: 'for',
    definitions: [
      {
        partOfSpeech: 'preposition',
        meaning: 'In favor of; in support of.',
        example: 'This gift is for you.',
      },
    ],
    frequency: 7500,
  },
  'with': {
    word: 'with',
    definitions: [
      {
        partOfSpeech: 'preposition',
        meaning: 'Accompanied by another person or thing.',
        example: 'I went to the movies with my friend.',
      },
    ],
    frequency: 7200,
  },
  'he': {
    word: 'he',
    definitions: [
      {
        partOfSpeech: 'pronoun',
        meaning: 'Used to refer to a man, boy, or male animal.',
        example: 'He is my brother.',
      },
    ],
    frequency: 7000,
  },
  'she': {
    word: 'she',
    definitions: [
      {
        partOfSpeech: 'pronoun',
        meaning: 'Used to refer to a woman, girl, or female animal.',
        example: 'She is my sister.',
      },
    ],
    frequency: 6800,
  },
  'as': {
    word: 'as',
    definitions: [
      {
        partOfSpeech: 'adverb',
        meaning: 'Used in comparisons to refer to the extent or degree of something.',
        example: 'She is as tall as me.',
      },
    ],
    frequency: 6500,
  },
  'his': {
    word: 'his',
    definitions: [
      {
        partOfSpeech: 'pronoun',
        meaning: 'Belonging to or associated with a male person or animal.',
        example: 'That is his car.',
      },
    ],
    frequency: 6200,
  },
  'her': {
    word: 'her',
    definitions: [
      {
        partOfSpeech: 'pronoun',
        meaning: 'Belonging to or associated with a female person or animal.',
        example: 'That is her book.',
      },
    ],
    frequency: 6000,
  },
  'you': {
    word: 'you',
    definitions: [
      {
        partOfSpeech: 'pronoun',
        meaning: 'Used to refer to the person or people that the speaker is addressing.',
        example: 'How are you today?',
      },
    ],
    frequency: 5800,
  },
  'had': {
    word: 'had',
    definitions: [
      {
        partOfSpeech: 'verb',
        meaning: 'Past tense of "have".',
        example: 'She had a good time at the party.',
      },
    ],
    frequency: 5500,
  },
  'have': {
    word: 'have',
    definitions: [
      {
        partOfSpeech: 'verb',
        meaning: 'Possess, own, or hold.',
        example: 'I have a new car.',
      },
    ],
    frequency: 5200,
  },
  'but': {
    word: 'but',
    definitions: [
      {
        partOfSpeech: 'conjunction',
        meaning: 'Used to introduce a phrase or clause contrasting with what has already been mentioned.',
        example: 'I like coffee but not tea.',
      },
    ],
    frequency: 5000,
  },
  'not': {
    word: 'not',
    definitions: [
      {
        partOfSpeech: 'adverb',
        meaning: 'Used with an auxiliary verb or "be" to form the negative.',
        example: 'I do not like spinach.',
      },
    ],
    frequency: 4800,
  },
  'are': {
    word: 'are',
    definitions: [
      {
        partOfSpeech: 'verb',
        meaning: 'Second person singular and plural present of "be".',
        example: 'You are my friend.',
      },
    ],
    frequency: 4500,
  },
  'on': {
    word: 'on',
    definitions: [
      {
        partOfSpeech: 'preposition',
        meaning: 'Physically in contact with and supported by a surface.',
        example: 'The book is on the table.',
      },
    ],
    frequency: 4200,
  },
  'at': {
    word: 'at',
    definitions: [
      {
        partOfSpeech: 'preposition',
        meaning: 'Expressing location or arrival in a particular place or position.',
        example: 'I am at home.',
      },
    ],
    frequency: 4000,
  },
  'be': {
    word: 'be',
    definitions: [
      {
        partOfSpeech: 'verb',
        meaning: 'Exist; have reality.',
        example: 'To be or not to be.',
      },
    ],
    frequency: 3800,
  },
  'or': {
    word: 'or',
    definitions: [
      {
        partOfSpeech: 'conjunction',
        meaning: 'Used to link alternatives.',
        example: 'Would you like tea or coffee?',
      },
    ],
    frequency: 3500,
  },
  'an': {
    word: 'an',
    definitions: [
      {
        partOfSpeech: 'article',
        meaning: 'Used before words beginning with a vowel sound.',
        example: 'An apple a day keeps the doctor away.',
      },
    ],
    frequency: 3200,
  },
  'this': {
    word: 'this',
    definitions: [
      {
        partOfSpeech: 'pronoun',
        meaning: 'Used to identify a specific person or thing close at hand.',
        example: 'This is my house.',
      },
    ],
    frequency: 3000,
  },
  'will': {
    word: 'will',
    definitions: [
      {
        partOfSpeech: 'modal verb',
        meaning: 'Expressing the future tense.',
        example: 'I will see you tomorrow.',
      },
    ],
    frequency: 2800,
  },
  'from': {
    word: 'from',
    definitions: [
      {
        partOfSpeech: 'preposition',
        meaning: 'Indicating the point in space at which a journey, motion, or action starts.',
        example: 'I am from New York.',
      },
    ],
    frequency: 2500,
  },
  'book': {
    word: 'book',
    definitions: [
      {
        partOfSpeech: 'noun',
        meaning: 'A written or printed work consisting of pages bound together.',
        example: 'She read an interesting book about history.',
      },
      {
        partOfSpeech: 'verb',
        meaning: 'To reserve or arrange for something.',
        example: 'I need to book a table at the restaurant.',
      },
    ],
    frequency: 2000,
  },
  'read': {
    word: 'read',
    definitions: [
      {
        partOfSpeech: 'verb',
        meaning: 'To look at and comprehend written or printed matter.',
        example: 'I read the newspaper every morning.',
      },
    ],
    frequency: 3000,
  },
  'language': {
    word: 'language',
    definitions: [
      {
        partOfSpeech: 'noun',
        meaning: 'A system of communication used by a particular community or country.',
        example: 'English is a widely spoken language.',
      },
    ],
    frequency: 1500,
  },
  'learning': {
    word: 'learning',
    definitions: [
      {
        partOfSpeech: 'noun',
        meaning: 'The acquisition of knowledge or skills through study or experience.',
        example: 'Learning a new language takes time and practice.',
      },
    ],
    frequency: 1800,
  },
  'word': {
    word: 'word',
    definitions: [
      {
        partOfSpeech: 'noun',
        meaning: 'A single distinct meaningful element of speech or writing.',
        example: 'What does this word mean?',
      },
    ],
    frequency: 2500,
  },
  'translation': {
    word: 'translation',
    definitions: [
      {
        partOfSpeech: 'noun',
        meaning: 'The process of translating words or text from one language into another.',
        example: 'The translation of the document was very accurate.',
      },
    ],
    frequency: 800,
  },
  'dictionary': {
    word: 'dictionary',
    definitions: [
      {
        partOfSpeech: 'noun',
        meaning: 'A book or electronic resource that lists words in alphabetical order and gives their meaning.',
        example: 'I looked up the word in a dictionary.',
      },
    ],
    frequency: 600,
  },
  'text': {
    word: 'text',
    definitions: [
      {
        partOfSpeech: 'noun',
        meaning: 'Written or printed words, typically forming a coherent and organized whole.',
        example: 'The text of the article was very informative.',
      },
    ],
    frequency: 1200,
  },
  // Spanish words for testing
  'en': {
    word: 'en',
    definitions: [
      {
        partOfSpeech: 'preposition',
        meaning: 'In, on, at (Spanish)',
        example: 'en la casa (in the house)',
      },
    ],
    frequency: 8000,
  },
  'un': {
    word: 'un',
    definitions: [
      {
        partOfSpeech: 'article',
        meaning: 'A, an (Spanish masculine)',
        example: 'un libro (a book)',
      },
    ],
    frequency: 7000,
  },
  'lugar': {
    word: 'lugar',
    definitions: [
      {
        partOfSpeech: 'noun',
        meaning: 'Place, location (Spanish)',
        example: 'un lugar hermoso (a beautiful place)',
      },
    ],
    frequency: 2000,
  },
  'de': {
    word: 'de',
    definitions: [
      {
        partOfSpeech: 'preposition',
        meaning: 'Of, from (Spanish)',
        example: 'el libro de María (María\'s book)',
      },
    ],
    frequency: 9500,
  },
  'la': {
    word: 'la',
    definitions: [
      {
        partOfSpeech: 'article',
        meaning: 'The (Spanish feminine)',
        example: 'la casa (the house)',
      },
    ],
    frequency: 9000,
  },
  'que': {
    word: 'que',
    definitions: [
      {
        partOfSpeech: 'pronoun/conjunction',
        meaning: 'That, which, who (Spanish)',
        example: 'el libro que leí (the book that I read)',
      },
    ],
    frequency: 8500,
  },
};

export class WordLookupService {
  
  /**
   * Look up a word definition
   */
  static async lookupWord(word: string): Promise<WordDefinition | null> {
    // Simulate network delay for realistic experience
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
    
    // Normalize the word (lowercase, remove punctuation)
    const normalizedWord = word.toLowerCase().replace(/[^\w]/g, '');
    
    // Check our basic dictionary
    const definition = BASIC_DICTIONARY[normalizedWord];
    
    if (definition) {
      return definition;
    }
    
    // If not found, return null (will trigger "no definition found")
    return null;
  }
  
  /**
   * Check if a word exists in our dictionary
   */
  static hasDefinition(word: string): boolean {
    const normalizedWord = word.toLowerCase().replace(/[^\w]/g, '');
    return normalizedWord in BASIC_DICTIONARY;
  }
  
  /**
   * Get suggested words based on partial match
   */
  static getSuggestions(partialWord: string): string[] {
    const normalized = partialWord.toLowerCase();
    return Object.keys(BASIC_DICTIONARY)
      .filter(word => word.startsWith(normalized))
      .slice(0, 5);
  }
  
  /**
   * Add a custom definition (for testing or user additions)
   */
  static addDefinition(word: string, definition: WordDefinition): void {
    const normalizedWord = word.toLowerCase().replace(/[^\w]/g, '');
    BASIC_DICTIONARY[normalizedWord] = definition;
  }
  
  /**
   * Get all available words (for debugging)
   */
  static getAvailableWords(): string[] {
    return Object.keys(BASIC_DICTIONARY).sort();
  }
}

export default WordLookupService;