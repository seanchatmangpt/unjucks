import { describe, it, expect, beforeEach } from 'vitest';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';

describe('Turtle Edge Cases and Regression Tests', () => {
  let parser: TurtleParser;
  let dataLoader: RDFDataLoader;

  beforeEach(() => {
    parser = new TurtleParser({ baseIRI: 'http://example.org/' });
    dataLoader = new RDFDataLoader({ cacheEnabled: false });
  });

  describe('URI Edge Cases', () => {
    it('should handle URIs with encoded characters', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        <http://example.org/path%20with%20spaces> ex:property "test" .
        <http://example.org/path%2Fwith%2Fslashes> ex:property "test" .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle URIs with query parameters and fragments', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        <http://example.org/resource?param=value&other=123> ex:property "test" .
        <http://example.org/resource#fragment> ex:property "test" .
        <http://example.org/resource?param=value#fragment> ex:property "test" .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle international domain names', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        <http://xn--bcher-kva.example.org/resource> ex:property "test" .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle very long URIs', async () => {
      const longPath = 'segment/'.repeat(1000);
      const content = `
        @prefix ex: <http://example.org/> .
        <http://example.org/${longPath}resource> ex:property "test" .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle edge case URI schemes', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        <urn:isbn:0451450523> ex:property "test" .
        <mailto:user@example.com> ex:property "test" .
        <tel:+1-800-555-1212> ex:property "test" .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });
  });

  describe('Literal Edge Cases', () => {
    it('should handle empty literals', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        ex:resource ex:emptyString "" ;
                   ex:emptyLang ""@en ;
                   ex:emptyTyped ""^^<http://www.w3.org/2001/XMLSchema#string> .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
      expect(result.data.resource.emptyString).toBe('');
    });

    it('should handle literals with only whitespace', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        ex:resource ex:spaces "   " ;
                   ex:tabs "\t\t\t" ;
                   ex:newlines "\n\n\n" ;
                   ex:mixed " \t\n\r " .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
      expect(result.data.resource.spaces).toBe('   ');
    });

    it('should handle edge case numeric literals', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:resource ex:zero 0 ;
                   ex:negativeZero -0 ;
                   ex:positiveInfinity "INF"^^xsd:float ;
                   ex:negativeInfinity "-INF"^^xsd:float ;
                   ex:notANumber "NaN"^^xsd:float ;
                   ex:verySmall 1.23e-100 ;
                   ex:veryLarge 1.23e100 .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
      expect(result.data.resource.zero).toBe('0');
    });

    it('should handle date/time edge cases', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:resource ex:minDate "0001-01-01"^^xsd:date ;
                   ex:maxDate "9999-12-31"^^xsd:date ;
                   ex:leapYear "2024-02-29"^^xsd:date ;
                   ex:y2k "2000-01-01T00:00:00Z"^^xsd:dateTime ;
                   ex:withTimezone "2024-01-01T12:00:00+14:00"^^xsd:dateTime .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle language tags with subtags', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        ex:resource rdfs:label "English"@en ;
                   rdfs:label "British English"@en-GB ;
                   rdfs:label "American English"@en-US ;
                   rdfs:label "Simplified Chinese"@zh-Hans ;
                   rdfs:label "Traditional Chinese"@zh-Hant-TW .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle multiline string literals', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        ex:resource ex:multiline """This is a
        multiline string
        with various
        line endings""" ;
        ex:singleQuoted '''Another
        multiline string
        with single quotes''' .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });
  });

  describe('Blank Node Edge Cases', () => {
    it('should handle complex blank node structures', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        ex:resource ex:complexBlank [
          ex:nested [
            ex:deeplyNested [
              ex:value "deep"
            ]
          ] ;
          ex:list ( "item1" "item2" "item3" ) ;
          ex:emptyList ()
        ] .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle blank nodes with circular references', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        _:b1 ex:references _:b2 .
        _:b2 ex:references _:b1 .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle shared blank nodes', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        ex:resource1 ex:sharedBlank _:shared .
        ex:resource2 ex:sharedBlank _:shared .
        _:shared ex:value "shared value" .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle blank node collections with mixed types', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:resource ex:mixedList ( 
          "string"
          42
          true
          "2024-01-01"^^xsd:date
          ex:namedResource
          []
        ) .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });
  });

  describe('Prefix Edge Cases', () => {
    it('should handle empty prefix', async () => {
      const content = `
        @prefix : <http://example.org/default#> .
        
        :resource :property "test" .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle prefix redefinition', async () => {
      const content = `
        @prefix ex: <http://example.org/v1#> .
        ex:resource ex:property "v1" .
        
        @prefix ex: <http://example.org/v2#> .
        ex:resource ex:property "v2" .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle case-sensitive prefixes', async () => {
      const content = `
        @prefix ex: <http://example.org/lower#> .
        @prefix EX: <http://example.org/upper#> .
        @prefix Ex: <http://example.org/mixed#> .
        
        ex:resource ex:property "lower" .
        EX:resource EX:property "upper" .
        Ex:resource Ex:property "mixed" .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle very long prefixes and namespace URIs', async () => {
      const longPrefix = 'a'.repeat(255);
      const longNamespace = 'http://example.org/' + 'segment/'.repeat(100);
      
      const content = `
        @prefix ${longPrefix}: <${longNamespace}#> .
        ${longPrefix}:resource ${longPrefix}:property "test" .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });
  });

  describe('Comment Edge Cases', () => {
    it('should handle comments with special characters', async () => {
      const content = `
        # This is a comment with Unicode: 中文 🌍 αβγ
        @prefix ex: <http://example.org/> .
        # Comment with @ symbols and # characters
        ex:resource ex:property "test" . # End-of-line comment
        # Comment with URIs: <http://example.org/comment>
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle very long comments', async () => {
      const longComment = '# ' + 'a'.repeat(10000);
      const content = `
        ${longComment}
        @prefix ex: <http://example.org/> .
        ex:resource ex:property "test" .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle comments at various positions', async () => {
      const content = `
        # Leading comment
        @prefix ex: <http://example.org/> . # After prefix
        # Middle comment
        ex:resource # After subject
                   ex:property # After predicate
                   "test" . # After object
        # Trailing comment
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });
  });

  describe('Variable Extraction Edge Cases', () => {
    it('should handle resources with no extractable local names', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        <http://example.org/> ex:property "root resource" .
        <http://example.org//double-slash> ex:property "double slash" .
        <http://example.org/#empty-fragment> ex:property "empty fragment" .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
      expect(result.variables.length).toBeGreaterThan(0);
    });

    it('should handle properties with identical local names from different namespaces', async () => {
      const content = `
        @prefix ex1: <http://example.org/ns1#> .
        @prefix ex2: <http://example.org/ns2#> .
        
        ex1:resource ex1:name "name from ns1" ;
                    ex2:name "name from ns2" .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle deeply nested object structures', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        ex:root ex:level1 [
          ex:level2 [
            ex:level3 [
              ex:level4 [
                ex:level5 "deep value"
              ]
            ]
          ]
        ] .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
      expect(result.variables).toContain('root');
    });

    it('should handle resources with many properties', async () => {
      const manyProperties = Array.from({ length: 1000 }, (_, i) =>
        `ex:property${i} "value${i}"`
      ).join(' ; ');

      const content = `
        @prefix ex: <http://example.org/> .
        ex:resource ${manyProperties} .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
      expect(result.variables.length).toBeGreaterThan(500);
    });
  });

  describe('Error Recovery Edge Cases', () => {
    it('should handle mixed valid and invalid statements gracefully', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        ex:valid1 ex:property "valid" .
        ex:invalid ex:property "unclosed string ;
        ex:valid2 ex:property "also valid" .
        invalid syntax without prefix
        ex:valid3 ex:property "still valid" .
      `;

      const result = await parser.parseContent(content);
      
      // Should fail gracefully but provide error information
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should handle incomplete triples at end of file', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        ex:complete ex:property "complete" .
        ex:incomplete ex:property
      `;

      const result = await parser.parseContent(content);
      expect(result).toBeDefined();
    });

    it('should handle truncated multiline strings', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        ex:resource ex:truncated """This is a multiline
        string that is not properly
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle pathological parsing patterns efficiently', async () => {
      // Pattern that might cause backtracking
      const content = `
        @prefix ex: <http://example.org/> .
        ` + Array.from({ length: 1000 }, (_, i) => 
          `ex:resource${i} ex:property "value${i}" .`
        ).join('\n');

      const startTime = Date.now();
      const result = await parser.parseContent(content);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should be reasonably fast
    });

    it('should handle wide graphs (many subjects with few properties)', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        ` + Array.from({ length: 10000 }, (_, i) => 
          `ex:subject${i} ex:property "value" .`
        ).join('\n');

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
      expect(result.quadCount).toBe(10000);
    });

    it('should handle deep graphs (few subjects with many properties)', async () => {
      const manyProperties = Array.from({ length: 1000 }, (_, i) =>
        `ex:property${i} "value${i}"`
      ).join(' ; ');

      const content = `
        @prefix ex: <http://example.org/> .
        ex:deepSubject ${manyProperties} .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
      expect(result.quadCount).toBe(1000);
    });
  });

  describe('Unicode and Internationalization', () => {
    it('should handle Right-to-Left text correctly', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        ex:resource rdfs:label "العربية"@ar ;
                   rdfs:label "עברית"@he ;
                   rdfs:label "فارسی"@fa .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle mixed text directions', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        ex:resource rdfs:label "English النص العربي English"@en .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle various Unicode normalization forms', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        ex:resource rdfs:label "café" ;  # NFC
                   rdfs:label "café" ;  # NFD (if different)
                   rdfs:label "Åpfel" . # Various A with ring above
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle zero-width characters', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        ex:resource ex:property "text\u200Bwith\u200Czero\u200Dwidth\uFEFFchars" .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });
  });

  describe('Data Type Edge Cases', () => {
    it('should handle custom datatype URIs', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        ex:resource ex:customType "custom value"^^<http://example.org/customType> ;
                   ex:unknownType "unknown"^^ex:UnknownDatatype .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle boolean edge cases', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:resource ex:true true ;
                   ex:false false ;
                   ex:stringTrue "true"^^xsd:boolean ;
                   ex:stringFalse "false"^^xsd:boolean ;
                   ex:numericTrue "1"^^xsd:boolean ;
                   ex:numericFalse "0"^^xsd:boolean .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });

    it('should handle duration and time datatypes', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:resource ex:duration "P1Y2M3DT4H5M6S"^^xsd:duration ;
                   ex:time "14:30:00"^^xsd:time ;
                   ex:gYear "2024"^^xsd:gYear ;
                   ex:gMonth "--03"^^xsd:gMonth ;
                   ex:gDay "---15"^^xsd:gDay .
      `;

      const result = await parser.parseContent(content);
      expect(result.success).toBe(true);
    });
  });
});