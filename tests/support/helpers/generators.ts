import * as fs from 'fs-extra';
import * as path from 'node:path';
import * as yaml from 'yaml';

export interface GeneratorFixture {
  name: string;
  templates: TemplateFile[];
  variables?: Record<string, any>;
  expectedOutputs?: ExpectedOutput[];
}

export interface TemplateFile {
  path: string;
  content: string;
  frontmatter?: Record<string, any>;
}

export interface ExpectedOutput {
  path: string;
  content: string;
  shouldExist: boolean;
}

export class GeneratorTestHelper {
  /**
   * Create a complete generator fixture with templates
   */
  static async createGenerator(
    baseDir: string,
    generatorName: string,
    templates: TemplateFile[]
  ): Promise<void> {
    const generatorDir = path.join(baseDir, '_templates', generatorName);
    await fs.ensureDir(generatorDir);

    for (const template of templates) {
      const templatePath = path.join(generatorDir, template.path);
      await fs.ensureDir(path.dirname(templatePath));
      
      let content = template.content;
      
      // Add frontmatter if provided
      if (template.frontmatter) {
        const frontmatterYaml = yaml.stringify(template.frontmatter);
        content = `---\n${frontmatterYaml}---\n${template.content}`;
      }
      
      await fs.writeFile(templatePath, content);
    }
  }

  /**
   * Create a realistic React component generator
   */
  static async createReactComponentGenerator(baseDir: string): Promise<GeneratorFixture> {
    const templates: TemplateFile[] = [
      {
        path: 'new.tsx.ejs',
        content: `import React from 'react';
{% if withProps %}
import { {{ componentName | pascalCase }}Props } from './{{ componentName | pascalCase }}.types';
{% endif %}
{% if withStyles %}
import styles from './{{ componentName | pascalCase }}.module.css';
{% endif %}

{% if withProps %}
interface {{ componentName | pascalCase }}Props {
  children?: React.ReactNode;
  className?: string;
  {% for prop in customProps %}
  {{ prop.name }}{% if not prop.required %}?{% endif %}: {{ prop.type }};
  {% endfor %}
}
{% endif %}

export const {{ componentName | pascalCase }}: React.FC{% if withProps %}<{{ componentName | pascalCase }}Props>{% endif %} = ({
  {% if withProps %}
  children,
  className,
  {% for prop in customProps %}
  {{ prop.name }}{% if not prop.required %} = {{ prop.default or 'undefined' }}{% endif %},
  {% endfor %}
  {% endif %}
}) => {
  return (
    <div 
      className={\`{{ componentName | kebabCase }}{% if withStyles %} \${styles.{{ componentName | camelCase }}}{% endif %}{% if withProps %} \${className || ''}{% endif %}\`}
    >
      {% if withHeader %}
      <h2 className="{{ componentName | kebabCase }}__title">
        {{ componentName | titleCase }}
      </h2>
      {% endif %}
      
      {% if withProps %}
      <div className="{{ componentName | kebabCase }}__content">
        {children}
      </div>
      {% endif %}
      
      {% if withActions %}
      <div className="{{ componentName | kebabCase }}__actions">
        <button 
          type="button"
          className="btn btn--primary"
          onClick={() => console.log('{{ componentName }} clicked')}
        >
          {{ actionButtonText || 'Click me' }}
        </button>
      </div>
      {% endif %}
    </div>
  );
};

export default {{ componentName | pascalCase }};`,
        frontmatter: {
          to: 'src/components/{{ componentName | pascalCase }}/{{ componentName | pascalCase }}.tsx',
          variables: {
            componentName: {
              type: 'string',
              required: true,
              description: 'Component name in PascalCase'
            },
            withProps: {
              type: 'boolean',
              default: true,
              description: 'Include props interface'
            },
            withStyles: {
              type: 'boolean',
              default: true,
              description: 'Include CSS module imports'
            },
            withHeader: {
              type: 'boolean',
              default: true,
              description: 'Include component title header'
            },
            withActions: {
              type: 'boolean',
              default: false,
              description: 'Include action buttons'
            },
            actionButtonText: {
              type: 'string',
              default: 'Click me',
              description: 'Text for action button'
            },
            customProps: {
              type: 'array',
              default: [],
              description: 'Custom props for the component'
            }
          }
        }
      },
      {
        path: 'types.ts.ejs',
        content: `export interface {{ componentName | pascalCase }}Props {
  children?: React.ReactNode;
  className?: string;
  {% for prop in customProps %}
  {{ prop.name }}{% if not prop.required %}?{% endif %}: {{ prop.type }};
  {% endfor %}
}

export interface {{ componentName | pascalCase }}State {
  isLoading: boolean;
  error?: string;
  data?: any;
}

export type {{ componentName | pascalCase }}Variant = 'primary' | 'secondary' | 'success' | 'warning' | 'error';

export type {{ componentName | pascalCase }}Size = 'small' | 'medium' | 'large';`,
        frontmatter: {
          to: 'src/components/{{ componentName | pascalCase }}/{{ componentName | pascalCase }}.types.ts',
          skipIf: '{{ not withProps }}'
        }
      },
      {
        path: 'styles.module.css.ejs',
        content: `.{{ componentName | camelCase }} {
  padding: 1rem;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.{{ componentName | camelCase }}__title {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #333;
}

.{{ componentName | camelCase }}__content {
  margin-bottom: 1rem;
}

.{{ componentName | camelCase }}__actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

/* Responsive design */
@media (max-width: 768px) {
  .{{ componentName | camelCase }} {
    padding: 0.75rem;
  }
  
  .{{ componentName | camelCase }}__title {
    font-size: 1.25rem;
  }
  
  .{{ componentName | camelCase }}__actions {
    flex-direction: column;
  }
}`,
        frontmatter: {
          to: 'src/components/{{ componentName | pascalCase }}/{{ componentName | pascalCase }}.module.css',
          skipIf: '{{ not withStyles }}'
        }
      },
      {
        path: 'test.tsx.ejs',
        content: `import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { {{ componentName | pascalCase }} } from './{{ componentName | pascalCase }}';

describe('{{ componentName | pascalCase }}', () => {
  it('renders without crashing', () => {
    render(<{{ componentName | pascalCase }} />);
    expect(screen.getByRole('generic')).toBeInTheDocument();
  });

  {% if withHeader %}
  it('displays the component title', () => {
    render(<{{ componentName | pascalCase }} />);
    expect(screen.getByText('{{ componentName | titleCase }}')).toBeInTheDocument();
  });
  {% endif %}

  {% if withProps %}
  it('renders children content', () => {
    const testContent = 'Test children content';
    render(<{{ componentName | pascalCase }}>{testContent}</{{ componentName | pascalCase }}>);
    expect(screen.getByText(testContent)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const customClass = 'custom-test-class';
    render(<{{ componentName | pascalCase }} className={customClass} />);
    const element = screen.getByRole('generic');
    expect(element).toHaveClass(customClass);
  });
  {% endif %}

  {% if withActions %}
  it('handles button click', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    render(<{{ componentName | pascalCase }} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(consoleSpy).toHaveBeenCalledWith('{{ componentName }} clicked');
    consoleSpy.mockRestore();
  });
  {% endif %}

  it('matches snapshot', () => {
    const { container } = render(<{{ componentName | pascalCase }} />);
    expect(container.firstChild).toMatchSnapshot();
  });
});`,
        frontmatter: {
          to: 'src/components/{{ componentName | pascalCase }}/__tests__/{{ componentName | pascalCase }}.test.tsx'
        }
      }
    ];

    await this.createGenerator(baseDir, 'component', templates);

    return {
      name: 'component',
      templates,
      variables: {
        componentName: 'TestComponent',
        withProps: true,
        withStyles: true,
        withHeader: true,
        withActions: false,
        customProps: [
          { name: 'variant', type: 'string', required: false, default: 'primary' },
          { name: 'size', type: 'string', required: false, default: 'medium' }
        ]
      },
      expectedOutputs: [
        {
          path: 'src/components/TestComponent/TestComponent.tsx',
          content: 'import React from \'react\';',
          shouldExist: true
        },
        {
          path: 'src/components/TestComponent/TestComponent.types.ts',
          content: 'export interface TestComponentProps',
          shouldExist: true
        },
        {
          path: 'src/components/TestComponent/TestComponent.module.css',
          content: '.testComponent {',
          shouldExist: true
        },
        {
          path: 'src/components/TestComponent/__tests__/TestComponent.test.tsx',
          content: 'describe(\'TestComponent\',',
          shouldExist: true
        }
      ]
    };
  }

  /**
   * Create a Node.js API endpoint generator
   */
  static async createApiEndpointGenerator(baseDir: string): Promise<GeneratorFixture> {
    const templates: TemplateFile[] = [
      {
        path: 'route.js.ejs',
        content: `const express = require('express');
const {{ resourceName | camelCase }}Controller = require('../controllers/{{ resourceName | kebabCase }}');
{% if withAuth %}
const { authenticate } = require('../middleware/auth');
{% endif %}
{% if withValidation %}
const { validate{{ resourceName | pascalCase }} } = require('../validators/{{ resourceName | kebabCase }}');
{% endif %}

const router = express.Router();

{% for method in httpMethods %}
{% if method === 'GET' %}
// Get all {{ resourceName | pluralize | toLowerCase }}
router.get('/'{% if withAuth %}, authenticate{% endif %}, {{ resourceName | camelCase }}Controller.getAll);

// Get {{ resourceName | toLowerCase }} by ID
router.get('/:id'{% if withAuth %}, authenticate{% endif %}, {{ resourceName | camelCase }}Controller.getById);
{% elif method === 'POST' %}

// Create new {{ resourceName | toLowerCase }}
router.post('/'{% if withAuth %}, authenticate{% endif %}{% if withValidation %}, validate{{ resourceName | pascalCase }}{% endif %}, {{ resourceName | camelCase }}Controller.create);
{% elif method === 'PUT' %}

// Update {{ resourceName | toLowerCase }}
router.put('/:id'{% if withAuth %}, authenticate{% endif %}{% if withValidation %}, validate{{ resourceName | pascalCase }}{% endif %}, {{ resourceName | camelCase }}Controller.update);
{% elif method === 'DELETE' %}

// Delete {{ resourceName | toLowerCase }}
router.delete('/:id'{% if withAuth %}, authenticate{% endif %}, {{ resourceName | camelCase }}Controller.delete);
{% endif %}
{% endfor %}

module.exports = router;`,
        frontmatter: {
          to: 'src/routes/{{ resourceName | kebabCase }}.js',
          variables: {
            resourceName: {
              type: 'string',
              required: true,
              description: 'Resource name (e.g., user, product)'
            },
            httpMethods: {
              type: 'array',
              default: ['GET', 'POST', 'PUT', 'DELETE'],
              description: 'HTTP methods to implement'
            },
            withAuth: {
              type: 'boolean',
              default: true,
              description: 'Include authentication middleware'
            },
            withValidation: {
              type: 'boolean',
              default: true,
              description: 'Include request validation'
            }
          }
        }
      }
    ];

    await this.createGenerator(baseDir, 'api', templates);

    return {
      name: 'api',
      templates,
      variables: {
        resourceName: 'User',
        httpMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        withAuth: true,
        withValidation: true
      },
      expectedOutputs: [
        {
          path: 'src/routes/user.js',
          content: 'const express = require(\'express\');',
          shouldExist: true
        }
      ]
    };
  }

  /**
   * Validate that a generator produces expected outputs
   */
  static async validateGeneratorOutputs(
    baseDir: string,
    fixture: GeneratorFixture
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!fixture.expectedOutputs) {
      return { success: true, errors: [] };
    }

    for (const expected of fixture.expectedOutputs) {
      const fullPath = path.join(baseDir, expected.path);
      const exists = await fs.pathExists(fullPath);

      if (expected.shouldExist && !exists) {
        errors.push(`Expected file ${expected.path} does not exist`);
        continue;
      }

      if (!expected.shouldExist && exists) {
        errors.push(`File ${expected.path} should not exist but does`);
        continue;
      }

      if (exists && expected.content) {
        const content = await fs.readFile(fullPath, 'utf-8');
        if (!content.includes(expected.content)) {
          errors.push(`File ${expected.path} does not contain expected content: "${expected.content}"`);
        }
      }
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * Create multiple generators for comprehensive testing
   */
  static async createTestSuite(baseDir: string): Promise<GeneratorFixture[]> {
    const fixtures: GeneratorFixture[] = [];

    // Create React component generator
    fixtures.push(await this.createReactComponentGenerator(baseDir));

    // Create API endpoint generator
    fixtures.push(await this.createApiEndpointGenerator(baseDir));

    return fixtures;
  }
}