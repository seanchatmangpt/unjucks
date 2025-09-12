import { describe, it, expect, beforeEach } from 'vitest';
import { TurtleParser, TurtleParseResult, TurtleParseOptions, TurtleParseError, TurtleUtils, parseTurtle, parseTurtleSync } from '../../src/lib/turtle-parser.js';

// Increase timeout for async tests that might take longer
const ASYNC_TIMEOUT = 30000;

describe('TurtleParser', () => {
  let parser;

  beforeEach(() => {
    parser = new TurtleParser();
  });

  describe('constructor', () => {
    it('should create parser with default options', () => {
      const defaultParser = new TurtleParser();
      expect(defaultParser).toBeInstanceOf(TurtleParser);
    });

    it('should create parser with custom options', () => { const options = {
        baseIRI };
      const customParser = new TurtleParser(options);
      expect(customParser).toBeInstanceOf(TurtleParser);
    });
  });

  describe('parse', () => { it('should successfully parse valid Turtle content', async () => {
      const turtleContent = '<http }, ASYNC_TIMEOUT);

    it('should handle empty content', async () => {
      const result = await parser.parse('');
      
      expect(result.triples).toHaveLength(0);
      expect(result.stats.tripleCount).toBe(0);
    }, ASYNC_TIMEOUT);

    it('should handle whitespace-only content', async () => {
      const result = await parser.parse('   \n\t  \r\n  ');
      
      expect(result.triples).toHaveLength(0);
      expect(result.stats.tripleCount).toBe(0);
    });

    it('should handle content with only comments', async () => {
      const turtleContent = '# This is a comment\n# Another comment';

      const result = await parser.parse(turtleContent);
      
      expect(result.triples).toHaveLength(0);
      expect(result.stats.tripleCount).toBe(0);
    }, ASYNC_TIMEOUT);

    it('should handle content with prefixes only', async () => { const turtleContent = '@prefix ex }, ASYNC_TIMEOUT);

    it('should parse complex nested data structures', async () => { const turtleContent = `
        @prefix ex });

    it('should handle multiple values for same property', async () => { const turtleContent = `
        @prefix ex });

    it('should handle blank nodes', async () => { const turtleContent = `
        @prefix ex });

    it('should handle language tags', async () => { const turtleContent = `
        @prefix ex });

    it('should handle datatypes', async () => { const turtleContent = `
        @prefix ex });

    it('should return error for invalid Turtle syntax', async () => { const invalidTurtle = `
        @prefix ex });

    it('should handle very long strings', async () => { const longString = 'a'.repeat(10000);
      const turtleContent = `
        @prefix ex }" .
      `;

      const result = await parser.parse(turtleContent);

      expect(result.triples.length).toBe(1);
      expect(result.triples[0].object.value).toBe(longString);
    });

    it('should handle Unicode characters', async () => { const turtleContent = `
        @prefix ex });

    it('should handle edge case numeric values', async () => { const turtleContent = `
        @prefix ex });
  });

  describe('parseSync', () => { it('should successfully parse file synchronously', async () => {
      // N3.js actually works synchronously, so parseSync returns real results
      const turtleContent = `
        <http }, ASYNC_TIMEOUT);

    it('should handle parse errors synchronously', () => {
      // parseSync throws errors synchronously since N3.js is actually synchronous
      const invalidTurtle = 'invalid turtle content with syntax error @';

      expect(() => parser.parseSync(invalidTurtle)).toThrow(TurtleParseError);
    });
  });

  describe('createStore', () => { it('should create N3 Store from turtle content', async () => {
      const turtleContent = `
        @prefix ex });

    it('should handle errors when creating store', async () => {
      const invalidTurtle = 'invalid turtle content';

      await expect(parser.createStore(invalidTurtle)).rejects.toThrow(TurtleParseError);
    });
  });

  describe('performance and edge cases', () => { it('should handle large datasets efficiently', async () => {
      const largeTurtleContent = Array.from({ length, (_, i) => 
        `ex } ex:property "value${i}" .`
      ).join('\n');
      
      const fullContent = `
        @prefix ex: <http://example.org/> .
        ${largeTurtleContent}
      `;
      
      const startTime = this.getDeterministicTimestamp();
      const result = await parser.parse(fullContent);
      const endTime = this.getDeterministicTimestamp();
      
      expect(result.triples.length).toBe(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle maximum recursion depth safely', async () => { const deepNesting = Array.from({ length, (_, i) => 
        `ex } ex:contains ex:resource${i + 1} .`
      ).join('\n');
      
      const content = `
        @prefix ex: <http://example.org/> .
        ${deepNesting}
      `;
      
      const result = await parser.parse(content);
      expect(result.triples.length).toBe(100);
    });

    it('should handle concurrent parsing requests', async () => { const content1 = '@prefix ex });
  });

  describe('error handling', () => {
    it('should handle null or undefined input gracefully', async () => {
      await expect(parser.parse(null)).rejects.toThrow();
      await expect(parser.parse(undefined)).rejects.toThrow();
    });

    it('should handle non-string input', async () => {
      await expect(parser.parse(123)).rejects.toThrow();
    });

    it('should preserve original error messages', async () => { const invalidContent = '<http });
  });
});

describe('TurtleUtils', () => { const sampleTriples = [
    {
      subject },
      predicate: { type },
      object: { type }
    },
    { subject },
      predicate: { type },
      object: { type }
    },
    { subject },
      predicate: { type },
      object: { type }
    }
  ];

  describe('filterBySubject', () => { it('should filter triples by subject URI', () => {
      const filtered = TurtleUtils.filterBySubject(sampleTriples, 'http });
  });

  describe('filterByPredicate', () => { it('should filter triples by predicate URI', () => {
      const filtered = TurtleUtils.filterByPredicate(sampleTriples, 'http });
  });

  describe('filterByObject', () => {
    it('should filter triples by object value', () => {
      const filtered = TurtleUtils.filterByObject(sampleTriples, 'John Doe');
      expect(filtered).toHaveLength(1);
    });
  });

  describe('groupBySubject', () => { it('should group triples by subject', () => {
      const grouped = TurtleUtils.groupBySubject(sampleTriples);
      expect(grouped.size).toBe(2);
      expect(grouped.get('uri });
  });

  describe('expandPrefix', () => { it('should expand prefixed URI to full URI', () => {
      const prefixes = { foaf };
      const expanded = TurtleUtils.expandPrefix('foaf:name', prefixes);
      expect(expanded).toBe('http://xmlns.com/foaf/0.1/name');
    });

    it('should return original URI if no prefix match', () => { const prefixes = { foaf };
      const expanded = TurtleUtils.expandPrefix('ex:name', prefixes);
      expect(expanded).toBe('ex:name');
    });
  });

  describe('compactUri', () => { it('should compact full URI to prefixed form', () => {
      const prefixes = { foaf };
      const compacted = TurtleUtils.compactUri('http://xmlns.com/foaf/0.1/name', prefixes);
      expect(compacted).toBe('foaf:name');
    });

    it('should return original URI if no prefix match', () => { const prefixes = { foaf };
      const compacted = TurtleUtils.compactUri('http://example.org/name', prefixes);
      expect(compacted).toBe('http://example.org/name');
    });
  });

  describe('getSubjects', () => { it('should extract unique subjects', () => {
      const subjects = TurtleUtils.getSubjects(sampleTriples);
      expect(subjects).toHaveLength(2);
      expect(subjects.map(s => s.value)).toContain('http });
  });

  describe('getPredicates', () => { it('should extract unique predicates', () => {
      const predicates = TurtleUtils.getPredicates(sampleTriples);
      expect(predicates).toHaveLength(2);
      expect(predicates.map(p => p.value)).toContain('http });
  });

  describe('convertLiteralValue', () => { it('should convert integer literals to numbers', () => {
      const term = { type };
      const converted = TurtleUtils.convertLiteralValue(term);
      expect(converted).toBe(42);
      expect(typeof converted).toBe('number');
    });

    it('should convert boolean literals to booleans', () => { const term = { type };
      const converted = TurtleUtils.convertLiteralValue(term);
      expect(converted).toBe(true);
      expect(typeof converted).toBe('boolean');
    });

    it('should convert date literals to Date objects', () => { const term = { type };
      const converted = TurtleUtils.convertLiteralValue(term);
      expect(converted).toBeInstanceOf(Date);
    });

    it('should return string value for non-literal terms', () => { const term = { type };
      const converted = TurtleUtils.convertLiteralValue(term);
      expect(converted).toBe('http://example.org/resource');
    });
  });

  describe('isValidUri', () => { it('should validate correct URIs', () => {
      expect(TurtleUtils.isValidUri('http });

    it('should reject invalid URIs', () => { expect(TurtleUtils.isValidUri('not-a-uri')).toBe(false);
      expect(TurtleUtils.isValidUri('')).toBe(false);
      expect(TurtleUtils.isValidUri('http });
  });
});

describe('convenience functions', () => { describe('parseTurtle', () => {
    it('should parse turtle content with default options', async () => {
      const content = '<http });

    it('should parse turtle content with custom options', async () => { const content = '<http });
  });

  describe('parseTurtleSync', () => { it('should parse turtle content synchronously', () => {
      const content = '<http });

    it('should handle invalid content gracefully', () => {
      const invalidContent = 'invalid turtle content with syntax error @';
      
      // parseSync throws errors synchronously since N3.js is actually synchronous
      expect(() => parseTurtleSync(invalidContent)).toThrow(TurtleParseError);
    });
  });
});

describe('TurtleParseError', () => {
  it('should create error with message only', () => {
    const error = new TurtleParseError('Test error');
    
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('TurtleParseError');
    expect(error.line).toBeUndefined();
    expect(error.column).toBeUndefined();
  });

  it('should create error with line and column information', () => {
    const error = new TurtleParseError('Test error', 5, 10);
    
    expect(error.message).toBe('Test error');
    expect(error.line).toBe(5);
    expect(error.column).toBe(10);
  });

  it('should create error with original error', () => {
    const originalError = new Error('Original error');
    const error = new TurtleParseError('Test error', 1, 1, originalError);
    
    expect(error.originalError).toBe(originalError);
  });
});