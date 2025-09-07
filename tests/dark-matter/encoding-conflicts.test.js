import { describe, it, expect, beforeEach } from 'vitest';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { SemanticTemplateProcessor } from '../../src/lib/semantic-template-processor.js';

/**
 * DARK MATTER VALIDATION: Encoding Conflicts and Character Set Issues
 * 
 * Tests the critical encoding edge cases that cause data corruption, parsing failures,
 * and security vulnerabilities in semantic web applications. Character encoding issues
 * are responsible for numerous production failures and data integrity problems.
 */
describe('Dark Matter: Encoding Conflicts', () => {
  let parser;
  let processor;

  beforeEach(() => {
    parser = new TurtleParser({ baseIRI: 'http://example.org/' });
    processor = new SemanticTemplateProcessor();
  });

  describe('UTF-8 Encoding Edge Cases', () => {
    it('should handle byte order mark (BOM) correctly', async () => {
      // UTF-8 BOM (\uFEFF) at start of content
      const contentWithBOM = '\uFEFF@prefix ex: <http://example.org/> .\nex:resource ex:property "value" .';
      const contentWithoutBOM = '@prefix ex: <http://example.org/> .\nex:resource ex:property "value" .';

      const resultWithBOM = await parser.parse(contentWithBOM);
      const resultWithoutBOM = await parser.parse(contentWithoutBOM);

      // Both should parse identically
      expect(resultWithBOM.triples.length).toBe(resultWithoutBOM.triples.length);
      expect(resultWithBOM.triples[0].subject.value).toBe(resultWithoutBOM.triples[0].subject.value);
      expect(resultWithBOM.stats.tripleCount).toBe(1);
    });

    it('should handle different UTF-8 byte sequence lengths', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        # 1-byte UTF-8 sequences (ASCII)
        ex:ascii ex:text "Hello World" .
        
        # 2-byte UTF-8 sequences (Latin extended)
        ex:latin ex:text "Café münü" .
        
        # 3-byte UTF-8 sequences (most Unicode)
        ex:unicode ex:text "こんにちは 测试 ₹₩€" .
        
        # 4-byte UTF-8 sequences (emoji and rare characters)
        ex:emoji ex:text "🚀🎉🌟 𝓤𝓷𝓲𝓬𝓸𝓭𝓮" .
        
        # Mixed sequences in single literal
        ex:mixed ex:text "ASCII-café-测试-🚀-𝓤" .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(5);

      // Verify all text is preserved correctly
      const textValues = result.triples.map(t => t.object.value);
      expect(textValues).toContain('Hello World');
      expect(textValues).toContain('Café münü');
      expect(textValues).toContain('こんにちは 测试 ₹₩€');
      expect(textValues).toContain('🚀🎉🌟 𝓤𝓷𝓲𝓬𝓸𝓭𝓮');
      expect(textValues).toContain('ASCII-café-测试-🚀-𝓤');
    });

    it('should handle malformed UTF-8 sequences gracefully', async () => {
      // These would be invalid UTF-8 in raw bytes, but JavaScript strings handle them
      const content = `
        @prefix ex: <http://example.org/> .
        
        # Replacement character for invalid sequences
        ex:invalid ex:text "Valid \uFFFD Invalid" .
        
        # Unpaired surrogates (invalid in UTF-8)
        ex:surrogate ex:text "High\uD800 Low\uDC00" .
        
        # Overlong sequences are normalized in JavaScript
        ex:normalized ex:text "Test \u0000 null" .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(3);

      // Should handle gracefully without crashing
      const values = result.triples.map(t => t.object.value);
      expect(values.some(v => v.includes('\uFFFD'))).toBe(true); // Replacement character
      expect(values.some(v => v.includes('\uD800'))).toBe(true); // Unpaired surrogate
    });

    it('should preserve UTF-8 normalization forms correctly', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        # NFC (Canonical Composition) - é as single character
        ex:nfc ex:text "café" .
        
        # NFD (Canonical Decomposition) - é as e + combining accent
        ex:nfd ex:text "cafe\u0301" .
        
        # NFKC (Compatibility Composition)
        ex:nfkc ex:text "ﬁle" .  # ﬁ ligature
        
        # NFKD (Compatibility Decomposition)  
        ex:nfkd ex:text "file" .
        
        # Mixed normalization in one literal
        ex:mixed ex:text "café cafe\u0301 ﬁle file" .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(5);

      const textValues = result.triples.map(t => t.object.value);
      
      // These should be different byte-wise but may render similarly
      expect(textValues[0]).toBe('café'); // NFC
      expect(textValues[1]).toBe('cafe\u0301'); // NFD
      expect(textValues[0]).not.toBe(textValues[1]); // Different normalization forms
      
      // Verify ligature handling
      expect(textValues[2]).toBe('ﬁle'); // With ligature
      expect(textValues[3]).toBe('file'); // Without ligature
    });
  });

  describe('URI Encoding and Percent-Encoding', () => {
    it('should handle percent-encoded URIs correctly', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        # Percent-encoded non-ASCII characters
        <http://example.org/%E6%B5%8B%E8%AF%95> ex:name "测试"@zh .
        <http://example.org/caf%C3%A9> ex:name "café"@fr .
        <http://example.org/%F0%9F%9A%80> ex:name "rocket"@en .
        
        # Percent-encoded reserved characters
        <http://example.org/path%2Fto%2Fresource> ex:type "Resource" .
        <http://example.org/query%3Fkey%3Dvalue> ex:type "Query" .
        <http://example.org/fragment%23section> ex:type "Fragment" .
        
        # Mixed encoded and unencoded
        <http://example.org/测试%20mixed%2Fcafé> ex:type "Mixed" .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(7);

      const subjects = result.triples.map(t => t.subject.value);
      
      // Verify percent-encoded URIs are preserved
      expect(subjects.some(s => s.includes('%E6%B5%8B%E8%AF%95'))).toBe(true); // 测试
      expect(subjects.some(s => s.includes('%C3%A9'))).toBe(true); // é
      expect(subjects.some(s => s.includes('%F0%9F%9A%80'))).toBe(true); // 🚀
      expect(subjects.some(s => s.includes('%2F'))).toBe(true); // /
      expect(subjects.some(s => s.includes('%3F'))).toBe(true); // ?
      expect(subjects.some(s => s.includes('%23'))).toBe(true); // #
    });

    it('should handle invalid percent-encoding gracefully', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        # Invalid percent sequences
        <http://example.org/invalid%> ex:type "InvalidPercent" .
        <http://example.org/invalid%G0> ex:type "InvalidHex" .
        <http://example.org/incomplete%2> ex:type "Incomplete" .
        <http://example.org/double%%20encoded> ex:type "DoublePercent" .
        
        # Valid sequences for comparison
        <http://example.org/valid%20space> ex:type "ValidSpace" .
      `;

      try {
        const result = await parser.parse(content);
        
        // Should handle invalid encoding gracefully
        expect(result.triples.length).toBeGreaterThan(0);
        
        const subjects = result.triples.map(t => t.subject.value);
        
        // Invalid sequences might be preserved as-is or normalized
        expect(subjects.length).toBeGreaterThan(0);
        
      } catch (error) {
        // Acceptable to reject invalid percent-encoding
        expect(error.message).toContain('URI');
      }
    });

    it('should handle URI encoding conflicts between schemes', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        # HTTP URLs with encoding
        <http://example.org/path%20with%20spaces> ex:scheme "http" .
        
        # HTTPS URLs (same encoding rules)
        <https://secure.example.org/path%20with%20spaces> ex:scheme "https" .
        
        # FTP URLs (different encoding requirements)
        <ftp://ftp.example.org/path%20with%20spaces> ex:scheme "ftp" .
        
        # File URLs (platform-dependent encoding)
        <file:///path%20to%20file> ex:scheme "file" .
        
        # URN with encoding
        <urn:isbn:978%2D0%2D123456%2D78%2D9> ex:scheme "urn" .
        
        # Data URLs with encoding
        <data:text/plain;charset=utf-8,Hello%20World> ex:scheme "data" .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(6);

      const schemes = result.triples.map(t => t.object.value);
      expect(schemes).toEqual(['http', 'https', 'ftp', 'file', 'urn', 'data']);

      // Verify different URI schemes are handled consistently
      const subjects = result.triples.map(t => t.subject.value);
      expect(subjects.every(s => s.includes('%20'))).toBe(true); // All should have encoded spaces
    });
  });

  describe('Template Processing with Encoding', () => {
    it('should handle encoding in template variables', async () => {
      const variables = {
        // UTF-8 content
        chinese: '测试用户',
        arabic: 'مستخدم اختبار',
        emoji: '👤 User 🚀',
        
        // URL-encoded content
        encodedPath: 'path%20with%20spaces',
        encodedQuery: 'key%3Dvalue%26other%3Ddata',
        
        // HTML entities (should not be decoded in RDF context)
        htmlEntities: '&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;',
        
        // Base64 encoded content
        base64: Buffer.from('Hello World').toString('base64'),
        
        // Mixed encoding
        mixed: 'café%20测试%20🚀'
      };

      const template = `
        @prefix ex: <http://example.org/> .
        
        ex:user ex:chineseName "{{ chinese }}" ;
          ex:arabicName "{{ arabic }}" ;
          ex:emojiName "{{ emoji }}" ;
          ex:encodedPath <http://example.org/{{ encodedPath }}> ;
          ex:encodedQuery "{{ encodedQuery }}" ;
          ex:htmlEntities "{{ htmlEntities | turtleEscape }}" ;
          ex:base64Data "{{ base64 }}" ;
          ex:mixedEncoding "{{ mixed }}" .
      `;

      const result = await processor.render(template, variables);
      expect(result.content).toBeDefined();

      // Parse the rendered content to verify correctness
      const parseResult = await parser.parse(result.content);
      expect(parseResult.triples.length).toBe(8);

      // Verify encoding preservation
      expect(result.content).toContain('测试用户');
      expect(result.content).toContain('مستخدم اختبار');
      expect(result.content).toContain('👤 User 🚀');
      expect(result.content).toContain('path%20with%20spaces');
      expect(result.content).toContain('SGVsbG8gV29ybGQ='); // Base64
    });

    it('should prevent encoding-based injection attacks', async () => {
      const maliciousVariables = {
        // URL-encoded injection attempt
        urlInjection: 'normal%22%20.%20ex:injected%20%22true',
        
        // HTML entity injection
        htmlInjection: 'normal&quot; . ex:injected &quot;true',
        
        // Unicode escape injection
        unicodeInjection: 'normal\\u0022 . ex:injected \\u0022true',
        
        // Base64 injection
        base64Injection: Buffer.from('" . ex:injected "true').toString('base64'),
        
        // Mixed encoding injection
        mixedInjection: 'normal%22%20.%20ex%3Ainjected%20%22true&quot;'
      };

      const template = `
        @prefix ex: <http://example.org/> .
        
        ex:test1 ex:value "{{ urlInjection | turtleEscape }}" ;
          ex:value2 "{{ htmlInjection | turtleEscape }}" ;
          ex:value3 "{{ unicodeInjection | turtleEscape }}" ;
          ex:value4 "{{ base64Injection }}" ;
          ex:value5 "{{ mixedInjection | turtleEscape }}" .
      `;

      const result = await processor.render(template, maliciousVariables);
      
      // Should prevent injection through encoding
      expect(result.content).not.toContain('ex:injected "true"');
      expect(result.content).not.toContain('ex:injected &quot;true');
      
      // Should properly escape dangerous characters
      expect(result.content).toContain('\\"'); // Escaped quotes
      
      // Verify the content is still valid Turtle
      const parseResult = await parser.parse(result.content);
      expect(parseResult.triples.length).toBe(5); // Only intended triples
    });

    it('should handle encoding conversion between character sets', async () => {
      const variables = {
        // Latin-1 compatible characters
        latin1: 'café münü résumé',
        
        // Characters outside Latin-1 range
        extended: 'café 测试 مرحبا 🚀',
        
        // Windows-1252 specific characters
        windows1252: 'Smart "quotes" and €uro',
        
        // ISO-8859-1 characters
        iso88591: 'Déjà vu café résumé'
      };

      const template = `
        @prefix ex: <http://example.org/> .
        
        ex:text ex:latin1 "{{ latin1 }}" ;
          ex:extended "{{ extended }}" ;
          ex:windows "{{ windows1252 }}" ;
          ex:iso "{{ iso88591 }}" .
      `;

      const result = await processor.render(template, variables);
      
      // All content should be properly encoded as UTF-8 in output
      expect(result.content).toContain('café münü résumé');
      expect(result.content).toContain('测试 مرحبا 🚀');
      expect(result.content).toContain('"quotes"');
      expect(result.content).toContain('€uro');
      
      // Verify parsability
      const parseResult = await parser.parse(result.content);
      expect(parseResult.triples.length).toBe(4);
    });
  });

  describe('Line Ending and Whitespace Encoding', () => {
    it('should handle different line ending formats', async () => {
      // Test different line ending styles
      const contentLF = '@prefix ex: <http://example.org/> .\nex:resource ex:property "value" .';
      const contentCRLF = '@prefix ex: <http://example.org/> .\r\nex:resource ex:property "value" .';
      const contentCR = '@prefix ex: <http://example.org/> .\rex:resource ex:property "value" .';
      const contentMixed = '@prefix ex: <http://example.org/> .\r\nex:res1 ex:prop "val1" .\nex:res2 ex:prop "val2" .';

      const results = await Promise.all([
        parser.parse(contentLF),
        parser.parse(contentCRLF),
        parser.parse(contentCR),
        parser.parse(contentMixed)
      ]);

      // All should parse successfully
      results.forEach(result => {
        expect(result.triples.length).toBeGreaterThan(0);
      });

      // LF and CRLF should produce identical results
      expect(results[0].triples.length).toBe(results[1].triples.length);
      expect(results[0].triples[0].subject.value).toBe(results[1].triples[0].subject.value);

      // Mixed line endings should work
      expect(results[3].triples.length).toBe(2);
    });

    it('should handle Unicode whitespace characters', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        # Various Unicode whitespace characters
        ex:spaces ex:regular "normal spaces" ;
          ex:tab "tab\tseparated" ;
          ex:nonBreaking "non\u00A0breaking\u00A0space" ;
          ex:enSpace "en\u2002space" ;
          ex:emSpace "em\u2003space" ;
          ex:thinSpace "thin\u2009space" ;
          ex:zeroWidth "zero\u200Bwidth\u200Cspace" ;
          ex:ideographic "ideo\u3000graphic" .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(8);

      // Verify different whitespace types are preserved
      const values = result.triples.map(t => t.object.value);
      expect(values.some(v => v.includes('\t'))).toBe(true); // Tab
      expect(values.some(v => v.includes('\u00A0'))).toBe(true); // Non-breaking space
      expect(values.some(v => v.includes('\u2002'))).toBe(true); // En space
      expect(values.some(v => v.includes('\u2003'))).toBe(true); // Em space
      expect(values.some(v => v.includes('\u2009'))).toBe(true); // Thin space
      expect(values.some(v => v.includes('\u200B'))).toBe(true); // Zero-width space
      expect(values.some(v => v.includes('\u3000'))).toBe(true); // Ideographic space
    });

    it('should handle whitespace in multiline literals', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        ex:multiline ex:text """
        Line 1 with spaces   
        	Line 2 with tab
        Line 3 with\u00A0non-breaking space
        
        Line 5 after empty line
        """ .
        
        ex:singleQuote ex:text '''
        Single quote multiline
        with\ttabs\tand   spaces
        ''' .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(2);

      const textValues = result.triples.map(t => t.object.value);
      
      // Multiline content should preserve whitespace
      expect(textValues[0]).toContain('\n');
      expect(textValues[0]).toContain('\t');
      expect(textValues[0]).toContain('\u00A0');
      expect(textValues[0]).toContain('   '); // Multiple spaces
      
      expect(textValues[1]).toContain('\n');
      expect(textValues[1]).toContain('\t');
    });
  });

  describe('Binary Data and Base64 Encoding', () => {
    it('should handle base64 encoded binary data in literals', async () => {
      const binaryData = {
        image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', // 1x1 PNG
        text: Buffer.from('Hello, World! 🌍').toString('base64'),
        binary: Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD]).toString('base64'),
        empty: Buffer.from('').toString('base64'),
        large: Buffer.from('x'.repeat(10000)).toString('base64')
      };

      const template = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:data ex:image "{{ image }}"^^xsd:base64Binary ;
          ex:text "{{ text }}"^^xsd:base64Binary ;
          ex:binary "{{ binary }}"^^xsd:base64Binary ;
          ex:empty "{{ empty }}"^^xsd:base64Binary ;
          ex:large "{{ large }}"^^xsd:base64Binary .
      `;

      const result = await processor.render(template, binaryData);
      
      // Verify base64 content is preserved
      expect(result.content).toContain('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAY');
      expect(result.content).toContain('^^xsd:base64Binary');
      
      const parseResult = await parser.parse(result.content);
      expect(parseResult.triples.length).toBe(5);

      // Verify data type annotations
      const base64Triples = parseResult.triples.filter(t => 
        t.object.datatype && t.object.datatype.includes('base64Binary')
      );
      expect(base64Triples.length).toBe(5);
    });

    it('should detect and handle invalid base64 data', async () => {
      const invalidBase64 = {
        invalidChars: 'Hello@World!', // Contains invalid base64 characters
        wrongPadding: 'SGVsbG8gV29ybGQ', // Missing padding
        extraPadding: 'SGVsbG8gV29ybGQ===', // Too much padding
        mixedCase: 'sgvsbg8gv29ybgq=', // Lowercase (technically valid but unusual)
        withWhitespace: 'SGVs bG8g V29y bGQ=', // Embedded whitespace
        withNewlines: 'SGVsbG8g\nV29ybGQ=', // Embedded newlines
      };

      const template = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:data ex:invalid "{{ invalidChars }}"^^xsd:base64Binary ;
          ex:padding "{{ wrongPadding }}"^^xsd:base64Binary ;
          ex:extra "{{ extraPadding }}"^^xsd:base64Binary ;
          ex:case "{{ mixedCase }}"^^xsd:base64Binary ;
          ex:whitespace "{{ withWhitespace }}"^^xsd:base64Binary ;
          ex:newlines "{{ withNewlines }}"^^xsd:base64Binary .
      `;

      const result = await processor.render(template, invalidBase64);
      
      // Should handle invalid base64 gracefully (not validate/decode during templating)
      expect(result.content).toBeDefined();
      
      const parseResult = await parser.parse(result.content);
      expect(parseResult.triples.length).toBe(6);
      
      // Values should be preserved as-is for later validation
      const base64Values = parseResult.triples.map(t => t.object.value);
      expect(base64Values).toContain('Hello@World!');
      expect(base64Values).toContain('SGVsbG8gV29ybGQ');
    });
  });

  describe('Locale and Cultural Encoding Issues', () => {
    it('should handle text direction and cultural formatting', async () => {
      const culturalContent = {
        hebrew: 'שלום עולם', // RTL text
        arabic: 'مرحبا بالعالم', // RTL text
        mixed: 'Hello שלום مرحبا World', // Mixed LTR/RTL
        numbers: '١٢٣٤٥٦٧٨٩٠', // Arabic-Indic digits
        persian: '۱۲۳۴۵۶۷۸۹۰', // Persian digits
        currency: '₹₩€$¥£', // Various currency symbols
        dates: '2023/12/31 vs 31/12/2023', // Different date formats
      };

      const template = `
        @prefix ex: <http://example.org/> .
        
        ex:text ex:hebrew "{{ hebrew }}"@he ;
          ex:arabic "{{ arabic }}"@ar ;
          ex:mixed "{{ mixed }}" ;
          ex:numbers "{{ numbers }}"@ar ;
          ex:persian "{{ persian }}"@fa ;
          ex:currency "{{ currency }}" ;
          ex:dates "{{ dates }}" .
      `;

      const result = await processor.render(template, culturalContent);
      
      // Verify cultural content is preserved
      expect(result.content).toContain('שלום עולם');
      expect(result.content).toContain('مرحبا بالعالم');
      expect(result.content).toContain('١٢٣٤٥٦٧٨٩٠');
      expect(result.content).toContain('۱۲۳۴۵۶۷۸۹۰');
      expect(result.content).toContain('₹₩€$¥£');
      
      // Verify language tags are preserved
      expect(result.content).toContain('"@he');
      expect(result.content).toContain('"@ar');
      expect(result.content).toContain('"@fa');
      
      const parseResult = await parser.parse(result.content);
      expect(parseResult.triples.length).toBe(7);
      
      // Verify language tags are parsed correctly
      const languageTriples = parseResult.triples.filter(t => t.object.language);
      expect(languageTriples.length).toBe(3);
      expect(languageTriples.map(t => t.object.language)).toEqual(['he', 'ar', 'fa']);
    });

    it('should handle collation and sorting edge cases', async () => {
      const sortingContent = {
        // Different ways to represent the same logical character
        a_acute1: 'á', // Single character
        a_acute2: 'a\u0301', // Combining character
        
        // Case variations
        german: 'Müller vs MÜLLER vs müller',
        turkish: 'İstanbul vs ISTANBUL vs istanbul', // Turkish I problem
        
        // Ligatures and special forms
        ligatures: 'ﬁle vs file vs ﬀ vs ff',
        
        // Different apostrophes
        apostrophes: "don't vs don't vs don`t", // Different apostrophe characters
      };

      const template = `
        @prefix ex: <http://example.org/> .
        
        ex:test ex:acute1 "{{ a_acute1 }}" ;
          ex:acute2 "{{ a_acute2 }}" ;
          ex:german "{{ german }}" ;
          ex:turkish "{{ turkish }}" ;
          ex:ligatures "{{ ligatures }}" ;
          ex:apostrophes "{{ apostrophes }}" .
      `;

      const result = await processor.render(template, sortingContent);
      
      // Verify different representations are preserved
      expect(result.content).toContain('á'); // NFC form
      expect(result.content).toContain('a\u0301'); // NFD form
      expect(result.content).toContain('İstanbul'); // Turkish capital I
      expect(result.content).toContain('ﬁle'); // Ligature fi
      expect(result.content).toContain("don't"); // Straight apostrophe
      expect(result.content).toContain("don't"); // Curly apostrophe
      
      const parseResult = await parser.parse(result.content);
      expect(parseResult.triples.length).toBe(6);
    });
  });

  describe('Performance with Different Encodings', () => {
    it('should handle large texts with various encodings efficiently', async () => {
      const largeTexts = {
        ascii: 'A'.repeat(50000),
        latin1: 'é'.repeat(50000),
        unicode: '测'.repeat(50000),
        emoji: '🚀'.repeat(10000), // 4-byte sequences
        mixed: ('A' + 'é' + '测' + '🚀').repeat(10000)
      };

      const template = `
        @prefix ex: <http://example.org/> .
        
        ex:large ex:ascii "{{ ascii }}" ;
          ex:latin1 "{{ latin1 }}" ;
          ex:unicode "{{ unicode }}" ;
          ex:emoji "{{ emoji }}" ;
          ex:mixed "{{ mixed }}" .
      `;

      const beforeMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();
      
      const result = await processor.render(template, largeTexts);
      
      const renderTime = performance.now();
      const parseResult = await parser.parse(result.content);
      const endTime = performance.now();
      const afterMemory = process.memoryUsage().heapUsed;
      
      expect(parseResult.triples.length).toBe(5);
      expect(renderTime - startTime).toBeLessThan(10000); // Under 10 seconds to render
      expect(endTime - renderTime).toBeLessThan(20000); // Under 20 seconds to parse
      expect(afterMemory - beforeMemory).toBeLessThan(200 * 1024 * 1024); // Under 200MB
      
      // Verify content preservation
      expect(result.content.length).toBeGreaterThan(500000); // Should be substantial
      expect(result.content).toContain('AAAAAAA'); // ASCII content
      expect(result.content).toContain('éééééé'); // Latin content  
      expect(result.content).toContain('测测测测'); // Unicode content
      expect(result.content).toContain('🚀🚀🚀'); // Emoji content
    });
  });
});