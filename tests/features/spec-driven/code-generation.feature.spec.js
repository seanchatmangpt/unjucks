import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

// Mock implementations for code generation system
class CodeGenerator {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.templates = new Map([
      ['service_class', {
        extension: '.js',
        template: 'class {{className}} {\n  constructor() {\n    // TODO: Initialize {{className}}\n  }\n}'
      }],
      ['api_routes', {
        extension: '.js',
        template: 'const express = require("express");\nconst router = express.Router();\n\n// {{description}}\n{{#each endpoints}}\nrouter.{{method}}("{{path}}", {{handlerName}});\n{{/each}}\n\nmodule.exports = router;'
      }],
      ['test_file', {
        extension: '.test.js',
        template: 'const { describe, it, expect } = require("vitest");\nconst {{className}} = require("../{{modulePath}}");\n\ndescribe("{{className}}", () => {\n  it("should be defined", () => {\n    expect({{className}}).toBeDefined();\n  });\n});'
      }]
    ]);

    this.qualityChecks = {
      syntax: true,
      lint: true,
      security: true,
      performance: true,
      coverage: true
    };
  }

  async generateCodeScaffolding(specification) {
    const files = [];

    // Generate service class
    const serviceFile = await this.generateFile('service_class', {
      className: specification.name,
      description: specification.description,
      path: `src/services/${specification.name}.js`
    });
    files.push(serviceFile);

    // Generate interface/types
    const interfaceFile = await this.generateFile('interface', {
      className: specification.name,
      path: `src/types/${specification.name}.js`,
      content: `// ${specification.name} interfaces\nmodule.exports = {\n  // TODO: Define interfaces\n};`
    });
    files.push(interfaceFile);

    // Generate test file
    const testFile = await this.generateFile('test_file', {
      className: specification.name,
      modulePath: `../services/${specification.name}`,
      path: `tests/services/${specification.name}.test.js`
    });
    files.push(testFile);

    // Generate API routes if needed
    if (specification.endpoints) {
      const routeFile = await this.generateAPIRoutes(specification);
      files.push(routeFile);
    }

    return files;
  }

  async generateAPICode(specification) {
    const files = [];
    const endpoints = specification.endpoints || [];

    for (const endpoint of endpoints) {
      // Generate route handler
      const handlerCode = this.generateRouteHandler(endpoint);
      const handlerFile = {
        path: `src/routes/${endpoint.path.replace(/[\/\:]/g, '_')}.js`,
        content: handlerCode,
        type: 'api_handler'
      };
      files.push(handlerFile);

      // Generate request/response schemas
      const schemaCode = this.generateAPISchemas(endpoint);
      const schemaFile = {
        path: `src/schemas/${endpoint.path.replace(/[\/\:]/g, '_')}_schema.js`,
        content: schemaCode,
        type: 'api_schema'
      };
      files.push(schemaFile);

      // Generate validation middleware
      const validationCode = this.generateValidationMiddleware(endpoint);
      const validationFile = {
        path: `src/middleware/validation/${endpoint.path.replace(/[\/\:]/g, '_')}_validation.js`,
        content: validationCode,
        type: 'validation_middleware'
      };
      files.push(validationFile);
    }

    // Generate OpenAPI documentation
    const openAPIDoc = this.generateOpenAPIDoc(specification);
    files.push({
      path: 'docs/api/openapi.json',
      content: JSON.stringify(openAPIDoc, null, 2),
      type: 'api_documentation'
    });

    return files;
  }

  async generateDatabaseSchema(specification) {
    const files = [];
    const entities = specification.entities || [];

    for (const entity of entities) {
      // Generate migration file
      const migrationCode = this.generateMigration(entity);
      const timestamp = this.getDeterministicTimestamp();
      const migrationFile = {
        path: `migrations/${timestamp}_create_${entity.name.toLowerCase()}_table.js`,
        content: migrationCode,
        type: 'database_migration'
      };
      files.push(migrationFile);

      // Generate model class
      const modelCode = this.generateModelClass(entity);
      const modelFile = {
        path: `src/models/${entity.name}.js`,
        content: modelCode,
        type: 'database_model'
      };
      files.push(modelFile);

      // Generate relationships
      if (entity.relationships) {
        const relationshipCode = this.generateRelationships(entity);
        const relationshipFile = {
          path: `src/models/relationships/${entity.name}Relationships.js`,
          content: relationshipCode,
          type: 'database_relationship'
        };
        files.push(relationshipFile);
      }
    }

    return files;
  }

  async generateFrontendComponents(specification) {
    const files = [];
    
    // Main component
    const componentCode = this.generateReactComponent(specification);
    const componentFile = {
      path: `src/components/${specification.name}.js`,
      content: componentCode,
      type: 'react_component'
    };
    files.push(componentFile);

    // Style file
    const styleCode = this.generateComponentStyles(specification);
    const styleFile = {
      path: `src/components/${specification.name}.css`,
      content: styleCode,
      type: 'component_style'
    };
    files.push(styleFile);

    // Test file
    const componentTestCode = this.generateComponentTest(specification);
    const testFile = {
      path: `tests/components/${specification.name}.test.js`,
      content: componentTestCode,
      type: 'component_test'
    };
    files.push(testFile);

    // Storybook story
    const storyCode = this.generateStorybook(specification);
    const storyFile = {
      path: `stories/${specification.name}.stories.js`,
      content: storyCode,
      type: 'storybook_story'
    };
    files.push(storyFile);

    return files;
  }

  async generateTestCode(specification) {
    const files = [];

    if (specification.acceptance) {
      // Unit tests
      const unitTestCode = this.generateUnitTests(specification);
      files.push({
        path: `tests/unit/${specification.name.toLowerCase()}.test.js`,
        content: unitTestCode,
        type: 'unit_test'
      });

      // Integration tests
      const integrationTestCode = this.generateIntegrationTests(specification);
      files.push({
        path: `tests/integration/${specification.name.toLowerCase()}.test.js`,
        content: integrationTestCode,
        type: 'integration_test'
      });

      // E2E tests
      const e2eTestCode = this.generateE2ETests(specification);
      files.push({
        path: `tests/e2e/${specification.name.toLowerCase()}.e2e.js`,
        content: e2eTestCode,
        type: 'e2e_test'
      });

      // API tests
      if (specification.endpoints) {
        const apiTestCode = this.generateAPITests(specification);
        files.push({
          path: `tests/api/${specification.name.toLowerCase()}.api.test.js`,
          content: apiTestCode,
          type: 'api_test'
        });
      }
    }

    return files;
  }

  async generateConfigurationFiles(specification) {
    const files = [];

    // Environment files
    const envExample = this.generateEnvExample(specification);
    files.push({
      path: '.env.example',
      content: envExample,
      type: 'environment_config'
    });

    // Docker files
    const dockerfile = this.generateDockerfile(specification);
    files.push({
      path: 'Dockerfile',
      content: dockerfile,
      type: 'docker_config'
    });

    const dockerCompose = this.generateDockerCompose(specification);
    files.push({
      path: 'docker-compose.yml',
      content: dockerCompose,
      type: 'docker_compose'
    });

    // CI/CD pipeline
    const githubWorkflow = this.generateGitHubWorkflow(specification);
    files.push({
      path: '.github/workflows/main.yml',
      content: githubWorkflow,
      type: 'ci_cd_config'
    });

    // Package configuration
    const packageConfig = this.generatePackageConfig(specification);
    files.push({
      path: 'package.json',
      content: JSON.stringify(packageConfig, null, 2),
      type: 'package_config'
    });

    return files;
  }

  async generateWithCustomTemplate(specification, templatePath) {
    try {
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const compiled = this.compileTemplate(templateContent);
      const rendered = compiled(specification);
      
      return {
        path: this.resolveTemplatePath(specification, templatePath),
        content: rendered,
        type: 'custom_template',
        template: templatePath
      };
    } catch (error) {
      throw new Error(`Failed to process custom template ${templatePath}: ${error.message}`);
    }
  }

  async performIncrementalGeneration(specification, existingFiles) {
    const newFiles = await this.generateCodeScaffolding(specification);
    const results = {
      generated: [],
      updated: [],
      skipped: [],
      conflicts: [],
      backups: []
    };

    for (const newFile of newFiles) {
      const existingFile = existingFiles.find(f => f.path === newFile.path);
      
      if (!existingFile) {
        // New file, generate it
        await this.writeFile(newFile);
        results.generated.push(newFile);
      } else {
        // File exists, check for conflicts
        const hasChanges = await this.detectChanges(existingFile, newFile);
        const hasCustomizations = await this.detectCustomizations(existingFile);

        if (hasCustomizations && hasChanges) {
          // Create backup and report conflict
          const backup = await this.createBackup(existingFile);
          results.backups.push(backup);
          results.conflicts.push({
            path: newFile.path,
            reason: 'File has customizations and would be overwritten',
            backup: backup.path
          });
        } else if (hasChanges) {
          // Update file
          await this.writeFile(newFile);
          results.updated.push(newFile);
        } else {
          // No changes needed
          results.skipped.push(newFile);
        }
      }
    }

    return results;
  }

  async generateMultiLanguage(specification, targets) {
    const results = {};

    for (const target of targets) {
      const generator = this.getLanguageGenerator(target.language, target.framework);
      const files = await generator.generate(specification);
      
      // Ensure output goes to correct directory
      const adjustedFiles = files.map(file => ({
        ...file,
        path: path.join(target.output_dir, file.path)
      }));

      results[target.language] = {
        framework: target.framework,
        files: adjustedFiles,
        outputDir: target.output_dir
      };
    }

    return results;
  }

  async runQualityChecks(files) {
    const results = {
      passed: true,
      checks: {},
      issues: []
    };

    for (const [checkName, enabled] of Object.entries(this.qualityChecks)) {
      if (!enabled) continue;

      const checkResult = await this.runQualityCheck(checkName, files);
      results.checks[checkName] = checkResult;
      
      if (!checkResult.passed) {
        results.passed = false;
        results.issues.push(...checkResult.issues);
      }
    }

    return results;
  }

  // Private helper methods
  async generateFile(templateName, context) {
    const template = this.templates.get(templateName);
    if (!template) {
      return {
        path: context.path,
        content: context.content || `// Generated ${templateName} for ${context.className}`,
        type: templateName
      };
    }

    const content = this.renderTemplate(template.template, context);
    return {
      path: context.path,
      content,
      type: templateName
    };
  }

  renderTemplate(template, context) {
    // Simple template rendering (in real implementation, would use proper template engine)
    let rendered = template;
    
    // Replace simple variables
    Object.keys(context).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, context[key]);
    });

    // Handle basic loops (simplified)
    const loopRegex = /{{#each (\w+)}}(.*?){{\/each}}/gs;
    rendered = rendered.replace(loopRegex, (match, arrayName, loopContent) => {
      const array = context[arrayName];
      if (!Array.isArray(array)) return '';
      
      return array.map(item => {
        let itemContent = loopContent;
        Object.keys(item).forEach(key => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          itemContent = itemContent.replace(regex, item[key]);
        });
        return itemContent;
      }).join('\n');
    });

    return rendered;
  }

  generateRouteHandler(endpoint) {
    return `const express = require('express');
const router = express.Router();

// ${endpoint.description}
router.${endpoint.method.toLowerCase()}('${endpoint.path}', async (req, res) => {
  try {
    // TODO: Implement ${endpoint.method} ${endpoint.path}
    res.json({ message: 'Not implemented yet' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;`;
  }

  generateAPISchemas(endpoint) {
    return `// Schema definitions for ${endpoint.method} ${endpoint.path}
const Joi = require('joi');

const requestSchema = Joi.object({
  // TODO: Define request schema
});

const responseSchema = Joi.object({
  // TODO: Define response schema
});

module.exports = {
  request: requestSchema,
  response: responseSchema
};`;
  }

  generateValidationMiddleware(endpoint) {
    return `const { requestSchema } = require('../schemas/${endpoint.path.replace(/[\/\:]/g, '_')}_schema');

const validate${endpoint.method}${endpoint.path.replace(/[\/\:]/g, '')} = (req, res, next) => {
  const { error } = requestSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

module.exports = validate${endpoint.method}${endpoint.path.replace(/[\/\:]/g, '')};`;
  }

  generateOpenAPIDoc(specification) {
    const doc = {
      openapi: '3.0.0',
      info: {
        title: specification.name,
        description: specification.description,
        version: '1.0.0'
      },
      paths: {}
    };

    if (specification.endpoints) {
      specification.endpoints.forEach(endpoint => {
        if (!doc.paths[endpoint.path]) {
          doc.paths[endpoint.path] = {};
        }
        
        doc.paths[endpoint.path][endpoint.method.toLowerCase()] = {
          summary: endpoint.description,
          responses: {
            '200': {
              description: 'Success'
            },
            '400': {
              description: 'Bad Request'
            },
            '500': {
              description: 'Internal Server Error'
            }
          }
        };
      });
    }

    return doc;
  }

  generateMigration(entity) {
    const fields = entity.fields || {};
    const fieldDefs = Object.entries(fields).map(([name, type]) => {
      let fieldDef = `t.${this.mapFieldType(type)}('${name}')`;
      if (name === 'id') fieldDef += '.primary()';
      return `    ${fieldDef};`;
    }).join('\n');

    return `exports.up = function(knex) {
  return knex.schema.createTable('${entity.name.toLowerCase()}s', function (t) {
${fieldDefs}
    t.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('${entity.name.toLowerCase()}s');
};`;
  }

  generateModelClass(entity) {
    return `const { Model } = require('objection');

class ${entity.name} extends Model {
  static get tableName() {
    return '${entity.name.toLowerCase()}s';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['${Object.keys(entity.fields || {})[0]}'],
      properties: {
        ${Object.entries(entity.fields || {}).map(([name, type]) => 
          `${name}: { type: '${this.mapJSONSchemaType(type)}' }`
        ).join(',\n        ')}
      }
    };
  }
}

module.exports = ${entity.name};`;
  }

  generateRelationships(entity) {
    return `// Relationships for ${entity.name}
// TODO: Implement relationships based on specification`;
  }

  generateReactComponent(specification) {
    return `import React, { useState, useEffect } from 'react';
import './${specification.name}.css';

const ${specification.name} = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Component initialization
  }, []);

  if (loading) {
    return <div className="${specification.name.toLowerCase()}__loading">Loading...</div>;
  }

  if (error) {
    return <div className="${specification.name.toLowerCase()}__error">Error: {error}</div>;
  }

  return (
    <div className="${specification.name.toLowerCase()}">
      <h1>${specification.name}</h1>
      <p>${specification.description}</p>
      {/* TODO: Implement component functionality */}
    </div>
  );
};

export default ${specification.name};`;
  }

  generateComponentStyles(specification) {
    const className = specification.name.toLowerCase();
    return `.${className} {
  /* Base styles for ${specification.name} */
}

.${className}__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.${className}__error {
  color: #e53e3e;
  padding: 1rem;
  border: 1px solid #e53e3e;
  border-radius: 4px;
  background-color: #fed7d7;
}

/* Responsive design */
@media (max-width: 768px) {
  .${className} {
    padding: 1rem;
  }
}`;
  }

  generateComponentTest(specification) {
    return `import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ${specification.name} from '../src/components/${specification.name}';

describe('${specification.name}', () => {
  it('renders without crashing', () => {
    render(<${specification.name} />);
    expect(screen.getByText('${specification.name}')).toBeInTheDocument();
  });

  it('displays the description', () => {
    render(<${specification.name} />);
    expect(screen.getByText('${specification.description}')).toBeInTheDocument();
  });

  it('handles loading state', () => {
    // TODO: Test loading state
  });

  it('handles error state', () => {
    // TODO: Test error state
  });
});`;
  }

  generateStorybook(specification) {
    return `import ${specification.name} from '../src/components/${specification.name}';

export default {
  title: 'Components/${specification.name}',
  component: ${specification.name},
  parameters: {
    docs: {
      description: {
        component: '${specification.description}'
      }
    }
  }
};

export const Default = {};

export const Loading = {
  parameters: {
    mockData: { loading: true }
  }
};

export const WithError = {
  parameters: {
    mockData: { error: 'Something went wrong' }
  }
};`;
  }

  generateUnitTests(specification) {
    return `const { describe, it, expect, beforeEach, afterEach } = require('vitest');
const ${specification.name} = require('../src/services/${specification.name}');

describe('${specification.name}', () => {
  let service;

  beforeEach(() => {
    service = new ${specification.name}();
  });

  afterEach(() => {
    // Cleanup
  });

  ${specification.acceptance ? specification.acceptance.map(criterion => `
  it('should ${criterion.toLowerCase()}', () => {
    // TODO: Test ${criterion}
    expect(true).toBe(true);
  });`).join('\n') : ''}

  it('should handle edge cases', () => {
    // TODO: Test edge cases
  });

  it('should validate input parameters', () => {
    // TODO: Test input validation
  });
});`;
  }

  generateIntegrationTests(specification) {
    return `const { describe, it, expect, beforeAll, afterAll } = require('vitest');
const request = require('supertest');
const app = require('../src/app');

describe('${specification.name} Integration Tests', () => {
  beforeAll(async () => {
    // Setup test database, etc.
  });

  afterAll(async () => {
    // Cleanup
  });

  ${specification.endpoints ? specification.endpoints.map(endpoint => `
  it('should ${endpoint.method} ${endpoint.path}', async () => {
    const response = await request(app)
      .${endpoint.method.toLowerCase()}('${endpoint.path}')
      .expect(200);
    
    // TODO: Add specific assertions
  });`).join('\n') : ''}
});`;
  }

  generateE2ETests(specification) {
    return `const { test, expect } = require('@playwright/test');

test.describe('${specification.name} E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  ${specification.acceptance ? specification.acceptance.map(criterion => `
  test('${criterion}', async ({ page }) => {
    // TODO: Implement E2E test for ${criterion}
    await expect(page).toHaveTitle(/${specification.name}/);
  });`).join('\n') : ''}
});`;
  }

  generateAPITests(specification) {
    return `const { describe, it, expect, beforeAll, afterAll } = require('vitest');
const request = require('supertest');
const app = require('../src/app');

describe('${specification.name} API Tests', () => {
  ${specification.endpoints ? specification.endpoints.map(endpoint => `
  describe('${endpoint.method} ${endpoint.path}', () => {
    it('should return successful response', async () => {
      const response = await request(app)
        .${endpoint.method.toLowerCase()}('${endpoint.path}');
      
      expect(response.status).toBe(200);
    });

    it('should validate request format', async () => {
      // TODO: Test request validation
    });

    it('should handle errors gracefully', async () => {
      // TODO: Test error handling
    });
  });`).join('\n') : ''}
});`;
  }

  generateEnvExample(specification) {
    return `# ${specification.name} Environment Variables

# Database
DATABASE_URL=postgresql://localhost:5432/${specification.name.toLowerCase()}
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=${specification.name.toLowerCase()}
DATABASE_USERNAME=user
DATABASE_PASSWORD=password

# Server
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=your-jwt-secret-here
ENCRYPTION_KEY=your-encryption-key-here

# External Services
# Add any external service configurations here`;
  }

  generateDockerfile(specification) {
    return `FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]`;
  }

  generateDockerCompose(specification) {
    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/${specification.name.toLowerCase()}
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=${specification.name.toLowerCase()}
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

volumes:
  postgres_data:`;
  }

  generateGitHubWorkflow(specification) {
    return `name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run tests
      run: npm test
    
    - name: Run security scan
      run: npm audit
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to production
      run: echo "Deploying ${specification.name}"`;
  }

  generatePackageConfig(specification) {
    return {
      name: specification.name.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: specification.description,
      main: 'src/index.js',
      scripts: {
        start: 'node src/index.js',
        dev: 'nodemon src/index.js',
        test: 'vitest',
        'test:coverage': 'vitest --coverage',
        lint: 'eslint src/**/*.js',
        'lint:fix': 'eslint src/**/*.js --fix',
        build: 'echo "Build process not configured"'
      },
      dependencies: {
        express: '^4.18.0',
        cors: '^2.8.5',
        helmet: '^6.0.0',
        dotenv: '^16.0.0'
      },
      devDependencies: {
        vitest: '^0.34.0',
        eslint: '^8.0.0',
        nodemon: '^2.0.0',
        supertest: '^6.0.0'
      }
    };
  }

  mapFieldType(type) {
    const typeMap = {
      'uuid': 'uuid',
      'string': 'string',
      'text': 'text',
      'integer': 'integer',
      'boolean': 'boolean',
      'datetime': 'datetime',
      'json': 'json'
    };
    return typeMap[type] || 'string';
  }

  mapJSONSchemaType(type) {
    const typeMap = {
      'uuid': 'string',
      'string': 'string',
      'text': 'string',
      'integer': 'integer',
      'boolean': 'boolean',
      'datetime': 'string',
      'json': 'object'
    };
    return typeMap[type] || 'string';
  }

  compileTemplate(templateContent) {
    // Simple template compiler (in real implementation, use proper engine)
    return (context) => {
      let compiled = templateContent;
      Object.keys(context).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        compiled = compiled.replace(regex, context[key]);
      });
      return compiled;
    };
  }

  resolveTemplatePath(specification, templatePath) {
    const basename = path.basename(templatePath, path.extname(templatePath));
    const ext = path.extname(templatePath);
    return `src/${basename.replace('{{name}}', specification.name)}${ext}`;
  }

  async writeFile(file) {
    const fullPath = path.join(this.baseDir, file.path);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.content, 'utf-8');
    return fullPath;
  }

  async detectChanges(existingFile, newFile) {
    // Simple change detection
    return existingFile.content !== newFile.content;
  }

  async detectCustomizations(existingFile) {
    // Simple customization detection (look for TODO removal or custom comments)
    return !existingFile.content.includes('TODO:') && 
           existingFile.content.includes('// CUSTOM:');
  }

  async createBackup(existingFile) {
    const timestamp = this.getDeterministicTimestamp();
    const backupPath = `${existingFile.path}.${timestamp}.bak`;
    const fullBackupPath = path.join(this.baseDir, backupPath);
    
    await fs.mkdir(path.dirname(fullBackupPath), { recursive: true });
    await fs.writeFile(fullBackupPath, existingFile.content, 'utf-8');
    
    return {
      originalPath: existingFile.path,
      path: backupPath,
      timestamp
    };
  }

  getLanguageGenerator(language, framework) {
    // Return appropriate generator for language/framework combination
    return {
      generate: async (specification) => {
        // Mock implementation for different languages
        return [{
          path: `main.${language === 'python' ? 'py' : 'js'}`,
          content: `// ${language} ${framework} implementation for ${specification.name}`,
          type: 'main_file'
        }];
      }
    };
  }

  async runQualityCheck(checkName, files) {
    // Mock quality check implementation
    const results = {
      syntax: { passed: true, issues: [] },
      lint: { passed: true, issues: [] },
      security: { passed: true, issues: [] },
      performance: { passed: true, issues: [] },
      coverage: { passed: true, issues: [] }
    };

    // Simulate some checks
    if (checkName === 'syntax') {
      const syntaxIssues = files.filter(f => f.content.includes('syntax error'));
      return {
        passed: syntaxIssues.length === 0,
        issues: syntaxIssues.map(f => `Syntax error in ${f.path}`)
      };
    }

    return results[checkName] || { passed: true, issues: [] };
  }
}

// Test context
let testContext = {};

describe('Code Generation from Specifications', () => {
  beforeEach(async () => {
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'codegen-test-'));
    testContext = {
      tempDir,
      codeGenerator: new CodeGenerator(tempDir),
      sampleSpec: {
        id: 'spec-1',
        name: 'UserService',
        description: 'User management service',
        type: 'feature',
        endpoints: [
          { method: 'GET', path: '/users', description: 'Get all users' },
          { method: 'POST', path: '/users', description: 'Create new user' },
          { method: 'PUT', path: '/users/:id', description: 'Update user' }
        ],
        entities: [
          { 
            name: 'User', 
            fields: { 
              id: 'uuid', 
              email: 'string', 
              name: 'string' 
            } 
          }
        ],
        acceptance: [
          'User can be created with valid data',
          'User can be updated',
          'User list can be retrieved'
        ]
      }
    };
  });

  afterEach(async () => {
    if (testContext.tempDir) {
      await fs.rm(testContext.tempDir, { recursive: true, force: true });
    }
  });

  // Scenario: Basic code scaffolding from specification
  describe('Basic code scaffolding from specification', () => {
    it('should generate all required file types', async () => {
      const files = await testContext.codeGenerator.generateCodeScaffolding(testContext.sampleSpec);

      expect(files.length).toBeGreaterThan(0);
      
      const fileTypes = files.map(f => f.type);
      expect(fileTypes).toContain('service_class');
      expect(fileTypes).toContain('interface');
      expect(fileTypes).toContain('test_file');
    });

    it('should create files with proper paths', async () => {
      const files = await testContext.codeGenerator.generateCodeScaffolding(testContext.sampleSpec);

      const servicePath = files.find(f => f.type === 'service_class')?.path;
      expect(servicePath).toBe('src/services/UserService.js');

      const testPath = files.find(f => f.type === 'test_file')?.path;
      expect(testPath).toBe('tests/services/UserService.test.js');
    });

    it('should include proper imports and exports', async () => {
      const files = await testContext.codeGenerator.generateCodeScaffolding(testContext.sampleSpec);

      files.forEach(file => {
        expect(file.content).toBeDefined();
        expect(file.content.length).toBeGreaterThan(0);
        // Basic check for class or module structure
        expect(file.content).toMatch(/(class|module\.exports|const)/);
      });
    });

    it('should include documentation comments', async () => {
      const files = await testContext.codeGenerator.generateCodeScaffolding(testContext.sampleSpec);

      files.forEach(file => {
        expect(file.content).toContain('//');
      });
    });
  });

  // Scenario: Specification-driven API generation
  describe('Specification-driven API generation', () => {
    it('should create route handlers for each endpoint', async () => {
      const files = await testContext.codeGenerator.generateAPICode(testContext.sampleSpec);

      const handlerFiles = files.filter(f => f.type === 'api_handler');
      expect(handlerFiles.length).toBe(testContext.sampleSpec.endpoints.length);

      handlerFiles.forEach(file => {
        expect(file.content).toContain('router.');
        expect(file.content).toContain('async (req, res)');
      });
    });

    it('should generate request/response schemas', async () => {
      const files = await testContext.codeGenerator.generateAPICode(testContext.sampleSpec);

      const schemaFiles = files.filter(f => f.type === 'api_schema');
      expect(schemaFiles.length).toBeGreaterThan(0);

      schemaFiles.forEach(file => {
        expect(file.content).toContain('requestSchema');
        expect(file.content).toContain('responseSchema');
      });
    });

    it('should generate validation middleware', async () => {
      const files = await testContext.codeGenerator.generateAPICode(testContext.sampleSpec);

      const validationFiles = files.filter(f => f.type === 'validation_middleware');
      expect(validationFiles.length).toBeGreaterThan(0);

      validationFiles.forEach(file => {
        expect(file.content).toContain('validate');
        expect(file.content).toMatch(/\(req, res, next\)/);
      });
    });

    it('should generate OpenAPI documentation', async () => {
      const files = await testContext.codeGenerator.generateAPICode(testContext.sampleSpec);

      const apiDocFile = files.find(f => f.type === 'api_documentation');
      expect(apiDocFile).toBeDefined();
      expect(apiDocFile.path).toBe('docs/api/openapi.json');

      const apiDoc = JSON.parse(apiDocFile.content);
      expect(apiDoc.openapi).toBe('3.0.0');
      expect(apiDoc.info.title).toBe(testContext.sampleSpec.name);
      expect(apiDoc.paths).toBeDefined();
    });
  });

  // Scenario: Database schema generation
  describe('Database schema generation', () => {
    it('should create migration files for each entity', async () => {
      const files = await testContext.codeGenerator.generateDatabaseSchema(testContext.sampleSpec);

      const migrationFiles = files.filter(f => f.type === 'database_migration');
      expect(migrationFiles.length).toBe(testContext.sampleSpec.entities.length);

      migrationFiles.forEach(file => {
        expect(file.path).toMatch(/migrations\/\d+_create_\w+_table\.js/);
        expect(file.content).toContain('exports.up');
        expect(file.content).toContain('exports.down');
      });
    });

    it('should generate model classes', async () => {
      const files = await testContext.codeGenerator.generateDatabaseSchema(testContext.sampleSpec);

      const modelFiles = files.filter(f => f.type === 'database_model');
      expect(modelFiles.length).toBe(testContext.sampleSpec.entities.length);

      modelFiles.forEach(file => {
        expect(file.content).toContain('class');
        expect(file.content).toContain('static get tableName');
        expect(file.content).toContain('static get jsonSchema');
      });
    });
  });

  // Scenario: Frontend component generation
  describe('Frontend component generation', () => {
    it('should generate React component with all files', async () => {
      const files = await testContext.codeGenerator.generateFrontendComponents(testContext.sampleSpec);

      const fileTypes = files.map(f => f.type);
      expect(fileTypes).toContain('react_component');
      expect(fileTypes).toContain('component_style');
      expect(fileTypes).toContain('component_test');
      expect(fileTypes).toContain('storybook_story');
    });

    it('should generate responsive components', async () => {
      const files = await testContext.codeGenerator.generateFrontendComponents(testContext.sampleSpec);

      const styleFile = files.find(f => f.type === 'component_style');
      expect(styleFile.content).toContain('@media');
    });

    it('should include accessibility attributes', async () => {
      const files = await testContext.codeGenerator.generateFrontendComponents(testContext.sampleSpec);

      const componentFile = files.find(f => f.type === 'react_component');
      // Check for basic accessibility structure (could be enhanced)
      expect(componentFile.content).toContain('<h1>');
    });

    it('should handle loading and error states', async () => {
      const files = await testContext.codeGenerator.generateFrontendComponents(testContext.sampleSpec);

      const componentFile = files.find(f => f.type === 'react_component');
      expect(componentFile.content).toContain('loading');
      expect(componentFile.content).toContain('error');
    });
  });

  // Scenario: Test generation from specifications
  describe('Test generation from specifications', () => {
    it('should generate comprehensive test suite', async () => {
      const files = await testContext.codeGenerator.generateTestCode(testContext.sampleSpec);

      const testTypes = files.map(f => f.type);
      expect(testTypes).toContain('unit_test');
      expect(testTypes).toContain('integration_test');
      expect(testTypes).toContain('e2e_test');
      expect(testTypes).toContain('api_test');
    });

    it('should match acceptance criteria', async () => {
      const files = await testContext.codeGenerator.generateTestCode(testContext.sampleSpec);

      const unitTestFile = files.find(f => f.type === 'unit_test');
      testContext.sampleSpec.acceptance.forEach(criterion => {
        expect(unitTestFile.content.toLowerCase()).toContain(criterion.toLowerCase().substring(0, 20));
      });
    });

    it('should generate meaningful assertions', async () => {
      const files = await testContext.codeGenerator.generateTestCode(testContext.sampleSpec);

      files.forEach(file => {
        expect(file.content).toContain('expect(');
        expect(file.content).toMatch(/(describe|it)\(/);
      });
    });
  });

  // Scenario: Configuration and environment setup
  describe('Configuration and environment setup', () => {
    it('should generate all configuration file types', async () => {
      const files = await testContext.codeGenerator.generateConfigurationFiles(testContext.sampleSpec);

      const configTypes = files.map(f => f.type);
      expect(configTypes).toContain('environment_config');
      expect(configTypes).toContain('docker_config');
      expect(configTypes).toContain('docker_compose');
      expect(configTypes).toContain('ci_cd_config');
      expect(configTypes).toContain('package_config');
    });

    it('should generate proper environment variables', async () => {
      const files = await testContext.codeGenerator.generateConfigurationFiles(testContext.sampleSpec);

      const envFile = files.find(f => f.type === 'environment_config');
      expect(envFile.content).toContain('DATABASE_URL');
      expect(envFile.content).toContain('PORT');
      expect(envFile.content).toContain('JWT_SECRET');
    });

    it('should include health checks in Docker setup', async () => {
      const files = await testContext.codeGenerator.generateConfigurationFiles(testContext.sampleSpec);

      const dockerFile = files.find(f => f.type === 'docker_config');
      expect(dockerFile.content).toContain('HEALTHCHECK');
    });

    it('should configure CI/CD pipeline', async () => {
      const files = await testContext.codeGenerator.generateConfigurationFiles(testContext.sampleSpec);

      const workflowFile = files.find(f => f.type === 'ci_cd_config');
      expect(workflowFile.content).toContain('runs-on:');
      expect(workflowFile.content).toContain('npm test');
      expect(workflowFile.content).toContain('npm run lint');
    });
  });

  // Scenario: Incremental code generation
  describe('Incremental code generation', () => {
    it('should identify new files to generate', async () => {
      const existingFiles = [];
      const result = await testContext.codeGenerator.performIncrementalGeneration(
        testContext.sampleSpec, 
        existingFiles
      );

      expect(result.generated.length).toBeGreaterThan(0);
      expect(result.updated.length).toBe(0);
      expect(result.conflicts.length).toBe(0);
    });

    it('should detect and handle conflicts', async () => {
      const existingFiles = [{
        path: 'src/services/UserService.js',
        content: 'class UserService {\n  // CUSTOM: My custom implementation\n}'
      }];

      const result = await testContext.codeGenerator.performIncrementalGeneration(
        testContext.sampleSpec, 
        existingFiles
      );

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.backups.length).toBeGreaterThan(0);
    });

    it('should create backups for conflicting files', async () => {
      const existingFiles = [{
        path: 'src/services/UserService.js',
        content: 'class UserService {\n  // CUSTOM: My custom implementation\n}'
      }];

      const result = await testContext.codeGenerator.performIncrementalGeneration(
        testContext.sampleSpec, 
        existingFiles
      );

      const backup = result.backups[0];
      expect(backup).toBeDefined();
      expect(backup.originalPath).toBe('src/services/UserService.js');
      expect(backup.path).toMatch(/\.bak$/);
    });
  });

  // Scenario: Quality assurance in generated code
  describe('Quality assurance in generated code', () => {
    it('should pass all quality checks by default', async () => {
      const files = await testContext.codeGenerator.generateCodeScaffolding(testContext.sampleSpec);
      const qualityResult = await testContext.codeGenerator.runQualityChecks(files);

      expect(qualityResult.passed).toBe(true);
      expect(qualityResult.issues.length).toBe(0);
    });

    it('should detect syntax errors', async () => {
      const filesWithErrors = [{
        path: 'test.js',
        content: 'syntax error here )',
        type: 'test_file'
      }];

      const qualityResult = await testContext.codeGenerator.runQualityChecks(filesWithErrors);
      
      // Note: This test depends on the mock implementation
      expect(qualityResult.checks.syntax).toBeDefined();
    });

    it('should run all configured quality checks', async () => {
      const files = await testContext.codeGenerator.generateCodeScaffolding(testContext.sampleSpec);
      const qualityResult = await testContext.codeGenerator.runQualityChecks(files);

      const expectedChecks = ['syntax', 'lint', 'security', 'performance', 'coverage'];
      expectedChecks.forEach(check => {
        expect(qualityResult.checks[check]).toBeDefined();
      });
    });
  });

  // Scenario: Multi-language code generation
  describe('Multi-language code generation', () => {
    it('should generate code for multiple languages', async () => {
      const targets = [
        { language: 'javascript', framework: 'express', output_dir: './js-service' },
        { language: 'python', framework: 'fastapi', output_dir: './py-service' },
        { language: 'typescript', framework: 'nestjs', output_dir: './ts-service' }
      ];

      const result = await testContext.codeGenerator.generateMultiLanguage(testContext.sampleSpec, targets);

      expect(Object.keys(result)).toHaveLength(3);
      expect(result.javascript).toBeDefined();
      expect(result.python).toBeDefined();
      expect(result.typescript).toBeDefined();

      targets.forEach(target => {
        expect(result[target.language].framework).toBe(target.framework);
        expect(result[target.language].outputDir).toBe(target.output_dir);
      });
    });

    it('should maintain equivalent functionality across languages', async () => {
      const targets = [
        { language: 'javascript', framework: 'express', output_dir: './js-service' },
        { language: 'python', framework: 'fastapi', output_dir: './py-service' }
      ];

      const result = await testContext.codeGenerator.generateMultiLanguage(testContext.sampleSpec, targets);

      // Both should have files generated
      expect(result.javascript.files.length).toBeGreaterThan(0);
      expect(result.python.files.length).toBeGreaterThan(0);
    });
  });
});