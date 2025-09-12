import * as fs from 'fs-extra';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

export const TestUtilities = {
  
  /**
   * Create a comprehensive test generator structure
   */
  async createTestGenerator(
    basePath,
    generator
  ) {
    const generatorPath = path.join(basePath, '_templates', generator.name);
    await fs.ensureDir(generatorPath);

    // Create template files
    for (const template of generator.templates) {
      const templatePath = path.join(generatorPath, template.path);
      await fs.ensureDir(path.dirname(templatePath));
      
      let content = '';
      
      // Add frontmatter if provided
      if (template.frontmatter || Object.keys(template.frontmatter || {}).length > 0) {
        content += '---\n';
        for (const [key, value] of Object.entries(template.frontmatter || {})) {
          content += `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}\n`;
        }
        content += '---\n';
      }
      
      content += template.content;
      
      await fs.writeFile(templatePath, content);
    }

    // Create metadata file
    if (generator.metadata || generator.description || generator.variables) {
      const metadata = {
        name: generator.name,
        description: generator.description,
        variables: generator.variables,
        ...generator.metadata
      };
      
      await fs.writeFile(
        path.join(generatorPath, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );
    }
  },

  /**
   * Create realistic React component generator
   */
  createReactComponentGenerator() {
    return {
      name: 'react-component',
      description: 'React functional component with TypeScript',
      variables: {
        name: { type: 'string', required: true, description: 'Component name' },
        withProps: { type: 'boolean', required: false, description: 'Include props interface' },
        withTests: { type: 'boolean', required: false, description: 'Include test file' },
        withStyles: { type: 'boolean', required: false, description: 'Include CSS file' }
      },
      templates: [
        {
          name: 'component',
          path: 'component.tsx.njk',
          frontmatter: {
            to: 'src/components/{{name}}.tsx'
          },
          content: `import React{% if withProps %}, { type FC }{% endif %} from 'react';
{% if withStyles %}
import './{{name}}.styles.css';
{% endif %}

{% if withProps %}
interface {{name}}Props {
  className?: string;
  children?: React.ReactNode;
}

export const {{name}}: FC<{{name}}Props> = ({ className = '', children, ...props }) => {
{% else %}
export const {{name}}: React.FC = () => {
{% endif %}
  return (
    <div className="{{name | kebabCase}}{% if withProps %} \${className}{% endif %}"{% if withProps %} {...props}{% endif %}>
      <h1>{{name}} Component</h1>
      {% if withProps %}{children}{% endif %}
    </div>
  );
};

export default {{name}};`
        },
        {
          name: 'test',
          path: 'component.test.tsx.njk',
          frontmatter: {
            to: 'src/components/{{name}}.test.tsx',
            skipIf: 'withTests === false'
          },
          content: `import { render, screen } from '@testing-library/react';
import { {{name}} } from './{{name}}';

describe('{{name}}', () => {
  it('renders successfully', () => {
    render(<{{name}} />);
    expect(screen.getByText('{{name}} Component')).toBeInTheDocument();
  });

  {% if withProps %}
  it('applies custom className', () => {
    render(<{{name}} className="custom-class" />);
    const element = screen.getByText('{{name}} Component').parentElement;
    expect(element).toHaveClass('{{name | kebabCase}}', 'custom-class');
  });

  it('renders children', () => {
    render(<{{name}}>Test children</{{name}}>);
    expect(screen.getByText('Test children')).toBeInTheDocument();
  });
  {% endif %}
});`
        },
        {
          name: 'styles',
          path: 'component.styles.css.njk',
          frontmatter: {
            to: 'src/components/{{name}}.styles.css',
            skipIf: 'withStyles === false'
          },
          content: `.{{name | kebabCase}} {
  /* Add your styles here */
  display: block;
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 0.25rem;
}

.{{name | kebabCase}} h1 {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  color: #333;
}`
        }
      ]
    };
  },

  /**
   * Create Express route generator
   */
  createExpressRouteGenerator() {
    return {
      name: 'express-route',
      description: 'Express.js route handler with middleware',
      variables: {
        name: { type: 'string', required: true, description: 'Route name' },
        method: { type: 'string', required: false, default: 'GET', description: 'HTTP method' },
        path: { type: 'string', required: false, description: 'Route path' },
        withAuth: { type: 'boolean', required: false, description: 'Include authentication' },
        withValidation: { type: 'boolean', required: false, description: 'Include validation' }
      },
      templates: [
        {
          name: 'route',
          path: 'route.js.njk',
          frontmatter: {
            to: 'src/routes/{{name | kebabCase}}.js'
          },
          content: `const express = require('express');
const router = express.Router();
{% if withValidation %}
const { body, validationResult } = require('express-validator');
{% endif %}
{% if withAuth %}
const { authenticate } = require('../middleware/auth');

// Apply authentication middleware
router.use(authenticate);
{% endif %}

/**
 * {{method | upper}} {{path | default('/' + (name | kebabCase))}}
 * {{name}} route handler
 */
router.{{method | lower}}('{{path | default('/' + (name | kebabCase))}}',
  {% if withValidation %}
  [
    body('name').notEmpty().withMessage('Name is required'),
    // Add more validation rules here
  ],
  {% endif %}
  async (req, res) => {
    try {
      {% if withValidation %}
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      {% endif %}

      // TODO: Implement {{name}} logic
      res.status(200).json({
        success: true,
        message: '{{name}} {{method | lower}} endpoint',
        data: {}
      });
    } catch (error) {
      console.error('Error in {{name}}:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

module.exports = router;`
        }
      ]
    };
  },

  /**
   * Create injection template for route registration
   */
  createRouteInjectionGenerator() {
    return {
      name: 'route-injection',
      description: 'Inject route into existing router',
      templates: [
        {
          name: 'route-registration',
          path: 'register.js.njk',
          frontmatter: {
            to: 'src/app.js',
            inject: true,
            before: 'module.exports = app;'
          },
          content: `app.use('/api/{{name | kebabCase}}', require('./routes/{{name | kebabCase}}'));`
        }
      ]
    };
  },

  /**
   * Validate generated file against expected patterns
   */
  async validateGeneratedFile(
    filePath,
    expectedPatterns
  ) {
    const content = await fs.readFile(filePath, 'utf8');
    const errors = [];

    for (const pattern of expectedPatterns) {
      const regex = new RegExp(pattern);
      if (!regex.test(content)) {
        errors.push(`Pattern not found: ${pattern}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Create performance test data
   */
  async createLargeGeneratorSet(
    basePath,
    count
  ) {
    const templatesPath = path.join(basePath, '_templates');

    for (let i = 1; i <= count; i++) {
      const generatorName = `perf-generator-${i.toString().padStart(3, '0')}`;
      const generator = {
        name: generatorName,
        description: `Performance test generator ${i}`,
        templates: [
          {
            name: 'main',
            path: 'main.js.njk',
            frontmatter: {
              to: 'src/perf/{{name}}-${i}.js'
            },
            content: `// Performance test file ${i}
export const ${generatorName.replace(/-/g, '_')} = {
  id: ${i},
  name: '{{name}}',
  timestamp: this.getDeterministicDate().toISOString(),
  data: ${JSON.stringify(Array.from({length: 100}).fill(null).map((_, idx) => ({ id: idx, value: `item-${idx}` })))}
};`
          }
        ]
      };

      await TestUtilities.createTestGenerator(basePath, generator);
    }
  },

  /**
   * Measure command execution time
   */
  async measureExecutionTime(
    operation
  ) {
    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();
    
    return {
      result,
      duration: endTime - startTime
    };
  },

  /**
   * Create test files with specific content for injection tests
   */
  async createTestFileStructure(
    basePath,
    files
  ) {
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(basePath, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content);
    }
  },

  /**
   * Compare two files and return differences
   */
  async compareFiles(
    file1,
    file2
  ) {
    const content1 = await fs.readFile(file1, 'utf8');
    const content2 = await fs.readFile(file2, 'utf8');
    
    if (content1 === content2) {
      return { identical: true, differences: [] };
    }

    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');
    const differences = [];

    const maxLines = Math.max(lines1.length, lines2.length);
    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';
      
      if (line1 !== line2) {
        differences.push(`Line ${i + 1}: "${line1}" vs "${line2}"`);
      }
    }

    return { identical: false, differences };
  },

  /**
   * Clean up test environment
   */
  async cleanup(paths) {
    for (const testPath of paths) {
      if (await fs.pathExists(testPath)) {
        await fs.remove(testPath);
      }
    }
  },

  /**
   * Generate realistic test data
   */
  generateTestData(type, count = 5) {
    const data = [];
    
    for (let i = 1; i <= count; i++) {
      switch (type) {
        case 'component': {
          data.push({
            name: `TestComponent${i}`,
            withProps: i % 2 === 0,
            withTests: i % 3 === 0,
            withStyles: i % 4 === 0
          });
          break;
        }
        
        case 'service': {
          data.push({
            name: `TestService${i}`,
            withInterface: true,
            withAuth: i % 2 === 0,
            methods: ['create', 'read', 'update', 'delete']
          });
          break;
        }
        
        case 'model': {
          data.push({
            name: `TestModel${i}`,
            fields: [
              { name: 'id', type: 'string', required: true },
              { name: 'name', type: 'string', required: true },
              { name: 'createdAt', type: 'Date', required: false }
            ]
          });
          break;
        }
      }
    }
    
    return data;
  },
};