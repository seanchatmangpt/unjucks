/**
 * Comprehensive Unit Tests for TurtleParser
 * Testing the critical 20% that must work perfectly
 */

import { TurtleParser, TurtleParseError, TurtleUtils, parseTurtle, parseTurtleSync } from '../../src/lib/turtle-parser.js';

describe('TurtleParser - Core Functionality', () => {
  let parser;
  
  beforeEach(() => {
    parser = new TurtleParser();
  });

  describe('Constructor and Configuration', () => {
    test('should create parser with default options', () => {
      expect(parser.options.baseIRI).toBe('http://example.org/');
      expect(parser.options.format).toBe('text/turtle');
      expect(parser.options.blankNodePrefix).toBe('_:');
    });

    test('should accept custom options', () => {
      const customParser = new TurtleParser({
        baseIRI: 'https://custom.org/',
        format: 'application/n-triples',
        blankNodePrefix: '_:custom'
      });
      
      expect(customParser.options.baseIRI).toBe('https://custom.org/');
      expect(customParser.options.format).toBe('application/n-triples');
      expect(customParser.options.blankNodePrefix).toBe('_:custom');
    });
  });

  describe('Basic Turtle Parsing', () => {
    test('should parse simple turtle triple', async () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate "object" .
      `;

      const result = await parser.parse(turtle);
      
      expect(result).toHaveProperty('triples');
      expect(result).toHaveProperty('prefixes');
      expect(result).toHaveProperty('stats');
      expect(result.triples).toHaveLength(1);
      
      const triple = result.triples[0];
      expect(triple.subject.value).toBe('http://example.org/subject');
      expect(triple.predicate.value).toBe('http://example.org/predicate');
      expect(triple.object.value).toBe('object');
      expect(triple.object.type).toBe('literal');
    });

    test('should parse multiple triples', async () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:person1 foaf:name "John Doe" ;
                   foaf:age 30 ;
                   foaf:knows ex:person2 .
        
        ex:person2 foaf:name "Jane Smith" .
      `;

      const result = await parser.parse(turtle);
      
      expect(result.triples.length).toBeGreaterThan(1);
      expect(result.prefixes).toHaveProperty('ex');
      expect(result.prefixes).toHaveProperty('foaf');
      expect(result.stats.tripleCount).toBeGreaterThan(1);
      expect(result.stats.subjectCount).toBe(2);
    });

    test('should handle different data types', async () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:entity ex:stringProp "text value" ;
                  ex:intProp 42 ;
                  ex:floatProp 3.14 ;
                  ex:boolProp true ;
                  ex:dateProp "2023-01-01"^^xsd:date .
      `;

      const result = await parser.parse(turtle);
      
      expect(result.triples).toHaveLength(5);
      
      // Find specific triples by predicate
      const intTriple = result.triples.find(t => t.predicate.value.endsWith('intProp'));
      const boolTriple = result.triples.find(t => t.predicate.value.endsWith('boolProp'));
      
      expect(intTriple).toBeDefined();
      expect(intTriple.object.value).toBe('42');
      expect(boolTriple).toBeDefined();
      expect(boolTriple.object.value).toBe('true');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty input', async () => {
      const result = await parser.parse('');
      expect(result.triples).toHaveLength(0);
      expect(result.prefixes).toEqual({});
      expect(result.stats.tripleCount).toBe(0);
    });

    test('should handle whitespace-only input', async () => {
      const result = await parser.parse('   \n\t   \n  ');
      expect(result.triples).toHaveLength(0);
    });

    test('should throw error for invalid input type', async () => {
      await expect(parser.parse(null)).rejects.toThrow(TurtleParseError);
      await expect(parser.parse(123)).rejects.toThrow(TurtleParseError);
      await expect(parser.parse({})).rejects.toThrow(TurtleParseError);
    });

    test('should handle malformed turtle with detailed error', async () => {
      const malformedTurtle = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate "unclosed string .
      `;

      await expect(parser.parse(malformedTurtle)).rejects.toThrow(TurtleParseError);
    });

    test('should handle Unicode characters', async () => {
      const unicodeTurtle = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:name "José María" ;
                   ex:description "Test with émojis 🎉 and Chinese 中文" .
      `;

      const result = await parser.parse(unicodeTurtle);
      expect(result.triples).toHaveLength(2);
      
      const nameTriple = result.triples.find(t => t.predicate.value.endsWith('name'));
      expect(nameTriple.object.value).toBe('José María');
    });

    test('should handle very large literals', async () => {
      const largeLiteral = 'x'.repeat(10000);
      const turtle = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:largeProp "${largeLiteral}" .
      `;

      const result = await parser.parse(turtle);
      expect(result.triples).toHaveLength(1);
      expect(result.triples[0].object.value).toBe(largeLiteral);
    });

    test('should handle blank nodes', async () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        
        _:blank1 ex:prop "value1" .
        _:blank2 ex:prop "value2" .
        ex:subject ex:related _:blank1, _:blank2 .
      `;

      const result = await parser.parse(turtle);
      expect(result.triples.length).toBeGreaterThanOrEqual(3);
      
      const blankTriples = result.triples.filter(t => t.subject.type === 'blank');
      expect(blankTriples.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Statistics', () => {
    test('should provide accurate statistics', async () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:person1 foaf:name "John" ; foaf:age 30 .
        ex:person2 foaf:name "Jane" ; foaf:age 25 .
        ex:person3 foaf:name "Bob" ; foaf:age 35 .
      `;

      const result = await parser.parse(turtle);
      
      expect(result.stats).toHaveProperty('tripleCount');
      expect(result.stats).toHaveProperty('prefixCount');
      expect(result.stats).toHaveProperty('subjectCount');
      expect(result.stats).toHaveProperty('predicateCount');
      expect(result.stats).toHaveProperty('parseTime');
      
      expect(result.stats.tripleCount).toBe(6);
      expect(result.stats.prefixCount).toBe(2);
      expect(result.stats.subjectCount).toBe(3);
      expect(result.stats.predicateCount).toBe(2); // foaf:name and foaf:age
      expect(result.stats.parseTime).toBeGreaterThan(0);
    });

    test('should parse large documents efficiently', async () => {
      // Generate a large turtle document
      let largeTurtle = '@prefix ex: <http://example.org/> .\n';
      for (let i = 0; i < 1000; i++) {
        largeTurtle += `ex:entity${i} ex:prop${i % 10} "value${i}" .\n`;
      }

      const timer = global.testUtils.timer();
      const result = await parser.parse(largeTurtle);
      const duration = timer.end();
      
      expect(result.triples).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should parse in under 1 second
      expect(result.stats.parseTime).toBeLessThan(1000);
    });
  });

  describe('Store Creation', () => {
    test('should create N3 store from turtle', async () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate "object" .
      `;

      const store = await parser.createStore(turtle);
      expect(store).toBeDefined();
      
      // Test that we can query the store
      const quads = store.getQuads();
      expect(quads).toHaveLength(1);
    });

    test('should handle store creation errors', async () => {
      const malformedTurtle = 'this is not valid turtle';
      
      await expect(parser.createStore(malformedTurtle))
        .rejects.toThrow(TurtleParseError);
    });
  });

  describe('Synchronous API', () => {
    test('should parse synchronously', () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate "object" .
      `;

      const result = parser.parseSync(turtle);
      
      expect(result.triples).toHaveLength(1);
      expect(result.prefixes).toHaveProperty('ex');
    });

    test('should throw synchronously for errors', () => {
      expect(() => parser.parseSync(null)).toThrow(TurtleParseError);
    });
  });
});

describe('TurtleUtils - Utility Functions', () => {
  let sampleTriples;
  
  beforeEach(() => {
    sampleTriples = [
      {
        subject: { type: 'uri', value: 'http://example.org/person1' },
        predicate: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/name' },
        object: { type: 'literal', value: 'John Doe' }
      },
      {
        subject: { type: 'uri', value: 'http://example.org/person1' },
        predicate: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/age' },
        object: { type: 'literal', value: '30', datatype: 'http://www.w3.org/2001/XMLSchema#integer' }
      },
      {
        subject: { type: 'uri', value: 'http://example.org/person2' },
        predicate: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/name' },
        object: { type: 'literal', value: 'Jane Smith' }
      }
    ];
  });

  describe('Filtering Operations', () => {
    test('should filter by subject', () => {
      const filtered = TurtleUtils.filterBySubject(sampleTriples, 'http://example.org/person1');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(t => t.subject.value === 'http://example.org/person1')).toBe(true);
    });

    test('should filter by predicate', () => {
      const filtered = TurtleUtils.filterByPredicate(sampleTriples, 'http://xmlns.com/foaf/0.1/name');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(t => t.predicate.value === 'http://xmlns.com/foaf/0.1/name')).toBe(true);
    });

    test('should filter by object', () => {
      const filtered = TurtleUtils.filterByObject(sampleTriples, 'John Doe');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].object.value).toBe('John Doe');
    });
  });

  describe('Grouping Operations', () => {
    test('should group by subject', () => {
      const grouped = TurtleUtils.groupBySubject(sampleTriples);
      expect(grouped.size).toBe(2);
      
      const person1Group = grouped.get('uri:http://example.org/person1');
      expect(person1Group).toHaveLength(2);
    });
  });

  describe('URI Operations', () => {
    const prefixes = {
      'foaf': 'http://xmlns.com/foaf/0.1/',
      'ex': 'http://example.org/'
    };

    test('should expand prefixed URIs', () => {
      const expanded = TurtleUtils.expandPrefix('foaf:name', prefixes);
      expect(expanded).toBe('http://xmlns.com/foaf/0.1/name');
    });

    test('should return original for unknown prefixes', () => {
      const result = TurtleUtils.expandPrefix('unknown:prop', prefixes);
      expect(result).toBe('unknown:prop');
    });

    test('should compact full URIs', () => {
      const compacted = TurtleUtils.compactUri('http://xmlns.com/foaf/0.1/name', prefixes);
      expect(compacted).toBe('foaf:name');
    });

    test('should return original for non-matching URIs', () => {
      const result = TurtleUtils.compactUri('http://other.org/prop', prefixes);
      expect(result).toBe('http://other.org/prop');
    });
  });

  describe('Data Type Conversion', () => {
    test('should convert integer literals', () => {
      const term = {
        type: 'literal',
        value: '42',
        datatype: 'http://www.w3.org/2001/XMLSchema#integer'
      };
      
      const converted = TurtleUtils.convertLiteralValue(term);
      expect(converted).toBe(42);
      expect(typeof converted).toBe('number');
    });

    test('should convert decimal literals', () => {
      const term = {
        type: 'literal',
        value: '3.14',
        datatype: 'http://www.w3.org/2001/XMLSchema#decimal'
      };
      
      const converted = TurtleUtils.convertLiteralValue(term);
      expect(converted).toBe(3.14);
    });

    test('should convert boolean literals', () => {
      const trueResult = TurtleUtils.convertLiteralValue({
        type: 'literal',
        value: 'true',
        datatype: 'http://www.w3.org/2001/XMLSchema#boolean'
      });
      
      const falseResult = TurtleUtils.convertLiteralValue({
        type: 'literal',
        value: 'false',
        datatype: 'http://www.w3.org/2001/XMLSchema#boolean'
      });
      
      expect(trueResult).toBe(true);
      expect(falseResult).toBe(false);
    });

    test('should convert date literals', () => {
      const term = {
        type: 'literal',
        value: '2023-01-01',
        datatype: 'http://www.w3.org/2001/XMLSchema#date'
      };
      
      const converted = TurtleUtils.convertLiteralValue(term);
      expect(converted).toBeInstanceOf(Date);
    });

    test('should return original for non-literal terms', () => {
      const term = {
        type: 'uri',
        value: 'http://example.org/entity'
      };
      
      const result = TurtleUtils.convertLiteralValue(term);
      expect(result).toBe('http://example.org/entity');
    });
  });

  describe('URI Validation', () => {
    test('should validate HTTP URLs', () => {
      expect(TurtleUtils.isValidUri('http://example.org')).toBe(true);
      expect(TurtleUtils.isValidUri('https://example.org/path')).toBe(true);
    });

    test('should validate URNs', () => {
      expect(TurtleUtils.isValidUri('urn:uuid:12345678-1234-5678-9012-123456789012')).toBe(true);
      expect(TurtleUtils.isValidUri('urn:isbn:0451450523')).toBe(true);
    });

    test('should reject invalid URIs', () => {
      expect(TurtleUtils.isValidUri('')).toBe(false);
      expect(TurtleUtils.isValidUri(null)).toBe(false);
      expect(TurtleUtils.isValidUri('not a uri')).toBe(false);
      expect(TurtleUtils.isValidUri(123)).toBe(false);
    });
  });

  describe('Subject and Predicate Extraction', () => {
    test('should extract unique subjects', () => {
      const subjects = TurtleUtils.getSubjects(sampleTriples);
      expect(subjects).toHaveLength(2);
      
      const subjectValues = subjects.map(s => s.value);
      expect(subjectValues).toContain('http://example.org/person1');
      expect(subjectValues).toContain('http://example.org/person2');
    });

    test('should extract unique predicates', () => {
      const predicates = TurtleUtils.getPredicates(sampleTriples);
      expect(predicates).toHaveLength(2);
      
      const predicateValues = predicates.map(p => p.value);
      expect(predicateValues).toContain('http://xmlns.com/foaf/0.1/name');
      expect(predicateValues).toContain('http://xmlns.com/foaf/0.1/age');
    });
  });
});

describe('Convenience Functions', () => {
  test('parseTurtle function should work', async () => {
    const turtle = `
      @prefix ex: <http://example.org/> .
      ex:subject ex:predicate "object" .
    `;

    const result = await parseTurtle(turtle);
    expect(result.triples).toHaveLength(1);
  });

  test('parseTurtleSync function should work', () => {
    const turtle = `
      @prefix ex: <http://example.org/> .
      ex:subject ex:predicate "object" .
    `;

    const result = parseTurtleSync(turtle);
    expect(result.triples).toHaveLength(1);
  });

  test('should accept options in convenience functions', async () => {
    const turtle = `<subject> <predicate> "object" .`;
    const options = { baseIRI: 'https://custom.org/' };

    const result = await parseTurtle(turtle, options);
    expect(result.triples).toHaveLength(1);
  });
});

describe('TurtleParseError', () => {
  test('should create error with message', () => {
    const error = new TurtleParseError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('TurtleParseError');
  });

  test('should create error with line and column', () => {
    const error = new TurtleParseError('Parse error', 5, 10);
    expect(error.line).toBe(5);
    expect(error.column).toBe(10);
  });

  test('should wrap original error', () => {
    const originalError = new Error('Original');
    const error = new TurtleParseError('Wrapper', 1, 1, originalError);
    expect(error.originalError).toBe(originalError);
  });
});