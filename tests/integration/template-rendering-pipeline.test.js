/**
 * Comprehensive Template Rendering Pipeline Validation Tests
 * Tests the complete workflow from CLI to file output with filter integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Generator } from '../../src/commands/generate.js';
import { addCommonFilters } from '../../src/lib/nunjucks-filters.js';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js';
import nunjucks from 'nunjucks';
import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTempDirectory, cleanupTempDirectory } from '../helpers/temp-utils.js';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Template Rendering Pipeline Integration', () => {
  let tempDir;
  let templatesDir;
  let outputDir;
  let generator;
  let frontmatterParser;

  beforeEach(async () => {
    tempDir = await createTempDirectory();
    templatesDir = path.join(tempDir, '_templates');
    outputDir = path.join(tempDir, 'output');
    
    await fs.ensureDir(templatesDir);
    await fs.ensureDir(outputDir);
    
    generator = new Generator();
    generator.templatesDir = templatesDir;
    
    frontmatterParser = new FrontmatterParser();
  });

  afterEach(async () => {
    await cleanupTempDirectory(tempDir);
  });

  describe('CLI Command Processing to File Output', () => {
    it('should trace complete workflow: CLI → variables → rendering → file creation', async () => {
      // STEP 1: Create template with filters in frontmatter and content
      const templateDir = path.join(templatesDir, 'component', 'vue');
      await fs.ensureDir(templateDir);
      
      const templateContent = `---
to: "{{ dest }}/components/{{ name | pascalCase }}.vue"
inject: false
---
<template>
  <div class="{{ name | kebabCase }}-component">
    <h2>{{ name | titleCase }}</h2>
    <p>Created on: {{ now() | formatDate('YYYY-MM-DD') }}</p>
    <p>Slug: {{ name | slug }}</p>
    <p>Table Name: {{ name | tableize }}</p>
    <p>Fake Email: {{ '' | fakeEmail }}</p>
  </div>
</template>

<script>
export default {
  name: '{{ name | pascalCase }}',
  props: {
    id: {
      type: String,
      default: '{{ '' | fakeUuid }}'
    }
  },
  data() {
    return {
      createdAt: '{{ fakeDate() | formatDate('YYYY-MM-DD') }}',
      isActive: {{ fakeBoolean() }}
    }
  }
}
</script>

<style scoped>
.{{ name | kebabCase }}-component {
  padding: 1rem;
  border: 1px solid #ddd;
}
</style>`;

      await fs.writeFile(
        path.join(templateDir, 'component.vue.njk'),
        templateContent
      );

      // STEP 2: Simulate CLI variable extraction
      const variables = {
        name: 'user-profile',
        dest: outputDir
      };

      // STEP 3: Test Nunjucks environment setup with filters
      const nunjucksEnv = new nunjucks.Environment(
        new nunjucks.FileSystemLoader(templatesDir),
        {
          autoescape: false,
          throwOnUndefined: false
        }
      );
      
      // Verify filters are added
      addCommonFilters(nunjucksEnv);
      
      // Test individual filter registration
      expect(nunjucksEnv.filters.pascalCase).toBeDefined();
      expect(nunjucksEnv.filters.kebabCase).toBeDefined();
      expect(nunjucksEnv.filters.titleCase).toBeDefined();
      expect(nunjucksEnv.filters.slug).toBeDefined();
      expect(nunjucksEnv.filters.tableize).toBeDefined();
      expect(nunjucksEnv.filters.fakeEmail).toBeDefined();
      expect(nunjucksEnv.filters.fakeUuid).toBeDefined();
      expect(nunjucksEnv.filters.formatDate).toBeDefined();
      expect(nunjucksEnv.globals.now).toBeDefined();
      expect(nunjucksEnv.globals.fakeDate).toBeDefined();
      expect(nunjucksEnv.globals.fakeBoolean).toBeDefined();

      // STEP 4: Test frontmatter processing with filter integration
      const { data: frontmatter, content } = matter(templateContent);
      
      // Test that frontmatter 'to' field can be rendered with filters
      const renderedPath = nunjucksEnv.renderString(frontmatter.to, variables);
      expect(renderedPath).toBe(`${outputDir}/components/UserProfile.vue`);

      // STEP 5: Test template body rendering with all filters
      const renderedContent = nunjucksEnv.renderString(content, variables);
      
      // Verify filter applications in rendered content
      expect(renderedContent).toContain('user-profile-component'); // kebabCase
      expect(renderedContent).toContain('User Profile'); // titleCase  
      expect(renderedContent).toContain('UserProfile'); // pascalCase
      expect(renderedContent).toContain('user-profile'); // slug
      expect(renderedContent).toContain('user_profiles'); // tableize
      expect(renderedContent).toMatch(/@[\w.-]+\.\w+/); // fakeEmail pattern
      expect(renderedContent).toMatch(/[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}/i); // UUID pattern
      expect(renderedContent).toMatch(/\d{4}-\d{2}-\d{2}/); // date format
      expect(renderedContent).toMatch(/(true|false)/); // boolean

      // STEP 6: Test complete generation workflow
      const result = await generator.generate({
        generator: 'component',
        template: 'vue',
        dest: outputDir,
        variables,
        dry: false,
        force: true
      });

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe(path.join(outputDir, 'components', 'UserProfile.vue'));

      // STEP 7: Verify file was actually created with correct content
      const outputFile = path.join(outputDir, 'components', 'UserProfile.vue');
      expect(await fs.pathExists(outputFile)).toBe(true);
      
      const actualContent = await fs.readFile(outputFile, 'utf8');
      expect(actualContent).toContain('user-profile-component');
      expect(actualContent).toContain('User Profile');
      expect(actualContent).toContain('UserProfile');
      expect(actualContent).toContain('user_profiles');
    });

    it('should handle complex filter chains and nested contexts', async () => {
      // Create template with complex filter chains
      const templateDir = path.join(templatesDir, 'api', 'route');
      await fs.ensureDir(templateDir);
      
      const templateContent = `---
to: "{{ dest }}/routes/{{ name | pluralize | kebabCase }}/{{ method | lowerCase }}.js"
inject: false
---
// {{ name | pluralize | titleCase }} {{ method | upperCase }} Route
// Generated: {{ now() | formatDate('YYYY-MM-DD HH:mm:ss') }}

const express = require('express');
const router = express.Router();

/**
 * {{ method | upperCase }} /{{ name | pluralize | kebabCase }}
 * @description {{ description | default('Handle ' + name + ' operations') }}
 * @example {{ fakeEmail() }}
 */
router.{{ method | lowerCase }}('/{{ name | pluralize | kebabCase }}', async (req, res) => {
  try {
    const data = {
      id: '{{ '' | fakeUuid }}',
      name: '{{ fakeName() }}',
      email: '{{ fakeEmail() }}',
      createdAt: '{{ now() | formatDate('YYYY-MM-DDTHH:mm:ss.SSSZ') }}',
      slug: '{{ name | slug }}-{{ fakeNumber(1, 999) }}',
      tableName: '{{ name | tableize }}',
      className: '{{ name | classify }}',
      isActive: {{ fakeBoolean() }}
    };
    
    res.json({
      success: true,
      data,
      timestamp: '{{ now() | dateIso }}'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: '{{ now() | dateIso }}'
    });
  }
});

module.exports = router;`;

      await fs.writeFile(
        path.join(templateDir, 'route.js.njk'),
        templateContent
      );

      const variables = {
        name: 'blogPost',
        method: 'GET',
        description: 'Retrieve blog posts from the database',
        dest: outputDir
      };

      const result = await generator.generate({
        generator: 'api',
        template: 'route',
        dest: outputDir,
        variables,
        dry: false,
        force: true
      });

      expect(result.success).toBe(true);
      
      const outputFile = path.join(outputDir, 'routes', 'blog-posts', 'get.js');
      expect(await fs.pathExists(outputFile)).toBe(true);
      
      const content = await fs.readFile(outputFile, 'utf8');
      expect(content).toContain('// Blog Posts GET Route');
      expect(content).toContain('GET /blog-posts');
      expect(content).toContain('router.get(\'/blog-posts\'');
      expect(content).toContain('tableName: \'blog_posts\'');
      expect(content).toContain('className: \'BlogPost\'');
      expect(content).toContain('slug: \'blog-post-');
      expect(content).toMatch(/@[\w.-]+\.\w+/); // email pattern
      expect(content).toMatch(/[\da-f-]{36}/); // UUID pattern
    });
  });

  describe('Filter Integration Validation', () => {
    it('should validate day.js and faker.js integration across pipeline', async () => {
      const templateDir = path.join(templatesDir, 'test', 'filters');
      await fs.ensureDir(templateDir);
      
      const templateContent = `---
to: "{{ dest }}/test-filters.json"
---
{
  "stringFilters": {
    "original": "{{ testString }}",
    "pascalCase": "{{ testString | pascalCase }}",
    "camelCase": "{{ testString | camelCase }}",
    "kebabCase": "{{ testString | kebabCase }}",
    "snakeCase": "{{ testString | snakeCase }}",
    "constantCase": "{{ testString | constantCase }}",
    "titleCase": "{{ testString | titleCase }}",
    "slug": "{{ testString | slug }}"
  },
  "dateFilters": {
    "now": "{{ now() | formatDate('YYYY-MM-DD') }}",
    "isoDate": "{{ now() | dateIso }}",
    "unixTime": {{ now() | dateUnix }},
    "fromNow": "{{ now() | dateAdd(1, 'day') | dateFrom }}",
    "customFormat": "{{ now() | formatDate('MMMM Do, YYYY') }}"
  },
  "fakerFilters": {
    "name": "{{ '' | fakeName }}",
    "email": "{{ '' | fakeEmail }}",
    "uuid": "{{ '' | fakeUuid }}",
    "number": {{ '' | fakeNumber(1, 100) }},
    "boolean": {{ '' | fakeBoolean }},
    "text": "{{ '' | fakeText(2) }}",
    "company": "{{ '' | fakeCompany }}"
  }
}`;

      await fs.writeFile(
        path.join(templateDir, 'filters.json.njk'),
        templateContent
      );

      const variables = {
        testString: 'hello_world_test',
        dest: outputDir
      };

      const result = await generator.generate({
        generator: 'test',
        template: 'filters',
        dest: outputDir,
        variables,
        dry: false,
        force: true
      });

      expect(result.success).toBe(true);
      
      const outputFile = path.join(outputDir, 'test-filters.json');
      expect(await fs.pathExists(outputFile)).toBe(true);
      
      const content = await fs.readFile(outputFile, 'utf8');
      const parsed = JSON.parse(content);
      
      // Validate string filters
      expect(parsed.stringFilters.pascalCase).toBe('HelloWorldTest');
      expect(parsed.stringFilters.camelCase).toBe('helloWorldTest');
      expect(parsed.stringFilters.kebabCase).toBe('hello-world-test');
      expect(parsed.stringFilters.snakeCase).toBe('hello_world_test');
      expect(parsed.stringFilters.constantCase).toBe('HELLO_WORLD_TEST');
      expect(parsed.stringFilters.titleCase).toBe('Hello World Test');
      expect(parsed.stringFilters.slug).toBe('hello-world-test');
      
      // Validate date filters
      expect(parsed.dateFilters.now).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(parsed.dateFilters.isoDate).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(typeof parsed.dateFilters.unixTime).toBe('number');
      expect(parsed.dateFilters.fromNow).toContain('in');
      expect(parsed.dateFilters.customFormat).toMatch(/\w+ \d+(st|nd|rd|th), \d{4}/);
      
      // Validate faker filters
      expect(typeof parsed.fakerFilters.name).toBe('string');
      expect(parsed.fakerFilters.email).toMatch(/@/);
      expect(parsed.fakerFilters.uuid).toMatch(/[\da-f-]{36}/);
      expect(typeof parsed.fakerFilters.number).toBe('number');
      expect(typeof parsed.fakerFilters.boolean).toBe('boolean');
      expect(typeof parsed.fakerFilters.text).toBe('string');
      expect(typeof parsed.fakerFilters.company).toBe('string');
    });

    it('should handle filter errors gracefully without breaking pipeline', async () => {
      const templateDir = path.join(templatesDir, 'test', 'error-handling');
      await fs.ensureDir(templateDir);
      
      const templateContent = `---
to: "{{ dest }}/error-test.txt"
---
Valid filters:
- Name: {{ name | pascalCase }}
- Slug: {{ name | slug }}

Error cases (should not break):
- Invalid date: {{ 'invalid-date' | formatDate }}
- Null input: {{ null | pascalCase }}
- Undefined filter result: {{ '' | fakeEmail }}

Should still work after errors:
- UUID: {{ '' | fakeUuid }}
- Current date: {{ now() | formatDate }}`;

      await fs.writeFile(
        path.join(templateDir, 'error-test.txt.njk'),
        templateContent
      );

      const variables = {
        name: 'test-component',
        dest: outputDir
      };

      const result = await generator.generate({
        generator: 'test',
        template: 'error-handling',
        dest: outputDir,
        variables,
        dry: false,
        force: true
      });

      expect(result.success).toBe(true);
      
      const outputFile = path.join(outputDir, 'error-test.txt');
      expect(await fs.pathExists(outputFile)).toBe(true);
      
      const content = await fs.readFile(outputFile, 'utf8');
      expect(content).toContain('TestComponent'); // pascalCase worked
      expect(content).toContain('test-component'); // slug worked
      expect(content).toMatch(/UUID: [\da-f-]{36}/); // UUID worked after errors
      expect(content).toMatch(/Current date: \d{4}-\d{2}-\d{2}/); // date worked
    });
  });

  describe('File Injection with Filtered Content', () => {
    it('should inject filtered content into existing files', async () => {
      // Create existing file to inject into
      const targetFile = path.join(outputDir, 'config.js');
      await fs.writeFile(targetFile, `module.exports = {
  // Configuration file
  app: {
    name: 'My App'
  }
};`);

      const templateDir = path.join(templatesDir, 'config', 'feature');
      await fs.ensureDir(templateDir);
      
      const templateContent = `---
to: "{{ dest }}/config.js"
inject: true
after: "app: {"
---
    {{ featureName | camelCase }}: {
      enabled: {{ enabled | default(true) }},
      apiKey: '{{ '' | fakeUuid }}',
      endpoint: '/api/{{ featureName | kebabCase }}',
      tableName: '{{ featureName | tableize }}',
      createdAt: '{{ now() | formatDate('YYYY-MM-DD') }}'
    },`;

      await fs.writeFile(
        path.join(templateDir, 'feature-config.js.njk'),
        templateContent
      );

      const variables = {
        featureName: 'userAuth',
        enabled: true,
        dest: outputDir
      };

      const result = await generator.generate({
        generator: 'config',
        template: 'feature',
        dest: outputDir,
        variables,
        dry: false,
        force: true
      });

      expect(result.success).toBe(true);
      
      const content = await fs.readFile(targetFile, 'utf8');
      expect(content).toContain('userAuth: {');
      expect(content).toContain('enabled: true');
      expect(content).toContain('endpoint: \'/api/user-auth\'');
      expect(content).toContain('tableName: \'user_auths\'');
      expect(content).toMatch(/apiKey: '[\da-f-]{36}'/);
      expect(content).toMatch(/createdAt: '\d{4}-\d{2}-\d{2}'/);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large templates with many filters efficiently', async () => {
      const templateDir = path.join(templatesDir, 'performance', 'large');
      await fs.ensureDir(templateDir);
      
      // Generate a template with many filter applications
      let templateContent = `---
to: "{{ dest }}/large-template.json"
---
{
  "metadata": {
    "generated": "{{ now() | formatDate('YYYY-MM-DD HH:mm:ss') }}",
    "uuid": "{{ '' | fakeUuid }}"
  },
  "items": [`;

      // Add 100 items with multiple filters each
      for (let i = 1; i <= 100; i++) {
        templateContent += `
    {
      "id": ${i},
      "name": "{{ 'item' + ${i} | pascalCase }}",
      "slug": "{{ 'item_' + ${i} | kebabCase }}",
      "table": "{{ 'item' + ${i} | tableize }}",
      "class": "{{ 'item' + ${i} | classify }}",
      "fake": {
        "email": "{{ '' | fakeEmail }}",
        "uuid": "{{ '' | fakeUuid }}",
        "name": "{{ '' | fakeName }}",
        "number": {{ '' | fakeNumber(1, 1000) }}
      }
    }${i < 100 ? ',' : ''}`;
      }

      templateContent += `
  ]
}`;

      await fs.writeFile(
        path.join(templateDir, 'large.json.njk'),
        templateContent
      );

      const startTime = this.getDeterministicTimestamp();
      
      const result = await generator.generate({
        generator: 'performance',
        template: 'large',
        dest: outputDir,
        variables: { dest: outputDir },
        dry: false,
        force: true
      });

      const duration = this.getDeterministicTimestamp() - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      const outputFile = path.join(outputDir, 'large-template.json');
      expect(await fs.pathExists(outputFile)).toBe(true);
      
      const content = await fs.readFile(outputFile, 'utf8');
      const parsed = JSON.parse(content);
      
      expect(parsed.items).toHaveLength(100);
      expect(parsed.items[0].name).toBe('Item1');
      expect(parsed.items[0].slug).toBe('item-1');
      expect(parsed.items[0].fake.email).toMatch(/@/);
    });
  });
});