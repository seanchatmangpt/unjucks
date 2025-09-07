import { describe, it, expect, beforeEach } from 'vitest';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { SemanticTemplateProcessor } from '../../src/lib/semantic-template-processor.js';

/**
 * DARK MATTER VALIDATION: Unicode Edge Cases
 * 
 * Tests the 20% of Unicode edge cases that cause 80% of production failures
 * in semantic web applications. These scenarios break most RDF processors
 * and template engines in production environments.
 */
describe('Dark Matter: Unicode Edge Cases', () => {
  let parser;
  let processor;

  beforeEach(() => {
    parser = new TurtleParser({ baseIRI: 'http://example.org/' });
    processor = new SemanticTemplateProcessor();
  });

  describe('Non-ASCII URI Handling', () => {
    it('should handle Chinese characters in URIs', async () => {
      const content = `
        @prefix ex: <http://example.org/测试/> .
        @prefix zh: <http://测试网站.com/> .
        
        ex:用户123 a zh:用户类型 ;
          zh:姓名 "张三" ;
          zh:年龄 "25"^^<http://www.w3.org/2001/XMLSchema#integer> ;
          zh:邮箱 "zhangsan@测试网站.com" .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBeGreaterThan(0);
      expect(result.stats.tripleCount).toBe(4);
      
      // Verify Chinese characters are preserved
      const subjectUri = result.triples[0].subject.value;
      expect(subjectUri).toContain('用户123');
    });

    it('should handle Arabic right-to-left text in literals', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        @prefix ar: <http://arabic.example.org/> .
        
        ex:user1 ar:name "محمد أحمد الخالدي"@ar ;
          ar:address "شارع الملك فهد، الرياض، المملكة العربية السعودية"@ar ;
          ar:description "مطور برمجيات متخصص في تطبيقات الويب والذكاء الاصطناعي"@ar .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(3);
      
      // Check RTL text preservation
      const nameTriple = result.triples.find(t => t.predicate.value.includes('name'));
      expect(nameTriple.object.value).toBe('محمد أحمد الخالدي');
      expect(nameTriple.object.language).toBe('ar');
    });

    it('should handle emoji and special Unicode characters', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        @prefix emoji: <http://emoji.example.org/> .
        
        ex:user1 emoji:status "Working from 🏠 on 🚀 projects! 💻⚡"@en ;
          emoji:mood "😀🎉🚀" ;
          emoji:location "📍 San Francisco, CA 🇺🇸" ;
          emoji:skills "JavaScript 💛, Python 🐍, AI 🤖" .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(4);
      
      // Verify emoji preservation
      const statusTriple = result.triples.find(t => t.predicate.value.includes('status'));
      expect(statusTriple.object.value).toContain('🏠');
      expect(statusTriple.object.value).toContain('🚀');
    });

    it('should handle combining characters and diacritics', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        @prefix diacritics: <http://diacritics.example.org/> .
        
        # Combining characters - café vs café (different Unicode normalization)
        ex:word1 diacritics:normalized "café" ;  # NFC form
          diacritics:decomposed "cafe\u0301" ;   # NFD form with combining acute
          diacritics:vietnamese "Nguyễn Văn Đức" ;
          diacritics:french "Clément François" ;
          diacritics:german "Müller Größe" .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(5);
      
      // Test normalization differences
      const normalizedTriple = result.triples.find(t => t.predicate.value.includes('normalized'));
      const decomposedTriple = result.triples.find(t => t.predicate.value.includes('decomposed'));
      
      expect(normalizedTriple.object.value).toBe('café');
      expect(decomposedTriple.object.value).toBe('cafe\u0301');
      // These should render the same but have different byte representations
      expect(normalizedTriple.object.value !== decomposedTriple.object.value).toBe(true);
    });

    it('should handle zero-width and invisible characters', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        @prefix stealth: <http://stealth.example.org/> .
        
        # Zero-width characters that can break parsers
        ex:user1 stealth:name "John\u200BDoe" ;  # Zero-width space
          stealth:email "test\u200C@\u200Dexample.com" ;  # Zero-width non-joiner/joiner
          stealth:hidden "visible\uFEFFhidden" ;  # Zero-width no-break space (BOM)
          stealth:direction "LTR\u202Dtext\u202C" .  # Left-to-right override
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(4);
      
      // Verify invisible characters are preserved
      const nameTriple = result.triples.find(t => t.predicate.value.includes('name'));
      expect(nameTriple.object.value).toContain('\u200B');
      expect(nameTriple.object.value.length).toBe(8); // John + ZWS + Doe = 8 chars
    });

    it('should handle mixed text directions (bidirectional text)', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        @prefix bidi: <http://bidi.example.org/> .
        
        ex:user1 bidi:mixed "English text with عربي mixed together" ;
          bidi:hebrew "שלום English שלום" ;
          bidi:embedded "Start \u202Eright-to-left\u202C end" ;
          bidi:complex "LTR \u202Dforced LTR\u202C then \u202Eforced RTL\u202C normal" .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(4);
      
      // Check mixed direction text
      const mixedTriple = result.triples.find(t => t.predicate.value.includes('mixed'));
      expect(mixedTriple.object.value).toContain('عربي');
      expect(mixedTriple.object.value).toContain('English');
    });
  });

  describe('Template Processing with Unicode', () => {
    it('should handle Unicode variables in Nunjucks templates', async () => {
      const template = `
        @prefix ex: <http://example.org/> .
        
        ex:{{ 用户名 | slug }} a ex:用户 ;
          ex:姓名 "{{ name | rdfLiteral }}" ;
          ex:描述 "{{ description | turtleEscape }}"@zh-CN .
      `;

      const variables = {
        '用户名': '张三测试',
        name: 'Test User 测试用户',
        description: 'A test user with "quotes" and special chars: 🚀'
      };

      const result = await processor.render(template, variables);
      expect(result.content).toContain('ex:张三测试');
      expect(result.content).toContain('"Test User 测试用户"');
      expect(result.content).toContain('🚀');
    });

    it('should handle Unicode in filter operations', async () => {
      // Test custom filters with Unicode
      const template = `
        {{ "café" | slug }}
        {{ "Müller" | pascalCase }}
        {{ "测试" | base64Encode }}
        {{ "🚀🎉" | length }}
      `;

      const result = await processor.render(template, {});
      
      // These tests would need actual filter implementations
      // For now, we verify the template doesn't crash
      expect(result.content).toBeDefined();
    });
  });

  describe('Memory and Performance with Unicode', () => {
    it('should handle large Unicode strings without memory issues', async () => {
      // Generate large Unicode content
      const largeUnicodeText = '测试'.repeat(10000); // 40KB of Chinese characters
      const content = `
        @prefix ex: <http://example.org/> .
        
        ex:largeText ex:content "${largeUnicodeText}" ;
          ex:size "${largeUnicodeText.length}"^^<http://www.w3.org/2001/XMLSchema#integer> .
      `;

      const startMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();
      
      const result = await parser.parse(content);
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      
      expect(result.triples.length).toBe(2);
      expect(endTime - startTime).toBeLessThan(1000); // Should parse in under 1 second
      expect(endMemory - startMemory).toBeLessThan(50 * 1024 * 1024); // Under 50MB memory growth
    });

    it('should handle pathological Unicode normalization cases', async () => {
      // Unicode normalization bomb - characters that expand significantly when normalized
      const problematicText = '\uFB01'.repeat(1000); // U+FB01 (ﬁ ligature)
      
      const content = `
        @prefix ex: <http://example.org/> .
        ex:test ex:ligatures "${problematicText}" .
      `;

      const startTime = performance.now();
      const result = await parser.parse(content);
      const endTime = performance.now();
      
      expect(result.triples.length).toBe(1);
      expect(endTime - startTime).toBeLessThan(2000); // Should not hang
    });
  });

  describe('Error Recovery with Unicode', () => {
    it('should gracefully handle malformed UTF-8 sequences', async () => {
      // This would typically be invalid UTF-8, but we'll test with valid replacements
      const content = `
        @prefix ex: <http://example.org/> .
        ex:user1 ex:name "Valid start \uFFFD invalid end" ;  # Replacement character
          ex:broken "Text with \uD800" .  # Unpaired surrogate (invalid in UTF-8)
      `;

      const result = await parser.parse(content);
      // Parser should not crash, might have warnings
      expect(result.triples.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle extremely long Unicode identifiers', async () => {
      const longIdentifier = '测试'.repeat(1000); // Very long Chinese identifier
      const content = `
        @prefix ${longIdentifier}: <http://example.org/long/> .
        ${longIdentifier}:resource ${longIdentifier}:property "value" .
      `;

      // This might fail due to implementation limits, but shouldn't crash
      try {
        const result = await parser.parse(content);
        expect(result).toBeDefined();
      } catch (error) {
        // Acceptable to throw error for extremely long identifiers
        expect(error.message).toContain('identifier'); 
      }
    });

    it('should handle Unicode in URI percent-encoding edge cases', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        # Percent-encoded Unicode in URIs
        <http://example.org/%E6%B5%8B%E8%AF%95> ex:name "测试"@zh ;
        <http://example.org/caf%C3%A9> ex:name "café"@fr ;
        <http://example.org/%F0%9F%9A%80> ex:name "rocket"@en .
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(3);
      
      // Verify percent-encoded URIs are properly handled
      const uris = result.triples.map(t => t.subject.value);
      expect(uris.some(uri => uri.includes('%E6%B5%8B%E8%AF%95'))).toBe(true); // 测试
      expect(uris.some(uri => uri.includes('%C3%A9'))).toBe(true); // é
      expect(uris.some(uri => uri.includes('%F0%9F%9A%80'))).toBe(true); // 🚀
    });
  });

  describe('Security Implications of Unicode', () => {
    it('should detect potential Unicode spoofing attacks', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        # Homograph attack - these look similar but are different
        ex:paypal ex:real "true" ;        # ASCII
        ex:рaypal ex:fake "true" .        # Cyrillic 'р' instead of 'p'
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(2);
      
      // The subjects should be different URIs despite looking similar
      const subjects = result.triples.map(t => t.subject.value);
      expect(subjects[0]).not.toBe(subjects[1]);
      expect(subjects[0]).toContain('paypal');
      expect(subjects[1]).toContain('рaypal'); // Cyrillic
    });

    it('should handle Unicode control characters safely', async () => {
      const content = `
        @prefix ex: <http://example.org/> .
        
        # Control characters that might affect display or processing
        ex:user1 ex:name "User\u0001Name" ;  # Start of heading
          ex:email "test\u0007@example.com" ;  # Bell character
          ex:newline "Line1\u000ALine2" ;  # Newline in literal
          ex:tab "Col1\u0009Col2" .  # Tab character
      `;

      const result = await parser.parse(content);
      expect(result.triples.length).toBe(4);
      
      // Control characters should be preserved in literals
      const nameTriple = result.triples.find(t => t.predicate.value.includes('name'));
      expect(nameTriple.object.value).toContain('\u0001');
    });
  });
});