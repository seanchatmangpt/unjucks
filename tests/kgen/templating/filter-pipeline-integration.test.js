/**
 * KGEN Filter Pipeline Integration Tests
 * 
 * Comprehensive tests for the complete filter pipeline connection between
 * UNJUCKS and KGEN deterministic and RDF filters.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { TemplateEngine } from '../../../packages/kgen-core/src/templating/template-engine.js';
import { createDeterministicFilters } from '../../../packages/kgen-core/src/templating/deterministic-filters.js';
import { RDFFilters } from '../../../packages/kgen-core/src/templating/rdf-filters.js';

describe('Filter Pipeline Integration', () => {
  let engine;
  
  beforeEach(() => {
    engine = new TemplateEngine({
      templatesDir: '/tmp/test-templates',
      enableFilters: true,
      enableRDF: true,
      deterministic: true
    });
  });

  describe('Deterministic Filters Connection', () => {
    test('should connect all 39 deterministic filters', async () => {
      const availableFilters = engine.getAvailableFilters();
      
      expect(availableFilters.deterministic).toHaveLength(39);
      expect(availableFilters.total).toBeGreaterThanOrEqual(39);
      
      // Verify key string filters are connected
      expect(availableFilters.deterministic).toContain('camelCase');
      expect(availableFilters.deterministic).toContain('pascalCase');
      expect(availableFilters.deterministic).toContain('kebabCase');
      expect(availableFilters.deterministic).toContain('snakeCase');
      expect(availableFilters.deterministic).toContain('constantCase');
      
      // Verify hash filters
      expect(availableFilters.deterministic).toContain('hash');
      expect(availableFilters.deterministic).toContain('shortHash');
      
      // Verify object/array filters
      expect(availableFilters.deterministic).toContain('sortKeys');
      expect(availableFilters.deterministic).toContain('unique');
      expect(availableFilters.deterministic).toContain('sortBy');
      expect(availableFilters.deterministic).toContain('groupBy');
    });

    test('should render templates using deterministic filters', async () => {
      const templateContent = `{{ name | pascalCase }}Component`;
      
      const result = await engine.renderString(templateContent, {
        name: 'user-profile'
      });
      
      expect(result.content).toBe('UserProfileComponent');
      expect(result.metadata.variablesUsed).toContain('name');
    });

    test('should chain multiple deterministic filters', async () => {
      const templateContent = `{{ text | trim | camelCase | hash | shortHash }}`;
      
      const result = await engine.renderString(templateContent, {
        text: '  hello world  '
      });
      
      // Should be 8 character hash of "helloWorld"
      expect(result.content).toMatch(/^[a-f0-9]{8}$/);
      expect(result.content).toHaveLength(8);
    });

    test('should handle array and object filters', async () => {
      const templateContent = `{{ items | unique | sortBy }}`;
      
      const result = await engine.renderString(templateContent, {
        items: ['beta', 'alpha', 'beta', 'gamma', 'alpha']
      });
      
      expect(result.content).toBe('alpha,beta,gamma');
    });

    test('should provide deterministic behavior across renders', async () => {
      const templateContent = `{{ data | sortKeys | stringify }}`;
      
      const context = {
        data: { c: 3, a: 1, b: 2 }
      };
      
      const result1 = await engine.renderString(templateContent, context);
      const result2 = await engine.renderString(templateContent, context);
      
      expect(result1.content).toBe(result2.content);
      expect(result1.content).toContain('"a": 1');
      expect(result1.content).toContain('"b": 2');
      expect(result1.content).toContain('"c": 3');
    });
  });

  describe('RDF Filters Connection', () => {
    test('should connect all 12 RDF filters when enabled', async () => {
      const availableFilters = engine.getAvailableFilters();
      
      expect(availableFilters.rdf).toHaveLength(12);
      expect(availableFilters.total).toBe(51); // 39 deterministic + 12 RDF
      
      // Verify core RDF filters are connected
      expect(availableFilters.rdf).toContain('rdfSubject');
      expect(availableFilters.rdf).toContain('rdfObject');
      expect(availableFilters.rdf).toContain('rdfPredicate');
      expect(availableFilters.rdf).toContain('rdfQuery');
      expect(availableFilters.rdf).toContain('rdfLabel');
      expect(availableFilters.rdf).toContain('rdfType');
      expect(availableFilters.rdf).toContain('rdfNamespace');
      expect(availableFilters.rdf).toContain('rdfGraph');
      expect(availableFilters.rdf).toContain('rdfExpand');
      expect(availableFilters.rdf).toContain('rdfCompact');
      expect(availableFilters.rdf).toContain('rdfCount');
      expect(availableFilters.rdf).toContain('rdfExists');
    });

    test('should access RDF filters from templates', async () => {
      // Update RDF store with test data
      const testTriples = [
        {
          subject: { type: 'uri', value: 'http://example.org/Person1' },
          predicate: { type: 'uri', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
          object: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/Person' }
        },
        {
          subject: { type: 'uri', value: 'http://example.org/Person1' },
          predicate: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/name' },
          object: { type: 'literal', value: 'John Doe' }
        }
      ];
      
      engine.updateRDFStore(testTriples);
      
      const templateContent = `{{ "ex:Person1" | rdfLabel }}`;
      
      const result = await engine.renderString(templateContent, {});
      
      // Should return either the FOAF name or local name
      expect(result.content).toMatch(/(John Doe|Person1)/);
    });

    test('should handle RDF namespace expansion', async () => {
      const templateContent = `{{ "foaf" | rdfNamespace }}`;
      
      const result = await engine.renderString(templateContent, {});
      
      expect(result.content).toBe('http://xmlns.com/foaf/0.1/');
    });

    test('should compact URIs to prefixed form', async () => {
      const templateContent = `{{ "http://xmlns.com/foaf/0.1/Person" | rdfCompact }}`;
      
      const result = await engine.renderString(templateContent, {});
      
      expect(result.content).toBe('foaf:Person');
    });
  });

  describe('Filter Pipeline Performance', () => {
    test('should cache filter results for performance', async () => {
      const templateContent = `{{ longText | hash }}{{ longText | hash }}`;
      
      const longText = 'a'.repeat(10000);
      const startTime = performance.now();
      
      await engine.renderString(templateContent, { longText });
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should be fast due to caching (under 100ms for this simple case)
      expect(renderTime).toBeLessThan(100);
      
      const stats = engine.getStats();
      expect(stats.filtersUsed).toContain('hash');
    });

    test('should track filter usage statistics', async () => {
      const templateContent = `
        {{ name | camelCase }}
        {{ items | unique | sortBy }}
        {{ data | hash }}
      `;
      
      await engine.renderString(templateContent, {
        name: 'test-name',
        items: [3, 1, 2, 1],
        data: { test: true }
      });
      
      const stats = engine.getStats();
      expect(stats.filtersUsed).toContain('camelCase');
      expect(stats.filtersUsed).toContain('unique');
      expect(stats.filtersUsed).toContain('sortBy');
      expect(stats.filtersUsed).toContain('hash');
      expect(stats.uniqueFilters).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Custom Filter Integration', () => {
    test('should allow adding custom deterministic filters', () => {
      engine.addFilter('customReverse', (str) => {
        return typeof str === 'string' ? str.split('').reverse().join('') : str;
      });
      
      const availableFilters = engine.getAvailableFilters();
      expect(availableFilters.deterministic).toContain('customReverse');
    });

    test('should render templates with custom filters', async () => {
      engine.addFilter('customDouble', (num) => {
        return typeof num === 'number' ? num * 2 : num;
      });
      
      const templateContent = `{{ count | customDouble }}`;
      
      const result = await engine.renderString(templateContent, {
        count: 21
      });
      
      expect(result.content).toBe('42');
    });
  });

  describe('Error Handling and Robustness', () => {
    test('should handle unknown filters gracefully', async () => {
      const templateContent = `{{ name | unknownFilter }}`;
      
      // Should not throw, filter will be ignored by Nunjucks
      const result = await engine.renderString(templateContent, {
        name: 'test'
      }, { throwOnError: false });
      
      expect(result.content).toContain('Template rendering error');
    });

    test('should handle invalid filter arguments', async () => {
      const templateContent = `{{ null | camelCase }}`;
      
      const result = await engine.renderString(templateContent, {});
      
      // Filter should handle null gracefully
      expect(result.content).toBe('');
    });

    test('should maintain deterministic behavior with errors', async () => {
      const templateContent = `{{ value | hash }}`;
      
      const result1 = await engine.renderString(templateContent, { value: null });
      const result2 = await engine.renderString(templateContent, { value: null });
      
      expect(result1.content).toBe(result2.content);
    });
  });

  describe('Integration with Template Features', () => {
    test('should work with template conditionals', async () => {
      const templateContent = `
{% if name %}
Name: {{ name | pascalCase }}
{% endif %}
{% if items %}
Items: {{ items | unique | sortBy | join(', ') }}
{% endif %}
      `.trim();
      
      const result = await engine.renderString(templateContent, {
        name: 'user-service',
        items: ['c', 'a', 'b', 'a']
      });
      
      expect(result.content).toContain('Name: UserService');
      expect(result.content).toContain('Items: a, b, c');
    });

    test('should work with template loops', async () => {
      const templateContent = `
{% for item in items %}
- {{ item | kebabCase }}
{% endfor %}
      `.trim();
      
      const result = await engine.renderString(templateContent, {
        items: ['UserProfile', 'AdminDashboard', 'DataService']
      });
      
      expect(result.content).toContain('- user-profile');
      expect(result.content).toContain('- admin-dashboard');  
      expect(result.content).toContain('- data-service');
    });

    test('should maintain context with global filter functions', async () => {
      const templateContent = `{{ applyFilter(text, 'camelCase') }}`;
      
      const result = await engine.renderString(templateContent, {
        text: 'hello world'
      });
      
      expect(result.content).toBe('helloWorld');
    });

    test('should support filter chaining with global chain function', async () => {
      const templateContent = `{{ chain(text, 'trim', 'camelCase', 'hash', ['shortHash', 6]) }}`;
      
      const result = await engine.renderString(templateContent, {
        text: '  hello world  '
      });
      
      // Should be 6-character hash of "helloWorld"
      expect(result.content).toMatch(/^[a-f0-9]{6}$/);
      expect(result.content).toHaveLength(6);
    });
  });
});