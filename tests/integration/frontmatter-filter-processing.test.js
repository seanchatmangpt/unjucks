/**
 * Frontmatter Filter Processing Integration Tests
 * Tests frontmatter parsing with filter integration in file paths and content
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js';
import { addCommonFilters } from '../../src/lib/nunjucks-filters.js';
import nunjucks from 'nunjucks';

describe('Frontmatter Filter Processing', () => {
  let frontmatterParser;
  let nunjucksEnv;

  beforeEach(() => {
    frontmatterParser = new FrontmatterParser();
    
    nunjucksEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader('_templates'),
      {
        autoescape: false,
        throwOnUndefined: false
      }
    );
    
    addCommonFilters(nunjucksEnv);
  });

  describe('Frontmatter Path Resolution with Filters', () => {
    it('should process filters in frontmatter "to" field', async () => {
      const templateContent = `---
to: "{{ dest }}/components/{{ name | pascalCase }}.vue"
inject: false
---
<template>
  <div class="{{ name | kebabCase }}">
    {{ name | titleCase }}
  </div>
</template>`;

      const parsed = await frontmatterParser.parse(templateContent);
      expect(parsed.hasValidFrontmatter).toBe(true);
      expect(parsed.frontmatter.to).toBe('{{ dest }}/components/{{ name | pascalCase }}.vue');

      // Test rendering the path with filters
      const variables = { name: 'user-profile', dest: './src' };
      const renderedPath = nunjucksEnv.renderString(parsed.frontmatter.to, variables);
      expect(renderedPath).toBe('./src/components/UserProfile.vue');
    });

    it('should handle complex filter chains in paths', async () => {
      const templateContent = `---
to: "{{ dest }}/{{ moduleName | snakeCase }}/{{ entityName | pluralize | kebabCase }}/{{ actionName | camelCase }}.js"
inject: false
---
module.exports = {};`;

      const parsed = await frontmatterParser.parse(templateContent);
      const variables = {
        dest: './api',
        moduleName: 'UserManagement',
        entityName: 'blogPost',
        actionName: 'create_new_post'
      };

      const renderedPath = nunjucksEnv.renderString(parsed.frontmatter.to, variables);
      expect(renderedPath).toBe('./api/user_management/blog-posts/createNewPost.js');
    });

    it('should process date and faker filters in paths', async () => {
      const templateContent = `---
to: "{{ dest }}/migrations/{{ now() | formatDate('YYYYMMDD') }}_{{ tableName | snakeCase }}_{{ '' | fakeUuid | slice(0, 8) }}.sql"
inject: false
---
CREATE TABLE {{ tableName | snakeCase }} ();`;

      const parsed = await frontmatterParser.parse(templateContent);
      const variables = {
        dest: './database',
        tableName: 'UserProfiles'
      };

      const renderedPath = nunjucksEnv.renderString(parsed.frontmatter.to, variables);
      expect(renderedPath).toMatch(/^\.\/database\/migrations\/\d{8}_user_profiles_[\da-f]{8}\.sql$/);
    });
  });

  describe('Injection Target Processing with Filters', () => {
    it('should process filters in injection targets', async () => {
      const templateContent = `---
to: "config.js"
inject: true
after: "{{ sectionName | camelCase }}: {"
---
    {{ featureName | camelCase }}: {{ enabled | default(true) }},`;

      const parsed = await frontmatterParser.parse(templateContent);
      expect(parsed.frontmatter.inject).toBe(true);
      expect(parsed.frontmatter.after).toBe('{{ sectionName | camelCase }}: {');

      const variables = { sectionName: 'database-config' };
      const renderedTarget = nunjucksEnv.renderString(parsed.frontmatter.after, variables);
      expect(renderedTarget).toBe('databaseConfig: {');
    });

    it('should handle multiple injection conditions with filters', async () => {
      const templateContent = `---
to: "routes.js"
inject: true
before: "// End {{ moduleName | pascalCase }} routes"
after: "// {{ moduleName | pascalCase }} routes"
skipIf: "{{ skipGeneration }}"
---
router.{{ method | lowerCase }}('/{{ resourceName | kebabCase }}', {{ handlerName | camelCase }});`;

      const parsed = await frontmatterParser.parse(templateContent);
      
      const variables = {
        moduleName: 'user_management',
        method: 'GET',
        resourceName: 'user_profiles',
        handlerName: 'get_user_profile',
        skipGeneration: false
      };

      const renderedBefore = nunjucksEnv.renderString(parsed.frontmatter.before, variables);
      const renderedAfter = nunjucksEnv.renderString(parsed.frontmatter.after, variables);
      const shouldSkip = frontmatterParser.shouldSkip(parsed.frontmatter, variables);

      expect(renderedBefore).toBe('// End UserManagement routes');
      expect(renderedAfter).toBe('// UserManagement routes');
      expect(shouldSkip).toBe(false);
    });
  });

  describe('Content Processing with Filters', () => {
    it('should process filters in template content', async () => {
      const templateContent = `---
to: "component.vue"
---
<template>
  <div class="{{ componentName | kebabCase }}-wrapper">
    <h1>{{ title | titleCase }}</h1>
    <p>Created: {{ now() | formatDate('MMMM Do, YYYY') }}</p>
    <p>ID: {{ '' | fakeUuid }}</p>
  </div>
</template>

<script>
export default {
  name: '{{ componentName | pascalCase }}',
  data() {
    return {
      id: '{{ '' | fakeUuid }}',
      createdAt: '{{ now() | dateIso }}',
      isActive: {{ fakeBoolean() }}
    }
  }
}
</script>`;

      const parsed = await frontmatterParser.parse(templateContent);
      
      const variables = {
        componentName: 'user_profile_card',
        title: 'user profile display'
      };

      const renderedContent = nunjucksEnv.renderString(parsed.content, variables);
      
      expect(renderedContent).toContain('user-profile-card-wrapper');
      expect(renderedContent).toContain('User Profile Display');
      expect(renderedContent).toContain('UserProfileCard');
      expect(renderedContent).toMatch(/Created: \w+ \d+(st|nd|rd|th), \d{4}/);
      expect(renderedContent).toMatch(/ID: [\da-f-]{36}/);
      expect(renderedContent).toMatch(/id: '[\da-f-]{36}'/);
      expect(renderedContent).toMatch(/createdAt: '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(renderedContent).toMatch(/isActive: (true|false)/);
    });

    it('should handle complex filter expressions in content', async () => {
      const templateContent = `---
to: "model.js"
---
class {{ modelName | classify }} {
  constructor() {
    this.tableName = '{{ modelName | tableize }}';
    this.primaryKey = '{{ modelName | singular | snakeCase }}_id';
    this.slug = '{{ modelName | singular | kebabCase }}';
  }

  static get schema() {
    return {
      id: { type: 'integer', primary: true },
      {{ modelName | singular | snakeCase }}_name: { type: 'string', required: true },
      slug: { type: 'string', unique: true, default: () => '{{ modelName | slug }}-{{ now() | formatDate("YYYYMMDD") }}-{{ "" | fakeNumber(1000, 9999) }}' },
      created_at: { type: 'timestamp', default: () => new Date() }
    };
  }
}

module.exports = {{ modelName | classify }};`;

      const parsed = await frontmatterParser.parse(templateContent);
      
      const variables = { modelName: 'blogPosts' };
      const renderedContent = nunjucksEnv.renderString(parsed.content, variables);
      
      expect(renderedContent).toContain('class BlogPost {');
      expect(renderedContent).toContain("this.tableName = 'blog_posts';");
      expect(renderedContent).toContain("this.primaryKey = 'blog_post_id';");
      expect(renderedContent).toContain("this.slug = 'blog-post';");
      expect(renderedContent).toContain('blog_post_name: { type: \'string\'');
      expect(renderedContent).toContain('module.exports = BlogPost;');
      expect(renderedContent).toMatch(/default: \(\) => 'blog-posts-\d{8}-\d{4}'/);
    });
  });

  describe('Conditional Processing with Filters', () => {
    it('should evaluate skipIf conditions with filter results', async () => {
      const templateContent = `---
to: "feature.js"
skipIf: "{{ featureType | lowerCase }}==disabled"
---
Feature: {{ featureType | titleCase }}`;

      const parsed = await frontmatterParser.parse(templateContent);
      
      // Test skipping condition
      const skipVariables = { featureType: 'DISABLED' };
      const shouldSkip = frontmatterParser.shouldSkip(parsed.frontmatter, skipVariables);
      expect(shouldSkip).toBe(true);

      // Test non-skipping condition
      const noSkipVariables = { featureType: 'ENABLED' };
      const shouldNotSkip = frontmatterParser.shouldSkip(parsed.frontmatter, noSkipVariables);
      expect(shouldNotSkip).toBe(false);
    });

    it('should handle complex skipIf expressions', async () => {
      const templateContent = `---
to: "test.js"
skipIf: "{{ environment | lowerCase }}==production"
---
Test file for {{ environment | upperCase }}`;

      const parsed = await frontmatterParser.parse(templateContent);
      
      expect(frontmatterParser.shouldSkip(parsed.frontmatter, { environment: 'PRODUCTION' })).toBe(true);
      expect(frontmatterParser.shouldSkip(parsed.frontmatter, { environment: 'development' })).toBe(false);
      expect(frontmatterParser.shouldSkip(parsed.frontmatter, { environment: 'staging' })).toBe(false);
    });
  });

  describe('Error Handling in Frontmatter Processing', () => {
    it('should handle invalid YAML gracefully', async () => {
      const templateContent = `---
invalid: yaml: content:
  - no proper indentation
to: "test.js"
---
Content here`;

      const parsed = await frontmatterParser.parse(templateContent);
      expect(parsed.hasValidFrontmatter).toBe(false);
      expect(parsed.frontmatter).toEqual({});
      expect(parsed.content).toBe(templateContent); // Full content returned
    });

    it('should continue processing after filter errors in frontmatter', async () => {
      const templateContent = `---
to: "{{ name | nonExistentFilter | pascalCase }}.js"
inject: true
after: "{{ section | kebabCase }}"
---
Valid content: {{ name | pascalCase }}`;

      const parsed = await frontmatterParser.parse(templateContent);
      expect(parsed.hasValidFrontmatter).toBe(true);
      
      // Rendering should handle missing filters gracefully
      const variables = { name: 'test-component', section: 'user_management' };
      
      // This might throw or return empty string depending on Nunjucks settings
      // The important thing is it doesn't break the entire process
      expect(() => {
        nunjucksEnv.renderString(parsed.frontmatter.to, variables);
      }).not.toThrow();
    });
  });

  describe('Validation Integration', () => {
    it('should validate frontmatter structure with filter expressions', () => {
      const validFrontmatter = {
        to: '{{ name | pascalCase }}.js',
        inject: true,
        after: '{{ section | camelCase }}:',
        chmod: '755'
      };

      const validation = frontmatterParser.validate(validFrontmatter);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should catch validation errors in frontmatter', () => {
      const invalidFrontmatter = {
        to: '{{ name | pascalCase }}.js',
        inject: true,
        append: true, // Conflicting with inject
        lineAt: -5, // Invalid line number
        chmod: 'invalid' // Invalid chmod format
      };

      const validation = frontmatterParser.validate(invalidFrontmatter);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Performance with Filter Processing', () => {
    it('should handle complex frontmatter with many filters efficiently', async () => {
      const frontmatter = Array.from({ length: 20 }, (_, i) => 
        `field${i}: "{{ value${i} | pascalCase | pluralize | kebabCase }}"`
      ).join('\n    ');

      const templateContent = `---
to: "{{ name | pascalCase }}.js"
${frontmatter}
---
Content with {{ name | titleCase }}`;

      const startTime = Date.now();
      const parsed = await frontmatterParser.parse(templateContent);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // Should parse quickly
      expect(parsed.hasValidFrontmatter).toBe(true);
      expect(Object.keys(parsed.frontmatter)).toHaveLength(21); // 20 fields + 'to'
    });
  });
});