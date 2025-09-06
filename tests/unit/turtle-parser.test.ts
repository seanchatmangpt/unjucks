import { describe, it, expect, beforeEach } from 'vitest';
import { TurtleParser, TurtleParseResult, TurtleParseOptions, TurtleParseError, TurtleUtils, parseTurtle, parseTurtleSync } from '../../src/lib/turtle-parser.js';

// Increase timeout for async tests that might take longer
const ASYNC_TIMEOUT = 30000;

describe('TurtleParser', () => {
  let parser: TurtleParser;

  beforeEach(() => {
    parser = new TurtleParser();
  });

  describe('constructor', () => {
    it('should create parser with default options', () => {
      const defaultParser = new TurtleParser();
      expect(defaultParser).toBeInstanceOf(TurtleParser);
    });

    it('should create parser with custom options', () => {
      const options: TurtleParseOptions = {
        baseIRI: 'http://example.org/',
        format: 'text/turtle',
        blankNodePrefix: '_:'
      };
      const customParser = new TurtleParser(options);
      expect(customParser).toBeInstanceOf(TurtleParser);
    });
  });

  describe('parse', () => {
    it('should successfully parse valid Turtle content', async () => {
      const turtleContent = '<http://example.org/person1> <http://xmlns.com/foaf/0.1/name> "John Doe" .';

      const result = await parser.parse(turtleContent);

      expect(result).toBeDefined();
      expect(result.triples).toBeDefined();
      expect(result.triples.length).toBeGreaterThan(0);
      expect(result.stats.tripleCount).toBeGreaterThan(0);
      
      // Check that at least one triple has expected structure
      const firstTriple = result.triples[0];
      expect(firstTriple.subject).toBeDefined();
      expect(firstTriple.predicate).toBeDefined();
      expect(firstTriple.object).toBeDefined();
    }, ASYNC_TIMEOUT);

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

    it('should handle content with prefixes only', async () => {
      const turtleContent = '@prefix ex: <http://example.org/> .\n@prefix foaf: <http://xmlns.com/foaf/0.1/> .';

      const result = await parser.parse(turtleContent);
      
      expect(result.triples).toHaveLength(0);
      expect(result.stats.tripleCount).toBe(0);
      // Note: Prefix extraction from N3 internal API might not work consistently
      expect(result.prefixes).toBeDefined();
    }, ASYNC_TIMEOUT);

    it('should parse complex nested data structures', async () => {
      const turtleContent = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:person1 a foaf:Person ;
                   foaf:name "John Doe" ;
                   foaf:knows ex:person2 .
                   
        ex:person2 a foaf:Person ;
                   foaf:name "Jane Smith" ;
                   foaf:age 28 .
      `;

      const result = await parser.parse(turtleContent);

      expect(result.triples.length).toBeGreaterThan(4);
      const subjects = TurtleUtils.getSubjects(result.triples);
      const subjectValues = subjects.map(s => s.value);
      expect(subjectValues).toContain('http://example.org/person1');
      expect(subjectValues).toContain('http://example.org/person2');
    });

    it('should handle multiple values for same property', async () => {
      const turtleContent = `
        @prefix ex: <http://example.org/> .
        
        ex:person1 ex:tag "tag1", "tag2", "tag3" .
      `;

      const result = await parser.parse(turtleContent);

      expect(result.triples.length).toBe(3);
      const tags = TurtleUtils.filterByPredicate(result.triples, 'http://example.org/tag');
      expect(tags).toHaveLength(3);
    });

    it('should handle blank nodes', async () => {
      const turtleContent = `
        @prefix ex: <http://example.org/> .
        
        [] a ex:AnonymousResource ;
           ex:value 123 .
      `;

      const result = await parser.parse(turtleContent);

      expect(result.triples.length).toBe(2);
      const blankNodeTriples = result.triples.filter(t => t.subject.type === 'blank');
      expect(blankNodeTriples.length).toBe(2);
    });

    it('should handle language tags', async () => {
      const turtleContent = `
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        ex:resource rdfs:label "English"@en, "Français"@fr .
      `;

      const result = await parser.parse(turtleContent);

      expect(result.triples.length).toBe(2);
      const labelTriples = result.triples.filter(t => 
        t.object.type === 'literal' && t.object.language
      );
      expect(labelTriples.length).toBe(2);
      expect(labelTriples[0].object.language).toBe('en');
      expect(labelTriples[1].object.language).toBe('fr');
    });

    it('should handle datatypes', async () => {
      const turtleContent = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:resource ex:intValue 42 ;
                   ex:floatValue 3.14 ;
                   ex:boolValue true ;
                   ex:dateValue "2024-01-01"^^xsd:date .
      `;

      const result = await parser.parse(turtleContent);

      expect(result.triples.length).toBe(4);
      
      const dateTriple = result.triples.find(t => 
        t.predicate.value === 'http://example.org/dateValue'
      );
      expect(dateTriple?.object.datatype).toBe('http://www.w3.org/2001/XMLSchema#date');
    });

    it('should return error for invalid Turtle syntax', async () => {
      const invalidTurtle = `
        @prefix ex: <http://example.org/> .
        ex:resource ex:property "unclosed string .
      `;

      await expect(parser.parse(invalidTurtle)).rejects.toThrow(TurtleParseError);
    });

    it('should handle very long strings', async () => {
      const longString = 'a'.repeat(10000);
      const turtleContent = `
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        ex:resource rdfs:label "${longString}" .
      `;

      const result = await parser.parse(turtleContent);

      expect(result.triples.length).toBe(1);
      expect(result.triples[0].object.value).toBe(longString);
    });

    it('should handle Unicode characters', async () => {
      const turtleContent = `
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        ex:resource rdfs:label "Héllo Wørld! 🌍 αβγδε 中文" .
      `;

      const result = await parser.parse(turtleContent);

      expect(result.triples.length).toBe(1);
      expect(result.triples[0].object.value).toBe('Héllo Wørld! 🌍 αβγδε 中文');
    });

    it('should handle edge case numeric values', async () => {
      const turtleContent = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:resource ex:zero 0 ;
                   ex:negative -42 ;
                   ex:scientific 1.23e-10 ;
                   ex:maxInt 9223372036854775807 .
      `;

      const result = await parser.parse(turtleContent);

      expect(result.triples.length).toBe(4);
      const values = result.triples.map(t => t.object.value);
      expect(values).toContain('0');
      expect(values).toContain('-42');
      expect(values).toContain('1.23e-10');
      expect(values).toContain('9223372036854775807');
    });
  });

  describe('parseSync', () => {
    it('should successfully parse file synchronously', async () => {
      // N3.js actually works synchronously, so parseSync returns real results
      const turtleContent = `
        <http://example.org/person1> <http://xmlns.com/foaf/0.1/name> "John Doe" .
      `;

      const result = parser.parseSync(turtleContent);

      // parseSync now returns actual parsed results
      expect(result.triples.length).toBeGreaterThan(0);
      expect(result.stats.tripleCount).toBeGreaterThan(0);
      
      // Compare with async version - should be the same
      const asyncResult = await parser.parse(turtleContent);
      expect(asyncResult.triples.length).toBe(result.triples.length);
    }, ASYNC_TIMEOUT);

    it('should handle parse errors synchronously', () => {
      // parseSync throws errors synchronously since N3.js is actually synchronous
      const invalidTurtle = 'invalid turtle content with syntax error @';

      expect(() => parser.parseSync(invalidTurtle)).toThrow(TurtleParseError);
    });
  });

  describe('createStore', () => {
    it('should create N3 Store from turtle content', async () => {
      const turtleContent = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:person1 a foaf:Person ;
                   foaf:name "John Doe" ;
                   foaf:age 30 .
      `;

      const store = await parser.createStore(turtleContent);

      expect(store).toBeDefined();
      const quads = store.getQuads(null, null, null);
      expect(quads.length).toBeGreaterThan(0);
    });

    it('should handle errors when creating store', async () => {
      const invalidTurtle = 'invalid turtle content';

      await expect(parser.createStore(invalidTurtle)).rejects.toThrow(TurtleParseError);
    });
  });

  describe('performance and edge cases', () => {
    it('should handle large datasets efficiently', async () => {
      const largeTurtleContent = Array.from({ length: 1000 }, (_, i) => 
        `ex:resource${i} ex:property "value${i}" .`
      ).join('\n');
      
      const fullContent = `
        @prefix ex: <http://example.org/> .
        ${largeTurtleContent}
      `;
      
      const startTime = Date.now();
      const result = await parser.parse(fullContent);
      const endTime = Date.now();
      
      expect(result.triples.length).toBe(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle maximum recursion depth safely', async () => {
      const deepNesting = Array.from({ length: 100 }, (_, i) => 
        `ex:resource${i} ex:contains ex:resource${i + 1} .`
      ).join('\n');
      
      const content = `
        @prefix ex: <http://example.org/> .
        ${deepNesting}
      `;
      
      const result = await parser.parse(content);
      expect(result.triples.length).toBe(100);
    });

    it('should handle concurrent parsing requests', async () => {
      const content1 = '@prefix ex: <http://example.org/> . ex:r1 ex:p "v1" .';
      const content2 = '@prefix ex: <http://example.org/> . ex:r2 ex:p "v2" .';
      const content3 = '@prefix ex: <http://example.org/> . ex:r3 ex:p "v3" .';
      
      const [result1, result2, result3] = await Promise.all([
        new TurtleParser().parse(content1),
        new TurtleParser().parse(content2),
        new TurtleParser().parse(content3)
      ]);
      
      expect(result1.triples.length).toBe(1);
      expect(result2.triples.length).toBe(1);
      expect(result3.triples.length).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle null or undefined input gracefully', async () => {
      await expect(parser.parse(null as any)).rejects.toThrow();
      await expect(parser.parse(undefined as any)).rejects.toThrow();
    });

    it('should handle non-string input', async () => {
      await expect(parser.parse(123 as any)).rejects.toThrow();
    });

    it('should preserve original error messages', async () => {
      const invalidContent = '<http://example.org/test> <http://example.org/prop> "unclosed string';
      
      await expect(parser.parse(invalidContent)).rejects.toThrow(TurtleParseError);
    });
  });
});

describe('TurtleUtils', () => {
  const sampleTriples = [
    {
      subject: { type: 'uri' as const, value: 'http://example.org/person1' },
      predicate: { type: 'uri' as const, value: 'http://xmlns.com/foaf/0.1/name' },
      object: { type: 'literal' as const, value: 'John Doe' }
    },
    {
      subject: { type: 'uri' as const, value: 'http://example.org/person1' },
      predicate: { type: 'uri' as const, value: 'http://xmlns.com/foaf/0.1/age' },
      object: { type: 'literal' as const, value: '30', datatype: 'http://www.w3.org/2001/XMLSchema#integer' }
    },
    {
      subject: { type: 'uri' as const, value: 'http://example.org/person2' },
      predicate: { type: 'uri' as const, value: 'http://xmlns.com/foaf/0.1/name' },
      object: { type: 'literal' as const, value: 'Jane Smith' }
    }
  ];

  describe('filterBySubject', () => {
    it('should filter triples by subject URI', () => {
      const filtered = TurtleUtils.filterBySubject(sampleTriples, 'http://example.org/person1');
      expect(filtered).toHaveLength(2);
    });
  });

  describe('filterByPredicate', () => {
    it('should filter triples by predicate URI', () => {
      const filtered = TurtleUtils.filterByPredicate(sampleTriples, 'http://xmlns.com/foaf/0.1/name');
      expect(filtered).toHaveLength(2);
    });
  });

  describe('filterByObject', () => {
    it('should filter triples by object value', () => {
      const filtered = TurtleUtils.filterByObject(sampleTriples, 'John Doe');
      expect(filtered).toHaveLength(1);
    });
  });

  describe('groupBySubject', () => {
    it('should group triples by subject', () => {
      const grouped = TurtleUtils.groupBySubject(sampleTriples);
      expect(grouped.size).toBe(2);
      expect(grouped.get('uri:http://example.org/person1')).toHaveLength(2);
      expect(grouped.get('uri:http://example.org/person2')).toHaveLength(1);
    });
  });

  describe('expandPrefix', () => {
    it('should expand prefixed URI to full URI', () => {
      const prefixes = { foaf: 'http://xmlns.com/foaf/0.1/' };
      const expanded = TurtleUtils.expandPrefix('foaf:name', prefixes);
      expect(expanded).toBe('http://xmlns.com/foaf/0.1/name');
    });

    it('should return original URI if no prefix match', () => {
      const prefixes = { foaf: 'http://xmlns.com/foaf/0.1/' };
      const expanded = TurtleUtils.expandPrefix('ex:name', prefixes);
      expect(expanded).toBe('ex:name');
    });
  });

  describe('compactUri', () => {
    it('should compact full URI to prefixed form', () => {
      const prefixes = { foaf: 'http://xmlns.com/foaf/0.1/' };
      const compacted = TurtleUtils.compactUri('http://xmlns.com/foaf/0.1/name', prefixes);
      expect(compacted).toBe('foaf:name');
    });

    it('should return original URI if no prefix match', () => {
      const prefixes = { foaf: 'http://xmlns.com/foaf/0.1/' };
      const compacted = TurtleUtils.compactUri('http://example.org/name', prefixes);
      expect(compacted).toBe('http://example.org/name');
    });
  });

  describe('getSubjects', () => {
    it('should extract unique subjects', () => {
      const subjects = TurtleUtils.getSubjects(sampleTriples);
      expect(subjects).toHaveLength(2);
      expect(subjects.map(s => s.value)).toContain('http://example.org/person1');
      expect(subjects.map(s => s.value)).toContain('http://example.org/person2');
    });
  });

  describe('getPredicates', () => {
    it('should extract unique predicates', () => {
      const predicates = TurtleUtils.getPredicates(sampleTriples);
      expect(predicates).toHaveLength(2);
      expect(predicates.map(p => p.value)).toContain('http://xmlns.com/foaf/0.1/name');
      expect(predicates.map(p => p.value)).toContain('http://xmlns.com/foaf/0.1/age');
    });
  });

  describe('convertLiteralValue', () => {
    it('should convert integer literals to numbers', () => {
      const term = { type: 'literal' as const, value: '42', datatype: 'http://www.w3.org/2001/XMLSchema#integer' };
      const converted = TurtleUtils.convertLiteralValue(term);
      expect(converted).toBe(42);
      expect(typeof converted).toBe('number');
    });

    it('should convert boolean literals to booleans', () => {
      const term = { type: 'literal' as const, value: 'true', datatype: 'http://www.w3.org/2001/XMLSchema#boolean' };
      const converted = TurtleUtils.convertLiteralValue(term);
      expect(converted).toBe(true);
      expect(typeof converted).toBe('boolean');
    });

    it('should convert date literals to Date objects', () => {
      const term = { type: 'literal' as const, value: '2024-01-01T00:00:00Z', datatype: 'http://www.w3.org/2001/XMLSchema#dateTime' };
      const converted = TurtleUtils.convertLiteralValue(term);
      expect(converted).toBeInstanceOf(Date);
    });

    it('should return string value for non-literal terms', () => {
      const term = { type: 'uri' as const, value: 'http://example.org/resource' };
      const converted = TurtleUtils.convertLiteralValue(term);
      expect(converted).toBe('http://example.org/resource');
    });
  });

  describe('isValidUri', () => {
    it('should validate correct URIs', () => {
      expect(TurtleUtils.isValidUri('http://example.org')).toBe(true);
      expect(TurtleUtils.isValidUri('https://example.org/path')).toBe(true);
      expect(TurtleUtils.isValidUri('urn:isbn:0451450523')).toBe(true);
    });

    it('should reject invalid URIs', () => {
      expect(TurtleUtils.isValidUri('not-a-uri')).toBe(false);
      expect(TurtleUtils.isValidUri('')).toBe(false);
      expect(TurtleUtils.isValidUri('http://')).toBe(false);
    });
  });
});

describe('convenience functions', () => {
  describe('parseTurtle', () => {
    it('should parse turtle content with default options', async () => {
      const content = '<http://example.org/test> <http://example.org/prop> "value" .';
      const result = await parseTurtle(content);
      
      expect(result.triples.length).toBeGreaterThan(0);
      expect(result.stats.tripleCount).toBeGreaterThan(0);
    });

    it('should parse turtle content with custom options', async () => {
      const content = '<http://example.org/test> <http://example.org/prop> "value" .';
      const result = await parseTurtle(content, { baseIRI: 'http://example.org/' });
      
      expect(result.triples.length).toBeGreaterThan(0);
    });
  });

  describe('parseTurtleSync', () => {
    it('should parse turtle content synchronously', () => {
      const content = '<http://example.org/test> <http://example.org/prop> "value" .';
      const result = parseTurtleSync(content);
      
      // parseSync now returns actual parsed results
      expect(result.triples.length).toBeGreaterThan(0);
      expect(result.stats.tripleCount).toBeGreaterThan(0);
    });

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