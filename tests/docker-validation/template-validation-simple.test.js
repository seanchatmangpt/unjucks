/**
 * Simple Template Rendering Validation Test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import nunjucks from 'nunjucks';

describe('Template Rendering Basic Tests', () => {
  let env;

  beforeEach(() => {
    env = new nunjucks.Environment([], {
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true
    });
  });

  describe('Basic Template Rendering', () => {
    it('should render a simple template with variables', () => {
      const template = 'Hello {{ name }}! You are {{ age }} years old.';
      const data = { name: 'Alice', age: 30 };
      const rendered = env.renderString(template, data);
      expect(rendered).toBe('Hello Alice! You are 30 years old.');
    });

    it('should handle missing variables with defaults', () => {
      const template = 'Hello {{ name | default("Anonymous") }}!';
      const data = {};
      const rendered = env.renderString(template, data);
      expect(rendered).toBe('Hello Anonymous!');
    });

    it('should process arrays and loops', () => {
      const template = 'Items: {% for item in items %}{{ item }}{% if not loop.last %}, {% endif %}{% endfor %}';
      const data = { items: ['apple', 'banana', 'cherry'] };
      const rendered = env.renderString(template, data);
      expect(rendered).toBe('Items: apple, banana, cherry');
    });

    it('should handle conditionals', () => {
      const template = '{% if user.admin %}Admin{% else %}User{% endif %}';
      
      const adminData = { user: { admin: true } };
      const adminRendered = env.renderString(template, adminData);
      expect(adminRendered).toBe('Admin');

      const userdata = { user: { admin: false } };
      const userRendered = env.renderString(template, userdata);
      expect(userRendered).toBe('User');
    });

    it('should handle nested objects', () => {
      const template = '{{ user.profile.name }} works at {{ user.company.name }}';
      const data = {
        user: {
          profile: { name: 'John Doe' },
          company: { name: 'Acme Corp' }
        }
      };
      const rendered = env.renderString(template, data);
      expect(rendered).toBe('John Doe works at Acme Corp');
    });
  });

  describe('Built-in Filters', () => {
    it('should apply basic built-in filters', () => {
      const template = '{{ message | upper }} has {{ count }} items';
      const data = { message: 'hello world', count: 5 };
      const rendered = env.renderString(template, data);
      expect(rendered).toBe('HELLO WORLD has 5 items');
    });

    it('should chain multiple filters', () => {
      const template = '{{ text | trim | upper }}';
      const data = { text: '  hello world  ' };
      const rendered = env.renderString(template, data);
      expect(rendered).toBe('HELLO WORLD');
    });

    it('should handle array join filter', () => {
      const template = '{{ items | join(", ") }}';
      const data = { items: ['red', 'green', 'blue'] };
      const rendered = env.renderString(template, data);
      expect(rendered).toBe('red, green, blue');
    });
  });

  describe('Error Handling', () => {
    it('should handle undefined variables gracefully', () => {
      const template = '{{ undefined_var }}';
      const data = {};
      const rendered = env.renderString(template, data);
      expect(rendered).toBe('');
    });

    it('should handle syntax errors gracefully', () => {
      expect(() => {
        env.renderString('{{ unclosed', {});
      }).toThrow();
    });
  });
});