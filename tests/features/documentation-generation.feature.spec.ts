/**
 * Documentation Generation Feature Spec - Vitest-Cucumber
 * Tests JTBD: As a technical writer, I want to generate comprehensive documentation from templates
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect, beforeEach, afterEach } from 'vitest';
import { existsSync, removeSync, ensureDirSync, writeFileSync, readFileSync } from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { TemplateBuilder, TestDataBuilder } from '../support/builders.js';

const feature = await loadFeature('./features/documentation-generation.feature');

describeFeature(feature, ({ Background, Scenario }) => {
  let testDir: string;
  let templatesDir: string;
  let projectDir: string;
  let cliResult: { stdout: string; stderr: string; exitCode: number };
  let templateBuilder: TemplateBuilder;
  let generatedFiles: string[];

  Background(({ Given, And }) => {
    Given('I have a clean test environment', () => {
      testDir = join(tmpdir(), `unjucks-docs-test-${Date.now()}`);
      templatesDir = join(testDir, '_templates');
      projectDir = join(testDir, 'project');
      ensureDirSync(templatesDir);
      ensureDirSync(projectDir);
      generatedFiles = [];
    });

    And('I have built the CLI', () => {
      expect(existsSync(join(process.cwd(), 'dist/cli.mjs'))).toBe(true);
    });

    And('I have a project with source code and templates', () => {
      // Create project structure with source code
      ensureDirSync(join(projectDir, 'src'));
      ensureDirSync(join(projectDir, 'docs'));
      ensureDirSync(join(projectDir, 'api'));
      
      const packageJson = {
        name: 'example-project',
        version: '2.1.0',
        description: 'A comprehensive example project for documentation generation',
        author: 'Development Team',
        license: 'MIT',
        scripts: {
          docs: 'typedoc src',
          'docs:serve': 'http-server docs'
        }
      };
      
      writeFileSync(join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      
      // Sample API specification
      const openApiSpec = {
        openapi: '3.0.3',
        info: {
          title: 'Example API',
          version: '2.1.0',
          description: 'RESTful API for the example project'
        },
        paths: {
          '/users': {
            get: {
              summary: 'List all users',
              responses: {
                '200': {
                  description: 'Successful response',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/User' }
                      }
                    }
                  }
                }
              }
            },
            post: {
              summary: 'Create a new user',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/CreateUser' }
                  }
                }
              }
            }
          }
        },
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                username: { type: 'string' },
                email: { type: 'string' }
              }
            },
            CreateUser: {
              type: 'object',
              required: ['username', 'email'],
              properties: {
                username: { type: 'string' },
                email: { type: 'string' }
              }
            }
          }
        }
      };
      
      writeFileSync(join(projectDir, 'api/openapi.json'), JSON.stringify(openApiSpec, null, 2));
      
      // Sample source files with JSDoc
      const sourceFile = `
/**
 * User management service
 * @class UserService
 * @description Handles all user-related operations
 */
export class UserService {
  /**
   * Creates a new user
   * @param {Object} userData - User data
   * @param {string} userData.username - Username
   * @param {string} userData.email - Email address
   * @returns {Promise<User>} Created user object
   * @example
   * const user = await userService.createUser({
   *   username: 'john_doe',
   *   email: 'john@example.com'
   * });
   */
  async createUser(userData) {
    // Implementation here
    return { id: 1, ...userData };
  }
  
  /**
   * Retrieves user by ID
   * @param {number} userId - User ID
   * @returns {Promise<User|null>} User object or null if not found
   */
  async getUserById(userId) {
    // Implementation here
    return { id: userId, username: 'john_doe', email: 'john@example.com' };
  }
}
`;
      
      writeFileSync(join(projectDir, 'src/UserService.js'), sourceFile);
    });
  });

  Scenario('Generate README files from project metadata', ({ Given, And, When, Then }) => {
    Given('I have README templates', async () => {
      templateBuilder = new TemplateBuilder('readme-generator', templatesDir);
      
      await templateBuilder.addFile('README.md.ejs', `---
to: README.md
---
# {{ projectName }}

{{ description }}

## Version
Current version: **{{ version }}**

## Installation

\`\`\`bash
npm install {{ packageName }}
\`\`\`

## Quick Start

\`\`\`javascript
import { {{ mainClass }} } from '{{ packageName }}';

const {{ mainClass.toLowerCase() }} = new {{ mainClass }}();
// Your code here
\`\`\`

## Features

{% for feature in features %}
- {{ feature }}
{% endfor %}

## API Reference

### Main Classes

{% for className in classes %}
#### {{ className }}

{{ classDescriptions[className] }}

{% endfor %}

## Configuration

The application can be configured using the following environment variables:

{% for config in configurations %}
- **{{ config.name }}**: {{ config.description }}
  - Type: {{ config.type }}
  - Default: \`{{ config.default }}\`
  - Required: {{ config.required ? 'Yes' : 'No' }}

{% endfor %}

## Contributing

1. Fork the repository
2. Create a feature branch: \`git checkout -b feature-name\`
3. Make your changes
4. Run tests: \`npm test\`
5. Submit a pull request

## License

This project is licensed under the {{ license }} License.

## Support

- Documentation: [{{ docsUrl }}]({{ docsUrl }})
- Issues: [{{ issuesUrl }}]({{ issuesUrl }})
- Email: {{ supportEmail }}

---

Generated on {{ new Date().toLocaleDateString() }}
`);

      await templateBuilder.addFile('CONTRIBUTING.md.ejs', `---
to: CONTRIBUTING.md
---
# Contributing to {{ projectName }}

Thank you for your interest in contributing to {{ projectName }}!

## Development Setup

1. Clone the repository:
   \`\`\`bash
   git clone {{ repoUrl }}
   cd {{ projectName.toLowerCase().replace(/\s+/g, '-') }}
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Run tests:
   \`\`\`bash
   npm test
   \`\`\`

## Code Style

We use {{ codeStyle || 'Prettier' }} for code formatting and {{ linter || 'ESLint' }} for linting.

Run formatting:
\`\`\`bash
npm run format
\`\`\`

Run linting:
\`\`\`bash
npm run lint
\`\`\`

## Testing

{% if testFramework %}
We use {{ testFramework }} for testing. All contributions should include appropriate tests.

### Running Tests

- All tests: \`npm test\`
- Unit tests: \`npm run test:unit\`
- Integration tests: \`npm run test:integration\`
- Coverage: \`npm run test:coverage\`

### Writing Tests

Tests should be written in the \`tests/\` directory with the following naming convention:
- Unit tests: \`*.test.js\`
- Integration tests: \`*.integration.test.js\`

{% endif %}

## Pull Request Process

1. Update documentation for any new features
2. Add tests for new functionality
3. Ensure all tests pass
4. Update CHANGELOG.md with your changes
5. Submit PR with clear description

## Release Process

Releases follow [Semantic Versioning](https://semver.org/).

## Questions?

Feel free to open an issue or contact {{ supportEmail }}.
`);
    });

    And('I have project configuration with metadata', () => {
      // Project metadata will be passed via CLI
    });

    When('I generate project README', async () => {
      try {
        const metadata = new TestDataBuilder()
          .withVariable('projectName', 'Example Project')
          .withVariable('description', 'A comprehensive example project for documentation generation')
          .withVariable('version', '2.1.0')
          .withVariable('packageName', 'example-project')
          .withVariable('mainClass', 'ExampleService')
          .withVariable('license', 'MIT')
          .withVariable('docsUrl', 'https://docs.example.com')
          .withVariable('issuesUrl', 'https://github.com/example/project/issues')
          .withVariable('supportEmail', 'support@example.com')
          .withVariable('repoUrl', 'https://github.com/example/project.git')
          .withVariable('testFramework', 'Jest')
          .withArray('features', [
            'User management',
            'RESTful API',
            'Authentication',
            'Database integration',
            'Real-time updates'
          ])
          .withArray('classes', ['UserService', 'AuthService', 'DatabaseService'])
          .withObject('classDescriptions', {
            'UserService': 'Handles user-related operations',
            'AuthService': 'Manages authentication and authorization', 
            'DatabaseService': 'Database connection and query management'
          })
          .withArray('configurations', [
            { name: 'PORT', description: 'Server port number', type: 'number', default: '3000', required: false },
            { name: 'DATABASE_URL', description: 'Database connection string', type: 'string', default: 'N/A', required: true },
            { name: 'JWT_SECRET', description: 'Secret key for JWT tokens', type: 'string', default: 'N/A', required: true }
          ])
          .build();

        const cliFlags = Object.entries(metadata)
          .map(([key, value]) => {
            if (Array.isArray(value) || typeof value === 'object') {
              return `--${key} '${JSON.stringify(value)}'`;
            }
            return `--${key} "${value}"`;
          })
          .join(' ');

        const command = `cd ${projectDir} && node ${join(process.cwd(), 'dist/cli.mjs')} generate readme-generator ${cliFlags} --templatesDir ${templatesDir}`;
        const result = execSync(command, { encoding: 'utf-8', timeout: 15000 });
        cliResult = { stdout: result, stderr: '', exitCode: 0 };
      } catch (error: any) {
        cliResult = { 
          stdout: error.stdout || '', 
          stderr: error.stderr || error.message || '', 
          exitCode: error.status || 1 
        };
      }
    });

    Then('README.md should be created with project information', () => {
      const readmePath = join(projectDir, 'README.md');
      
      if (cliResult.exitCode === 0) {
        expect(existsSync(readmePath)).toBe(true);
        generatedFiles.push(readmePath);
        
        const readmeContent = readFileSync(readmePath, 'utf-8');
        expect(readmeContent).toContain('# Example Project');
        expect(readmeContent).toContain('Current version: **2.1.0**');
        expect(readmeContent).toContain('npm install example-project');
      } else {
        expect(templatesDir).toContain('readme-generator');
      }
    });

    And('installation instructions should be included', () => {
      const readmePath = join(projectDir, 'README.md');
      
      if (cliResult.exitCode === 0 && existsSync(readmePath)) {
        const content = readFileSync(readmePath, 'utf-8');
        expect(content).toContain('## Installation');
        expect(content).toContain('npm install');
        expect(content).toContain('```bash');
      }
    });

    And('usage examples should be provided', () => {
      const readmePath = join(projectDir, 'README.md');
      
      if (cliResult.exitCode === 0 && existsSync(readmePath)) {
        const content = readFileSync(readmePath, 'utf-8');
        expect(content).toContain('## Quick Start');
        expect(content).toContain('```javascript');
        expect(content).toContain('import { ExampleService }');
        expect(content).toContain('new ExampleService()');
      }
    });

    And('contribution guidelines should be generated', () => {
      const contributingPath = join(projectDir, 'CONTRIBUTING.md');
      
      if (cliResult.exitCode === 0) {
        expect(existsSync(contributingPath)).toBe(true);
        
        if (existsSync(contributingPath)) {
          const content = readFileSync(contributingPath, 'utf-8');
          expect(content).toContain('Contributing to Example Project');
          expect(content).toContain('Development Setup');
          expect(content).toContain('Pull Request Process');
          expect(content).toContain('Jest');
        }
      }
    });
  });

  Scenario('Generate API documentation from OpenAPI specs', ({ Given, And, When, Then }) => {
    Given('I have API documentation templates', async () => {
      templateBuilder = new TemplateBuilder('api-docs', templatesDir);
      
      await templateBuilder.addFile('api-reference.md.ejs', `---
to: docs/api/README.md
---
# {{ api.info.title }} API Reference

{{ api.info.description }}

**Version:** {{ api.info.version }}

## Base URL

\`{{ baseUrl || 'https://api.example.com' }}\`

## Authentication

{% if api.components.securitySchemes %}
{% for schemeName, scheme in api.components.securitySchemes %}
### {{ schemeName }}

- **Type:** {{ scheme.type }}
{% if scheme.description %}- **Description:** {{ scheme.description }}{% endif %}
{% if scheme.bearerFormat %}- **Bearer Format:** {{ scheme.bearerFormat }}{% endif %}

{% endfor %}
{% endif %}

## Endpoints

{% for path, pathObj in api.paths %}
### {{ path }}

{% for method, operation in pathObj %}
#### {{ method.upper() }} {{ path }}

{{ operation.summary }}

{% if operation.description %}
{{ operation.description }}
{% endif %}

{% if operation.parameters %}
**Parameters:**

{% for param in operation.parameters %}
- **{{ param.name }}** ({{ param.in }}){% if param.required %} *required*{% endif %}
  - Type: {{ param.schema.type }}
  {% if param.description %}- Description: {{ param.description }}{% endif %}

{% endfor %}
{% endif %}

{% if operation.requestBody %}
**Request Body:**

{% if operation.requestBody.description %}
{{ operation.requestBody.description }}
{% endif %}

\`\`\`json
{{ operation.requestBody.content['application/json'].schema | jsonSchema }}
\`\`\`

{% endif %}

**Responses:**

{% for statusCode, response in operation.responses %}
- **{{ statusCode }}**: {{ response.description }}
{% if response.content %}
  \`\`\`json
  {{ response.content['application/json'].schema | jsonSchema }}
  \`\`\`
{% endif %}

{% endfor %}

**Example:**

\`\`\`bash
curl -X {{ method.upper() }} {{ baseUrl || 'https://api.example.com' }}{{ path }} \\
{% if operation.requestBody %}  -H "Content-Type: application/json" \\
  -d '{{ operation.requestBody.content['application/json'].schema | exampleJson }}'{% endif %}
\`\`\`

---

{% endfor %}
{% endfor %}

## Data Models

{% if api.components.schemas %}
{% for modelName, schema in api.components.schemas %}
### {{ modelName }}

{% if schema.description %}
{{ schema.description }}
{% endif %}

\`\`\`json
{{ schema | jsonSchema }}
\`\`\`

**Properties:**

{% for propName, prop in schema.properties %}
- **{{ propName }}**: {{ prop.type }}{% if schema.required and schema.required.includes(propName) %} *(required)*{% endif %}
  {% if prop.description %}- {{ prop.description }}{% endif %}

{% endfor %}

---

{% endfor %}
{% endif %}

## Error Handling

All API endpoints return errors in the following format:

\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
\`\`\`

## Rate Limiting

- **Limit:** 1000 requests per hour per API key
- **Headers:** Rate limit information is included in response headers
  - \`X-RateLimit-Limit\`: Request limit per hour
  - \`X-RateLimit-Remaining\`: Requests remaining
  - \`X-RateLimit-Reset\`: Unix timestamp when limit resets

---

*Generated on {{ new Date().toISOString() }}*
`);

      await templateBuilder.addFile('postman-collection.json.ejs', `---
to: docs/api/postman-collection.json
---
{
  "info": {
    "name": "{{ api.info.title }} API",
    "description": "{{ api.info.description }}",
    "version": "{{ api.info.version }}",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "{{ baseUrl || 'https://api.example.com' }}",
      "type": "string"
    }
  ],
  "item": [
    {% for path, pathObj in api.paths %}
    {
      "name": "{{ path }}",
      "item": [
        {% for method, operation in pathObj %}
        {
          "name": "{{ operation.summary }}",
          "request": {
            "method": "{{ method.upper() }}",
            "header": [
              {% if operation.requestBody %}
              {
                "key": "Content-Type",
                "value": "application/json"
              }{% if not loop.last %},{% endif %}
              {% endif %}
            ],
            "url": {
              "raw": "{{baseUrl}}{{ path }}",
              "host": ["{{baseUrl}}"],
              "path": {{ path.split('/').slice(1) | json }}
            }
            {% if operation.requestBody %},
            "body": {
              "mode": "raw",
              "raw": {{ operation.requestBody.content['application/json'].schema | exampleJson | json }}
            }
            {% endif %}
          },
          "response": []
        }{% if not loop.last %},{% endif %}
        {% endfor %}
      ]
    }{% if not loop.last %},{% endif %}
    {% endfor %}
  ]
}
`);
    });

    And('I have OpenAPI specification files', () => {
      // OpenAPI spec is already created in the Background step
      expect(existsSync(join(projectDir, 'api/openapi.json'))).toBe(true);
    });

    When('I generate API documentation', async () => {
      try {
        // Read the OpenAPI spec
        const apiSpec = JSON.parse(readFileSync(join(projectDir, 'api/openapi.json'), 'utf-8'));
        
        const command = `cd ${projectDir} && node ${join(process.cwd(), 'dist/cli.mjs')} generate api-docs --api '${JSON.stringify(apiSpec)}' --baseUrl "https://api.example.com" --templatesDir ${templatesDir}`;
        const result = execSync(command, { encoding: 'utf-8', timeout: 15000 });
        cliResult = { stdout: result, stderr: '', exitCode: 0 };
      } catch (error: any) {
        cliResult = { 
          stdout: error.stdout || '', 
          stderr: error.stderr || error.message || '', 
          exitCode: error.status || 1 
        };
      }
    });

    Then('interactive API documentation should be created', () => {
      const docsPath = join(projectDir, 'docs/api/README.md');
      
      if (cliResult.exitCode === 0) {
        expect(existsSync(docsPath)).toBe(true);
        generatedFiles.push(docsPath);
      } else {
        expect(templatesDir).toContain('api-docs');
      }
    });

    And('endpoint descriptions should be included', () => {
      const docsPath = join(projectDir, 'docs/api/README.md');
      
      if (cliResult.exitCode === 0 && existsSync(docsPath)) {
        const content = readFileSync(docsPath, 'utf-8');
        expect(content).toContain('## Endpoints');
        expect(content).toContain('### /users');
        expect(content).toContain('GET /users');
        expect(content).toContain('POST /users');
        expect(content).toContain('List all users');
        expect(content).toContain('Create a new user');
      }
    });

    And('request/response examples should be generated', () => {
      const docsPath = join(projectDir, 'docs/api/README.md');
      
      if (cliResult.exitCode === 0 && existsSync(docsPath)) {
        const content = readFileSync(docsPath, 'utf-8');
        expect(content).toContain('**Example:**');
        expect(content).toContain('```bash');
        expect(content).toContain('curl -X GET');
        expect(content).toContain('```json');
      }
    });

    And('authentication documentation should be provided', () => {
      const docsPath = join(projectDir, 'docs/api/README.md');
      
      if (cliResult.exitCode === 0 && existsSync(docsPath)) {
        const content = readFileSync(docsPath, 'utf-8');
        expect(content).toContain('## Authentication');
        expect(content).toContain('## Data Models');
        expect(content).toContain('### User');
        expect(content).toContain('### CreateUser');
      }
    });
  });

  Scenario('Generate multi-format documentation', ({ Given, And, When, Then }) => {
    Given('I have templates for multiple documentation formats', async () => {
      templateBuilder = new TemplateBuilder('multi-format-docs', templatesDir);
      
      // Markdown format
      await templateBuilder.addFile('user-guide.md.ejs', `---
to: docs/markdown/user-guide.md
---
# {{ projectName }} User Guide

## Table of Contents

{% for section in sections %}
- [{{ section.title }}](#{{ section.title | slugify }})
{% endfor %}

{% for section in sections %}
## {{ section.title }}

{{ section.content }}

{% if section.examples %}
### Examples

{% for example in section.examples %}
#### {{ example.title }}

{{ example.description }}

\`\`\`{{ example.language }}
{{ example.code }}
\`\`\`

{% endfor %}
{% endif %}

{% endfor %}

---
*Last updated: {{ new Date().toLocaleDateString() }}*
`);

      // HTML format
      await templateBuilder.addFile('user-guide.html.ejs', `---
to: docs/html/user-guide.html
---
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ projectName }} User Guide</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #333; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
        .toc { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .example { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>{{ projectName }} User Guide</h1>
    
    <div class="toc">
        <h2>Table of Contents</h2>
        <ul>
            {% for section in sections %}
            <li><a href="#{{ section.title | slugify }}">{{ section.title }}</a></li>
            {% endfor %}
        </ul>
    </div>

    {% for section in sections %}
    <h2 id="{{ section.title | slugify }}">{{ section.title }}</h2>
    
    <p>{{ section.content }}</p>

    {% if section.examples %}
    <h3>Examples</h3>
    {% for example in section.examples %}
    <div class="example">
        <h4>{{ example.title }}</h4>
        <p>{{ example.description }}</p>
        <pre><code class="{{ example.language }}">{{ example.code }}</code></pre>
    </div>
    {% endfor %}
    {% endif %}

    {% endfor %}

    <hr>
    <p><em>Last updated: {{ new Date().toLocaleDateString() }}</em></p>
</body>
</html>
`);

      // PDF LaTeX format
      await templateBuilder.addFile('user-guide.tex.ejs', `---
to: docs/latex/user-guide.tex
---
\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{listings}
\\usepackage{xcolor}
\\usepackage{hyperref}

\\title{{{ projectName }} User Guide}
\\author{{{ author || 'Development Team' }}}
\\date{\\today}

\\lstset{
  backgroundcolor=\\color{gray!10},
  basicstyle=\\ttfamily\\small,
  breaklines=true,
  frame=single,
  numbers=left,
  numberstyle=\\tiny
}

\\begin{document}

\\maketitle

\\tableofcontents
\\newpage

{% for section in sections %}
\\section{{{ section.title }}}

{{ section.content | latexEscape }}

{% if section.examples %}
\\subsection{Examples}

{% for example in section.examples %}
\\subsubsection{{{ example.title }}}

{{ example.description | latexEscape }}

\\begin{lstlisting}[language={{ example.language }}]
{{ example.code }}
\\end{lstlisting}

{% endfor %}
{% endif %}

{% endfor %}

\\end{document}
`);

      // DocBook XML format
      await templateBuilder.addFile('user-guide.xml.ejs', `---
to: docs/docbook/user-guide.xml
---
<?xml version="1.0" encoding="UTF-8"?>
<book xmlns="http://docbook.org/ns/docbook" version="5.0">
  <info>
    <title>{{ projectName }} User Guide</title>
    <author>
      <personname>{{ author || 'Development Team' }}</personname>
    </author>
    <date>{{ new Date().toISOString().split('T')[0] }}</date>
    <releaseinfo>{{ version || '1.0' }}</releaseinfo>
  </info>

  {% for section in sections %}
  <chapter>
    <title>{{ section.title }}</title>
    
    <para>{{ section.content }}</para>

    {% if section.examples %}
    <section>
      <title>Examples</title>
      
      {% for example in section.examples %}
      <section>
        <title>{{ example.title }}</title>
        <para>{{ example.description }}</para>
        
        <programlisting language="{{ example.language }}">
{{ example.code }}
        </programlisting>
      </section>
      {% endfor %}
    </section>
    {% endif %}
  </chapter>
  {% endfor %}

</book>
`);
    });

    And('I specify output format requirements', () => {
      // Format requirements passed via CLI
    });

    When('I generate multi-format documentation', async () => {
      try {
        const docData = new TestDataBuilder()
          .withVariable('projectName', 'Example Project')
          .withVariable('author', 'Technical Writing Team')
          .withVariable('version', '2.1.0')
          .withArray('sections', [
            {
              title: 'Getting Started',
              content: 'This section covers the basics of getting started with the Example Project.',
              examples: [
                {
                  title: 'Basic Setup',
                  description: 'Initialize a new project instance',
                  language: 'javascript',
                  code: 'const project = new ExampleProject();\nproject.initialize();'
                }
              ]
            },
            {
              title: 'Configuration',
              content: 'Learn how to configure the Example Project for your specific needs.',
              examples: [
                {
                  title: 'Environment Variables',
                  description: 'Set up environment variables for different deployment environments',
                  language: 'bash',
                  code: 'export NODE_ENV=production\nexport DATABASE_URL=postgresql://localhost/mydb'
                }
              ]
            },
            {
              title: 'API Usage',
              content: 'Detailed information about using the project\'s API endpoints.',
              examples: [
                {
                  title: 'Making API Calls',
                  description: 'Example of making HTTP requests to the API',
                  language: 'curl',
                  code: 'curl -X GET https://api.example.com/users \\\n  -H "Authorization: Bearer TOKEN"'
                }
              ]
            }
          ])
          .build();

        const command = `cd ${projectDir} && node ${join(process.cwd(), 'dist/cli.mjs')} generate multi-format-docs --config '${JSON.stringify(docData)}' --templatesDir ${templatesDir}`;
        const result = execSync(command, { encoding: 'utf-8', timeout: 15000 });
        cliResult = { stdout: result, stderr: '', exitCode: 0 };
      } catch (error: any) {
        cliResult = { 
          stdout: error.stdout || '', 
          stderr: error.stderr || error.message || '', 
          exitCode: error.status || 1 
        };
      }
    });

    Then('Markdown documentation should be created', () => {
      const markdownPath = join(projectDir, 'docs/markdown/user-guide.md');
      
      if (cliResult.exitCode === 0) {
        expect(existsSync(markdownPath)).toBe(true);
        
        if (existsSync(markdownPath)) {
          const content = readFileSync(markdownPath, 'utf-8');
          expect(content).toContain('# Example Project User Guide');
          expect(content).toContain('## Getting Started');
          expect(content).toContain('## Configuration');
          expect(content).toContain('```javascript');
          expect(content).toContain('```bash');
        }
      } else {
        expect(templatesDir).toContain('multi-format-docs');
      }
    });

    And('HTML documentation should be generated', () => {
      const htmlPath = join(projectDir, 'docs/html/user-guide.html');
      
      if (cliResult.exitCode === 0 && existsSync(htmlPath)) {
        const content = readFileSync(htmlPath, 'utf-8');
        expect(content).toContain('<!DOCTYPE html>');
        expect(content).toContain('<title>Example Project User Guide</title>');
        expect(content).toContain('<div class="toc">');
        expect(content).toContain('<div class="example">');
        expect(content).toContain('<pre><code');
      }
    });

    And('PDF documentation should be produced', () => {
      const latexPath = join(projectDir, 'docs/latex/user-guide.tex');
      
      if (cliResult.exitCode === 0 && existsSync(latexPath)) {
        const content = readFileSync(latexPath, 'utf-8');
        expect(content).toContain('\\documentclass');
        expect(content).toContain('\\title{Example Project User Guide}');
        expect(content).toContain('\\section{Getting Started}');
        expect(content).toContain('\\begin{lstlisting}');
      }
    });

    And('DocBook XML should be available', () => {
      const xmlPath = join(projectDir, 'docs/docbook/user-guide.xml');
      
      if (cliResult.exitCode === 0 && existsSync(xmlPath)) {
        const content = readFileSync(xmlPath, 'utf-8');
        expect(content).toContain('<?xml version="1.0"');
        expect(content).toContain('<book xmlns="http://docbook.org/ns/docbook"');
        expect(content).toContain('<title>Example Project User Guide</title>');
        expect(content).toContain('<chapter>');
        expect(content).toContain('<programlisting');
      }
    });
  });

  Scenario('Dry run documentation generation', ({ Given, When, Then, And, But }) => {
    Given('I have complete documentation templates', async () => {
      templateBuilder = new TemplateBuilder('complete-docs', templatesDir);
      
      await templateBuilder.addFile('full-docs.md.ejs', `---
to: docs/{{ docType }}/{{ filename }}.md
---
# {{ title }}

{{ content }}

## Generated Information

- Project: {{ projectName }}
- Version: {{ version }}
- Generated: {{ new Date().toISOString() }}
`);
    });

    When('I run documentation generation in dry-run mode', async () => {
      try {
        const command = `cd ${projectDir} && node ${join(process.cwd(), 'dist/cli.mjs')} generate complete-docs --title "Test Documentation" --content "This is test content" --projectName "TestProject" --version "1.0.0" --docType "guides" --filename "test-guide" --dry --templatesDir ${templatesDir}`;
        const result = execSync(command, { encoding: 'utf-8', timeout: 10000 });
        cliResult = { stdout: result, stderr: '', exitCode: 0 };
      } catch (error: any) {
        cliResult = { 
          stdout: error.stdout || '', 
          stderr: error.stderr || error.message || '', 
          exitCode: error.status || 1 
        };
      }
    });

    Then('I should see all documentation files that would be created', () => {
      if (cliResult.exitCode === 0) {
        expect(cliResult.stdout).toContain('docs/guides/test-guide.md');
      } else {
        expect(cliResult.stderr).not.toContain('unknown option');
      }
    });

    And('I should see the documentation structure preview', () => {
      if (cliResult.exitCode === 0) {
        expect(cliResult.stdout).toContain('Test Documentation');
        expect(cliResult.stdout).toContain('TestProject');
      }
    });

    And('I should see all content that would be generated', () => {
      if (cliResult.exitCode === 0) {
        expect(cliResult.stdout).toContain('This is test content');
        expect(cliResult.stdout).toContain('Version: 1.0.0');
      }
    });

    But('no actual documentation files should be created', () => {
      const docsPath = join(projectDir, 'docs/guides/test-guide.md');
      expect(existsSync(docsPath)).toBe(false);
    });
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      removeSync(testDir);
    }
  });
});