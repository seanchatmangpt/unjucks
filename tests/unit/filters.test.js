/**
 * Comprehensive Filter Pipeline Tests
 * 
 * Tests for all filter categories and functionality including:
 * - String manipulation filters
 * - Date/time filters  
 * - Collection filters
 * - RDF/semantic filters
 * - LaTeX/academic filters
 * - Advanced utility filters
 * - Error handling and performance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FilterPipeline, createFilterPipeline, registerFiltersWithNunjucks } from '../../src/core/filters.js';
import nunjucks from 'nunjucks';

describe('Filter Pipeline System', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = createFilterPipeline();
  });

  describe('Pipeline Infrastructure', () => {
    it('should initialize with all filter categories', () => {
      expect(pipeline.filters.size).toBeGreaterThan(60);
      expect(pipeline.categories.size).toBe(6);
      
      const expectedCategories = ['string', 'datetime', 'collection', 'rdf', 'latex', 'advanced'];
      expectedCategories.forEach(category => {
        expect(pipeline.categories.has(category)).toBe(true);
      });
    });

    it('should provide filter catalog', () => {
      const catalog = pipeline.getFilterCatalog();
      
      expect(catalog).toHaveProperty('totalFilters');
      expect(catalog).toHaveProperty('categories');
      expect(catalog).toHaveProperty('stats');
      
      expect(catalog.totalFilters).toBeGreaterThan(60);
      expect(Object.keys(catalog.categories)).toContain('string');
      expect(Object.keys(catalog.categories)).toContain('datetime');
      expect(Object.keys(catalog.categories)).toContain('collection');
    });

    it('should track performance statistics', () => {
      const stats = pipeline.getStats();
      
      expect(stats).toHaveProperty('filterCalls');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('errors');
      expect(stats).toHaveProperty('cacheSize');
    });
  });

  describe('String Filters', () => {
    describe('Case Transformation', () => {
      it('should convert to pascalCase', () => {
        const filter = pipeline.filters.get('pascalCase');
        expect(filter.fn('hello world')).toBe('HelloWorld');
        expect(filter.fn('hello-world')).toBe('HelloWorld');
        expect(filter.fn('hello_world')).toBe('HelloWorld');
        expect(filter.fn('HELLO WORLD')).toBe('HELLOWORLD');
      });

      it('should convert to camelCase', () => {
        const filter = pipeline.filters.get('camelCase');
        expect(filter.fn('hello world')).toBe('helloWorld');
        expect(filter.fn('Hello World')).toBe('helloWorld');
        expect(filter.fn('hello-world')).toBe('helloWorld');
        expect(filter.fn('hello_world')).toBe('helloWorld');
      });

      it('should convert to kebab-case', () => {
        const filter = pipeline.filters.get('kebabCase');
        expect(filter.fn('HelloWorld')).toBe('hello-world');
        expect(filter.fn('hello world')).toBe('hello-world');
        expect(filter.fn('hello_world')).toBe('hello-world');
      });

      it('should convert to snake_case', () => {
        const filter = pipeline.filters.get('snakeCase');
        expect(filter.fn('HelloWorld')).toBe('hello_world');
        expect(filter.fn('hello world')).toBe('hello_world');
        expect(filter.fn('hello-world')).toBe('hello_world');
      });

      it('should convert to CONSTANT_CASE', () => {
        const filter = pipeline.filters.get('constantCase');
        expect(filter.fn('HelloWorld')).toBe('HELLO_WORLD');
        expect(filter.fn('hello world')).toBe('HELLO_WORLD');
        expect(filter.fn('hello-world')).toBe('HELLO_WORLD');
      });

      it('should convert to Title Case', () => {
        const filter = pipeline.filters.get('titleCase');
        expect(filter.fn('hello world')).toBe('Hello World');
        expect(filter.fn('HELLO WORLD')).toBe('Hello World');
        expect(filter.fn('hELLo WoRLd')).toBe('Hello World');
      });
    });

    describe('String Manipulation', () => {
      it('should capitalize strings', () => {
        const filter = pipeline.filters.get('capitalize');
        expect(filter.fn('hello')).toBe('Hello');
        expect(filter.fn('HELLO')).toBe('HELLO');
        expect(filter.fn('')).toBe('');
      });

      it('should create slugs', () => {
        const filter = pipeline.filters.get('slug');
        expect(filter.fn('Hello World!')).toBe('hello-world');
        expect(filter.fn('  Multiple   Spaces  ')).toBe('multiple-spaces');
        expect(filter.fn('Special@#$%Characters')).toBe('specialcharacters');
      });

      it('should humanize strings', () => {
        const filter = pipeline.filters.get('humanize');
        expect(filter.fn('hello_world')).toBe('Hello World');
        expect(filter.fn('hello-world')).toBe('Hello World');
        expect(filter.fn('helloWorld')).toBe('Hello World');
      });

      it('should trim whitespace', () => {
        const filter = pipeline.filters.get('trim');
        expect(filter.fn('  hello  ')).toBe('hello');
        expect(filter.fn('\n\ttest\n\t')).toBe('test');
      });

      it('should pad strings', () => {
        const filter = pipeline.filters.get('pad');
        expect(filter.fn('test', 10)).toBe('   test   ');
        expect(filter.fn('test', 8, '0')).toBe('00test00');
      });

      it('should truncate strings', () => {
        const filter = pipeline.filters.get('truncate');
        expect(filter.fn('This is a long string', 10)).toBe('This is...');
        expect(filter.fn('Short', 10)).toBe('Short');
        expect(filter.fn('Test string', 8, '…')).toBe('Test st…');
      });

      it('should replace text', () => {
        const filter = pipeline.filters.get('replace');
        expect(filter.fn('hello world', 'world', 'universe')).toBe('hello universe');
        expect(filter.fn('test test test', 'test', 'demo')).toBe('demo demo demo');
      });

      it('should strip HTML tags', () => {
        const filter = pipeline.filters.get('stripTags');
        expect(filter.fn('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
        expect(filter.fn('<div class="test">Content</div>')).toBe('Content');
      });
    });

    describe('String Formatting', () => {
      it('should wrap strings', () => {
        const filter = pipeline.filters.get('wrap');
        expect(filter.fn('test', '[', ']')).toBe('[test]');
        expect(filter.fn('content', '<div>', '</div>')).toBe('<div>content</div>');
      });

      it('should indent strings', () => {
        const filter = pipeline.filters.get('indent');
        expect(filter.fn('line1\nline2', 4)).toBe('    line1\n    line2');
      });

      it('should escape HTML', () => {
        const filter = pipeline.filters.get('escape');
        expect(filter.fn('<script>alert("test")</script>')).toBe('&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;');
        expect(filter.fn('Tom & Jerry')).toBe('Tom &amp; Jerry');
      });

      it('should unescape HTML', () => {
        const filter = pipeline.filters.get('unescape');
        expect(filter.fn('&lt;div&gt;test&lt;/div&gt;')).toBe('<div>test</div>');
        expect(filter.fn('Tom &amp; Jerry')).toBe('Tom & Jerry');
      });

      it('should quote strings', () => {
        const filter = pipeline.filters.get('quote');
        expect(filter.fn('test')).toBe('"test"');
        expect(filter.fn('test', "'")).toBe("'test'");
      });

      it('should unquote strings', () => {
        const filter = pipeline.filters.get('unquote');
        expect(filter.fn('"test"')).toBe('test');
        expect(filter.fn("'test'")).toBe('test');
        expect(filter.fn('test')).toBe('test');
      });
    });
  });

  describe('Date & Time Filters', () => {
    const testDate = '2023-12-25T10:30:00Z';

    it('should format dates', () => {
      const filter = pipeline.filters.get('dateFormat');
      expect(filter.fn(testDate, 'YYYY-MM-DD')).toBe('2023-12-25');
      expect(filter.fn(testDate, 'MMMM Do, YYYY')).toBe('December 25th, 2023');
    });

    it('should show relative time', () => {
      const filter = pipeline.filters.get('fromNow');
      const result = filter.fn(testDate);
      expect(typeof result).toBe('string');
      expect(result).toMatch(/(ago|in)/);
    });

    it('should handle timezone conversion', () => {
      const filter = pipeline.filters.get('timezone');
      const result = filter.fn(testDate, 'America/New_York');
      expect(result).toBeDefined();
    });

    it('should add days', () => {
      const filter = pipeline.filters.get('addDays');
      const result = filter.fn(testDate, 7);
      expect(result).toContain('2024-01-01');
    });

    it('should subtract days', () => {
      const filter = pipeline.filters.get('subtractDays');
      const result = filter.fn(testDate, 5);
      expect(result).toContain('2023-12-20');
    });

    it('should get start of period', () => {
      const filter = pipeline.filters.get('startOf');
      const result = filter.fn(testDate, 'day');
      expect(result).toContain('T00:00:00');
    });

    it('should get end of period', () => {
      const filter = pipeline.filters.get('endOf');
      const result = filter.fn(testDate, 'day');
      expect(result).toContain('T23:59:59');
    });
  });

  describe('Collection Filters', () => {
    describe('Array Operations', () => {
      it('should sort arrays', () => {
        const filter = pipeline.filters.get('sort');
        expect(filter.fn([3, 1, 4, 1, 5])).toEqual([1, 1, 3, 4, 5]);
        
        const objects = [{ name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' }];
        const sorted = filter.fn(objects, 'name');
        expect(sorted.map(o => o.name)).toEqual(['Alice', 'Bob', 'Charlie']);
      });

      it('should filter arrays', () => {
        const filter = pipeline.filters.get('filter');
        const numbers = [1, 2, 3, 4, 5];
        
        // Note: This would need a predicate function in real usage
        expect(filter.fn(numbers)).toEqual(numbers.filter(Boolean));
        
        const objects = [{ active: true }, { active: false }, { active: true }];
        const filtered = filter.fn(objects, 'active');
        expect(filtered).toHaveLength(2);
      });

      it('should map arrays', () => {
        const filter = pipeline.filters.get('map');
        const objects = [{ value: 1 }, { value: 2 }, { value: 3 }];
        const mapped = filter.fn(objects, 'value');
        expect(mapped).toEqual([1, 2, 3]);
      });

      it('should get unique values', () => {
        const filter = pipeline.filters.get('unique');
        expect(filter.fn([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
        expect(filter.fn(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
      });

      it('should flatten arrays', () => {
        const filter = pipeline.filters.get('flatten');
        expect(filter.fn([[1, 2], [3, 4], [5]])).toEqual([1, 2, 3, 4, 5]);
        expect(filter.fn([[[1]], [[2]]], 2)).toEqual([1, 2]);
      });

      it('should chunk arrays', () => {
        const filter = pipeline.filters.get('chunk');
        expect(filter.fn([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        expect(filter.fn([1, 2, 3, 4, 5, 6], 3)).toEqual([[1, 2, 3], [4, 5, 6]]);
      });

      it('should zip arrays', () => {
        const filter = pipeline.filters.get('zip');
        expect(filter.fn([1, 2, 3], ['a', 'b', 'c'])).toEqual([[1, 'a'], [2, 'b'], [3, 'c']]);
        expect(filter.fn([1, 2], ['a', 'b', 'c'])).toEqual([[1, 'a'], [2, 'b']]);
      });
    });

    describe('Object Operations', () => {
      const testObject = { name: 'John', age: 30, city: 'New York' };

      it('should get object keys', () => {
        const filter = pipeline.filters.get('keys');
        expect(filter.fn(testObject)).toEqual(['name', 'age', 'city']);
      });

      it('should get object values', () => {
        const filter = pipeline.filters.get('values');
        expect(filter.fn(testObject)).toEqual(['John', 30, 'New York']);
      });

      it('should get object pairs', () => {
        const filter = pipeline.filters.get('pairs');
        expect(filter.fn(testObject)).toEqual([
          ['name', 'John'],
          ['age', 30],
          ['city', 'New York']
        ]);
      });

      it('should merge objects', () => {
        const filter = pipeline.filters.get('merge');
        const obj1 = { a: 1, b: 2 };
        const obj2 = { b: 3, c: 4 };
        expect(filter.fn(obj1, obj2)).toEqual({ a: 1, b: 3, c: 4 });
      });

      it('should pick properties', () => {
        const filter = pipeline.filters.get('pick');
        expect(filter.fn(testObject, 'name', 'age')).toEqual({ name: 'John', age: 30 });
      });

      it('should omit properties', () => {
        const filter = pipeline.filters.get('omit');
        expect(filter.fn(testObject, 'age')).toEqual({ name: 'John', city: 'New York' });
      });

      it('should group by property', () => {
        const filter = pipeline.filters.get('groupBy');
        const items = [
          { category: 'A', value: 1 },
          { category: 'B', value: 2 },
          { category: 'A', value: 3 }
        ];
        const grouped = filter.fn(items, 'category');
        expect(grouped.A).toHaveLength(2);
        expect(grouped.B).toHaveLength(1);
      });
    });

    describe('Utility Operations', () => {
      it('should get length', () => {
        const filter = pipeline.filters.get('length');
        expect(filter.fn([1, 2, 3])).toBe(3);
        expect(filter.fn('hello')).toBe(5);
        expect(filter.fn(null)).toBe(0);
      });

      it('should get first element', () => {
        const filter = pipeline.filters.get('first');
        expect(filter.fn([1, 2, 3])).toBe(1);
        expect(filter.fn([])).toBeUndefined();
      });

      it('should get last element', () => {
        const filter = pipeline.filters.get('last');
        expect(filter.fn([1, 2, 3])).toBe(3);
        expect(filter.fn([])).toBeUndefined();
      });

      it('should slice arrays', () => {
        const filter = pipeline.filters.get('slice');
        expect(filter.fn([1, 2, 3, 4, 5], 1, 4)).toEqual([2, 3, 4]);
      });

      it('should reverse arrays', () => {
        const filter = pipeline.filters.get('reverse');
        expect(filter.fn([1, 2, 3])).toEqual([3, 2, 1]);
      });

      it('should shuffle arrays', () => {
        const filter = pipeline.filters.get('shuffle');
        const original = [1, 2, 3, 4, 5];
        const shuffled = filter.fn(original);
        
        expect(shuffled).toHaveLength(5);
        expect(shuffled.sort()).toEqual(original);
        // Note: This test might occasionally fail due to randomness
      });
    });
  });

  describe('LaTeX/Academic Filters', () => {
    it('should escape LaTeX special characters', () => {
      const filter = pipeline.filters.get('texEscape');
      expect(filter.fn('Special & chars $#^_{}')).toBe('Special \\& chars \\$\\#\\textasciicircum{}\\_\\{\\}');
    });

    it('should wrap in math mode', () => {
      const filter = pipeline.filters.get('mathMode');
      expect(filter.fn('x^2 + y^2 = z^2')).toBe('$x^2 + y^2 = z^2$');
    });

    it('should format citations', () => {
      const filter = pipeline.filters.get('citation');
      const paper = {
        author: 'Smith, J.',
        year: 2023,
        title: 'Test Paper',
        journal: 'Test Journal'
      };
      
      expect(filter.fn(paper, 'apa')).toBe('Smith, J. (2023). Test Paper. Test Journal.');
      expect(filter.fn(paper, 'mla')).toBe('Smith, J. "Test Paper." Test Journal, 2023.');
    });

    it('should format bluebook citations', () => {
      const filter = pipeline.filters.get('bluebook');
      const caseRef = {
        case: 'Brown v. Board',
        citation: '347 U.S. 483',
        court: 'U.S.',
        year: 1954
      };
      
      expect(filter.fn(caseRef)).toBe('Brown v. Board, 347 U.S. 483 (U.S. 1954)');
    });

    it('should generate arXiv metadata', () => {
      const filter = pipeline.filters.get('arXivMeta');
      const result = filter.fn('2301.12345');
      
      expect(result).toHaveProperty('id', '2301.12345');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('authors');
    });

    it('should generate BibTeX entries', () => {
      const filter = pipeline.filters.get('bibEntry');
      const paper = {
        key: 'smith2023',
        author: 'Smith, J.',
        title: 'Test Paper',
        journal: 'Test Journal',
        year: 2023
      };
      
      const result = filter.fn(paper);
      expect(result).toContain('@article{smith2023');
      expect(result).toContain('title={Test Paper}');
    });

    it('should wrap in theorem environment', () => {
      const filter = pipeline.filters.get('theorem');
      expect(filter.fn('Content here')).toBe('\\begin{theorem}\nContent here\n\\end{theorem}');
      expect(filter.fn('Content', 'lemma')).toBe('\\begin{lemma}\nContent\n\\end{lemma}');
    });

    it('should wrap in proof environment', () => {
      const filter = pipeline.filters.get('proof');
      expect(filter.fn('Proof content')).toBe('\\begin{proof}\nProof content\n\\end{proof}');
    });
  });

  describe('Advanced Utility Filters', () => {
    it('should provide safe filter execution', () => {
      const filter = pipeline.filters.get('safe');
      expect(filter.fn('test')).toBe('test');
      expect(filter.fn(null, 'fallback')).toBe('fallback');
    });

    it('should provide default values', () => {
      const filter = pipeline.filters.get('default');
      expect(filter.fn('test', 'default')).toBe('test');
      expect(filter.fn('', 'default')).toBe('default');
      expect(filter.fn(null, 'default')).toBe('default');
      expect(filter.fn(undefined, 'default')).toBe('default');
    });

    it('should try filter with fallback', () => {
      const filter = pipeline.filters.get('try');
      expect(filter.fn('test', 'upperCase')).toBe('TEST');
      expect(filter.fn('test', 'nonexistentFilter')).toBe('test');
    });

    it('should provide fallback values', () => {
      const filter = pipeline.filters.get('fallback');
      expect(filter.fn('test', 'fallback')).toBe('test');
      expect(filter.fn('', 'fallback')).toBe('fallback');
      expect(filter.fn(null, 'fallback')).toBe('fallback');
    });

    it('should serialize to JSON', () => {
      const filter = pipeline.filters.get('json');
      const obj = { name: 'test', value: 123 };
      const result = filter.fn(obj);
      
      expect(result).toBe('{\n  "name": "test",\n  "value": 123\n}');
      expect(filter.fn(obj, 0)).toBe('{"name":"test","value":123}');
    });

    it('should apply filter chains', () => {
      const filter = pipeline.filters.get('apply');
      const filterChain = ['upperCase', 'trim'];
      
      expect(filter.fn('  hello  ', filterChain)).toBe('HELLO');
    });
  });

  describe('Error Handling', () => {
    it('should handle filter errors gracefully', () => {
      // Test error recovery
      pipeline.options.strictMode = false;
      
      const errorFilter = (value) => {
        throw new Error('Test error');
      };
      
      pipeline.registerFilter('errorFilter', errorFilter, 'test');
      const filter = pipeline.filters.get('errorFilter');
      
      expect(() => filter.fn('test')).not.toThrow();
      expect(filter.fn('test')).toBe('test'); // Should return original value
    });

    it('should throw in strict mode', () => {
      const strictPipeline = createFilterPipeline({ strictMode: true });
      
      const errorFilter = (value) => {
        throw new Error('Test error');
      };
      
      strictPipeline.registerFilter('errorFilter', errorFilter, 'test');
      const filter = strictPipeline.filters.get('errorFilter');
      
      expect(() => filter.fn('test')).toThrow('Test error');
    });

    it('should log errors', () => {
      pipeline.registerFilter('errorFilter', () => {
        throw new Error('Test error');
      }, 'test');
      
      const filter = pipeline.filters.get('errorFilter');
      filter.fn('test');
      
      expect(pipeline.errorLog).toHaveLength(1);
      expect(pipeline.errorLog[0]).toHaveProperty('filter', 'errorFilter');
      expect(pipeline.errorLog[0]).toHaveProperty('error', 'Test error');
    });
  });

  describe('Performance and Caching', () => {
    it('should cache filter results', () => {
      const expensiveFilter = pipeline.filters.get('upperCase');
      
      // First call
      expensiveFilter.fn('test');
      const initialCacheHits = pipeline.stats.cacheHits;
      
      // Second call with same input - should hit cache
      expensiveFilter.fn('test');
      
      expect(pipeline.stats.cacheHits).toBe(initialCacheHits + 1);
    });

    it('should track performance metrics', () => {
      const filter = pipeline.filters.get('upperCase');
      filter.fn('test');
      
      const stats = pipeline.getStats();
      expect(stats.filterCalls).toBeGreaterThan(0);
      expect(stats.totalExecutionTime).toBeGreaterThanOrEqual(0);
    });

    it('should clear cache', () => {
      const filter = pipeline.filters.get('upperCase');
      filter.fn('test');
      
      expect(pipeline.cache.size).toBeGreaterThan(0);
      pipeline.clearCache();
      expect(pipeline.cache.size).toBe(0);
    });
  });

  describe('Nunjucks Integration', () => {
    it('should register filters with Nunjucks environment', () => {
      const env = new nunjucks.Environment();
      const result = registerFiltersWithNunjucks(env);
      
      expect(result).toHaveProperty('pipeline');
      expect(result).toHaveProperty('filtersRegistered');
      expect(result).toHaveProperty('catalog');
      
      expect(result.filtersRegistered).toBeGreaterThan(60);
    });

    it('should work with Nunjucks template rendering', () => {
      const env = new nunjucks.Environment();
      registerFiltersWithNunjucks(env);
      
      const template = '{{ "hello world" | pascalCase }}';
      const result = env.renderString(template);
      
      expect(result).toBe('HelloWorld');
    });

    it('should support filter chaining in templates', () => {
      const env = new nunjucks.Environment();
      registerFiltersWithNunjucks(env);
      
      const template = '{{ "  hello world  " | trim | titleCase | quote }}';
      const result = env.renderString(template);
      
      expect(result).toBe('"Hello World"');
    });
  });
});