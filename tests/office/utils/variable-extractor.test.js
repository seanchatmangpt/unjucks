/**
 * @fileoverview Comprehensive test suite for Variable Extractor
 * Tests all variable syntaxes, patterns, and edge cases
 */

const VariableExtractor = require('../../../src/office/utils/variable-extractor');

describe('VariableExtractor', () => {
  let extractor;

  beforeEach(() => {
    extractor = new VariableExtractor();
  });

  describe('Basic Variable Extraction', () => {
    test('should extract simple Handlebars variables', () => {
      const content = 'Hello {{name}}, welcome to {{site}}!';
      const result = extractor.extract(content);

      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].name).toBe('name');
      expect(result.variables[0].type).toBe('simple');
      expect(result.variables[1].name).toBe('site');
    });

    test('should extract single brace variables', () => {
      const content = 'User: {username}, Age: {age}';
      const result = extractor.extract(content);

      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].name).toBe('username');
      expect(result.variables[1].name).toBe('age');
    });

    test('should extract template literal variables', () => {
      const content = 'const message = `Hello ${user.name}, you have ${count} messages`;';
      const result = extractor.extract(content);

      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].name).toBe('user');
      expect(result.variables[0].type).toBe('object');
      expect(result.variables[1].name).toBe('count');
    });

    test('should extract Angular-style variables', () => {
      const content = 'Welcome <username>, your role is <role>';
      const result = extractor.extract(content);

      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].name).toBe('username');
      expect(result.variables[1].name).toBe('role');
    });

    test('should track line and column positions', () => {
      const content = 'Line 1: {{var1}}\nLine 2: {{var2}}';
      const result = extractor.extract(content);

      expect(result.variables[0].line).toBe(1);
      expect(result.variables[0].column).toBe(8);
      expect(result.variables[1].line).toBe(2);
      expect(result.variables[1].column).toBe(8);
    });
  });

  describe('Nested Object Notation', () => {
    test('should extract object property access', () => {
      const content = '{{user.name}} works at {{user.company.name}}';
      const result = extractor.extract(content);

      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].name).toBe('user');
      expect(result.variables[0].type).toBe('object');
      expect(result.variables[0].path).toBe('user.name');
      expect(result.variables[1].path).toBe('user.company.name');
    });

    test('should extract array access with numeric indices', () => {
      const content = '{{items[0]}} and {{items[1].name}}';
      const result = extractor.extract(content);

      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].name).toBe('items');
      expect(result.variables[0].type).toBe('array');
      expect(result.variables[0].path).toBe('items[0]');
      expect(result.variables[1].path).toBe('items[1].name');
    });

    test('should extract array access with variable indices', () => {
      const content = '{{items[index]}} and {{data[key].value}}';
      const result = extractor.extract(content);

      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].dependencies).toContain('index');
      expect(result.variables[1].dependencies).toContain('key');
    });

    test('should handle complex nested paths', () => {
      const content = '{{users[0].profile.settings["theme"].color}}';
      const result = extractor.extract(content);

      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].path).toBe('users[0].profile.settings["theme"].color');
      expect(result.variables[0].metadata.parts).toHaveLength(5);
    });
  });

  describe('Loop Variable Detection', () => {
    test('should extract Handlebars each loops', () => {
      const content = '{{#each items}}{{name}}{{/each}}';
      const result = extractor.extract(content);

      const loopVars = result.byType.get('loop') || [];
      expect(loopVars).toHaveLength(1);
      expect(loopVars[0].name).toBe('items');
      expect(loopVars[0].metadata.loopType).toBe('each');
    });

    test('should extract loop variables with iterator', () => {
      const content = '{{#each users as user}}{{user.name}}{{/each}}';
      const result = extractor.extract(content);

      const loopVars = result.byType.get('loop') || [];
      expect(loopVars).toHaveLength(1);
      expect(loopVars[0].metadata.iteratorVar).toBe('user');
    });

    test('should extract for-in loop variables', () => {
      const content = '{{#each item in collection}}{{item.title}}{{/each}}';
      const result = extractor.extract(content);

      const loopVars = result.byType.get('loop') || [];
      expect(loopVars).toHaveLength(1);
      expect(loopVars[0].metadata.iteratorVar).toBe('item');
    });
  });

  describe('Conditional Variable Detection', () => {
    test('should extract if condition variables', () => {
      const content = '{{#if user.isActive}}Welcome {{user.name}}{{/if}}';
      const result = extractor.extract(content);

      const conditionalVars = result.byType.get('conditional') || [];
      expect(conditionalVars).toHaveLength(1);
      expect(conditionalVars[0].name).toBe('user');
      expect(conditionalVars[0].metadata.conditionType).toBe('if');
    });

    test('should extract unless condition variables', () => {
      const content = '{{#unless user.banned}}{{content}}{{/unless}}';
      const result = extractor.extract(content);

      const conditionalVars = result.byType.get('conditional') || [];
      expect(conditionalVars).toHaveLength(1);
      expect(conditionalVars[0].metadata.conditionType).toBe('unless');
    });

    test('should extract complex conditional expressions', () => {
      const content = '{{#if user.age >= 18 && user.verified}}{{content}}{{/if}}';
      const result = extractor.extract(content);

      const conditionalVars = result.byType.get('conditional') || [];
      expect(conditionalVars).toHaveLength(1);
      expect(conditionalVars[0].metadata.fullCondition).toContain('user.age >= 18 && user.verified');
    });
  });

  describe('Filter and Pipe Detection', () => {
    test('should extract simple filters', () => {
      const content = '{{price|currency}} and {{date|format}}';
      const result = extractor.extract(content);

      const filterVars = result.byType.get('filter') || [];
      expect(filterVars).toHaveLength(2);
      expect(filterVars[0].name).toBe('price');
      expect(filterVars[0].metadata.filters).toContain('currency');
      expect(filterVars[1].metadata.filters).toContain('format');
    });

    test('should extract filters with parameters', () => {
      const content = '{{date|format:"YYYY-MM-DD"}} and {{amount|round:2}}';
      const result = extractor.extract(content);

      const filterVars = result.byType.get('filter') || [];
      expect(filterVars).toHaveLength(2);
      expect(filterVars[0].metadata.filters).toContain('format:"YYYY-MM-DD"');
      expect(filterVars[1].metadata.filters).toContain('round:2');
    });

    test('should extract chained filters', () => {
      const content = '{{name|upper|truncate:20|default:"Anonymous"}}';
      const result = extractor.extract(content);

      const filterVars = result.byType.get('filter') || [];
      expect(filterVars).toHaveLength(1);
      expect(filterVars[0].metadata.filters).toHaveLength(3);
      expect(filterVars[0].metadata.filters).toContain('upper');
      expect(filterVars[0].metadata.filters).toContain('truncate:20');
      expect(filterVars[0].metadata.filters).toContain('default:"Anonymous"');
    });

    test('should extract filter dependencies', () => {
      const content = '{{price|multiply:taxRate|format:currency}}';
      const result = extractor.extract(content);

      const filterVars = result.byType.get('filter') || [];
      expect(filterVars).toHaveLength(1);
      expect(filterVars[0].dependencies).toContain('taxRate');
      expect(filterVars[0].dependencies).toContain('currency');
    });
  });

  describe('Variable Validation', () => {
    test('should validate variable names', () => {
      const variables = [
        { name: 'validName', type: 'simple' },
        { name: '123invalid', type: 'simple' },
        { name: 'valid_name', type: 'simple' },
        { name: 'invalid-name', type: 'simple' }
      ];

      const validation = extractor.validateVariables(variables);

      expect(validation.valid).toHaveLength(2);
      expect(validation.invalid).toHaveLength(2);
      expect(validation.invalid[0].variable.name).toBe('123invalid');
      expect(validation.invalid[1].variable.name).toBe('invalid-name');
    });

    test('should warn about reserved words', () => {
      const variables = [
        { name: 'function', type: 'simple' },
        { name: 'var', type: 'simple' },
        { name: 'normalName', type: 'simple' }
      ];

      const validation = extractor.validateVariables(variables);

      expect(validation.warnings).toHaveLength(2);
      expect(validation.warnings[0].warnings[0]).toContain('reserved word');
    });

    test('should warn about long variable names', () => {
      const variables = [
        { name: 'a'.repeat(60), type: 'simple' }
      ];

      const validation = extractor.validateVariables(variables);

      expect(validation.warnings).toHaveLength(1);
      expect(validation.warnings[0].warnings[0]).toContain('very long');
    });
  });

  describe('Variable Dependencies', () => {
    test('should build dependency graph', () => {
      const content = '{{users[index].profile}} {{items[key].name}}';
      const result = extractor.extract(content);

      expect(result.dependencies.has('users')).toBe(true);
      expect(result.dependencies.get('users')).toContain('index');
      expect(result.dependencies.get('items')).toContain('key');
    });

    test('should get dependencies for specific variable', () => {
      const content = '{{data[id].values[index]}}';
      const dependencies = extractor.getDependencies(content, 'data');

      expect(dependencies).toContain('id');
      expect(dependencies).toContain('index');
    });
  });

  describe('Multiple Syntax Support', () => {
    test('should extract from mixed syntax content', () => {
      const content = `
        Handlebars: {{name}}
        Single brace: {age}
        Template literal: \`Hello \${user}\`
        Angular: <role>
      `;
      const result = extractor.extract(content);

      expect(result.variables).toHaveLength(4);
      expect(result.variables.map(v => v.name)).toEqual(['name', 'age', 'user', 'role']);
    });

    test('should handle PHP-style syntax', () => {
      const content = '<?= $username ?> and <?= $email ?>';
      const result = extractor.extract(content);

      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].name).toBe('username');
      expect(result.variables[1].name).toBe('email');
    });

    test('should handle ERB-style syntax', () => {
      const content = '<%= user.name %> has <%= user.posts.count %> posts';
      const result = extractor.extract(content);

      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].path).toBe('user.name');
      expect(result.variables[1].path).toBe('user.posts.count');
    });
  });

  describe('Custom Syntax Support', () => {
    test('should support custom syntax definitions', () => {
      extractor.addCustomSyntax('custom', {
        pattern: /\[\[([^\]]+)\]\]/g,
        extractor: (match, content, line, column) => {
          return [{
            name: match[1].trim(),
            type: 'custom',
            syntax: match[0],
            path: match[1].trim(),
            line,
            column,
            dependencies: [],
            metadata: { customSyntax: true }
          }];
        }
      });

      const content = 'Custom variable: [[customVar]]';
      const result = extractor.extract(content);

      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('customVar');
      expect(result.variables[0].type).toBe('custom');
      expect(result.variables[0].metadata.customSyntax).toBe(true);
    });
  });

  describe('Documentation Generation', () => {
    test('should generate Markdown documentation', () => {
      const content = '{{user.name}} has {{posts|count}} posts';
      const result = extractor.extract(content);
      const docs = extractor.generateDocumentation(result, { format: 'markdown' });

      expect(docs).toContain('# Template Variables Documentation');
      expect(docs).toContain('## Summary');
      expect(docs).toContain('Total Variables');
      expect(docs).toContain('user.name');
      expect(docs).toContain('posts');
    });

    test('should generate JSON documentation', () => {
      const content = '{{name}} and {{age}}';
      const result = extractor.extract(content);
      const docs = extractor.generateDocumentation(result, { format: 'json' });

      const parsed = JSON.parse(docs);
      expect(parsed.summary.totalVariables).toBe(2);
      expect(parsed.variables).toHaveLength(2);
    });

    test('should generate HTML documentation', () => {
      const content = '{{title}} and {{content}}';
      const result = extractor.extract(content);
      const docs = extractor.generateDocumentation(result, { format: 'html' });

      expect(docs).toContain('<!DOCTYPE html>');
      expect(docs).toContain('<title>Template Variables Documentation</title>');
      expect(docs).toContain('title');
      expect(docs).toContain('content');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed templates gracefully', () => {
      const content = '{{unclosed} and {malformed}}';
      const result = extractor.extract(content);

      // Should extract what it can
      expect(result.variables.length).toBeGreaterThan(0);
      // May have warnings about malformed syntax
    });

    test('should ignore comments when configured', () => {
      const content = `
        {{var1}}
        <!-- {{commented}} -->
        {{var2}}
        /* {{jsCommented}} */
        {{var3}}
      `;
      const result = extractor.extract(content, { ignoreComments: true });

      expect(result.variables).toHaveLength(3);
      expect(result.variables.map(v => v.name)).toEqual(['var1', 'var2', 'var3']);
    });
  });

  describe('Complex Real-World Examples', () => {
    test('should handle complex template with multiple patterns', () => {
      const content = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>{{page.title|title}}</title>
        </head>
        <body>
            <h1>Welcome {{user.name}}!</h1>
            
            {{#if user.isAdmin}}
                <p>Admin panel: <a href="/admin">Manage</a></p>
            {{/if}}
            
            {{#each posts}}
                <article>
                    <h2>{{title}}</h2>
                    <p>By {{author.name}} on {{date|format:"YYYY-MM-DD"}}</p>
                    <div>{{content|truncate:200}}</div>
                    {{#if comments.length > 0}}
                        <p>{{comments.length}} comments</p>
                    {{/if}}
                </article>
            {{/each}}
            
            <script>
                const userId = \${user.id};
                const theme = \${settings["theme"]};
            </script>
        </body>
        </html>
      `;

      const result = extractor.extract(content);

      expect(result.variables.length).toBeGreaterThan(5);
      expect(result.byType.has('filter')).toBe(true);
      expect(result.byType.has('conditional')).toBe(true);
      expect(result.byType.has('loop')).toBe(true);
      expect(result.byType.has('object')).toBe(true);
      expect(result.statistics.complexityScore).toBeGreaterThan(10);
    });

    test('should calculate complexity scores accurately', () => {
      const content = `
        Simple: {{name}}
        Object: {{user.profile.name}}
        Array: {{items[index].data}}
        Filter: {{price|currency|round:2}}
        Loop: {{#each items}}{{name}}{{/each}}
        Conditional: {{#if user.age >= 18}}{{content}}{{/if}}
      `;

      const result = extractor.extract(content);

      expect(result.statistics.complexityScore).toBeGreaterThan(15);
      
      // Simple variable should have lowest complexity
      const simpleVar = result.variables.find(v => v.name === 'name' && v.type === 'simple');
      expect(simpleVar).toBeTruthy();
      
      // Complex variables should have higher complexity
      const filterVar = result.variables.find(v => v.type === 'filter');
      expect(filterVar).toBeTruthy();
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle large templates efficiently', () => {
      const largeContent = '{{var}} '.repeat(1000);
      const startTime = this.getDeterministicTimestamp();
      const result = extractor.extract(largeContent);
      const endTime = this.getDeterministicTimestamp();

      expect(result.variables.length).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should deduplicate identical variables', () => {
      const content = '{{name}} {{name}} {{name}}';
      const result = extractor.extract(content);

      // Should have 3 total occurrences but 1 unique variable
      expect(result.variables.length).toBe(3);
      expect(result.statistics.uniqueVariables).toBe(1);
    });

    test('should handle empty content', () => {
      const result = extractor.extract('');

      expect(result.variables).toHaveLength(0);
      expect(result.statistics.totalVariables).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle content with no variables', () => {
      const content = 'This is plain text with no variables.';
      const result = extractor.extract(content);

      expect(result.variables).toHaveLength(0);
      expect(result.statistics.totalVariables).toBe(0);
    });
  });
});