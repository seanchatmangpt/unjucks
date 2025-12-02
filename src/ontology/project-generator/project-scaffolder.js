/**
 * @fileoverview Project Scaffolding Generator
 * Generates complete project structures from parsed ontologies
 *
 * Features:
 * - Full directory structure generation
 * - TypeScript models, services, and API routes
 * - Database schemas and migrations
 * - BDD test scenarios
 * - Project configuration files
 * - Cross-file dependency management
 * - Dry-run mode support
 * - Name conflict resolution
 */

import path from 'node:path';
import fs from 'fs-extra';
import nunjucks from 'nunjucks';
import { consola } from 'consola';
import yaml from 'yaml';

/**
 * @typedef {Object} ProjectSchema
 * @property {string} name - Project name
 * @property {string} namespace - Project namespace/prefix
 * @property {Array<ClassDefinition>} classes - Class definitions
 * @property {Array<Relationship>} relationships - Class relationships
 * @property {Object} metadata - Additional metadata
 */

/**
 * @typedef {Object} ClassDefinition
 * @property {string} name - Class name
 * @property {string} uri - RDF URI
 * @property {Array<Property>} properties - Class properties
 * @property {string} [description] - Class description
 * @property {Array<string>} [tags] - Classification tags
 */

/**
 * @typedef {Object} Property
 * @property {string} name - Property name
 * @property {string} type - Data type
 * @property {boolean} required - Is required
 * @property {boolean} multiple - Is array/collection
 * @property {string} [description] - Property description
 * @property {*} [defaultValue] - Default value
 */

/**
 * @typedef {Object} Relationship
 * @property {string} source - Source class name
 * @property {string} target - Target class name
 * @property {string} type - Relationship type (hasMany, belongsTo, etc.)
 * @property {string} [name] - Relationship name
 */

/**
 * @typedef {Object} GenerationResult
 * @property {string} projectPath - Generated project path
 * @property {Array<FileRecord>} filesCreated - Files created
 * @property {Object} summary - Generation summary
 * @property {Object} validation - Validation results
 */

/**
 * @typedef {Object} FileRecord
 * @property {string} path - File path (relative to project)
 * @property {string} type - File type (model, service, api, etc.)
 * @property {number} size - File size in bytes
 */

/**
 * Project scaffolding generator
 */
export class ProjectScaffolder {
  /**
   * @param {ProjectSchema} projectSchema - Parsed project schema
   * @param {Object} options - Generation options
   * @param {string} [options.templatesDir] - Templates directory path
   * @param {boolean} [options.dryRun] - Dry run mode (no file writes)
   * @param {boolean} [options.overwrite] - Overwrite existing files
   * @param {string} [options.typescript] - Use TypeScript (default: true)
   * @param {string} [options.framework] - Framework (express, fastify, koa)
   * @param {string} [options.database] - Database type (postgres, mysql, sqlite)
   * @param {string} [options.orm] - ORM (prisma, typeorm, sequelize)
   * @param {boolean} [options.generateTests] - Generate BDD tests
   */
  constructor(projectSchema, options = {}) {
    this.schema = projectSchema;
    this.options = {
      templatesDir: options.templatesDir || path.join(process.cwd(), '_templates'),
      dryRun: options.dryRun || false,
      overwrite: options.overwrite || false,
      typescript: options.typescript !== false,
      framework: options.framework || 'express',
      database: options.database || 'postgres',
      orm: options.orm || 'prisma',
      generateTests: options.generateTests !== false,
      ...options
    };

    this.filesCreated = [];
    this.errors = [];
    this.warnings = [];

    // Initialize Nunjucks environment
    this.nunjucksEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(this.options.templatesDir, {
        noCache: true,
        watch: false
      }),
      {
        autoescape: false,
        trimBlocks: true,
        lstripBlocks: true
      }
    );

    // Add custom filters
    this._setupFilters();
  }

  /**
   * Setup custom Nunjucks filters
   * @private
   */
  _setupFilters() {
    // PascalCase
    this.nunjucksEnv.addFilter('pascalCase', (str) => {
      return str.replace(/(?:^|\s|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_\s]/g, '');
    });

    // camelCase
    this.nunjucksEnv.addFilter('camelCase', (str) => {
      const pascal = str.replace(/(?:^|\s|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_\s]/g, '');
      return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    });

    // kebab-case
    this.nunjucksEnv.addFilter('kebabCase', (str) => {
      return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[\s_]/g, '-');
    });

    // snake_case
    this.nunjucksEnv.addFilter('snakeCase', (str) => {
      return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[\s-]/g, '_');
    });

    // Pluralize (simple)
    this.nunjucksEnv.addFilter('plural', (str) => {
      if (str.endsWith('s')) return str + 'es';
      if (str.endsWith('y')) return str.slice(0, -1) + 'ies';
      return str + 's';
    });

    // Type mapping
    this.nunjucksEnv.addFilter('tsType', (type) => {
      const typeMap = {
        'string': 'string',
        'integer': 'number',
        'float': 'number',
        'double': 'number',
        'boolean': 'boolean',
        'date': 'Date',
        'datetime': 'Date',
        'object': 'Record<string, unknown>',
        'array': 'unknown[]'
      };
      return typeMap[type.toLowerCase()] || 'unknown';
    });

    // SQL type mapping
    this.nunjucksEnv.addFilter('sqlType', (type) => {
      const typeMap = {
        'string': 'VARCHAR(255)',
        'text': 'TEXT',
        'integer': 'INTEGER',
        'bigint': 'BIGINT',
        'float': 'FLOAT',
        'double': 'DOUBLE PRECISION',
        'decimal': 'DECIMAL(10,2)',
        'boolean': 'BOOLEAN',
        'date': 'DATE',
        'datetime': 'TIMESTAMP',
        'timestamp': 'TIMESTAMP',
        'uuid': 'UUID',
        'json': 'JSONB'
      };
      return typeMap[type.toLowerCase()] || 'TEXT';
    });
  }

  /**
   * Generate complete project structure
   * @param {string} outputDir - Output directory
   * @returns {Promise<GenerationResult>}
   */
  async generateProject(outputDir) {
    consola.start(`Generating project: ${this.schema.name}`);

    const projectPath = path.join(outputDir, this.schema.name);

    try {
      // Create directory structure
      await this._createDirectoryStructure(projectPath);

      // Generate files for each class
      for (const classDefinition of this.schema.classes) {
        await this._generateClassFiles(projectPath, classDefinition);
      }

      // Generate project configuration files
      await this._generateProjectConfig(projectPath);

      // Generate root documentation
      await this._generateDocumentation(projectPath);

      // Validation
      const validation = this._validateGeneration();

      // Summary
      const summary = this._generateSummary();

      consola.success(`Project generated: ${projectPath}`);
      consola.info(`Files created: ${this.filesCreated.length}`);

      if (this.warnings.length > 0) {
        consola.warn(`Warnings: ${this.warnings.length}`);
      }

      return {
        projectPath,
        filesCreated: this.filesCreated,
        summary,
        validation
      };

    } catch (error) {
      consola.error('Project generation failed:', error);
      throw error;
    }
  }

  /**
   * Create directory structure
   * @private
   */
  async _createDirectoryStructure(projectPath) {
    const dirs = [
      'src',
      'src/models',
      'src/services',
      'src/api',
      'src/api/routes',
      'src/api/controllers',
      'src/api/middleware',
      'src/db',
      'src/db/schemas',
      'src/db/migrations',
      'src/validation',
      'src/types',
      'src/utils',
      'src/config',
      'tests',
      'tests/unit',
      'tests/integration',
      'tests/bdd',
      'tests/fixtures',
      'docs',
      'docs/api',
      'scripts'
    ];

    for (const dir of dirs) {
      const fullPath = path.join(projectPath, dir);
      if (!this.options.dryRun) {
        await fs.ensureDir(fullPath);
      }
      consola.debug(`Created directory: ${dir}`);
    }
  }

  /**
   * Generate files for a class definition
   * @private
   */
  async _generateClassFiles(projectPath, classDefinition) {
    const className = classDefinition.name;
    consola.info(`Generating files for class: ${className}`);

    // Enrich class definition with relationships
    const enrichedClass = this._enrichClassDefinition(classDefinition);

    // 1. TypeScript model/interface
    await this._generateModel(projectPath, enrichedClass);

    // 2. Service (CRUD operations)
    await this._generateService(projectPath, enrichedClass);

    // 3. API routes
    await this._generateApiRoutes(projectPath, enrichedClass);

    // 4. API controller
    await this._generateApiController(projectPath, enrichedClass);

    // 5. Database schema
    await this._generateDatabaseSchema(projectPath, enrichedClass);

    // 6. Validation schema
    await this._generateValidationSchema(projectPath, enrichedClass);

    // 7. BDD test scenarios
    if (this.options.generateTests) {
      await this._generateBDDTests(projectPath, enrichedClass);
    }

    // 8. API documentation
    await this._generateApiDocs(projectPath, enrichedClass);
  }

  /**
   * Enrich class definition with relationships
   * @private
   */
  _enrichClassDefinition(classDefinition) {
    const relationships = this.schema.relationships.filter(
      rel => rel.source === classDefinition.name || rel.target === classDefinition.name
    );

    return {
      ...classDefinition,
      relationships: {
        hasMany: relationships.filter(r => r.source === classDefinition.name && r.type === 'hasMany'),
        belongsTo: relationships.filter(r => r.source === classDefinition.name && r.type === 'belongsTo'),
        manyToMany: relationships.filter(r =>
          (r.source === classDefinition.name || r.target === classDefinition.name) &&
          r.type === 'manyToMany'
        )
      }
    };
  }

  /**
   * Generate TypeScript model/interface
   * @private
   */
  async _generateModel(projectPath, classDefinition) {
    const fileName = `${classDefinition.name}.ts`;
    const filePath = path.join(projectPath, 'src/models', fileName);

    const template = `
/**
 * ${classDefinition.description || classDefinition.name + ' model'}
 * Generated from: ${classDefinition.uri}
 */

{% for rel in relationships.belongsTo %}
import type { {{ rel.target }} } from './{{ rel.target }}';
{% endfor %}
{% for rel in relationships.hasMany %}
import type { {{ rel.target }} } from './{{ rel.target }}';
{% endfor %}

export interface {{ name }} {
  id: string;
{% for prop in properties %}
  {{ prop.name }}{{ '?' if not prop.required }}: {{ prop.type | tsType }}{{ '[]' if prop.multiple }};
{% endfor %}

  // Relationships
{% for rel in relationships.belongsTo %}
  {{ rel.name || (rel.target | camelCase) }}Id: string;
  {{ rel.name || (rel.target | camelCase) }}?: {{ rel.target }};
{% endfor %}
{% for rel in relationships.hasMany %}
  {{ rel.name || (rel.target | camelCase | plural) }}?: {{ rel.target }}[];
{% endfor %}

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface Create{{ name }}Input {
{% for prop in properties %}
  {% if prop.required %}{{ prop.name }}: {{ prop.type | tsType }}{{ '[]' if prop.multiple }};
{% else %}{{ prop.name }}?: {{ prop.type | tsType }}{{ '[]' if prop.multiple }};
{% endif %}
{% endfor %}
{% for rel in relationships.belongsTo %}
  {{ rel.name || (rel.target | camelCase) }}Id{% if not rel.required %}?{% endif %}: string;
{% endfor %}
}

export interface Update{{ name }}Input {
{% for prop in properties %}
  {{ prop.name }}?: {{ prop.type | tsType }}{{ '[]' if prop.multiple }};
{% endfor %}
{% for rel in relationships.belongsTo %}
  {{ rel.name || (rel.target | camelCase) }}Id?: string;
{% endfor %}
}
`.trim();

    const content = this.nunjucksEnv.renderString(template, classDefinition);
    await this._writeFile(filePath, content, 'model');
  }

  /**
   * Generate CRUD service
   * @private
   */
  async _generateService(projectPath, classDefinition) {
    const fileName = `${classDefinition.name}Service.ts`;
    const filePath = path.join(projectPath, 'src/services', fileName);

    const template = `
/**
 * ${classDefinition.name} Service
 * CRUD operations for ${classDefinition.name}
 */

import type { {{ name }}, Create{{ name }}Input, Update{{ name }}Input } from '../models/{{ name }}';
import { db } from '../db';
import { consola } from 'consola';

export class {{ name }}Service {
  /**
   * Find all {{ name | plural | lower }}
   */
  async findAll(options?: { limit?: number; offset?: number }): Promise<{{ name }}[]> {
    consola.debug('Finding all {{ name | plural | lower }}');
    // TODO: Implement database query
    return db.{{ name | camelCase }}.findMany({
      take: options?.limit,
      skip: options?.offset,
    });
  }

  /**
   * Find {{ name }} by ID
   */
  async findById(id: string): Promise<{{ name }} | null> {
    consola.debug(\`Finding {{ name }} by id: \${id}\`);
    return db.{{ name | camelCase }}.findUnique({
      where: { id }
    });
  }

  /**
   * Create new {{ name }}
   */
  async create(input: Create{{ name }}Input): Promise<{{ name }}> {
    consola.debug('Creating {{ name }}', input);
    return db.{{ name | camelCase }}.create({
      data: input
    });
  }

  /**
   * Update existing {{ name }}
   */
  async update(id: string, input: Update{{ name }}Input): Promise<{{ name }}> {
    consola.debug(\`Updating {{ name }} \${id}\`, input);
    return db.{{ name | camelCase }}.update({
      where: { id },
      data: input
    });
  }

  /**
   * Delete {{ name }}
   */
  async delete(id: string): Promise<void> {
    consola.debug(\`Deleting {{ name }} \${id}\`);
    await db.{{ name | camelCase }}.delete({
      where: { id }
    });
  }

  /**
   * Count {{ name | plural | lower }}
   */
  async count(): Promise<number> {
    return db.{{ name | camelCase }}.count();
  }
}

export const {{ name | camelCase }}Service = new {{ name }}Service();
`.trim();

    const content = this.nunjucksEnv.renderString(template, classDefinition);
    await this._writeFile(filePath, content, 'service');
  }

  /**
   * Generate API routes
   * @private
   */
  async _generateApiRoutes(projectPath, classDefinition) {
    const fileName = `${classDefinition.name.toLowerCase()}.ts`;
    const filePath = path.join(projectPath, 'src/api/routes', fileName);

    const template = `
/**
 * ${classDefinition.name} API Routes
 */

import { Router } from 'express';
import { {{ name }}Controller } from '../controllers/{{ name }}Controller';
import { validate } from '../middleware/validation';
import { {{ name | camelCase }}Schema } from '../../validation/{{ name }}Schema';

const router = Router();
const controller = new {{ name }}Controller();

// GET /{{ name | kebabCase | plural }} - List all
router.get('/', controller.findAll.bind(controller));

// GET /{{ name | kebabCase | plural }}/:id - Get by ID
router.get('/:id', controller.findById.bind(controller));

// POST /{{ name | kebabCase | plural }} - Create new
router.post(
  '/',
  validate({{ name | camelCase }}Schema.create),
  controller.create.bind(controller)
);

// PUT /{{ name | kebabCase | plural }}/:id - Update
router.put(
  '/:id',
  validate({{ name | camelCase }}Schema.update),
  controller.update.bind(controller)
);

// DELETE /{{ name | kebabCase | plural }}/:id - Delete
router.delete('/:id', controller.delete.bind(controller));

export default router;
`.trim();

    const content = this.nunjucksEnv.renderString(template, classDefinition);
    await this._writeFile(filePath, content, 'api-routes');
  }

  /**
   * Generate API controller
   * @private
   */
  async _generateApiController(projectPath, classDefinition) {
    const fileName = `${classDefinition.name}Controller.ts`;
    const filePath = path.join(projectPath, 'src/api/controllers', fileName);

    const template = `
/**
 * ${classDefinition.name} Controller
 * HTTP request handlers
 */

import type { Request, Response, NextFunction } from 'express';
import { {{ name | camelCase }}Service } from '../../services/{{ name }}Service';
import { consola } from 'consola';

export class {{ name }}Controller {
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      const items = await {{ name | camelCase }}Service.findAll({ limit, offset });
      const total = await {{ name | camelCase }}Service.count();

      res.json({
        data: items,
        meta: { total, limit, offset }
      });
    } catch (error) {
      consola.error('Error finding {{ name | plural | lower }}:', error);
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const item = await {{ name | camelCase }}Service.findById(id);

      if (!item) {
        res.status(404).json({ error: '{{ name }} not found' });
        return;
      }

      res.json({ data: item });
    } catch (error) {
      consola.error('Error finding {{ name }}:', error);
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await {{ name | camelCase }}Service.create(req.body);
      res.status(201).json({ data: item });
    } catch (error) {
      consola.error('Error creating {{ name }}:', error);
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const item = await {{ name | camelCase }}Service.update(id, req.body);
      res.json({ data: item });
    } catch (error) {
      consola.error('Error updating {{ name }}:', error);
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await {{ name | camelCase }}Service.delete(id);
      res.status(204).send();
    } catch (error) {
      consola.error('Error deleting {{ name }}:', error);
      next(error);
    }
  }
}
`.trim();

    const content = this.nunjucksEnv.renderString(template, classDefinition);
    await this._writeFile(filePath, content, 'api-controller');
  }

  /**
   * Generate database schema
   * @private
   */
  async _generateDatabaseSchema(projectPath, classDefinition) {
    const fileName = `${classDefinition.name.toLowerCase()}.sql`;
    const filePath = path.join(projectPath, 'src/db/schemas', fileName);

    const template = `
-- {{ name }} Table Schema
-- Generated from: {{ uri }}

CREATE TABLE IF NOT EXISTS {{ name | snakeCase | plural }} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
{% for prop in properties %}
  {{ prop.name | snakeCase }} {{ prop.type | sqlType }}{{ ' NOT NULL' if prop.required }}{{ '[]' if prop.multiple }},
{% endfor %}

  -- Foreign Keys
{% for rel in relationships.belongsTo %}
  {{ rel.name | snakeCase || (rel.target | snakeCase) }}_id UUID{{ ' NOT NULL' if rel.required }} REFERENCES {{ rel.target | snakeCase | plural }}(id) ON DELETE {% if rel.required %}CASCADE{% else %}SET NULL{% endif %},
{% endfor %}

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_{{ name | snakeCase }}_created_at ON {{ name | snakeCase | plural }}(created_at);
{% for rel in relationships.belongsTo %}
CREATE INDEX IF NOT EXISTS idx_{{ name | snakeCase }}_{{ rel.target | snakeCase }}_id ON {{ name | snakeCase | plural }}({{ rel.name | snakeCase || (rel.target | snakeCase) }}_id);
{% endfor %}

-- Comments
COMMENT ON TABLE {{ name | snakeCase | plural }} IS '{{ description || name }}';
{% for prop in properties %}
COMMENT ON COLUMN {{ name | snakeCase | plural }}.{{ prop.name | snakeCase }} IS '{{ prop.description || prop.name }}';
{% endfor %}
`.trim();

    const content = this.nunjucksEnv.renderString(template, classDefinition);
    await this._writeFile(filePath, content, 'db-schema');
  }

  /**
   * Generate validation schema
   * @private
   */
  async _generateValidationSchema(projectPath, classDefinition) {
    const fileName = `${classDefinition.name}Schema.ts`;
    const filePath = path.join(projectPath, 'src/validation', fileName);

    const template = `
/**
 * ${classDefinition.name} Validation Schema
 * Using Zod for runtime validation
 */

import { z } from 'zod';

export const {{ name | camelCase }}Schema = {
  create: z.object({
{% for prop in properties %}
{% if prop.required %}    {{ prop.name }}: z.{{ prop.type | tsType | lower }}(){{ '.array()' if prop.multiple }},
{% else %}    {{ prop.name }}: z.{{ prop.type | tsType | lower }}(){{ '.array()' if prop.multiple }}.optional(),
{% endif %}
{% endfor %}
{% for rel in relationships.belongsTo %}
{% if rel.required %}    {{ rel.name || (rel.target | camelCase) }}Id: z.string().uuid(),
{% else %}    {{ rel.name || (rel.target | camelCase) }}Id: z.string().uuid().optional(),
{% endif %}
{% endfor %}
  }),

  update: z.object({
{% for prop in properties %}
    {{ prop.name }}: z.{{ prop.type | tsType | lower }}(){{ '.array()' if prop.multiple }}.optional(),
{% endfor %}
{% for rel in relationships.belongsTo %}
    {{ rel.name || (rel.target | camelCase) }}Id: z.string().uuid().optional(),
{% endfor %}
  }),

  query: z.object({
    limit: z.coerce.number().min(1).max(1000).optional(),
    offset: z.coerce.number().min(0).optional(),
  })
};
`.trim();

    const content = this.nunjucksEnv.renderString(template, classDefinition);
    await this._writeFile(filePath, content, 'validation');
  }

  /**
   * Generate BDD test scenarios
   * @private
   */
  async _generateBDDTests(projectPath, classDefinition) {
    const fileName = `${classDefinition.name.toLowerCase()}.feature`;
    const filePath = path.join(projectPath, 'tests/bdd', fileName);

    const template = `
Feature: {{ name }} Management
  As a user
  I want to manage {{ name | plural | lower }}
  So that I can perform CRUD operations

  Background:
    Given the API server is running
    And the database is initialized

  Scenario: List all {{ name | plural | lower }}
    When I send a GET request to "/api/{{ name | kebabCase | plural }}"
    Then the response status should be 200
    And the response should contain a list of {{ name | plural | lower }}

  Scenario: Get {{ name }} by ID
    Given a {{ name }} exists with id "123"
    When I send a GET request to "/api/{{ name | kebabCase | plural }}/123"
    Then the response status should be 200
    And the response should contain the {{ name }} details

  Scenario: Create new {{ name }}
    When I send a POST request to "/api/{{ name | kebabCase | plural }}" with:
      """
      {
{% for prop in properties %}
{% if prop.required %}        "{{ prop.name }}": {{ '"test-value"' if prop.type == 'string' else '123' }}{{ '' if not loop.last else '' }}
{% endif %}
{% endfor %}
      }
      """
    Then the response status should be 201
    And the response should contain the created {{ name }}

  Scenario: Update existing {{ name }}
    Given a {{ name }} exists with id "123"
    When I send a PUT request to "/api/{{ name | kebabCase | plural }}/123" with:
      """
      {
{% for prop in properties | slice(0, 1) %}
        "{{ prop.name }}": "updated-value"
{% endfor %}
      }
      """
    Then the response status should be 200
    And the response should contain the updated {{ name }}

  Scenario: Delete {{ name }}
    Given a {{ name }} exists with id "123"
    When I send a DELETE request to "/api/{{ name | kebabCase | plural }}/123"
    Then the response status should be 204

  Scenario: Handle not found error
    When I send a GET request to "/api/{{ name | kebabCase | plural }}/nonexistent"
    Then the response status should be 404
    And the response should contain an error message
`.trim();

    const content = this.nunjucksEnv.renderString(template, classDefinition);
    await this._writeFile(filePath, content, 'bdd-test');
  }

  /**
   * Generate API documentation
   * @private
   */
  async _generateApiDocs(projectPath, classDefinition) {
    const fileName = `${classDefinition.name}.md`;
    const filePath = path.join(projectPath, 'docs/api', fileName);

    const template = `
# {{ name }} API

{{ description || 'API endpoints for managing ' + name + ' resources.' }}

## Endpoints

### List {{ name | plural }}

\`\`\`http
GET /api/{{ name | kebabCase | plural }}
\`\`\`

**Query Parameters:**
- \`limit\` (number, optional): Maximum items to return (default: 100)
- \`offset\` (number, optional): Pagination offset (default: 0)

**Response:**
\`\`\`json
{
  "data": [{ ... }],
  "meta": {
    "total": 100,
    "limit": 100,
    "offset": 0
  }
}
\`\`\`

### Get {{ name }} by ID

\`\`\`http
GET /api/{{ name | kebabCase | plural }}/:id
\`\`\`

**Response:**
\`\`\`json
{
  "data": {
    "id": "uuid",
{% for prop in properties | slice(0, 3) %}
    "{{ prop.name }}": {{ '"value"' if prop.type == 'string' else 'null' }}{{ ',' if not loop.last }}
{% endfor %}
  }
}
\`\`\`

### Create {{ name }}

\`\`\`http
POST /api/{{ name | kebabCase | plural }}
Content-Type: application/json
\`\`\`

**Request Body:**
\`\`\`json
{
{% for prop in properties %}
{% if prop.required %}  "{{ prop.name }}": {{ '"value"' if prop.type == 'string' else 'null' }}{{ ',' if not loop.last }}
{% endif %}
{% endfor %}
}
\`\`\`

### Update {{ name }}

\`\`\`http
PUT /api/{{ name | kebabCase | plural }}/:id
Content-Type: application/json
\`\`\`

### Delete {{ name }}

\`\`\`http
DELETE /api/{{ name | kebabCase | plural }}/:id
\`\`\`

## Model

\`\`\`typescript
interface {{ name }} {
  id: string;
{% for prop in properties %}
  {{ prop.name }}{{ '?' if not prop.required }}: {{ prop.type | tsType }};
{% endfor %}
  createdAt: Date;
  updatedAt: Date;
}
\`\`\`
`.trim();

    const content = this.nunjucksEnv.renderString(template, classDefinition);
    await this._writeFile(filePath, content, 'api-docs');
  }

  /**
   * Generate project configuration files
   * @private
   */
  async _generateProjectConfig(projectPath) {
    // package.json
    await this._generatePackageJson(projectPath);

    // tsconfig.json
    await this._generateTsConfig(projectPath);

    // .env.example
    await this._generateEnvExample(projectPath);

    // Database config
    await this._generateDatabaseConfig(projectPath);

    // Main server file
    await this._generateServerFile(projectPath);
  }

  /**
   * Generate package.json
   * @private
   */
  async _generatePackageJson(projectPath) {
    const packageJson = {
      name: this.schema.name.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: this.schema.metadata?.description || `Generated project: ${this.schema.name}`,
      type: 'module',
      main: 'dist/index.js',
      scripts: {
        dev: 'tsx watch src/index.ts',
        build: 'tsc',
        start: 'node dist/index.js',
        test: 'vitest',
        'test:bdd': 'cucumber-js',
        lint: 'eslint src/**/*.ts',
        format: 'prettier --write "src/**/*.ts"'
      },
      dependencies: {
        'express': '^4.18.0',
        'consola': '^3.2.0',
        'zod': '^3.22.0',
        '@prisma/client': '^5.0.0'
      },
      devDependencies: {
        '@types/express': '^4.17.0',
        '@types/node': '^20.0.0',
        'typescript': '^5.0.0',
        'tsx': '^4.0.0',
        'vitest': '^1.0.0',
        '@cucumber/cucumber': '^10.0.0',
        'eslint': '^8.0.0',
        'prettier': '^3.0.0'
      }
    };

    const content = JSON.stringify(packageJson, null, 2);
    await this._writeFile(path.join(projectPath, 'package.json'), content, 'config');
  }

  /**
   * Generate tsconfig.json
   * @private
   */
  async _generateTsConfig(projectPath) {
    const tsConfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        lib: ['ES2022'],
        moduleResolution: 'bundler',
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        paths: {
          '@/*': ['./src/*']
        }
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', 'tests']
    };

    const content = JSON.stringify(tsConfig, null, 2);
    await this._writeFile(path.join(projectPath, 'tsconfig.json'), content, 'config');
  }

  /**
   * Generate .env.example
   * @private
   */
  async _generateEnvExample(projectPath) {
    const content = `
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/${this.schema.name.toLowerCase()}

# Server
PORT=3000
NODE_ENV=development

# API
API_PREFIX=/api
`.trim();

    await this._writeFile(path.join(projectPath, '.env.example'), content, 'config');
  }

  /**
   * Generate database configuration
   * @private
   */
  async _generateDatabaseConfig(projectPath) {
    const content = `
/**
 * Database Configuration
 */

import { PrismaClient } from '@prisma/client';

export const db = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

export async function connectDatabase(): Promise<void> {
  await db.$connect();
  console.log('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  await db.$disconnect();
  console.log('Database disconnected');
}
`.trim();

    await this._writeFile(path.join(projectPath, 'src/db/index.ts'), content, 'config');
  }

  /**
   * Generate main server file
   * @private
   */
  async _generateServerFile(projectPath) {
    const routeImports = this.schema.classes.map(c =>
      `import ${c.name.toLowerCase()}Routes from './api/routes/${c.name.toLowerCase()}';`
    ).join('\n');

    const routeRegistrations = this.schema.classes.map(c =>
      `app.use('/api/${c.name.toLowerCase().replace(/\s+/g, '-')}s', ${c.name.toLowerCase()}Routes);`
    ).join('\n  ');

    const content = `
/**
 * ${this.schema.name} Server
 * Generated API server
 */

import express from 'express';
import { consola } from 'consola';
import { connectDatabase } from './db';

${routeImports}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
${routeRegistrations}

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  consola.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      consola.success(\`Server running on port \${PORT}\`);
    });
  } catch (error) {
    consola.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
`.trim();

    await this._writeFile(path.join(projectPath, 'src/index.ts'), content, 'server');
  }

  /**
   * Generate root documentation
   * @private
   */
  async _generateDocumentation(projectPath) {
    const content = `
# ${this.schema.name}

${this.schema.metadata?.description || 'Generated project from ontology schema'}

## Project Structure

\`\`\`
${this.schema.name}/
├── src/
│   ├── models/          # TypeScript interfaces
│   ├── services/        # Business logic (CRUD)
│   ├── api/
│   │   ├── routes/      # API route definitions
│   │   └── controllers/ # HTTP request handlers
│   ├── db/
│   │   ├── schemas/     # Database schemas (SQL)
│   │   └── migrations/  # Database migrations
│   ├── validation/      # Zod validation schemas
│   └── index.ts         # Server entry point
├── tests/
│   ├── unit/
│   ├── integration/
│   └── bdd/             # BDD feature files
├── docs/
│   └── api/             # API documentation
└── package.json
\`\`\`

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npm run migrate

# Start development server
npm run dev
\`\`\`

## API Endpoints

${this.schema.classes.map(c => `- \`/api/${c.name.toLowerCase()}s\` - ${c.description || c.name + ' management'}`).join('\n')}

## Models

${this.schema.classes.map(c => `### ${c.name}\n${c.description || ''}\n`).join('\n')}

## Development

- **Dev Server**: \`npm run dev\`
- **Build**: \`npm run build\`
- **Test**: \`npm test\`
- **BDD Tests**: \`npm run test:bdd\`
- **Lint**: \`npm run lint\`

## Generated Files

- **${this.filesCreated.length}** total files generated
- **${this.schema.classes.length}** models
- **${this.schema.classes.length}** services
- **${this.schema.classes.length}** API routes

---

Generated with Unjucks Project Scaffolder
`.trim();

    await this._writeFile(path.join(projectPath, 'README.md'), content, 'docs');
  }

  /**
   * Write file to disk (respects dry-run mode)
   * @private
   */
  async _writeFile(filePath, content, type) {
    if (!this.options.dryRun) {
      // Check for existing file
      if (!this.options.overwrite && await fs.pathExists(filePath)) {
        this.warnings.push(`File exists (skipped): ${filePath}`);
        consola.warn(`File exists (skipped): ${filePath}`);
        return;
      }

      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, content, 'utf-8');
    }

    const relativePath = filePath.split(this.schema.name + '/')[1] || filePath;
    this.filesCreated.push({
      path: relativePath,
      type,
      size: Buffer.byteLength(content, 'utf-8')
    });

    consola.debug(`${this.options.dryRun ? '[DRY RUN] ' : ''}Created: ${relativePath}`);
  }

  /**
   * Validate generation results
   * @private
   */
  _validateGeneration() {
    const errors = [];
    const warnings = [...this.warnings];

    // Check for missing required files
    const requiredTypes = ['model', 'service', 'api-routes', 'config'];
    for (const type of requiredTypes) {
      if (!this.filesCreated.some(f => f.type === type)) {
        errors.push(`Missing required file type: ${type}`);
      }
    }

    // Check for orphaned relationships
    const classNames = this.schema.classes.map(c => c.name);
    for (const rel of this.schema.relationships) {
      if (!classNames.includes(rel.source)) {
        warnings.push(`Orphaned relationship source: ${rel.source}`);
      }
      if (!classNames.includes(rel.target)) {
        warnings.push(`Orphaned relationship target: ${rel.target}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Generate summary statistics
   * @private
   */
  _generateSummary() {
    const filesByType = this.filesCreated.reduce((acc, file) => {
      acc[file.type] = (acc[file.type] || 0) + 1;
      return acc;
    }, {});

    const totalSize = this.filesCreated.reduce((sum, file) => sum + file.size, 0);

    return {
      classes: this.schema.classes.length,
      routes: this.schema.classes.length,
      tests: this.filesCreated.filter(f => f.type === 'bdd-test').length,
      files: {
        total: this.filesCreated.length,
        byType: filesByType
      },
      size: {
        total: totalSize,
        formatted: this._formatBytes(totalSize)
      }
    };
  }

  /**
   * Format bytes to human-readable string
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}
