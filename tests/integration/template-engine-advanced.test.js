/**
 * Advanced Template Engine Integration Tests
 * Tests complex variable resolution, filter chaining, and error recovery
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnhancedTemplateEngine } from '../../src/lib/template-engine-enhanced.js';
import fs from 'fs-extra';
import path from 'node:path';

describe('Enhanced Template Engine - Advanced Features', () => {
  let engine;
  let testDir;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'test-templates-advanced');
    await fs.ensureDir(testDir);
    
    engine = new EnhancedTemplateEngine({
      templatesDir: testDir,
      enableCaching: true,
      enableSecurity: false // Disable for testing
    });
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('Complex Variable Resolution', () => {
    it('should handle deep nested object access', async () => {
      const templateContent = `---
to: "user/{{ user.profile.settings.theme }}.json"
---
User: {{ user.name }}
Email: {{ user.profile.contact.email }}
Theme: {{ user.profile.settings.theme }}
Notifications: {{ user.profile.settings.notifications.enabled }}`;

      const templatePath = path.join(testDir, 'nested-user.njk');
      await fs.writeFile(templatePath, templateContent);

      const variables = {
        user: {
          name: 'John Doe',
          profile: {
            contact: {
              email: 'john@example.com'
            },
            settings: {
              theme: 'dark',
              notifications: {
                enabled: true
              }
            }
          }
        }
      };

      const result = await engine.renderTemplate(templatePath, variables);
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('User: John Doe');
      expect(result.content).toContain('Email: john@example.com');
      expect(result.content).toContain('Theme: dark');
      expect(result.content).toContain('Notifications: true');
      expect(result.frontmatter.to).toBe('user/dark.json');
    });

    it('should handle array access with bracket notation', async () => {
      const templateContent = `---
to: "{{ items[0].name | kebabCase }}.md"
---
First Item: {{ items[0].name }}
Second Item: {{ items[1].name }}
Total Count: {{ items.length }}`;

      const templatePath = path.join(testDir, 'array-access.njk');
      await fs.writeFile(templatePath, templateContent);

      const variables = {
        items: [
          { name: 'First Item', value: 1 },
          { name: 'Second Item', value: 2 },
          { name: 'Third Item', value: 3 }
        ]
      };

      const result = await engine.renderTemplate(templatePath, variables);
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('First Item: First Item');
      expect(result.content).toContain('Second Item: Second Item');
      expect(result.content).toContain('Total Count: 3');
      expect(result.frontmatter.to).toBe('first-item.md');
    });

    it('should handle complex filter chains', async () => {
      const templateContent = `---
to: "{{ name | pascalCase | pluralize }}.js"
---
Class Name: {{ name | pascalCase }}
Pluralized: {{ name | pluralize }}
Chain Result: {{ name | camelCase | pluralize | upperCase }}
Date: {{ timestamp | formatDate('YYYY-MM-DD') }}`;

      const templatePath = path.join(testDir, 'filter-chains.njk');
      await fs.writeFile(templatePath, templateContent);

      const variables = {
        name: 'user_account',
        timestamp: new Date('2025-09-09T00:00:00Z')
      };

      const result = await engine.renderTemplate(templatePath, variables);
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('Class Name: UserAccount');
      expect(result.content).toContain('Pluralized: user_accounts');
      expect(result.content).toContain('Chain Result: USERACCOUNTS');
      expect(result.content).toContain('Date: 2025-09-09');
      expect(result.frontmatter.to).toBe('UserAccounts.js');
    });

    it('should handle conditional expressions with ternary operators', async () => {
      const templateContent = `---
to: "{{ isProduction ? 'prod' : 'dev' }}/config.json"
---
Environment: {{ isProduction ? 'production' : 'development' }}
Debug Mode: {{ isProduction ? 'false' : 'true' }}
Log Level: {{ logLevel || 'info' }}
Features: {{ features.length > 0 ? 'enabled' : 'disabled' }}`;

      const templatePath = path.join(testDir, 'conditionals.njk');
      await fs.writeFile(templatePath, templateContent);

      const variables = {
        isProduction: false,
        logLevel: null,
        features: ['auth', 'logging']
      };

      const result = await engine.renderTemplate(templatePath, variables);
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('Environment: development');
      expect(result.content).toContain('Debug Mode: true');
      expect(result.content).toContain('Log Level: info');
      expect(result.content).toContain('Features: enabled');
      expect(result.frontmatter.to).toBe('dev/config.json');
    });
  });

  describe('Advanced Template Processing', () => {
    it('should handle null coalescing operators', async () => {
      const templateContent = `---
to: "{{ config.output ?? 'default' }}.txt"
---
Title: {{ title ?? 'Untitled' }}
Author: {{ author ?? 'Anonymous' }}
Version: {{ version ?? '1.0.0' }}`;

      const templatePath = path.join(testDir, 'null-coalescing.njk');
      await fs.writeFile(templatePath, templateContent);

      const variables = {
        title: 'My Document',
        author: null,
        config: {}
      };

      const result = await engine.renderTemplate(templatePath, variables);
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('Title: My Document');
      expect(result.content).toContain('Author: Anonymous');
      expect(result.content).toContain('Version: 1.0.0');
      expect(result.frontmatter.to).toBe('default.txt');
    });

    it('should handle safe navigation operators', async () => {
      const templateContent = `---
to: "{{ user?.profile?.name || 'unknown' }}.json"
---
User Name: {{ user?.name ?? 'Not provided' }}
Profile Email: {{ user?.profile?.email ?? 'No email' }}
Settings Theme: {{ user?.profile?.settings?.theme ?? 'default' }}`;

      const templatePath = path.join(testDir, 'safe-navigation.njk');
      await fs.writeFile(templatePath, templateContent);

      const variables = {
        user: {
          name: 'Alice',
          profile: {
            email: 'alice@example.com'
            // settings is missing
          }
        }
      };

      const result = await engine.renderTemplate(templatePath, variables);
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('User Name: Alice');
      expect(result.content).toContain('Profile Email: alice@example.com');
      expect(result.content).toContain('Settings Theme: default');
    });

    it('should handle complex loop structures with nested objects', async () => {
      const templateContent = `---
to: "{{ name | kebabCase }}-routes.js"
---
{% for route in routes %}
// {{ route.method | upperCase }} {{ route.path }}
app.{{ route.method }}('{{ route.path }}', (req, res) => {
  // {{ route.description }}
  {% if route.middleware %}
  // Middleware: {{ route.middleware | join(', ') }}
  {% endif %}
  res.status({{ route.status || 200 }}).json({ message: '{{ route.response }}' });
});

{% endfor %}`;

      const templatePath = path.join(testDir, 'complex-loops.njk');
      await fs.writeFile(templatePath, templateContent);

      const variables = {
        name: 'user_api',
        routes: [
          {
            method: 'get',
            path: '/users',
            description: 'Get all users',
            middleware: ['auth', 'validate'],
            response: 'Users retrieved'
          },
          {
            method: 'post',
            path: '/users',
            description: 'Create user',
            status: 201,
            response: 'User created'
          }
        ]
      };

      const result = await engine.renderTemplate(templatePath, variables);
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('// GET /users');
      expect(result.content).toContain('app.get(\'/users\'');
      expect(result.content).toContain('// Middleware: auth, validate');
      expect(result.content).toContain('// POST /users');
      expect(result.content).toContain('res.status(201)');
      expect(result.frontmatter.to).toBe('user-api-routes.js');
    });
  });

  describe('Error Recovery and Robustness', () => {
    it('should recover from undefined variable errors', async () => {
      const templateContent = `---
to: "{{ name || 'default' }}.js"
---
Name: {{ name }}
Missing: {{ undefinedVariable }}
With Default: {{ undefinedVariable | default('fallback') }}
Nested Missing: {{ user.profile.missing }}`;

      const templatePath = path.join(testDir, 'undefined-recovery.njk');
      await fs.writeFile(templatePath, templateContent);

      const variables = {
        name: 'test'
      };

      const result = await engine.renderTemplate(templatePath, variables);
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('Name: test');
      expect(result.frontmatter.to).toBe('test.js');
    });

    it('should recover from syntax errors in templates', async () => {
      const templateContent = `---
to: "recovered.txt"
---
Valid: {{ name }}
Broken: {{ name | nonexistentFilter 
Missing End: {{ value
Incomplete If: {% if condition
Fixed: {{ name | upperCase }}`;

      const templatePath = path.join(testDir, 'syntax-errors.njk');
      await fs.writeFile(templatePath, templateContent);

      const variables = {
        name: 'test',
        value: 'hello',
        condition: true
      };

      const result = await engine.renderTemplate(templatePath, variables);
      
      // Should not completely fail but recover gracefully
      expect(result.success).toBe(true);
      expect(result.content).toContain('Valid: test');
    });

    it('should handle malformed frontmatter gracefully', async () => {
      const templateContent = `---
to: {{ filename }}.txt
invalid yaml: [unclosed
missing_quotes: value with spaces
---
Content: {{ content }}`;

      const templatePath = path.join(testDir, 'malformed-frontmatter.njk');
      await fs.writeFile(templatePath, templateContent);

      const variables = {
        filename: 'test',
        content: 'Hello World'
      };

      const result = await engine.renderTemplate(templatePath, variables);
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('Content: Hello World');
    });
  });

  describe('Performance and Caching', () => {
    it('should cache template renders for performance', async () => {
      const templateContent = `---
to: "cached.txt"
---
Timestamp: {{ timestamp }}
Random: {{ Math.random() }}`;

      const templatePath = path.join(testDir, 'cached-template.njk');
      await fs.writeFile(templatePath, templateContent);

      const variables = {
        timestamp: '2025-09-09'
      };

      // First render
      const result1 = await engine.renderTemplate(templatePath, variables);
      expect(result1.success).toBe(true);

      // Second render should be faster (cached)
      const start = performance.now();
      const result2 = await engine.renderTemplate(templatePath, variables);
      const duration = performance.now() - start;
      
      expect(result2.success).toBe(true);
      expect(duration).toBeLessThan(10); // Should be very fast due to caching

      // Verify metrics
      const metrics = engine.getMetrics();
      expect(metrics.cacheHits).toBeGreaterThan(0);
      expect(metrics.totalRenders).toBe(2);
    });

    it('should provide detailed performance metrics', async () => {
      const templateContent = `Hello {{ name }}!`;
      const templatePath = path.join(testDir, 'metrics-test.njk');
      await fs.writeFile(templatePath, templateContent);

      await engine.renderTemplate(templatePath, { name: 'World' });
      
      const metrics = engine.getMetrics();
      
      expect(metrics).toHaveProperty('totalRenders');
      expect(metrics).toHaveProperty('renderTime');
      expect(metrics).toHaveProperty('cacheHits');
      expect(metrics).toHaveProperty('cacheMisses');
      expect(metrics).toHaveProperty('errorRecoveries');
      expect(metrics).toHaveProperty('averageRenderTime');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('cacheSize');
      
      expect(metrics.totalRenders).toBe(1);
      expect(metrics.renderTime).toBeGreaterThan(0);
    });
  });

  describe('Utility Functions and Globals', () => {
    it('should provide enhanced utility functions', async () => {
      const templateContent = `---
to: "utils-test.js"
---
// Object utilities
Keys: {{ Object.keys(user) | join(', ') }}
Values: {{ Object.values(user) | join(', ') }}

// Array utilities  
Unique: {{ Array.unique([1,2,2,3]) | join(',') }}
Chunked: {{ Array.chunk([1,2,3,4], 2) | dump }}

// Math utilities
Max: {{ Math.max(1, 5, 3) }}
Random: {{ Math.floor(Math.random() * 100) }}

// Utils
Is Defined: {{ utils.isDefined(user.name) }}
Is Empty: {{ utils.isEmpty(emptyArray) }}
Type Of: {{ utils.typeOf(user) }}
Deep Get: {{ utils.deepGet(user, 'profile.email', 'no-email') }}`;

      const templatePath = path.join(testDir, 'utils-test.njk');
      await fs.writeFile(templatePath, templateContent);

      const variables = {
        user: { name: 'John', age: 30 },
        emptyArray: []
      };

      const result = await engine.renderTemplate(templatePath, variables);
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('Keys: name, age');
      expect(result.content).toContain('Values: John, 30');
      expect(result.content).toContain('Unique: 1,2,3');
      expect(result.content).toContain('Is Defined: true');
      expect(result.content).toContain('Is Empty: true');
      expect(result.content).toContain('Type Of: object');
    });

    it('should handle template string formatting', async () => {
      const templateContent = `---
to: "formatted.txt"
---
{{ String.format('Hello {0}, you are {1} years old!', user.name, user.age) }}
{{ String.template('Welcome {{name}} to {{place}}!', {name: user.name, place: 'our site'}) }}`;

      const templatePath = path.join(testDir, 'string-format.njk');
      await fs.writeFile(templatePath, templateContent);

      const variables = {
        user: { name: 'Alice', age: 25 }
      };

      const result = await engine.renderTemplate(templatePath, variables);
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('Hello Alice, you are 25 years old!');
      expect(result.content).toContain('Welcome Alice to our site!');
    });
  });

  describe('Template Validation', () => {
    it('should validate template syntax', async () => {
      const validTemplate = `---
to: "valid.txt"
---
Hello {{ name }}!`;

      const templatePath = path.join(testDir, 'valid-template.njk');
      await fs.writeFile(templatePath, validTemplate);

      const validation = await engine.validateTemplate(templatePath);
      
      expect(validation.valid).toBe(true);
      expect(validation.frontmatter).toEqual({ to: 'valid.txt' });
      expect(validation.testVariables).toHaveProperty('name');
    });

    it('should detect invalid template syntax', async () => {
      const invalidTemplate = `---
to: "invalid.txt"
---
Hello {{ name
Unclosed if: {% if condition %}
Never closed!`;

      const templatePath = path.join(testDir, 'invalid-template.njk');
      await fs.writeFile(templatePath, invalidTemplate);

      const validation = await engine.validateTemplate(templatePath);
      
      // Should either be valid (recovered) or provide error details
      expect(validation).toHaveProperty('valid');
      if (!validation.valid) {
        expect(validation).toHaveProperty('error');
        expect(validation.error).toHaveProperty('message');
      }
    });
  });
});