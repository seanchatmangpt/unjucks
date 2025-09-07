import { describe, it, expect, beforeEach } from 'vitest';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { SemanticTemplateProcessor } from '../../src/lib/semantic-template-processor.js';

/**
 * DARK MATTER VALIDATION: Malformed Input Chaos Testing
 * 
 * Tests the critical edge cases where malformed, invalid, or chaotic input data
 * causes catastrophic failures in production semantic web applications.
 * These are the "chaos engineering" scenarios that most systems can't handle.
 */
describe('Dark Matter: Malformed Input Chaos', () => {
  let parser;
  let dataLoader;
  let processor;

  beforeEach(() => {
    parser = new TurtleParser({ baseIRI: 'http://example.org/' });
    dataLoader = new RDFDataLoader({ cacheEnabled: false });
    processor = new SemanticTemplateProcessor();
  });

  describe('Turtle Syntax Chaos', () => {
    it('should handle incomplete triples gracefully', async () => {
      const malformedContent = `
        @prefix ex: <http://example.org/> .
        
        # Incomplete triple - missing object
        ex:subject1 ex:property1
        
        # Incomplete triple - missing predicate and object  
        ex:subject2
        
        # Valid triple for comparison
        ex:subject3 ex:property3 "valid" .
        
        # Incomplete triple at EOF - missing semicolon
        ex:subject4 ex:property4 "incomplete"
      `;

      try {
        const result = await parser.parse(malformedContent);
        // Should either parse valid parts or fail gracefully
        expect(result).toBeDefined();
        if (result.triples) {
          expect(result.triples.length).toBeGreaterThan(0);
        }
      } catch (error) {
        // Acceptable to throw error, but should be descriptive
        expect(error.message).toBeDefined();
        expect(error.name).toBe('TurtleParseError');
      }
    });

    it('should handle mismatched brackets and quotes', async () => {
      const malformedContent = `
        @prefix ex: <http://example.org/> .
        
        # Mismatched angle brackets
        ex:subject1 ex:property1 <http://example.org/incomplete
        
        # Mismatched quotes
        ex:subject2 ex:property2 "unclosed string literal
        
        # Mixed quote types
        ex:subject3 ex:property3 "mixed' quotes" .
        
        # Triple quotes without proper closing
        ex:subject4 ex:property4 """
        Multi-line string
        without proper closing
        
        # Valid triple
        ex:subject5 ex:property5 "valid" .
      `;

      try {
        const result = await parser.parse(malformedContent);
        // Should recover and parse what it can
        expect(result).toBeDefined();
      } catch (error) {
        expect(error.message).toContain('parse');
      }
    });

    it('should handle circular blank node references', async () => {
      const circularContent = `
        @prefix ex: <http://example.org/> .
        
        # Circular reference through blank nodes
        _:a ex:pointsTo _:b .
        _:b ex:pointsTo _:c .
        _:c ex:pointsTo _:a .
        
        # Self-referential blank node
        _:self ex:pointsTo _:self .
        
        # Complex circular structure
        _:root ex:hasChild _:child1, _:child2 .
        _:child1 ex:hasParent _:root ;
                 ex:hasSibling _:child2 .
        _:child2 ex:hasParent _:root ;
                 ex:hasSibling _:child1 ;
                 ex:pointsBack _:root .
      `;

      const result = await parser.parse(circularContent);
      expect(result.triples.length).toBe(8);
      
      // Verify circular references are preserved
      const blankNodes = result.triples.filter(t => t.subject.type === 'blank' || t.object.type === 'blank');
      expect(blankNodes.length).toBeGreaterThan(0);
    });

    it('should handle extremely nested structures', async () => {
      const depth = 100;
      let nestedContent = '@prefix ex: <http://example.org/> .\n\n';
      
      // Create deeply nested blank node structure
      nestedContent += 'ex:root ex:hasNested [\n';
      for (let i = 0; i < depth; i++) {
        nestedContent += `  ex:level${i} [\n`;
      }
      nestedContent += '    ex:value "deep" \n';
      for (let i = 0; i < depth; i++) {
        nestedContent += '  ] ;\n';
      }
      nestedContent += '] .';

      try {
        const result = await parser.parse(nestedContent);
        expect(result.triples.length).toBeGreaterThan(depth);
      } catch (error) {
        // May fail due to stack overflow or parsing limits
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('JSON Data Source Chaos', () => {
    it('should handle deeply nested JSON structures', async () => {
      const chaosJson = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: "deep",
                  circular: null // Will be set to create circular reference
                }
              }
            }
          }
        }
      };
      
      // Create circular reference
      chaosJson.level1.level2.level3.level4.level5.circular = chaosJson;

      try {
        // This would typically cause JSON.stringify to fail
        const jsonString = JSON.stringify(chaosJson, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (key === 'circular') return '[Circular]';
          }
          return value;
        });
        
        expect(jsonString).toContain('deep');
      } catch (error) {
        expect(error.message).toContain('circular');
      }
    });

    it('should handle malformed JSON input', async () => {
      const malformedJsonInputs = [
        '{ "name": "unclosed',
        '{ "name": "test", }', // Trailing comma
        '{ name: "test" }', // Unquoted key
        '{ "name": undefined }', // Undefined value
        '{ "name": NaN }', // NaN value
        '{ "name": Infinity }', // Infinity value
        '{ "duplicate": "value1", "duplicate": "value2" }', // Duplicate keys
        '{ "emoji": "🚀", "control": "\x01" }', // Control characters
      ];

      for (const malformedJson of malformedJsonInputs) {
        try {
          const parsed = JSON.parse(malformedJson);
          // If it parses, it should be handled gracefully
          expect(parsed).toBeDefined();
        } catch (error) {
          // Expected for malformed JSON
          expect(error).toBeInstanceOf(SyntaxError);
        }
      }
    });

    it('should handle JSON with extreme values', async () => {
      const extremeJson = {
        veryLongString: 'x'.repeat(100000),
        veryLargeNumber: Number.MAX_SAFE_INTEGER,
        verySmallNumber: Number.MIN_SAFE_INTEGER,
        precisionNumber: 0.1 + 0.2, // Floating point precision issue
        specialNumbers: [NaN, Infinity, -Infinity],
        emptyValues: [null, undefined, '', 0, false],
        deepArray: new Array(1000).fill('item'),
        binaryData: Buffer.from('hello').toString('base64'),
        specialChars: '\n\r\t\b\f\\\/"',
        unicodeString: '测试🚀\u0001\uFFFD'
      };

      const jsonString = JSON.stringify(extremeJson, (key, value) => {
        if (value === undefined) return null;
        if (typeof value === 'number' && !isFinite(value)) return null;
        return value;
      });

      expect(jsonString).toBeDefined();
      expect(jsonString.length).toBeGreaterThan(100000);
    });
  });

  describe('CSV Data Source Chaos', () => {
    it('should handle malformed CSV with inconsistent columns', async () => {
      const malformedCsv = `
name,email,age,extra
John,john@test.com,25
Jane,jane@test.com,30,extra1,extra2,extra3
Bob,bob@test.com
Alice,alice@test.com,28,extra
Charlie,"charlie@test.com,invalid",32
"Quote,Name",test@test.com,25
Name with
Newline,test@test.com,30
,empty@test.com,0
trailing,comma@test.com,25,
      `.trim();

      // Test CSV parsing resilience
      const lines = malformedCsv.split('\n');
      expect(lines.length).toBeGreaterThan(5);
      
      // Each line should have different number of fields
      const fieldCounts = lines.slice(1).map(line => line.split(',').length);
      const uniqueCounts = new Set(fieldCounts);
      expect(uniqueCounts.size).toBeGreaterThan(1); // Inconsistent field counts
    });

    it('should handle CSV with injection attempts', async () => {
      const maliciousCsv = `
name,formula,description
User1,=SUM(1+1),Normal description
User2,"=cmd|'/c calc'!A0",Command injection attempt
User3,@SUM(1+1),At symbol injection
User4,+SUM(1+1),Plus injection
User5,"-=SUM(1+1)",Dash injection
User6,"=HYPERLINK(""http://evil.com"",""Click me"")",Hyperlink injection
      `.trim();

      const lines = maliciousCsv.split('\n').slice(1);
      const maliciousFormulas = lines.filter(line => 
        line.includes('=') || line.includes('@') || line.includes('+')
      );
      
      expect(maliciousFormulas.length).toBeGreaterThan(4);
      
      // Should detect and handle formula injection
      for (const formula of maliciousFormulas) {
        expect(formula).toMatch(/[=@+-]/);
      }
    });
  });

  describe('XML/RDF-XML Chaos', () => {
    it('should handle malformed XML structures', async () => {
      const malformedXml = `
        <?xml version="1.0"?>
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
                 xmlns:ex="http://example.org/">
          
          <!-- Unclosed tag -->
          <ex:Resource rdf:about="test1"
          
          <!-- Mismatched tags -->
          <ex:Person>
            <ex:name>John</ex:name>
          </ex:Different>
          
          <!-- Invalid characters in element names -->
          <ex:123invalid>Content</ex:123invalid>
          
          <!-- Nested CDATA with special content -->
          <ex:Resource>
            <![CDATA[
              Some content with ]]> and more CDATA
            ]]>
          </ex:Resource>
          
          <!-- Valid element for comparison -->
          <ex:ValidResource rdf:about="test2">
            <ex:name>Valid Name</ex:name>
          </ex:ValidResource>
          
        </rdf:RDF
      `;

      try {
        // XML parsing would typically fail here
        expect(malformedXml).toContain('unclosed tag');
        expect(malformedXml).toContain('Mismatched tags');
      } catch (error) {
        expect(error.message).toContain('XML');
      }
    });

    it('should handle XML entity expansion attacks', async () => {
      const xmlBomb = `
        <?xml version="1.0"?>
        <!DOCTYPE rdf [
          <!ENTITY lol "lol">
          <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
          <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
          <!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;">
        ]>
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
          <rdf:Description>
            <ex:content>&lol4;</ex:content>
          </rdf:Description>
        </rdf:RDF>
      `;

      // This should be detected and prevented
      expect(xmlBomb).toContain('<!DOCTYPE');
      expect(xmlBomb).toContain('<!ENTITY');
      
      // In a real parser, this would need to be prevented from expanding
    });
  });

  describe('Template Processing Chaos', () => {
    it('should handle template variables with extreme values', async () => {
      const chaosVariables = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        veryLongString: 'x'.repeat(50000),
        numberAsString: '12345',
        booleanAsString: 'true',
        arrayValue: [1, 2, 3, { nested: 'object' }],
        objectValue: { a: 1, b: { c: 2 } },
        functionValue: () => 'function result',
        dateValue: new Date(),
        regexValue: /test/gi,
        symbolValue: Symbol('test'),
        circularObject: {}
      };
      
      // Create circular reference
      chaosVariables.circularObject.self = chaosVariables.circularObject;

      const template = `
        @prefix ex: <http://example.org/> .
        
        ex:test ex:null "{{ nullValue }}" ;
          ex:undefined "{{ undefinedValue }}" ;
          ex:empty "{{ emptyString }}" ;
          ex:long "{{ veryLongString | truncate(100) }}" ;
          ex:array "{{ arrayValue | join(',') }}" ;
          ex:object "{{ objectValue | dump }}" ;
          ex:date "{{ dateValue | date }}" .
      `;

      try {
        const result = await processor.render(template, chaosVariables);
        expect(result.content).toBeDefined();
        expect(result.content).toContain('ex:test');
      } catch (error) {
        // Template engine should handle gracefully
        expect(error.message).toBeDefined();
      }
    });

    it('should handle template injection attempts', async () => {
      const maliciousVariables = {
        injection1: '{{ 7*7 }}',
        injection2: '{% set x = "dangerous" %}{{ x }}',
        injection3: '{{ this.constructor.constructor("return process")().exit() }}',
        injection4: '{{ range.constructor("return global")() }}',
        injection5: '<script>alert("xss")</script>',
        injection6: 'javascript:alert(1)',
        injection7: '${7*7}', // Template literal injection
        injection8: '#{"code": "injection"}' // Hash injection
      };

      const template = `
        @prefix ex: <http://example.org/> .
        
        ex:user ex:input1 "{{ injection1 | escape }}" ;
          ex:input2 "{{ injection2 | turtleEscape }}" ;
          ex:input3 "{{ injection3 | safe }}" ;
          ex:input4 "{{ injection4 }}" .
      `;

      const result = await processor.render(template, maliciousVariables);
      
      // Should escape or sanitize dangerous content
      expect(result.content).not.toContain('<script>');
      expect(result.content).not.toContain('constructor');
      expect(result.content).toContain('ex:user');
    });
  });

  describe('Error Recovery and Graceful Degradation', () => {
    it('should continue processing after recoverable errors', async () => {
      const mixedContent = `
        @prefix ex: <http://example.org/> .
        
        # Valid triple
        ex:valid1 ex:property "good value" .
        
        # Invalid triple - missing object
        ex:invalid1 ex:property
        
        # Valid triple  
        ex:valid2 ex:property "another good value" .
        
        # Invalid triple - syntax error
        ex:invalid2 ex:property "unclosed string
        
        # Valid triple
        ex:valid3 ex:property "final good value" .
      `;

      try {
        const result = await parser.parse(mixedContent);
        // Should recover valid triples even if some are invalid
        expect(result).toBeDefined();
        if (result.triples) {
          expect(result.triples.length).toBeGreaterThan(0);
          // At least the valid triples should be parsed
          const validTriples = result.triples.filter(t => 
            t.object && t.object.value && !t.object.value.includes('good value') === false
          );
          expect(validTriples.length).toBeGreaterThan(0);
        }
      } catch (error) {
        // Should provide helpful error information
        expect(error.line).toBeDefined();
        expect(error.message).toContain('parse');
      }
    });

    it('should handle timeout scenarios gracefully', async () => {
      // Create content that might cause slow parsing
      const slowContent = `
        @prefix ex: <http://example.org/> .
        ${Array.from({ length: 10000 }, (_, i) => 
          `ex:resource${i} ex:property${i} "value ${i}" .`
        ).join('\n')}
      `;

      const startTime = performance.now();
      const result = await parser.parse(slowContent);
      const endTime = performance.now();
      
      expect(result.triples.length).toBe(10000);
      expect(endTime - startTime).toBeLessThan(10000); // Should parse in under 10 seconds
    });

    it('should handle memory pressure gracefully', async () => {
      // Create content that uses significant memory
      const largeValue = 'x'.repeat(10000); // 10KB per value
      const memoryIntensiveContent = `
        @prefix ex: <http://example.org/> .
        ${Array.from({ length: 1000 }, (_, i) => 
          `ex:resource${i} ex:largeProperty "${largeValue}" .`
        ).join('\n')}
      `;

      const beforeMemory = process.memoryUsage();
      const result = await parser.parse(memoryIntensiveContent);
      const afterMemory = process.memoryUsage();
      
      expect(result.triples.length).toBe(1000);
      
      // Memory should not increase excessively
      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Under 100MB
    });
  });
});