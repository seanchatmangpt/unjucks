/**
 * Critical JSON Entity Corruption Test
 * Tests the |dump filter for HTML entity encoding issues that corrupt JSON output
 */

import { describe, it, expect, beforeAll } from 'vitest';
import nunjucks from 'nunjucks';
import { addCommonFilters } from '../src/lib/nunjucks-filters.js';

describe('JSON Entity Corruption Critical Tests', () => {
  let env;

  beforeAll(() => {
    env = new nunjucks.Environment();
    addCommonFilters(env);
  });

  describe('HTML Entity Corruption Detection', () => {
    it('should NOT encode quotes as &quot; in JSON output', () => {
      const testObj = {
        message: "Hello World",
        nested: {
          title: "Test \"quoted\" content",
          array: ["item1", "item2"]
        }
      };
      
      const result = env.renderString(`{{ obj | dump }}`, { obj: testObj });
      
      // Should contain actual quotes, NOT &quot;
      expect(result).toContain('"Hello World"');
      expect(result).toContain('"Test \\"quoted\\" content"');
      expect(result).not.toContain('&quot;');
      
      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should NOT encode ampersands as &amp; in JSON output', () => {
      const testObj = {
        company: "Johnson & Johnson",
        url: "https://example.com?param1=value1&param2=value2",
        text: "Research & Development"
      };
      
      const result = env.renderString(`{{ obj | dump }}`, { obj: testObj });
      
      // Should contain actual ampersands, NOT &amp;
      expect(result).toContain('"Johnson & Johnson"');
      expect(result).toContain('&param2=value2');
      expect(result).not.toContain('&amp;');
      
      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should NOT encode < and > as &lt; and &gt; in JSON output', () => {
      const testObj = {
        html: "<div>Content</div>",
        comparison: "x < 5 and y > 10",
        tags: ["<script>", "</script>"]
      };
      
      const result = env.renderString(`{{ obj | dump }}`, { obj: testObj });
      
      // Should contain actual angle brackets, NOT HTML entities
      expect(result).toContain('"<div>Content</div>"');
      expect(result).toContain('"x < 5 and y > 10"');
      expect(result).not.toContain('&lt;');
      expect(result).not.toContain('&gt;');
      
      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should handle complex nested objects without entity corruption', () => {
      const testObj = {
        user: {
          name: "John \"Johnny\" Doe",
          bio: "Developer & Designer at <Company>",
          skills: ["HTML & CSS", "JavaScript", "Node.js"],
          preferences: {
            theme: "dark",
            notifications: true,
            settings: {
              autoSave: true,
              format: "JSON & XML"
            }
          }
        },
        metadata: {
          created: "2024-01-15T10:30:00Z",
          tags: ["<important>", "R&D", "Q&A"],
          description: "User profile with \"special\" characters & symbols <test>"
        }
      };
      
      const result = env.renderString(`{{ data | dump }}`, { data: testObj });
      
      // Verify no HTML entity encoding
      expect(result).not.toContain('&quot;');
      expect(result).not.toContain('&amp;');
      expect(result).not.toContain('&lt;');
      expect(result).not.toContain('&gt;');
      
      // Should be valid JSON that can be parsed
      let parsed;
      expect(() => {
        parsed = JSON.parse(result);
      }).not.toThrow();
      
      // Verify data integrity after parsing
      expect(parsed.user.name).toBe('John "Johnny" Doe');
      expect(parsed.user.bio).toBe('Developer & Designer at <Company>');
      expect(parsed.user.skills).toContain('HTML & CSS');
      expect(parsed.metadata.tags).toContain('<important>');
      expect(parsed.metadata.tags).toContain('R&D');
      expect(parsed.metadata.description).toContain('"special"');
      expect(parsed.metadata.description).toContain(' & symbols <test>');
    });
  });

  describe('JSON Export Function Tests', () => {
    it('should produce clean JSON in template variable contexts', () => {
      const config = {
        database: {
          url: "postgres://user:pass@host:5432/db?ssl=true&timeout=30",
          options: {
            maxConnections: 10,
            retryAttempts: 3
          }
        },
        features: {
          auth: true,
          cache: "Redis & Memcached",
          logging: {
            level: "info",
            format: "JSON & structured"
          }
        }
      };
      
      const template = `
        const config = {{ config | dump }};
        module.exports = config;
      `;
      
      const result = env.renderString(template, { config });
      
      // Extract the JSON part
      const jsonMatch = result.match(/const config = (.*);/s);
      expect(jsonMatch).toBeTruthy();
      
      const jsonString = jsonMatch[1].trim();
      
      // Should not contain HTML entities
      expect(jsonString).not.toContain('&quot;');
      expect(jsonString).not.toContain('&amp;');
      expect(jsonString).not.toContain('&lt;');
      expect(jsonString).not.toContain('&gt;');
      
      // Should be valid JSON
      let parsed;
      expect(() => {
        parsed = JSON.parse(jsonString);
      }).not.toThrow();
      
      // Verify data integrity
      expect(parsed.database.url).toContain('&timeout=30');
      expect(parsed.features.cache).toBe('Redis & Memcached');
      expect(parsed.features.logging.format).toBe('JSON & structured');
    });

    it('should handle arrays with special characters correctly', () => {
      const testData = {
        commands: [
          'echo "Hello World"',
          'grep -r "pattern" .',
          'sed "s/old/new/g" file.txt',
          'curl "https://api.com/endpoint?param=value&other=data"'
        ],
        patterns: [
          '<script>alert("xss")</script>',
          '${user.name} & ${user.email}',
          'if (x > 5 && y < 10) { return true; }'
        ]
      };
      
      const result = env.renderString(`{{ data | dump }}`, { data: testData });
      
      // Should not contain HTML entities
      expect(result).not.toContain('&quot;');
      expect(result).not.toContain('&amp;');
      expect(result).not.toContain('&lt;');
      expect(result).not.toContain('&gt;');
      
      // Should be valid JSON
      let parsed;
      expect(() => {
        parsed = JSON.parse(result);
      }).not.toThrow();
      
      // Verify array data integrity
      expect(parsed.commands[0]).toBe('echo "Hello World"');
      expect(parsed.commands[3]).toContain('&other=data');
      expect(parsed.patterns[0]).toBe('<script>alert("xss")</script>');
      expect(parsed.patterns[1]).toBe('${user.name} & ${user.email}');
      expect(parsed.patterns[2]).toContain('x > 5 && y < 10');
    });
  });

  describe('Edge Cases and Performance', () => {
    it('should handle circular references without crashing', () => {
      const circular = { name: 'test' };
      circular.self = circular;
      
      const result = env.renderString(`{{ obj | dump }}`, { obj: circular });
      
      // Should handle circular references gracefully
      expect(result).toContain('[Circular Reference]');
      expect(result).not.toContain('&quot;');
      
      // Should be valid JSON (with circular reference marker)
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should handle special Unicode characters correctly', () => {
      const testObj = {
        unicode: "Café résumé naïve façade",
        symbols: "→ ← ↑ ↓ ✓ ✗ ★ ♥",
        math: "∑∏∫∂∇√∞≈≠≤≥",
        quotes: ""Hello" 'World' «Bonjour» ‹test›"
      };
      
      const result = env.renderString(`{{ obj | dump }}`, { obj: testObj });
      
      // Should preserve Unicode without entity encoding
      expect(result).toContain('"Café résumé naïve façade"');
      expect(result).toContain('"→ ← ↑ ↓ ✓ ✗ ★ ♥"');
      expect(result).not.toContain('&quot;');
      
      // Should be valid JSON
      let parsed;
      expect(() => {
        parsed = JSON.parse(result);
      }).not.toThrow();
      
      // Verify Unicode preservation
      expect(parsed.unicode).toBe("Café résumé naïve façade");
      expect(parsed.quotes).toBe(""Hello" 'World' «Bonjour» ‹test›");
    });

    it('should maintain performance with large objects', () => {
      const largeObj = {
        users: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          bio: `Developer & Designer #${i} working on <projects>`,
          tags: [`tag${i}`, `"special"`, `R&D`]
        }))
      };
      
      const start = Date.now();
      const result = env.renderString(`{{ data | dump }}`, { data: largeObj });
      const end = Date.now();
      
      // Should complete quickly (under 100ms for 100 records)
      expect(end - start).toBeLessThan(100);
      
      // Should not contain HTML entities
      expect(result).not.toContain('&quot;');
      expect(result).not.toContain('&amp;');
      expect(result).not.toContain('&lt;');
      expect(result).not.toContain('&gt;');
      
      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe('Cross-Filter Compatibility', () => {
    it('should work correctly when chained with other filters', () => {
      const testData = {
        config: {
          database: "postgres://user:pass@host/db?ssl=true&retry=3",
          features: ["auth & sessions", "cache <redis>", "logging"]
        }
      };
      
      // Test chaining with other filters
      const template = `
        Config: {{ data | dump }}
        Formatted: {{ (data | dump) | length }}
      `;
      
      const result = env.renderString(template, { data: testData });
      
      // The dumped JSON should not contain entities
      expect(result).not.toContain('&quot;');
      expect(result).not.toContain('&amp;');
      expect(result).not.toContain('&lt;');
      expect(result).not.toContain('&gt;');
      
      // Should still work with length filter
      expect(result).toContain('Formatted:');
    });

    it('should handle mixed content correctly in templates', () => {
      const data = {
        html: '<div class="container">Content</div>',
        config: {
          url: "https://api.com/v1/data?format=json&encode=utf8",
          timeout: 5000
        }
      };
      
      const template = `
        <script>
          const config = {{ data.config | dump }};
          const htmlContent = {{ data.html | dump }};
        </script>
      `;
      
      const result = env.renderString(template, { data });
      
      // JSON content should not be entity-encoded
      expect(result).toContain('"url": "https://api.com/v1/data?format=json&encode=utf8"');
      expect(result).toContain('"<div class=\\"container\\">Content</div>"');
      
      // Should not contain HTML entities in JSON parts
      const jsonMatches = result.match(/= ({.*?});/gs);
      if (jsonMatches) {
        for (const match of jsonMatches) {
          expect(match).not.toContain('&quot;');
          expect(match).not.toContain('&amp;');
          expect(match).not.toContain('&lt;');
          expect(match).not.toContain('&gt;');
        }
      }
    });
  });
});