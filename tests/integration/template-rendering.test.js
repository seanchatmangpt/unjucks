/**
 * Integration tests for Nunjucks template rendering with filters
 * Tests the complete filter registration and usage pipeline
 */

import { describe, it, expect, beforeEach } from 'vitest';
import nunjucks from 'nunjucks';
import { addCommonFilters } from '../../src/lib/nunjucks-filters.js';

describe('Nunjucks Filter Integration', () => {
  let env;

  beforeEach(() => {
    // Create a new Nunjucks environment for each test
    env = new nunjucks.Environment();
    addCommonFilters(env);
  });

  describe('Basic Filter Registration', () => {
    it('should register all case conversion filters', () => {
      const template = env.renderString('{{ "hello world" | pascalCase }}');
      expect(template).toBe('HelloWorld');
    });

    it('should register filter aliases', () => {
      // Test PascalCase alias
      const template1 = env.renderString('{{ "hello world" | PascalCase }}');
      expect(template1).toBe('HelloWorld');
      
      // Test kebab-case alias
      const template2 = env.renderString('{{ "HelloWorld" | kebab-case }}');
      expect(template2).toBe('hello-world');
      
      // Test snake_case alias
      const template3 = env.renderString('{{ "HelloWorld" | snake_case }}');
      expect(template3).toBe('hello_world');
      
      // Test CONSTANT_CASE alias
      const template4 = env.renderString('{{ "hello world" | CONSTANT_CASE }}');
      expect(template4).toBe('HELLO_WORLD');
    });

    it('should register utility filters', () => {
      // Test lower/upper aliases
      expect(env.renderString('{{ "HELLO" | lower }}')).toBe('hello');
      expect(env.renderString('{{ "hello" | upper }}')).toBe('HELLO');
      
      // Test dump filter
      const objStr = env.renderString('{{ obj | dump }}', { obj: { name: 'test' } });
      expect(JSON.parse(objStr)).toEqual({ name: 'test' });
      
      // Test join filter
      expect(env.renderString('{{ arr | join(",") }}', { arr: ['a', 'b', 'c'] })).toBe('a,b,c');
      
      // Test default filter
      expect(env.renderString('{{ null | default("fallback") }}')).toBe('fallback');
      expect(env.renderString('{{ "value" | default("fallback") }}')).toBe('value');
    });
  });

  describe('Filter Chaining', () => {
    it('should allow chaining case conversion filters', () => {
      const template = env.renderString('{{ "hello world" | pascalCase | lowerCase }}');
      expect(template).toBe('helloworld');
    });

    it('should allow complex filter chains', () => {
      // Test realistic chaining scenario
      const template = env.renderString('{{ name | snakeCase | upperCase }}', { name: 'userProfile' });
      expect(template).toBe('USER_PROFILE');
    });

    it('should handle filter chains with utility filters', () => {
      const template = env.renderString('{{ arr | join("-") | upperCase }}', { arr: ['hello', 'world'] });
      expect(template).toBe('HELLO-WORLD');
    });
  });

  describe('Template Context Integration', () => {
    it('should work with template variables', () => {
      const template = env.renderString('{{ className | pascalCase }}Component', { 
        className: 'user-profile' 
      });
      expect(template).toBe('UserProfileComponent');
    });

    it('should work in loops', () => {
      const template = `
        {%- for item in items -%}
          {{ item | kebabCase }}{% if not loop.last %},{% endif %}
        {%- endfor -%}
      `;
      const result = env.renderString(template, { 
        items: ['UserProfile', 'AdminPanel', 'DataTable'] 
      });
      expect(result).toBe('user-profile,admin-panel,data-table');
    });

    it('should work in conditionals', () => {
      const template = `
        {%- if isClass -%}
          {{ name | pascalCase }}
        {%- else -%}
          {{ name | camelCase }}
        {%- endif -%}
      `;
      
      const result1 = env.renderString(template, { name: 'user profile', isClass: true });
      expect(result1).toBe('UserProfile');
      
      const result2 = env.renderString(template, { name: 'user profile', isClass: false });
      expect(result2).toBe('userProfile');
    });
  });

  describe('Global Functions', () => {
    it('should register timestamp global function', () => {
      const template = env.renderString('{{ timestamp() }}');
      expect(template).toMatch(/^\d{14}$/); // YYYYMMDDHHMMSS format
    });

    it('should register now global function', () => {
      const template = env.renderString('{{ now() }}');
      expect(template).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/); // YYYY-MM-DD HH:MM:SS format
    });

    it('should register formatDate global function', () => {
      const template = env.renderString('{{ formatDate() }}');
      expect(template).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
      
      // Test with specific date
      const specificDate = new Date('2023-12-25T15:30:45Z');
      const template2 = env.renderString('{{ formatDate(date) }}', { date: specificDate });
      expect(template2).toBe('2023-12-25');
    });
  });

  describe('Error Handling', () => {
    it('should handle undefined variables gracefully', () => {
      const template = env.renderString('{{ undefinedVar | pascalCase }}');
      expect(template).toBe(''); // Should render empty for undefined
    });

    it('should handle null values gracefully', () => {
      const template = env.renderString('{{ nullVar | pascalCase }}', { nullVar: null });
      expect(template).toBe(''); // Should render empty for null
    });

    it('should handle non-string values', () => {
      const template = env.renderString('{{ number | pascalCase }}', { number: 123 });
      expect(template).toBe('123'); // Should pass through non-strings
    });
  });

  describe('Real-world Template Scenarios', () => {
    it('should handle component name generation', () => {
      const template = `
        import { Component } from 'react';
        
        class {{ componentName | pascalCase }}Component extends Component {
          constructor(props) {
            super(props);
            this.state = {
              {{ stateName | camelCase }}: null
            };
          }
        }
        
        export default {{ componentName | pascalCase }}Component;
      `;
      
      const result = env.renderString(template, { 
        componentName: 'user-profile',
        stateName: 'loading_state'
      });
      
      expect(result).toContain('UserProfileComponent');
      expect(result).toContain('loadingState: null');
    });

    it('should handle database schema generation', () => {
      const template = `
        CREATE TABLE {{ tableName | snakeCase }} (
          id SERIAL PRIMARY KEY,
          {{ fieldName | snakeCase }} VARCHAR(255),
          created_at TIMESTAMP DEFAULT '{{ now() }}'
        );
      `;
      
      const result = env.renderString(template, { 
        tableName: 'UserProfile',
        fieldName: 'fullName'
      });
      
      expect(result).toContain('user_profile');
      expect(result).toContain('full_name');
      expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    });

    it('should handle API endpoint generation', () => {
      const template = `
        router.get('/{{ resourceName | kebabCase }}/:id', (req, res) => {
          const {{ variableName | camelCase }} = await {{ modelName | pascalCase }}.findById(req.params.id);
          res.json({{ variableName | camelCase }});
        });
      `;
      
      const result = env.renderString(template, { 
        resourceName: 'user_profiles',
        variableName: 'user_profile',
        modelName: 'user_profile'
      });
      
      expect(result).toContain('/user-profiles/:id');
      expect(result).toContain('const userProfile');
      expect(result).toContain('UserProfile.findById');
    });
  });
});

describe('Filter Environment Edge Cases', () => {
  it('should handle multiple environment instances', () => {
    const env1 = new nunjucks.Environment();
    const env2 = new nunjucks.Environment();
    
    addCommonFilters(env1);
    addCommonFilters(env2);
    
    const result1 = env1.renderString('{{ "test" | pascalCase }}');
    const result2 = env2.renderString('{{ "test" | pascalCase }}');
    
    expect(result1).toBe('Test');
    expect(result2).toBe('Test');
  });

  it('should not interfere with default Nunjucks filters', () => {
    const env = new nunjucks.Environment();
    addCommonFilters(env);
    
    // Test that built-in filters still work
    expect(env.renderString('{{ "test" | length }}')).toBe('4');
    expect(env.renderString('{{ arr | first }}', { arr: [1, 2, 3] })).toBe('1');
    expect(env.renderString('{{ arr | last }}', { arr: [1, 2, 3] })).toBe('3');
  });
});