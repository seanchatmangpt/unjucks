/**
 * Test Data Manager
 * 
 * Manages test data, fixtures, and mock data for comprehensive test scenarios.
 * Provides consistent test data across the test suite.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test data manager for organizing and providing test fixtures
 */
export class TestDataManager {
  constructor() {
    this.fixturesPath = __dirname;
    this.cache = new Map();
  }

  /**
   * Load test data from fixtures
   */
  async loadFixture(name) {
    if (this.cache.has(name)) {
      return this.cache.get(name);
    }

    const fixturePath = path.join(this.fixturesPath, `${name}.json`);
    
    try {
      const data = await fs.readJson(fixturePath);
      this.cache.set(name, data);
      return data;
    } catch (error) {
      throw new Error(`Failed to load fixture: ${name}. Error: ${error.message}`);
    }
  }

  /**
   * Save test data as fixture
   */
  async saveFixture(name, data) {
    const fixturePath = path.join(this.fixturesPath, `${name}.json`);
    await fs.writeJson(fixturePath, data, { spaces: 2 });
    this.cache.set(name, data);
  }

  /**
   * Get sample generators for testing
   */
  getSampleGenerators() {
    return [
      {
        name: 'component',
        description: 'React component generator',
        category: 'frontend',
        templates: [
          {
            name: 'react',
            description: 'React functional component',
            variables: ['name', 'description', 'withProps', 'withState']
          },
          {
            name: 'class',
            description: 'React class component',
            variables: ['name', 'description', 'withLifecycle']
          }
        ]
      },
      {
        name: 'api',
        description: 'API endpoint generator',
        category: 'backend',
        templates: [
          {
            name: 'express',
            description: 'Express.js route',
            variables: ['name', 'method', 'auth', 'validation']
          },
          {
            name: 'fastify',
            description: 'Fastify route',
            variables: ['name', 'method', 'schema']
          }
        ]
      },
      {
        name: 'model',
        description: 'Data model generator',
        category: 'database',
        templates: [
          {
            name: 'sequelize',
            description: 'Sequelize model',
            variables: ['name', 'fields', 'associations']
          },
          {
            name: 'mongoose',
            description: 'Mongoose schema',
            variables: ['name', 'fields', 'virtuals']
          }
        ]
      }
    ];
  }

  /**
   * Get sample template content for different scenarios
   */
  getTemplateContent(type) {
    const templates = {
      simple: {
        frontmatter: {
          to: 'src/{{ name }}.js'
        },
        content: `// {{ description || name }}
export const {{ name }} = () => {
  return '{{ name }}';
};`
      },

      complex: {
        frontmatter: {
          to: 'src/{{ domain }}/{{ feature }}/{{ name | kebabCase }}.js',
          inject: false,
          skipIf: '{{ skipIfExists }}'
        },
        content: `import { {{ dependencies | join(', ') }} } from '{{ importPath }}';

/**
 * {{ description }}
 * @category {{ category }}
 * @author {{ author }}
 */
{% if withClass %}
export class {{ name | pascalCase }} {
  {% if withConstructor %}
  constructor({{ constructorParams | join(', ') }}) {
    {% for param in constructorParams %}
    this.{{ param }} = {{ param }};
    {% endfor %}
  }
  {% endif %}

  {% for method in methods %}
  {{ method.name }}({{ method.params | join(', ') }}) {
    {% if method.async %}
    return new Promise((resolve, reject) => {
      // TODO: Implement {{ method.name }}
      resolve();
    });
    {% else %}
    // TODO: Implement {{ method.name }}
    {% endif %}
  }
  {% endfor %}
}
{% else %}
export const {{ name | camelCase }} = {
  {% for property in properties %}
  {{ property.name }}: {{ property.value }},
  {% endfor %}
};
{% endif %}`
      },

      injection: {
        frontmatter: {
          to: '{{ targetFile }}',
          inject: true,
          after: '{{ afterPattern }}',
          before: '{{ beforePattern }}',
          skipIf: '{{ skipCondition }}'
        },
        content: `{{ injectionContent }}`
      },

      multiFile: [
        {
          file: 'component.njk',
          frontmatter: {
            to: 'src/components/{{ name | pascalCase }}/{{ name | pascalCase }}.jsx'
          },
          content: `import React from 'react';
import styles from './{{ name | pascalCase }}.module.css';

export const {{ name | pascalCase }} = ({ children, ...props }) => {
  return (
    <div className={styles.{{ name | camelCase }}} {...props}>
      {children}
    </div>
  );
};`
        },
        {
          file: 'styles.njk',
          frontmatter: {
            to: 'src/components/{{ name | pascalCase }}/{{ name | pascalCase }}.module.css'
          },
          content: `.{{ name | camelCase }} {
  /* Styles for {{ name }} */
}`
        },
        {
          file: 'test.njk',
          frontmatter: {
            to: 'src/components/{{ name | pascalCase }}/{{ name | pascalCase }}.test.jsx'
          },
          content: `import { render, screen } from '@testing-library/react';
import { {{ name | pascalCase }} } from './{{ name | pascalCase }}';

describe('{{ name | pascalCase }}', () => {
  test('renders correctly', () => {
    render(<{{ name | pascalCase }}>Test content</{{ name | pascalCase }}>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
});`
        }
      ],

      typescript: {
        frontmatter: {
          to: 'src/types/{{ name | kebabCase }}.types.ts'
        },
        content: `/**
 * Type definitions for {{ name }}
 */

export interface {{ name | pascalCase }} {
  id: string;
  name: string;
  {% for field in fields %}
  {{ field.name }}: {{ field.type }};
  {% endfor %}
  createdAt: Date;
  updatedAt: Date;
}

export interface {{ name | pascalCase }}Input {
  name: string;
  {% for field in fields %}
  {% if field.required %}
  {{ field.name }}: {{ field.type }};
  {% else %}
  {{ field.name }}?: {{ field.type }};
  {% endif %}
  {% endfor %}
}

export interface {{ name | pascalCase }}Update extends Partial<{{ name | pascalCase }}Input> {
  id: string;
}

export type {{ name | pascalCase }}List = {{ name | pascalCase }}[];`
      },

      config: {
        frontmatter: {
          to: 'config/{{ env }}.json'
        },
        content: `{
  "name": "{{ appName }}",
  "version": "{{ version }}",
  "environment": "{{ env }}",
  "database": {
    "host": "{{ dbHost }}",
    "port": {{ dbPort }},
    "name": "{{ dbName }}"
  },
  "api": {
    "baseUrl": "{{ apiUrl }}",
    "timeout": {{ apiTimeout }}
  },
  "features": {
    {% for feature in features %}
    "{{ feature.name }}": {{ feature.enabled }}{% if not loop.last %},{% endif %}
    {% endfor %}
  }
}`
      }
    };

    return templates[type] || templates.simple;
  }

  /**
   * Get test variables for different scenarios
   */
  getTestVariables(scenario = 'basic') {
    const variables = {
      basic: {
        name: 'TestEntity',
        description: 'A test entity for testing purposes',
        author: 'Test Suite',
        version: '1.0.0'
      },

      component: {
        name: 'UserProfile',
        description: 'User profile display component',
        withProps: true,
        withState: false,
        withTests: true,
        category: 'UI',
        author: 'Frontend Team'
      },

      api: {
        name: 'users',
        method: 'GET',
        auth: true,
        validation: true,
        description: 'User management endpoint',
        version: 'v1'
      },

      model: {
        name: 'User',
        fields: [
          { name: 'email', type: 'string', required: true },
          { name: 'age', type: 'number', required: false },
          { name: 'isActive', type: 'boolean', required: true }
        ],
        associations: ['Profile', 'Posts'],
        timestamps: true
      },

      complex: {
        name: 'PaymentProcessor',
        domain: 'ecommerce',
        feature: 'payments',
        category: 'Service',
        description: 'Handles payment processing operations',
        author: 'Backend Team',
        withClass: true,
        withConstructor: true,
        constructorParams: ['config', 'logger'],
        methods: [
          {
            name: 'processPayment',
            params: ['amount', 'paymentMethod'],
            async: true
          },
          {
            name: 'refundPayment',
            params: ['transactionId'],
            async: true
          }
        ],
        dependencies: ['Logger', 'Config'],
        importPath: '../utils'
      },

      injection: {
        targetFile: 'src/routes/index.js',
        afterPattern: '// ROUTES_PLACEHOLDER',
        injectionContent: "router.use('/users', userRoutes);"
      },

      multiFile: {
        name: 'ProductCard',
        description: 'Product display card component',
        withStyles: true,
        withTests: true
      },

      typescript: {
        name: 'Product',
        fields: [
          { name: 'title', type: 'string', required: true },
          { name: 'price', type: 'number', required: true },
          { name: 'description', type: 'string', required: false },
          { name: 'inStock', type: 'boolean', required: true }
        ]
      },

      config: {
        appName: 'MyApp',
        version: '2.1.0',
        env: 'production',
        dbHost: 'localhost',
        dbPort: 5432,
        dbName: 'myapp_prod',
        apiUrl: 'https://api.myapp.com',
        apiTimeout: 5000,
        features: [
          { name: 'userRegistration', enabled: true },
          { name: 'paymentProcessing', enabled: true },
          { name: 'advancedAnalytics', enabled: false }
        ]
      }
    };

    return variables[scenario] || variables.basic;
  }

  /**
   * Get performance test data
   */
  getPerformanceTestData() {
    return {
      smallDataset: {
        generatorCount: 5,
        templatesPerGenerator: 3,
        variablesPerTemplate: 5
      },
      mediumDataset: {
        generatorCount: 25,
        templatesPerGenerator: 8,
        variablesPerTemplate: 10
      },
      largeDataset: {
        generatorCount: 100,
        templatesPerGenerator: 15,
        variablesPerTemplate: 20
      },
      stressDataset: {
        generatorCount: 500,
        templatesPerGenerator: 25,
        variablesPerTemplate: 30
      }
    };
  }

  /**
   * Get edge case test data
   */
  getEdgeCaseData() {
    return {
      emptyValues: {
        name: '',
        description: '',
        values: []
      },
      specialCharacters: {
        name: 'Test-Component_With.Special@Chars',
        description: 'A component with special characters: !@#$%^&*()',
        path: './src/weird-path/../components'
      },
      unicodeValues: {
        name: 'TestComponent™',
        description: '测试组件 with émojis 🚀',
        author: 'Åndré Müller'
      },
      longValues: {
        name: 'VeryLongComponentNameThatExceedsNormalLimits'.repeat(5),
        description: 'A'.repeat(1000),
        path: 'very/deep/nested/directory/structure/that/goes/on/forever'.repeat(10)
      },
      nullValues: {
        name: null,
        description: undefined,
        optional: null
      },
      circularReferences: {
        obj: {}
      }
    };
  }

  /**
   * Get error scenario test data
   */
  getErrorScenarios() {
    return {
      malformedYaml: `---
invalid: yaml: [unclosed
broken:: structure
---
Content`,
      missingFrontmatter: `No frontmatter here
Just content`,
      invalidTemplateSyntax: `---
to: output.js
---
{{ unclosed.variable.without.end`,
      circularIncludes: `---
to: output.js
---
{% include "template-that-includes-this-one.njk" %}`,
      invalidPaths: {
        to: '../../../etc/passwd'
      },
      restrictedPaths: {
        to: '/root/restricted.txt'
      }
    };
  }

  /**
   * Generate random test data
   */
  generateRandomData(count = 10) {
    const data = [];
    const names = ['User', 'Product', 'Order', 'Payment', 'Category'];
    const types = ['component', 'service', 'model', 'util', 'config'];
    
    for (let i = 0; i < count; i++) {
      data.push({
        name: `${names[i % names.length]}${i + 1}`,
        type: types[i % types.length],
        description: `Generated test entity number ${i + 1}`,
        index: i,
        random: Math.random(),
        timestamp: new Date().toISOString()
      });
    }
    
    return data;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Preload common fixtures
   */
  async preloadFixtures() {
    const commonFixtures = [
      'sample-generators',
      'test-variables',
      'performance-benchmarks'
    ];

    for (const fixture of commonFixtures) {
      try {
        await this.loadFixture(fixture);
      } catch (error) {
        console.warn(`Could not preload fixture: ${fixture}`);
      }
    }
  }
}

// Singleton instance
export const testDataManager = new TestDataManager();

// Convenience exports
export const loadFixture = (name) => testDataManager.loadFixture(name);
export const saveFixture = (name, data) => testDataManager.saveFixture(name, data);
export const getSampleGenerators = () => testDataManager.getSampleGenerators();
export const getTemplateContent = (type) => testDataManager.getTemplateContent(type);
export const getTestVariables = (scenario) => testDataManager.getTestVariables(scenario);
export const getPerformanceTestData = () => testDataManager.getPerformanceTestData();
export const getEdgeCaseData = () => testDataManager.getEdgeCaseData();
export const getErrorScenarios = () => testDataManager.getErrorScenarios();
export const generateRandomData = (count) => testDataManager.generateRandomData(count);