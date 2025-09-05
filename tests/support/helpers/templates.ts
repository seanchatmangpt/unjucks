import * as fs from 'fs-extra';
import * as path from 'node:path';
import * as yaml from 'yaml';

export interface TemplateTestCase {
  name: string;
  template: string;
  variables: Record<string, any>;
  expected: string;
  shouldThrow?: boolean;
  expectedError?: string;
  performance?: {
    maxTime: number;
    maxMemory: number;
  };
}

export interface TemplateValidation {
  hasValidSyntax: boolean;
  hasRequiredVariables: boolean;
  usesSecureFilters: boolean;
  hasValidFrontmatter: boolean;
  errors: string[];
  warnings: string[];
}

export class TemplateTestHelper {
  /**
   * Create template test cases for various scenarios
   */
  static createStandardTestCases(): TemplateTestCase[] {
    return [
      {
        name: 'Simple variable substitution',
        template: 'Hello {{ name }}!',
        variables: { name: 'World' },
        expected: 'Hello World!'
      },
      {
        name: 'Multiple variables',
        template: '{{ greeting }} {{ name }}, you have {{ count }} messages.',
        variables: { greeting: 'Hello', name: 'Alice', count: 5 },
        expected: 'Hello Alice, you have 5 messages.'
      },
      {
        name: 'Conditional rendering - true',
        template: '{% if showWelcome %}Welcome {{ name }}!{% endif %}',
        variables: { showWelcome: true, name: 'Bob' },
        expected: 'Welcome Bob!'
      },
      {
        name: 'Conditional rendering - false',
        template: '{% if showWelcome %}Welcome {{ name }}!{% endif %}',
        variables: { showWelcome: false, name: 'Bob' },
        expected: ''
      },
      {
        name: 'If-else conditional',
        template: '{% if isActive %}Active{% else %}Inactive{% endif %}',
        variables: { isActive: false },
        expected: 'Inactive'
      },
      {
        name: 'Simple loop',
        template: '{% for item in items %}{{ item }}\n{% endfor %}',
        variables: { items: ['apple', 'banana', 'cherry'] },
        expected: 'apple\nbanana\ncherry\n'
      },
      {
        name: 'Loop with index',
        template: '{% for item in items %}{{ loop.index }}: {{ item }}\n{% endfor %}',
        variables: { items: ['a', 'b', 'c'] },
        expected: '1: a\n2: b\n3: c\n'
      },
      {
        name: 'Nested loops',
        template: '{% for category in categories %}{{ category.name }}:\n{% for item in category.items %}  - {{ item }}\n{% endfor %}{% endfor %}',
        variables: {
          categories: [
            { name: 'Fruits', items: ['apple', 'banana'] },
            { name: 'Colors', items: ['red', 'blue'] }
          ]
        },
        expected: 'Fruits:\n  - apple\n  - banana\nColors:\n  - red\n  - blue\n'
      },
      {
        name: 'Object property access',
        template: '{{ user.profile.firstName }} {{ user.profile.lastName }}',
        variables: {
          user: {
            profile: {
              firstName: 'John',
              lastName: 'Doe'
            }
          }
        },
        expected: 'John Doe'
      },
      {
        name: 'Array access',
        template: 'First: {{ items[0] }}, Last: {{ items[-1] }}',
        variables: { items: ['first', 'middle', 'last'] },
        expected: 'First: first, Last: last'
      },
      {
        name: 'Filter application',
        template: '{{ name | upper }} has {{ items | length }} items',
        variables: { name: 'alice', items: [1, 2, 3, 4, 5] },
        expected: 'ALICE has 5 items'
      },
      {
        name: 'Multiple filters',
        template: '{{ content | trim | title }}',
        variables: { content: '  hello world  ' },
        expected: 'Hello World'
      },
      {
        name: 'Mathematical operations',
        template: '{{ (price * quantity) + tax }}',
        variables: { price: 10.50, quantity: 3, tax: 2.50 },
        expected: '34'
      },
      {
        name: 'String concatenation',
        template: '{{ firstName ~ " " ~ lastName }}',
        variables: { firstName: 'Jane', lastName: 'Smith' },
        expected: 'Jane Smith'
      },
      {
        name: 'Complex conditional with operators',
        template: '{% if score >= 90 %}A{% elif score >= 80 %}B{% elif score >= 70 %}C{% else %}F{% endif %}',
        variables: { score: 85 },
        expected: 'B'
      },
      // Error cases
      {
        name: 'Missing required variable',
        template: 'Hello {{ requiredVar }}!',
        variables: {},
        expected: '',
        shouldThrow: true,
        expectedError: 'requiredVar is not defined'
      },
      {
        name: 'Invalid template syntax',
        template: 'Hello {{ unclosedTag',
        variables: { name: 'World' },
        expected: '',
        shouldThrow: true,
        expectedError: 'Could not find matching close tag'
      },
      {
        name: 'Invalid filter',
        template: '{{ name | nonExistentFilter }}',
        variables: { name: 'test' },
        expected: '',
        shouldThrow: true,
        expectedError: 'filter not found'
      },
      // Performance test cases
      {
        name: 'Large loop performance',
        template: '{% for i in range(1000) %}{{ i }}{% endfor %}',
        variables: {},
        expected: Array.from({ length: 1000 }, (_, i) => i).join(''),
        performance: {
          maxTime: 100,
          maxMemory: 10 * 1024 * 1024 // 10MB
        }
      },
      {
        name: 'Deep nesting performance',
        template: '{% for i in range(10) %}{% for j in range(10) %}{{ i }}{{ j }}{% endfor %}{% endfor %}',
        variables: {},
        expected: Array.from({ length: 10 }, (_, i) => 
          Array.from({ length: 10 }, (_, j) => `${i}${j}`).join('')
        ).join(''),
        performance: {
          maxTime: 50,
          maxMemory: 5 * 1024 * 1024 // 5MB
        }
      }
    ];
  }

  /**
   * Create edge case test scenarios
   */
  static createEdgeCaseTestCases(): TemplateTestCase[] {
    return [
      {
        name: 'Empty template',
        template: '',
        variables: {},
        expected: ''
      },
      {
        name: 'Only whitespace template',
        template: '   \n\t  ',
        variables: {},
        expected: '   \n\t  '
      },
      {
        name: 'Unicode characters',
        template: 'Hello {{ name }}! 🌟 café résumé',
        variables: { name: '世界' },
        expected: 'Hello 世界! 🌟 café résumé'
      },
      {
        name: 'Special characters in variables',
        template: 'Content: {{ content }}',
        variables: { content: '<script>alert("XSS")</script>' },
        expected: 'Content: <script>alert("XSS")</script>'
      },
      {
        name: 'Very long string',
        template: '{{ longString }}',
        variables: { longString: 'a'.repeat(10000) },
        expected: 'a'.repeat(10000)
      },
      {
        name: 'Null and undefined values',
        template: 'Null: {{ nullValue }}, Undefined: {{ undefinedValue }}',
        variables: { nullValue: null, undefinedValue: undefined },
        expected: 'Null: , Undefined: '
      },
      {
        name: 'Boolean values',
        template: 'True: {{ trueValue }}, False: {{ falseValue }}',
        variables: { trueValue: true, falseValue: false },
        expected: 'True: true, False: false'
      },
      {
        name: 'Numeric edge cases',
        template: 'Zero: {{ zero }}, NaN: {{ nan }}, Infinity: {{ infinity }}',
        variables: { zero: 0, nan: NaN, infinity: Infinity },
        expected: 'Zero: 0, NaN: NaN, Infinity: Infinity'
      },
      {
        name: 'Empty arrays and objects',
        template: 'Array: {{ emptyArray }}, Object: {{ emptyObject }}',
        variables: { emptyArray: [], emptyObject: {} },
        expected: 'Array: , Object: [object Object]'
      },
      {
        name: 'Circular reference handling',
        template: '{{ circular }}',
        variables: (() => {
          const obj: any = { name: 'circular' };
          obj.self = obj;
          return { circular: obj };
        })(),
        expected: '[object Object]',
        shouldThrow: false // Should handle gracefully
      }
    ];
  }

  /**
   * Create frontmatter test cases
   */
  static createFrontmatterTestCases(): Array<{
    name: string;
    template: string;
    expectedFrontmatter: Record<string, any>;
    expectedBody: string;
    isValid: boolean;
  }> {
    return [
      {
        name: 'Valid YAML frontmatter',
        template: '---\nto: output.txt\nvariables:\n  name:\n    type: string\n---\nHello {{ name }}!',
        expectedFrontmatter: {
          to: 'output.txt',
          variables: {
            name: {
              type: 'string'
            }
          }
        },
        expectedBody: 'Hello {{ name }}!',
        isValid: true
      },
      {
        name: 'Frontmatter with injection config',
        template: '---\ninject: true\nafter: "// INSERT_POINT"\nskipIf: "{{ name }}"\n---\nCode: {{ code }}',
        expectedFrontmatter: {
          inject: true,
          after: '// INSERT_POINT',
          skipIf: '{{ name }}'
        },
        expectedBody: 'Code: {{ code }}',
        isValid: true
      },
      {
        name: 'Complex variable definitions',
        template: `---
to: src/{{ name | kebabCase }}.ts
variables:
  name:
    type: string
    required: true
    description: Component name
  withProps:
    type: boolean
    default: true
    description: Include props interface
  customProps:
    type: array
    default: []
    description: Custom properties
---
Component content here`,
        expectedFrontmatter: {
          to: 'src/{{ name | kebabCase }}.ts',
          variables: {
            name: {
              type: 'string',
              required: true,
              description: 'Component name'
            },
            withProps: {
              type: 'boolean',
              default: true,
              description: 'Include props interface'
            },
            customProps: {
              type: 'array',
              default: [],
              description: 'Custom properties'
            }
          }
        },
        expectedBody: 'Component content here',
        isValid: true
      },
      {
        name: 'Invalid YAML frontmatter',
        template: '---\ninvalid: yaml: content: here\n---\nContent',
        expectedFrontmatter: {},
        expectedBody: 'Content',
        isValid: false
      },
      {
        name: 'No frontmatter',
        template: 'Just template content {{ name }}',
        expectedFrontmatter: {},
        expectedBody: 'Just template content {{ name }}',
        isValid: true
      },
      {
        name: 'Empty frontmatter',
        template: '---\n---\nContent only',
        expectedFrontmatter: {},
        expectedBody: 'Content only',
        isValid: true
      }
    ];
  }

  /**
   * Validate template syntax and structure
   */
  static async validateTemplate(templateContent: string): Promise<TemplateValidation> {
    const validation: TemplateValidation = {
      hasValidSyntax: true,
      hasRequiredVariables: true,
      usesSecureFilters: true,
      hasValidFrontmatter: true,
      errors: [],
      warnings: []
    };

    try {
      // Basic syntax validation
      const openTags = (templateContent.match(/{%|{{/g) || []).length;
      const closeTags = (templateContent.match(/%}|}}/g) || []).length;
      
      if (openTags !== closeTags) {
        validation.hasValidSyntax = false;
        validation.errors.push('Mismatched template tags');
      }

      // Frontmatter validation
      const frontmatterMatch = templateContent.match(/^---\n([\s\S]*?)\n---\n/);
      if (frontmatterMatch) {
        try {
          const frontmatter = yaml.parse(frontmatterMatch[1]);
          if (typeof frontmatter !== 'object') {
            validation.hasValidFrontmatter = false;
            validation.errors.push('Invalid frontmatter structure');
          }
        } catch (error) {
          validation.hasValidFrontmatter = false;
          validation.errors.push(`Invalid frontmatter YAML: ${error}`);
        }
      }

      // Variable usage validation
      const variableMatches = templateContent.match(/{{\s*([^}]+)\s*}}/g) || [];
      const undefinedVariables = variableMatches.filter(match => 
        match.includes('undefined') || match.includes('null')
      );
      
      if (undefinedVariables.length > 0) {
        validation.warnings.push(`Potential undefined variables: ${undefinedVariables.join(', ')}`);
      }

      // Security checks
      const unsafePatterns = [
        /require\s*\(/,
        /process\./,
        /global\./,
        /__proto__/,
        /constructor/,
        /eval\s*\(/
      ];

      for (const pattern of unsafePatterns) {
        if (pattern.test(templateContent)) {
          validation.usesSecureFilters = false;
          validation.errors.push(`Potentially unsafe pattern detected: ${pattern}`);
        }
      }

    } catch (error) {
      validation.hasValidSyntax = false;
      validation.errors.push(`Template validation error: ${error}`);
    }

    return validation;
  }

  /**
   * Create templates for specific use cases
   */
  static createSpecializedTemplates(): Record<string, string> {
    return {
      'react-component': `---
to: src/components/{{ componentName | pascalCase }}.tsx
variables:
  componentName:
    type: string
    required: true
---
import React from 'react';

export const {{ componentName | pascalCase }}: React.FC = () => {
  return (
    <div className="{{ componentName | kebabCase }}">
      <h1>{{ componentName | titleCase }}</h1>
    </div>
  );
};`,

      'node-service': `---
to: src/services/{{ serviceName | kebabCase }}.service.ts
variables:
  serviceName:
    type: string
    required: true
  methods:
    type: array
    default: ['create', 'read', 'update', 'delete']
---
export class {{ serviceName | pascalCase }}Service {
{% for method in methods %}
  async {{ method }}(): Promise<void> {
    // TODO: Implement {{ method }}
  }
{% endfor %}
}`,

      'api-route': `---
to: src/routes/{{ resourceName | kebabCase }}.ts
inject: true
after: "// ROUTES_INSERTION_POINT"
variables:
  resourceName:
    type: string
    required: true
  httpMethod:
    type: string
    default: GET
---
router.{{ httpMethod | lower }}('/{{ resourceName | kebabCase }}', {{ resourceName | camelCase }}Handler);`,

      'database-migration': `---
to: migrations/{{ timestamp }}_{{ migrationName | snakeCase }}.sql
variables:
  migrationName:
    type: string
    required: true
  timestamp:
    type: string
    default: "{{ 'now' | date('YYYYMMDDHHmmss') }}"
---
-- Migration: {{ migrationName | titleCase }}
-- Created: {{ timestamp }}

-- Add your migration SQL here
CREATE TABLE IF NOT EXISTS example (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`,

      'test-file': `---
to: __tests__/{{ testName | kebabCase }}.test.ts
variables:
  testName:
    type: string
    required: true
  testFramework:
    type: string
    default: jest
---
{% if testFramework === 'jest' %}
import { describe, it, expect } from '@jest/globals';
{% elif testFramework === 'vitest' %}
import { describe, it, expect } from 'vitest';
{% endif %}

describe('{{ testName | titleCase }}', () => {
  it('should pass basic test', () => {
    expect(true).toBe(true);
  });
});`
    };
  }

  /**
   * Performance testing for template rendering
   */
  static async benchmarkTemplate(
    template: string,
    variables: Record<string, any>,
    iterations: number = 100
  ): Promise<{
    avgTime: number;
    minTime: number;
    maxTime: number;
    totalTime: number;
    memoryUsage: number;
  }> {
    const times: number[] = [];
    const startMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      // Here you would render the template with the actual engine
      // For now, we'll simulate the rendering
      await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
      
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    const endMemory = process.memoryUsage().heapUsed;
    const totalTime = times.reduce((sum, time) => sum + time, 0);

    return {
      avgTime: totalTime / iterations,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      totalTime,
      memoryUsage: endMemory - startMemory
    };
  }
}