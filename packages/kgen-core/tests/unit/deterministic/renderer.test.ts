/**
 * Tests for deterministic renderer
 */

import { DeterministicRenderer, createDeterministicRenderer, renderDeterministic } from '../../../src/deterministic/renderer';

describe('DeterministicRenderer', () => {
  let renderer: DeterministicRenderer;
  
  beforeEach(() => {
    renderer = new DeterministicRenderer();
  });
  
  describe('basic rendering', () => {
    it('should render simple templates consistently', () => {
      const template = 'Hello {{ name }}!';
      const context = { name: 'World' };
      
      const result1 = renderer.render(template, context);
      const result2 = renderer.render(template, context);
      
      expect(result1).toBe('Hello World!');
      expect(result1).toBe(result2);
    });
    
    it('should handle empty context', () => {
      const template = 'Static content only';
      const result = renderer.render(template);
      
      expect(result).toBe('Static content only');
    });
    
    it('should sort context keys for deterministic access', () => {
      const template = '{{ z }}-{{ a }}-{{ m }}';
      const context = { z: '3', a: '1', m: '2' };
      
      const result = renderer.render(template, context);
      expect(result).toBe('3-1-2');
    });
  });
  
  describe('deterministic context sorting', () => {
    it('should produce identical output regardless of context key order', () => {
      const template = '{{ user.name }}-{{ user.age }}-{{ config.debug }}';
      
      const context1 = {
        config: { debug: true },
        user: { age: 30, name: 'John' }
      };
      
      const context2 = {
        user: { name: 'John', age: 30 },
        config: { debug: true }
      };
      
      const result1 = renderer.render(template, context1);
      const result2 = renderer.render(template, context2);
      
      expect(result1).toBe(result2);
      expect(result1).toBe('John-30-true');
    });
    
    it('should handle nested object sorting', () => {
      const template = '{{ JSON.stringify(data) }}';
      const context = {
        data: {
          z: { b: 2, a: 1 },
          a: { y: 24, x: 23 }
        }
      };
      
      const result = renderer.render(template, context);
      
      // Should contain sorted keys
      expect(result).toContain('"a":');
      expect(result).toContain('"z":');
      expect(result.indexOf('"a":')).toBeLessThan(result.indexOf('"z":'));
    });
  });
  
  describe('built-in filters', () => {
    it('should provide sort filter for arrays', () => {
      const template = '{{ items | sort | join(",") }}';
      const context = { items: ['c', 'a', 'b'] };
      
      const result = renderer.render(template, context);
      expect(result).toBe('a,b,c');
    });
    
    it('should provide sortKeys filter for objects', () => {
      const template = '{{ data | sortKeys | json }}';
      const context = {
        data: { z: 3, a: 1, m: 2 }
      };
      
      const result = renderer.render(template, context);
      const parsed = JSON.parse(result);
      const keys = Object.keys(parsed);
      
      expect(keys).toEqual(['a', 'm', 'z']);
    });
    
    it('should provide hash filter for generating stable IDs', () => {
      const template = '{{ data | hash }}';
      const context = {
        data: { name: 'test', value: 123 }
      };
      
      const result1 = renderer.render(template, context);
      const result2 = renderer.render(template, context);
      
      expect(result1).toBe(result2);
      expect(result1).toMatch(/^[a-f0-9]{8}$/);
    });
    
    it('should provide prop filter for safe property access', () => {
      const template = '{{ user | prop("name", "Anonymous") }}';
      const context = { user: { name: 'John' } };
      
      const result = renderer.render(template, context);
      expect(result).toBe('John');
      
      const emptyResult = renderer.render(template, { user: null });
      expect(emptyResult).toBe('Anonymous');
    });
  });
  
  describe('non-deterministic prevention', () => {
    it('should not have access to Date', () => {
      const template = '{{ Date.now() }}';
      
      expect(() => {
        renderer.render(template);
      }).toThrow();
    });
    
    it('should not have access to Math.random', () => {
      const template = '{{ Math.random() }}';
      
      expect(() => {
        renderer.render(template);
      }).toThrow();
    });
    
    it('should not have access to process', () => {
      const template = '{{ process.env.NODE_ENV }}';
      
      expect(() => {
        renderer.render(template);
      }).toThrow();
    });
  });
  
  describe('custom filters and globals', () => {
    it('should accept custom filters', () => {
      const customRenderer = new DeterministicRenderer({
        filters: {
          uppercase: (str: string) => str.toUpperCase(),
          reverse: (str: string) => str.split('').reverse().join('')
        }
      });
      
      const template = '{{ name | uppercase | reverse }}';
      const context = { name: 'hello' };
      
      const result = customRenderer.render(template, context);
      expect(result).toBe('OLLEH');
    });
    
    it('should accept custom globals with sorting', () => {
      const customRenderer = new DeterministicRenderer({
        globals: {
          z_global: 'last',
          a_global: 'first',
          m_global: 'middle'
        }
      });
      
      const template = '{{ a_global }}-{{ m_global }}-{{ z_global }}';
      const result = customRenderer.render(template);
      
      expect(result).toBe('first-middle-last');
    });
  });
  
  describe('whitespace handling', () => {
    it('should trim blocks consistently', () => {
      const template = `
        {%- for item in items -%}
          {{ item }}
        {%- endfor -%}
      `;
      const context = { items: ['a', 'b', 'c'] };
      
      const result = renderer.render(template, context);
      expect(result.trim()).toBe('abc');
    });
  });
  
  describe('static functions', () => {
    it('createDeterministicRenderer should work', () => {
      const r = createDeterministicRenderer({ trimBlocks: false });
      const result = r.render('{{ name }}', { name: 'test' });
      expect(result).toBe('test');
    });
    
    it('renderDeterministic should work', () => {
      const result = renderDeterministic('{{ value }}', { value: 42 });
      expect(result).toBe('42');
    });
  });
  
  describe('cross-execution consistency', () => {
    it('should produce identical output across multiple executions', () => {
      const template = `
        # Generated File
        Name: {{ config.name }}
        Version: {{ config.version }}
        Features:
        {%- for feature in config.features | sort %}
        - {{ feature }}
        {%- endfor %}
        
        Data: {{ data | json(2) }}
      `;
      
      const context = {
        config: {
          version: '1.0.0',
          name: 'test-app',
          features: ['auth', 'api', 'web']
        },
        data: {
          z: 'last',
          a: 'first',
          nested: { b: 2, a: 1 }
        }
      };
      
      const results = Array.from({ length: 10 }, () => 
        renderer.render(template, context)
      );
      
      // All results should be identical
      const firstResult = results[0];
      expect(results.every(result => result === firstResult)).toBe(true);
      
      // Should contain expected sorted content
      expect(firstResult).toContain('- api');
      expect(firstResult).toContain('- auth');
      expect(firstResult).toContain('- web');
      expect(firstResult.indexOf('- api')).toBeLessThan(firstResult.indexOf('- auth'));
    });
  });
});