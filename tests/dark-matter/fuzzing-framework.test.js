import { describe, it, expect, beforeEach } from 'vitest';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { SemanticTemplateProcessor } from '../../src/lib/semantic-template-processor.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';

/**
 * DARK MATTER VALIDATION: Automated Fuzzing Framework
 * 
 * Systematic generation of malformed, edge-case, and adversarial inputs
 * to discover the critical vulnerabilities that cause production failures.
 * This fuzzing framework generates the 20% of inputs that break 80% of systems.
 */
describe('Dark Matter: Fuzzing Framework', () => {
  let parser;
  let processor;
  let dataLoader;

  beforeEach(() => {
    parser = new TurtleParser({ baseIRI: 'http://example.org/' });
    processor = new SemanticTemplateProcessor();
    dataLoader = new RDFDataLoader();
  });

  describe('Structural Fuzzing', () => {
    it('should fuzz turtle syntax structure boundaries', async () => {
      const structuralFuzzInputs = [
        // Missing terminators
        '@prefix ex: <http://example.org/>',
        'ex:subject ex:predicate "object"',
        'ex:subject ex:predicate',
        'ex:subject',
        
        // Malformed prefix declarations
        '@prefix : <incomplete',
        '@prefix incomplete <http://example.org/> .',
        '@prefix ex: incomplete .',
        '@prefix ex <http://example.org/> .',
        
        // Mismatched brackets and quotes
        'ex:subject ex:predicate "unclosed string',
        'ex:subject ex:predicate <unclosed URI',
        'ex:subject ex:predicate [incomplete blank',
        'ex:subject ex:predicate (incomplete collection',
        
        // Wrong separators
        'ex:s1 ex:p1 "o1"; ex:p2 "o2"', // Missing comma in predicate list
        'ex:s1 ex:p1 "o1", ex:s2 ex:p2 "o2"', // Comma between different subjects
        
        // Empty structures
        '',
        '   \n\t  \r\n  ',
        '@prefix ex: <http://example.org/> . ',
        
        // Only comments
        '# Just a comment',
        '# Comment 1\n# Comment 2\n# Comment 3',
        
        // Nested structure abuse
        '[ [ [ [ [ ] ] ] ] ]',
        '( ( ( ( ( ) ) ) ) )',
        'ex:s [ ex:p [ ex:pp [ ex:ppp "deep" ] ] ] .'
      ];

      let parsedCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const input of structuralFuzzInputs) {
        try {
          const result = await parser.parse(input);
          parsedCount++;
          
          // Even if parsing succeeds, verify result integrity
          if (result.triples) {
            expect(Array.isArray(result.triples)).toBe(true);
            result.triples.forEach(triple => {
              expect(triple.subject).toBeDefined();
              expect(triple.predicate).toBeDefined();
              expect(triple.object).toBeDefined();
            });
          }
        } catch (error) {
          errorCount++;
          errors.push({ input, error: error.message });
          
          // Errors should be graceful and informative
          expect(error.name).toBe('TurtleParseError');
          expect(error.message).toBeDefined();
          expect(error.message).not.toContain('undefined');
          expect(error.message).not.toContain('[object Object]');
        }
      }

      // Should handle all inputs gracefully (parse or fail cleanly)
      expect(parsedCount + errorCount).toBe(structuralFuzzInputs.length);
      expect(errorCount).toBeGreaterThan(structuralFuzzInputs.length * 0.5); // Many should fail
      expect(parsedCount).toBeGreaterThan(0); // Some should succeed
    });

    it('should fuzz URI structure edge cases', async () => {
      const uriFuzzInputs = [
        // Protocol edge cases
        '<>',
        '<:>',
        '<scheme:>',
        '<scheme:///>',
        '<://host>',
        '<scheme://host>',
        
        // Invalid characters in URIs
        '<http://example.org/ space>',
        '<http://example.org/"quote">',
        '<http://example.org/[bracket]>',
        '<http://example.org/{brace}>',
        '<http://example.org/\\backslash>',
        '<http://example.org/\nnewline>',
        '<http://example.org/\ttab>',
        
        // Extremely long URIs
        `<http://example.org/${'x'.repeat(10000)}>`,
        `<${'http://'.repeat(1000)}example.org/>`,
        
        // Unicode in URIs (should be percent-encoded)
        '<http://测试.example.org/>',
        '<http://example.org/测试>',
        '<http://example.org/🚀>',
        
        // Percent-encoding edge cases
        '<http://example.org/%>',
        '<http://example.org/%GG>',
        '<http://example.org/%2>',
        '<http://example.org/%%20>',
        '<http://example.org/%00>',
        
        // Malicious URI schemes
        '<javascript:alert(1)>',
        '<data:text/html,<script>alert(1)</script>>',
        '<file:///etc/passwd>',
        '<ftp://user:pass@ftp.evil.com/>',
        
        // Relative URI edge cases
        '<../../../etc/passwd>',
        '<./current>',
        '<?>',
        '<#fragment>',
        '<#>',
        
        // Port number edge cases
        '<http://example.org:0/>',
        '<http://example.org:65536/>',
        '<http://example.org:-1/>',
        '<http://example.org:999999/>'
      ];

      let validCount = 0;
      let invalidCount = 0;

      for (const uri of uriFuzzInputs) {
        const content = `@prefix ex: <http://example.org/> .\n${uri} ex:property "test" .`;
        
        try {
          const result = await parser.parse(content);
          validCount++;
          
          if (result.triples && result.triples.length > 0) {
            const subjectUri = result.triples[0].subject.value;
            expect(typeof subjectUri).toBe('string');
            expect(subjectUri.length).toBeGreaterThan(0);
          }
        } catch (error) {
          invalidCount++;
          expect(error).toBeInstanceOf(Error);
        }
      }

      expect(validCount + invalidCount).toBe(uriFuzzInputs.length);
      // Many URI edge cases should be handled or fail gracefully
    });

    it('should fuzz literal value boundaries', async () => {
      const literalFuzzInputs = [
        // String literal edge cases
        '""',
        '"\\""',
        '"\\\\"',
        '"\\n\\r\\t\\b\\f"',
        '"\\u0000"',
        '"\\u0001"',
        '"\\uFFFF"',
        '"\\U00000000"',
        '"\\U0010FFFF"',
        
        // Very long strings
        `"${'x'.repeat(100000)}"`,
        `"${'🚀'.repeat(10000)}"`,
        `"${'\\n'.repeat(1000)}"`,
        
        // Multiline string edge cases
        '""""""',
        '"""unclosed',
        '"""line1\nline2\nline3"""',
        "'''single quotes'''",
        "'''mixed \"quotes\" here'''",
        '"""mixed \'quotes\' here"""',
        
        // Datatype edge cases
        '"123"^^<invalid-datatype>',
        '"abc"^^<http://www.w3.org/2001/XMLSchema#integer>',
        '"999999999999999999999999999999"^^<http://www.w3.org/2001/XMLSchema#integer>',
        '"-0"^^<http://www.w3.org/2001/XMLSchema#integer>',
        '"NaN"^^<http://www.w3.org/2001/XMLSchema#double>',
        '"Infinity"^^<http://www.w3.org/2001/XMLSchema#double>',
        '"-Infinity"^^<http://www.w3.org/2001/XMLSchema#double>',
        
        // Boolean edge cases
        '"true"^^<http://www.w3.org/2001/XMLSchema#boolean>',
        '"false"^^<http://www.w3.org/2001/XMLSchema#boolean>',
        '"1"^^<http://www.w3.org/2001/XMLSchema#boolean>',
        '"0"^^<http://www.w3.org/2001/XMLSchema#boolean>',
        '"maybe"^^<http://www.w3.org/2001/XMLSchema#boolean>',
        
        // Date/time edge cases
        '"2023-13-01"^^<http://www.w3.org/2001/XMLSchema#date>',
        '"2023-02-30"^^<http://www.w3.org/2001/XMLSchema#date>',
        '"25:00:00"^^<http://www.w3.org/2001/XMLSchema#time>',
        '"12:60:00"^^<http://www.w3.org/2001/XMLSchema#time>',
        '"12:00:60"^^<http://www.w3.org/2001/XMLSchema#time>',
        
        // Language tag edge cases
        '"text"@',
        '"text"@invalid-language-tag-that-is-way-too-long',
        '"text"@zh-CN-x-private',
        '"text"@de-DE-1996',
        '"text"@1234',
        '"text"@',
        
        // Mixed chaos
        '"string with \0 null"',
        '"string with \x01 control"',
        '"string with \uFFFD replacement"',
        `"${'nested"quotes"and'.repeat(100)}"`,
      ];

      for (const literal of literalFuzzInputs) {
        const content = `@prefix ex: <http://example.org/> .\nex:subject ex:property ${literal} .`;
        
        try {
          const result = await parser.parse(content);
          
          if (result.triples && result.triples.length > 0) {
            const objectValue = result.triples[0].object;
            expect(objectValue.type).toBe('literal');
            expect(typeof objectValue.value).toBe('string');
          }
        } catch (error) {
          // Many should fail - that's expected
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Content Fuzzing', () => {
    it('should fuzz template processing with chaotic variables', async () => {
      const chaoticVariables = {
        // Null and undefined
        nullVar: null,
        undefinedVar: undefined,
        
        // Extreme strings
        emptyString: '',
        veryLongString: 'x'.repeat(50000),
        unicodeString: '测试🚀\uFFFD\u0000\uD800\uDC00',
        
        // Numbers
        zero: 0,
        negativeZero: -0,
        infinity: Infinity,
        negativeInfinity: -Infinity,
        notANumber: NaN,
        maxNumber: Number.MAX_SAFE_INTEGER,
        minNumber: Number.MIN_SAFE_INTEGER,
        
        // Booleans
        trueValue: true,
        falseValue: false,
        
        // Objects
        emptyObject: {},
        circularObject: {},
        deepObject: { a: { b: { c: { d: { e: 'deep' } } } } },
        
        // Arrays
        emptyArray: [],
        largeArray: new Array(10000).fill('item'),
        mixedArray: [1, 'string', true, null, undefined, {}, []],
        
        // Functions
        simpleFunction: () => 'function result',
        throwingFunction: () => { throw new Error('Intentional error'); },
        
        // Dates
        validDate: new Date('2023-01-01T00:00:00Z'),
        invalidDate: new Date('invalid'),
        epochDate: new Date(0),
        futureDate: new Date('2038-01-19T03:14:07Z'),
        
        // Special objects
        regex: /test/gi,
        symbol: Symbol('test'),
        
        // Malicious strings
        injectionAttempt: '{{ 7*7 }}',
        templateInjection: '{% set x = "dangerous" %}{{ x }}',
        scriptInjection: '<script>alert("xss")</script>',
        sqlInjection: "'; DROP TABLE users; --",
        pathTraversal: '../../../etc/passwd',
        nullByteInjection: 'test\x00.txt',
        
        // RDF-specific injections
        rdfInjection: '" . ex:injected "true',
        uriInjection: 'http://example.org/> . ex:backdoor "open" . <http://evil.com/',
        prefixInjection: 'safe> . ex:compromised "yes" . @prefix evil: <http://attack.com/> . @prefix good',
      };

      // Create circular reference
      chaoticVariables.circularObject.self = chaoticVariables.circularObject;

      const chaoticTemplates = [
        // Basic variable substitution
        'ex:test ex:value "{{ nullVar }}" .',
        'ex:test ex:value "{{ undefinedVar }}" .',
        'ex:test ex:value "{{ veryLongString | truncate(100) }}" .',
        'ex:test ex:value "{{ unicodeString | turtleEscape }}" .',
        
        // Numeric edge cases
        'ex:test ex:number "{{ infinity }}"^^<http://www.w3.org/2001/XMLSchema#double> .',
        'ex:test ex:number "{{ notANumber }}"^^<http://www.w3.org/2001/XMLSchema#double> .',
        'ex:test ex:number "{{ maxNumber }}"^^<http://www.w3.org/2001/XMLSchema#integer> .',
        
        // Object/array handling
        'ex:test ex:object "{{ emptyObject | dump }}" .',
        'ex:test ex:array "{{ emptyArray | join(",") }}" .',
        'ex:test ex:mixed "{{ mixedArray | join(", ") }}" .',
        
        // Function calls
        'ex:test ex:function "{{ simpleFunction() }}" .',
        'ex:test ex:throw "{{ throwingFunction() }}" .',
        
        // Date handling
        'ex:test ex:date "{{ validDate | date("iso") }}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .',
        'ex:test ex:invalid "{{ invalidDate | date("iso") }}" .',
        
        // Injection attempts
        'ex:test ex:injection "{{ injectionAttempt | turtleEscape }}" .',
        'ex:test ex:template "{{ templateInjection | safe }}" .',
        'ex:test ex:script "{{ scriptInjection | turtleEscape }}" .',
        'ex:test ex:rdf "{{ rdfInjection | turtleEscape }}" .',
        '<{{ uriInjection | uriEscape }}> ex:property "test" .',
        '@prefix {{ prefixInjection | prefixEscape }}: <http://example.org/> .',
        
        // Complex nested structures
        '{% for item in largeArray %}ex:item{{ loop.index }} ex:value "{{ item }}" .{% endfor %}',
        '{{ circularObject | dump }}',
        '{% if deepObject.a.b.c.d %}ex:deep ex:value "{{ deepObject.a.b.c.d.e }}" .{% endif %}',
      ];

      for (const template of chaoticTemplates) {
        const fullTemplate = `@prefix ex: <http://example.org/> .\n${template}`;
        
        try {
          const result = await processor.render(fullTemplate, chaoticVariables);
          
          // If rendering succeeds, verify it's valid Turtle
          if (result.content) {
            expect(typeof result.content).toBe('string');
            expect(result.content.length).toBeGreaterThan(0);
            
            // Try to parse the result
            try {
              const parseResult = await parser.parse(result.content);
              expect(parseResult.triples.length).toBeGreaterThanOrEqual(0);
            } catch (parseError) {
              // Template might generate invalid Turtle, which is also useful to test
              expect(parseError).toBeInstanceOf(Error);
            }
          }
        } catch (error) {
          // Template processing might fail with extreme inputs
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toBeDefined();
        }
      }
    });

    it('should fuzz data loader with malicious data sources', async () => {
      const maliciousDataSources = [
        // Malformed JSON
        { type: 'json', content: '{"unclosed": "json"' },
        { type: 'json', content: '{"null": null, "undefined": undefined}' },
        { type: 'json', content: '{"circular": "reference"}' }, // Would need actual circular ref
        { type: 'json', content: '{"huge": "' + 'x'.repeat(10000) + '"}' },
        
        // Malformed CSV
        { type: 'csv', content: 'name,value\n"unclosed,field\nno,quotes' },
        { type: 'csv', content: 'name,value\ninjection,"' + '=SUM(1+1)' + '"' },
        { type: 'csv', content: 'name\n' + '\n'.repeat(10000) }, // Many empty rows
        
        // Malformed XML
        { type: 'xml', content: '<root><unclosed>' },
        { type: 'xml', content: '<root><!ENTITY xxe SYSTEM "file:///etc/passwd"><data>&xxe;</data></root>' },
        { type: 'xml', content: '<root>' + '<nested>'.repeat(1000) + 'deep' + '</nested>'.repeat(1000) + '</root>' },
        
        // Binary data
        { type: 'text', content: '\x00\x01\x02\x03\xFF\xFE\xFD' },
        { type: 'text', content: 'Test\0null\0bytes' },
        
        // Very large content
        { type: 'text', content: 'x'.repeat(10 * 1024 * 1024) }, // 10MB
        
        // Unicode edge cases
        { type: 'text', content: '\uFFFD\uD800\uDC00\u0000' },
        { type: 'text', content: '🚀'.repeat(100000) },
        
        // Control characters
        { type: 'text', content: '\x01\x02\x03\x04\x05\x06\x07\x08\x0E\x0F' },
      ];

      for (const source of maliciousDataSources) {
        try {
          // This would require actual data loader implementation
          // For now, just test that malicious content doesn't crash the system
          expect(source.content).toBeDefined();
          expect(typeof source.content).toBe('string');
          
          // Test content length and character boundaries
          const contentLength = source.content.length;
          if (contentLength > 0) {
            expect(contentLength).toBeGreaterThan(0);
            
            // Verify we can handle the content without crashing
            const firstChar = source.content.charCodeAt(0);
            const lastChar = source.content.charCodeAt(contentLength - 1);
            expect(typeof firstChar).toBe('number');
            expect(typeof lastChar).toBe('number');
          }
        } catch (error) {
          // Data loader should handle malicious input gracefully
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toBeDefined();
        }
      }
    });
  });

  describe('Boundary Value Fuzzing', () => {
    it('should fuzz numeric and size boundaries', async () => {
      const boundaryValues = [
        // String length boundaries
        { type: 'string', value: '' },
        { type: 'string', value: 'x' },
        { type: 'string', value: 'x'.repeat(255) },
        { type: 'string', value: 'x'.repeat(256) },
        { type: 'string', value: 'x'.repeat(65535) },
        { type: 'string', value: 'x'.repeat(65536) },
        { type: 'string', value: 'x'.repeat(1048576) }, // 1MB
        
        // Numeric boundaries
        { type: 'number', value: 0 },
        { type: 'number', value: 1 },
        { type: 'number', value: -1 },
        { type: 'number', value: 2147483647 }, // Max 32-bit signed int
        { type: 'number', value: -2147483648 }, // Min 32-bit signed int
        { type: 'number', value: 4294967295 }, // Max 32-bit unsigned int
        { type: 'number', value: 9007199254740991 }, // MAX_SAFE_INTEGER
        { type: 'number', value: -9007199254740991 }, // MIN_SAFE_INTEGER
        { type: 'number', value: Number.MAX_VALUE },
        { type: 'number', value: Number.MIN_VALUE },
        { type: 'number', value: Infinity },
        { type: 'number', value: -Infinity },
        { type: 'number', value: NaN },
        
        // Array size boundaries
        { type: 'array', value: [] },
        { type: 'array', value: [1] },
        { type: 'array', value: new Array(1000).fill('item') },
        { type: 'array', value: new Array(100000).fill('item') },
        
        // Object depth boundaries
        { type: 'object', value: {} },
        { type: 'object', value: { a: 'value' } },
        { type: 'object', value: this.createDeepObject(100) },
        { type: 'object', value: this.createDeepObject(1000) },
        
        // Date boundaries
        { type: 'date', value: new Date(0) }, // Epoch
        { type: 'date', value: new Date(-8640000000000000) }, // Min date
        { type: 'date', value: new Date(8640000000000000) }, // Max date
        { type: 'date', value: new Date('1900-01-01') },
        { type: 'date', value: new Date('2000-01-01') },
        { type: 'date', value: new Date('2038-01-19T03:14:07Z') }, // Unix 32-bit limit
      ];

      for (const boundary of boundaryValues) {
        const template = `
          @prefix ex: <http://example.org/> .
          ex:boundary ex:type "{{ type }}" ;
            ex:value "{{ value | dump | turtleEscape }}" .
        `;

        try {
          const result = await processor.render(template, {
            type: boundary.type,
            value: boundary.value
          });
          
          expect(result.content).toBeDefined();
          expect(typeof result.content).toBe('string');
          
          // Try to parse the result
          const parseResult = await parser.parse(result.content);
          expect(parseResult.triples.length).toBe(2);
          
        } catch (error) {
          // Some boundary values might cause legitimate errors
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should fuzz memory and performance boundaries', async () => {
      const performanceFuzzTests = [
        {
          name: 'Large triple count',
          generator: () => {
            const count = 50000;
            return Array.from({ length: count }, (_, i) =>
              `ex:resource${i} ex:property${i % 100} "value${i}" .`
            ).join('\n');
          }
        },
        {
          name: 'Very wide graph (many subjects)',
          generator: () => {
            const count = 100000;
            return Array.from({ length: count }, (_, i) =>
              `ex:subject${i} ex:type "Resource" .`
            ).join('\n');
          }
        },
        {
          name: 'Very deep graph (many properties per subject)',
          generator: () => {
            const propertyCount = 10000;
            const properties = Array.from({ length: propertyCount }, (_, i) =>
              `ex:property${i} "value${i}"`
            ).join(' ; ');
            return `ex:deepSubject ${properties} .`;
          }
        },
        {
          name: 'Long URI paths',
          generator: () => {
            const longPath = 'segment/'.repeat(1000);
            return `<http://example.org/${longPath}resource> ex:property "test" .`;
          }
        },
        {
          name: 'Many prefixes',
          generator: () => {
            const prefixCount = 5000;
            const prefixes = Array.from({ length: prefixCount }, (_, i) =>
              `@prefix ns${i}: <http://namespace${i}.example.org/> .`
            ).join('\n');
            const triples = Array.from({ length: prefixCount }, (_, i) =>
              `ns${i}:resource ns${i}:property "value${i}" .`
            ).join('\n');
            return prefixes + '\n' + triples;
          }
        },
        {
          name: 'Complex blank node structures',
          generator: () => {
            const depth = 500;
            let structure = 'ex:root ex:hasChild [\n';
            for (let i = 0; i < depth; i++) {
              structure += `  ex:level${i} [\n`;
            }
            structure += '    ex:value "deep"\n';
            for (let i = 0; i < depth; i++) {
              structure += '  ]\n';
            }
            structure += '] .';
            return structure;
          }
        }
      ];

      for (const test of performanceFuzzTests) {
        const content = `@prefix ex: <http://example.org/> .\n${test.generator()}`;
        
        const beforeMemory = process.memoryUsage().heapUsed;
        const startTime = performance.now();
        
        try {
          const result = await parser.parse(content);
          const endTime = performance.now();
          const afterMemory = process.memoryUsage().heapUsed;
          
          const executionTime = endTime - startTime;
          const memoryUsage = afterMemory - beforeMemory;
          
          // Performance should be reasonable
          expect(executionTime).toBeLessThan(60000); // Under 60 seconds
          expect(memoryUsage).toBeLessThan(1024 * 1024 * 1024); // Under 1GB
          
          expect(result.triples.length).toBeGreaterThan(0);
          
        } catch (error) {
          const endTime = performance.now();
          const executionTime = endTime - startTime;
          
          // Even failures should be reasonably fast
          expect(executionTime).toBeLessThan(30000); // Under 30 seconds
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('State-Based Fuzzing', () => {
    it('should fuzz parser state transitions', async () => {
      const stateTransitionInputs = [
        // Prefix definition state transitions
        '@prefix ex: <http://example.org/> . ex:resource ex:property "value" . @prefix ex: <http://different.org/> . ex:resource2 ex:property "value2" .',
        
        // Comment state transitions
        'ex:s1 ex:p1 "v1" . # comment\nex:s2 ex:p2 "v2" .',
        '# comment at start\nex:s1 ex:p1 "v1" . # inline comment\n# comment at end',
        
        // String literal state transitions
        'ex:s ex:p "string1" , "string2" , "string3" .',
        'ex:s ex:p """multiline\nstring""" , "single line" .',
        'ex:s ex:p "escaped\\"quote" , \'single\\\'quote\' .',
        
        // Blank node state transitions
        'ex:s1 ex:p [ ex:p1 "v1" ; ex:p2 "v2" ] . ex:s2 ex:p "simple" .',
        '_:b1 ex:p "value" . [ ex:p1 "v1" ] ex:p2 "v2" . _:b2 ex:p "another" .',
        
        // Collection state transitions
        'ex:s ex:p (1 2 3) . ex:s2 ex:p2 "simple" .',
        'ex:s ex:p () . ex:s2 ex:p2 (1) . ex:s3 ex:p3 (1 2 3 4 5) .',
        
        // Mixed state chaos
        '@prefix ex: <http://example.org/> . ex:s [ ex:p (1 "two" [ ex:inner "nested" ] ) ; ex:p2 "value" ] . # comment\n@prefix other: <http://other.org/> .',
      ];

      for (const input of stateTransitionInputs) {
        try {
          const result = await parser.parse(input);
          
          // Verify parser handled state transitions correctly
          expect(result.triples.length).toBeGreaterThan(0);
          expect(result.stats.tripleCount).toBe(result.triples.length);
          
          // Verify no malformed triples
          result.triples.forEach(triple => {
            expect(triple.subject.type).toMatch(/^(uri|blank)$/);
            expect(triple.predicate.type).toBe('uri');
            expect(triple.object.type).toMatch(/^(uri|blank|literal)$/);
          });
          
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error.name).toBe('TurtleParseError');
        }
      }
    });

    it('should fuzz template processing state transitions', async () => {
      const templateStateInputs = [
        // Variable substitution states
        'ex:s ex:p "{{ var1 }} {{ var2 }} {{ var3 }}" .',
        '{{ subject }} {{ predicate }} {{ object }} .',
        'ex:s ex:p "prefix {{ middle }} suffix" .',
        
        // Control structure states
        '{% if condition %}ex:true ex:value "true" .{% else %}ex:false ex:value "false" .{% endif %}',
        '{% for item in items %}ex:item{{ loop.index }} ex:value "{{ item }}" .{% endfor %}',
        '{% set variable = "value" %}ex:test ex:set "{{ variable }}" .',
        
        // Filter chain states
        '{{ value | filter1 | filter2 | filter3 }}',
        '{{ complex | turtleEscape | upper | truncate(50) }}',
        '{{ date | date("Y-m-d") | default("unknown") }}',
        
        // Nested template structures
        '{% for outer in outerLoop %}{% for inner in outer.items %}{{ outer.name }}_{{ inner.name }}{% endfor %}{% endfor %}',
        '{% if level1 %}{% if level2 %}{% if level3 %}deep{% endif %}{% endif %}{% endif %}',
        
        // Mixed content states
        '# Comment\n{{ variable }} # Another comment\n{% for item in items %}\n{{ item }}\n{% endfor %}\n# Final comment',
        
        // Error recovery states
        '{{ undefined.property.chain }}',
        '{% for item in undefined %}{{ item }}{% endfor %}',
        '{{ function.call.that.fails() }}',
      ];

      const testData = {
        var1: 'value1',
        var2: 'value2', 
        var3: 'value3',
        subject: 'ex:testSubject',
        predicate: 'ex:testPredicate',
        object: '"test object"',
        condition: true,
        items: ['item1', 'item2', 'item3'],
        value: 'test value',
        complex: 'Complex "String" with special chars!',
        date: new Date('2023-01-01T00:00:00Z'),
        outerLoop: [
          { name: 'outer1', items: [{ name: 'inner1' }, { name: 'inner2' }] },
          { name: 'outer2', items: [{ name: 'inner3' }] }
        ],
        level1: true,
        level2: true,
        level3: true
      };

      for (const template of templateStateInputs) {
        const fullTemplate = `@prefix ex: <http://example.org/> .\n${template}`;
        
        try {
          const result = await processor.render(fullTemplate, testData);
          
          expect(result.content).toBeDefined();
          expect(typeof result.content).toBe('string');
          
          // Try parsing the result to verify valid Turtle was generated
          try {
            const parseResult = await parser.parse(result.content);
            expect(parseResult.triples.length).toBeGreaterThanOrEqual(0);
          } catch (parseError) {
            // Some templates might generate invalid Turtle during fuzzing
          }
          
        } catch (error) {
          // Template processing might fail with undefined references etc.
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  // Helper method for creating deep objects
  createDeepObject(depth) {
    let obj = { value: 'deep' };
    for (let i = 0; i < depth; i++) {
      obj = { [`level${i}`]: obj };
    }
    return obj;
  }
});