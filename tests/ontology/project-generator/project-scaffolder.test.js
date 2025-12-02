/**
 * @fileoverview BDD Tests for Project Scaffolder
 * Tests complete project generation from ontology schemas
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { ProjectScaffolder } from '../../../src/ontology/project-generator/project-scaffolder.js';

describe('ProjectScaffolder - BDD Tests', () => {
  let tempDir;
  let testSchema;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = path.join(process.cwd(), 'tests/output/project-generator-test');
    await fs.ensureDir(tempDir);

    // Create test schema
    testSchema = {
      name: 'TestProject',
      namespace: 'http://example.org/test#',
      classes: [
        {
          name: 'User',
          uri: 'http://example.org/test#User',
          description: 'User entity',
          properties: [
            { name: 'email', type: 'string', required: true, multiple: false },
            { name: 'name', type: 'string', required: true, multiple: false },
            { name: 'age', type: 'integer', required: false, multiple: false },
            { name: 'isActive', type: 'boolean', required: false, multiple: false }
          ]
        },
        {
          name: 'Post',
          uri: 'http://example.org/test#Post',
          description: 'Blog post entity',
          properties: [
            { name: 'title', type: 'string', required: true, multiple: false },
            { name: 'content', type: 'text', required: true, multiple: false },
            { name: 'published', type: 'boolean', required: false, multiple: false },
            { name: 'tags', type: 'string', required: false, multiple: true }
          ]
        }
      ],
      relationships: [
        {
          source: 'Post',
          target: 'User',
          type: 'belongsTo',
          name: 'author',
          required: true
        },
        {
          source: 'User',
          target: 'Post',
          type: 'hasMany',
          name: 'posts'
        }
      ],
      metadata: {
        description: 'Test project for BDD validation'
      }
    };
  });

  afterEach(async () => {
    // Cleanup
    await fs.remove(tempDir);
  });

  describe('Feature: Project Structure Generation', () => {
    it('Scenario: Generate complete directory structure', async () => {
      // Given a project schema
      const scaffolder = new ProjectScaffolder(testSchema);

      // When generating the project
      const result = await scaffolder.generateProject(tempDir);

      // Then all required directories should exist
      const projectPath = result.projectPath;
      const expectedDirs = [
        'src',
        'src/models',
        'src/services',
        'src/api/routes',
        'src/api/controllers',
        'src/db/schemas',
        'src/validation',
        'tests/bdd',
        'docs/api'
      ];

      for (const dir of expectedDirs) {
        const fullPath = path.join(projectPath, dir);
        expect(await fs.pathExists(fullPath)).toBe(true);
      }
    });

    it('Scenario: Generate files for all classes', async () => {
      // Given a project schema with 2 classes
      const scaffolder = new ProjectScaffolder(testSchema);

      // When generating the project
      const result = await scaffolder.generateProject(tempDir);

      // Then files should be created for each class
      expect(result.filesCreated.length).toBeGreaterThan(0);

      // User files
      expect(result.filesCreated.some(f => f.path.includes('User.ts'))).toBe(true);
      expect(result.filesCreated.some(f => f.path.includes('UserService.ts'))).toBe(true);
      expect(result.filesCreated.some(f => f.path.includes('user.ts'))).toBe(true); // routes

      // Post files
      expect(result.filesCreated.some(f => f.path.includes('Post.ts'))).toBe(true);
      expect(result.filesCreated.some(f => f.path.includes('PostService.ts'))).toBe(true);
    });

    it('Scenario: Generate project configuration files', async () => {
      // Given a project schema
      const scaffolder = new ProjectScaffolder(testSchema);

      // When generating the project
      const result = await scaffolder.generateProject(tempDir);

      // Then configuration files should exist
      const configFiles = ['package.json', 'tsconfig.json', '.env.example'];
      for (const file of configFiles) {
        const fullPath = path.join(result.projectPath, file);
        expect(await fs.pathExists(fullPath)).toBe(true);
      }
    });
  });

  describe('Feature: TypeScript Model Generation', () => {
    it('Scenario: Generate model with properties', async () => {
      // Given a class with properties
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the User model
      const modelPath = path.join(result.projectPath, 'src/models/User.ts');
      const content = await fs.readFile(modelPath, 'utf-8');

      // Then the model should contain all properties
      expect(content).toContain('interface User');
      expect(content).toContain('email: string');
      expect(content).toContain('name: string');
      expect(content).toContain('age?: number');
      expect(content).toContain('isActive?: boolean');
    });

    it('Scenario: Generate model with relationships', async () => {
      // Given classes with relationships
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the Post model
      const modelPath = path.join(result.projectPath, 'src/models/Post.ts');
      const content = await fs.readFile(modelPath, 'utf-8');

      // Then the model should contain relationship fields
      expect(content).toContain('authorId: string');
      expect(content).toContain('author?: User');
      expect(content).toContain('import type { User }');
    });

    it('Scenario: Generate Create and Update input types', async () => {
      // Given a class definition
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the model
      const modelPath = path.join(result.projectPath, 'src/models/User.ts');
      const content = await fs.readFile(modelPath, 'utf-8');

      // Then input types should be generated
      expect(content).toContain('interface CreateUserInput');
      expect(content).toContain('interface UpdateUserInput');
    });

    it('Scenario: Handle array/multiple properties', async () => {
      // Given a property with multiple: true
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the Post model
      const modelPath = path.join(result.projectPath, 'src/models/Post.ts');
      const content = await fs.readFile(modelPath, 'utf-8');

      // Then array type should be used
      expect(content).toContain('tags?: string[]');
    });
  });

  describe('Feature: Service Generation', () => {
    it('Scenario: Generate CRUD service', async () => {
      // Given a class definition
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the service
      const servicePath = path.join(result.projectPath, 'src/services/UserService.ts');
      const content = await fs.readFile(servicePath, 'utf-8');

      // Then all CRUD methods should exist
      expect(content).toContain('class UserService');
      expect(content).toContain('async findAll');
      expect(content).toContain('async findById');
      expect(content).toContain('async create');
      expect(content).toContain('async update');
      expect(content).toContain('async delete');
      expect(content).toContain('async count');
    });

    it('Scenario: Service imports correct types', async () => {
      // Given a class definition
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the service
      const servicePath = path.join(result.projectPath, 'src/services/PostService.ts');
      const content = await fs.readFile(servicePath, 'utf-8');

      // Then type imports should be present
      expect(content).toContain('import type { Post, CreatePostInput, UpdatePostInput }');
      expect(content).toContain("from '../models/Post'");
    });
  });

  describe('Feature: API Route Generation', () => {
    it('Scenario: Generate RESTful routes', async () => {
      // Given a class definition
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the routes
      const routesPath = path.join(result.projectPath, 'src/api/routes/user.ts');
      const content = await fs.readFile(routesPath, 'utf-8');

      // Then all REST routes should exist
      expect(content).toContain("router.get('/', controller.findAll");
      expect(content).toContain("router.get('/:id', controller.findById");
      expect(content).toContain("router.post('/', ");
      expect(content).toContain("router.put('/:id', ");
      expect(content).toContain("router.delete('/:id', ");
    });

    it('Scenario: Routes include validation middleware', async () => {
      // Given a class definition
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the routes
      const routesPath = path.join(result.projectPath, 'src/api/routes/post.ts');
      const content = await fs.readFile(routesPath, 'utf-8');

      // Then validation should be included
      expect(content).toContain('validate');
      expect(content).toContain('postSchema.create');
      expect(content).toContain('postSchema.update');
    });
  });

  describe('Feature: API Controller Generation', () => {
    it('Scenario: Generate controller with error handling', async () => {
      // Given a class definition
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the controller
      const controllerPath = path.join(result.projectPath, 'src/api/controllers/UserController.ts');
      const content = await fs.readFile(controllerPath, 'utf-8');

      // Then error handling should be present
      expect(content).toContain('try {');
      expect(content).toContain('catch (error)');
      expect(content).toContain('next(error)');
    });

    it('Scenario: Controller handles pagination', async () => {
      // Given a class definition
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the controller
      const controllerPath = path.join(result.projectPath, 'src/api/controllers/PostController.ts');
      const content = await fs.readFile(controllerPath, 'utf-8');

      // Then pagination should be implemented
      expect(content).toContain('limit');
      expect(content).toContain('offset');
      expect(content).toContain('meta: { total, limit, offset }');
    });
  });

  describe('Feature: Database Schema Generation', () => {
    it('Scenario: Generate SQL schema with columns', async () => {
      // Given a class with properties
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the schema
      const schemaPath = path.join(result.projectPath, 'src/db/schemas/user.sql');
      const content = await fs.readFile(schemaPath, 'utf-8');

      // Then SQL schema should be correct
      expect(content).toContain('CREATE TABLE IF NOT EXISTS users');
      expect(content).toContain('id UUID PRIMARY KEY');
      expect(content).toContain('email VARCHAR(255) NOT NULL');
      expect(content).toContain('name VARCHAR(255) NOT NULL');
      expect(content).toContain('age INTEGER');
      expect(content).toContain('is_active BOOLEAN');
    });

    it('Scenario: Generate foreign key constraints', async () => {
      // Given classes with relationships
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the Post schema
      const schemaPath = path.join(result.projectPath, 'src/db/schemas/post.sql');
      const content = await fs.readFile(schemaPath, 'utf-8');

      // Then foreign keys should be defined
      expect(content).toContain('author_id UUID NOT NULL REFERENCES users(id)');
      expect(content).toContain('ON DELETE CASCADE');
    });

    it('Scenario: Generate indexes for performance', async () => {
      // Given a class definition
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the schema
      const schemaPath = path.join(result.projectPath, 'src/db/schemas/user.sql');
      const content = await fs.readFile(schemaPath, 'utf-8');

      // Then indexes should be created
      expect(content).toContain('CREATE INDEX');
      expect(content).toContain('idx_user_created_at');
    });
  });

  describe('Feature: Validation Schema Generation', () => {
    it('Scenario: Generate Zod validation schema', async () => {
      // Given a class definition
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the validation schema
      const validationPath = path.join(result.projectPath, 'src/validation/UserSchema.ts');
      const content = await fs.readFile(validationPath, 'utf-8');

      // Then Zod schema should be defined
      expect(content).toContain("import { z } from 'zod'");
      expect(content).toContain('userSchema');
      expect(content).toContain('z.object');
    });

    it('Scenario: Validation schema handles required fields', async () => {
      // Given properties with required flags
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the validation
      const validationPath = path.join(result.projectPath, 'src/validation/UserSchema.ts');
      const content = await fs.readFile(validationPath, 'utf-8');

      // Then required fields should not be optional
      expect(content).toContain('email: z.string()');
      expect(content).toContain('age: z.number().optional()');
    });
  });

  describe('Feature: BDD Test Generation', () => {
    it('Scenario: Generate Cucumber feature files', async () => {
      // Given a class definition
      const scaffolder = new ProjectScaffolder(testSchema, { generateTests: true });
      const result = await scaffolder.generateProject(tempDir);

      // When checking for BDD tests
      const featurePath = path.join(result.projectPath, 'tests/bdd/user.feature');
      const exists = await fs.pathExists(featurePath);

      // Then feature file should exist
      expect(exists).toBe(true);
    });

    it('Scenario: Feature file contains CRUD scenarios', async () => {
      // Given a class definition
      const scaffolder = new ProjectScaffolder(testSchema, { generateTests: true });
      const result = await scaffolder.generateProject(tempDir);

      // When reading the feature file
      const featurePath = path.join(result.projectPath, 'tests/bdd/post.feature');
      const content = await fs.readFile(featurePath, 'utf-8');

      // Then all CRUD scenarios should be present
      expect(content).toContain('Feature: Post Management');
      expect(content).toContain('Scenario: List all posts');
      expect(content).toContain('Scenario: Get Post by ID');
      expect(content).toContain('Scenario: Create new Post');
      expect(content).toContain('Scenario: Update existing Post');
      expect(content).toContain('Scenario: Delete Post');
    });
  });

  describe('Feature: Documentation Generation', () => {
    it('Scenario: Generate API documentation', async () => {
      // Given a class definition
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the API docs
      const docsPath = path.join(result.projectPath, 'docs/api/User.md');
      const content = await fs.readFile(docsPath, 'utf-8');

      // Then documentation should be comprehensive
      expect(content).toContain('# User API');
      expect(content).toContain('## Endpoints');
      expect(content).toContain('GET /api/users');
      expect(content).toContain('POST /api/users');
    });

    it('Scenario: Generate project README', async () => {
      // Given a project schema
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading the README
      const readmePath = path.join(result.projectPath, 'README.md');
      const content = await fs.readFile(readmePath, 'utf-8');

      // Then README should contain project info
      expect(content).toContain('# TestProject');
      expect(content).toContain('Getting Started');
      expect(content).toContain('API Endpoints');
    });
  });

  describe('Feature: Dry Run Mode', () => {
    it('Scenario: Dry run does not create files', async () => {
      // Given dry run mode enabled
      const scaffolder = new ProjectScaffolder(testSchema, { dryRun: true });

      // When generating the project
      const result = await scaffolder.generateProject(tempDir);

      // Then files should be listed but not created
      expect(result.filesCreated.length).toBeGreaterThan(0);

      const projectExists = await fs.pathExists(result.projectPath);
      expect(projectExists).toBe(false);
    });

    it('Scenario: Dry run returns complete file list', async () => {
      // Given dry run mode
      const scaffolder = new ProjectScaffolder(testSchema, { dryRun: true });

      // When generating the project
      const result = await scaffolder.generateProject(tempDir);

      // Then all files should be listed
      expect(result.summary.files.total).toBeGreaterThan(0);
      expect(result.filesCreated).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'model' }),
          expect.objectContaining({ type: 'service' }),
          expect.objectContaining({ type: 'api-routes' })
        ])
      );
    });
  });

  describe('Feature: Name Conflict Handling', () => {
    it('Scenario: Warn on existing files', async () => {
      // Given a project that already exists
      const scaffolder1 = new ProjectScaffolder(testSchema);
      await scaffolder1.generateProject(tempDir);

      // When generating again without overwrite
      const scaffolder2 = new ProjectScaffolder(testSchema, { overwrite: false });
      const result = await scaffolder2.generateProject(tempDir);

      // Then warnings should be generated
      expect(result.validation.warnings.length).toBeGreaterThan(0);
    });

    it('Scenario: Overwrite mode replaces files', async () => {
      // Given a project that already exists
      const scaffolder1 = new ProjectScaffolder(testSchema);
      const result1 = await scaffolder1.generateProject(tempDir);

      // When generating again with overwrite
      const scaffolder2 = new ProjectScaffolder(testSchema, { overwrite: true });
      const result2 = await scaffolder2.generateProject(tempDir);

      // Then files should be recreated
      expect(result2.filesCreated.length).toBeGreaterThan(0);
    });
  });

  describe('Feature: Generation Result Validation', () => {
    it('Scenario: Return complete generation result', async () => {
      // Given a project schema
      const scaffolder = new ProjectScaffolder(testSchema);

      // When generating the project
      const result = await scaffolder.generateProject(tempDir);

      // Then result should contain all information
      expect(result).toHaveProperty('projectPath');
      expect(result).toHaveProperty('filesCreated');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('validation');
    });

    it('Scenario: Summary contains statistics', async () => {
      // Given a project schema with 2 classes
      const scaffolder = new ProjectScaffolder(testSchema);

      // When generating the project
      const result = await scaffolder.generateProject(tempDir);

      // Then summary should have correct stats
      expect(result.summary.classes).toBe(2);
      expect(result.summary.routes).toBe(2);
      expect(result.summary.files.total).toBeGreaterThan(0);
      expect(result.summary.size.total).toBeGreaterThan(0);
    });

    it('Scenario: Validation detects errors', async () => {
      // Given a schema with orphaned relationships
      const badSchema = {
        ...testSchema,
        relationships: [
          { source: 'NonExistent', target: 'User', type: 'belongsTo' }
        ]
      };
      const scaffolder = new ProjectScaffolder(badSchema);

      // When generating the project
      const result = await scaffolder.generateProject(tempDir);

      // Then warnings should be reported
      expect(result.validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Feature: Custom Filters', () => {
    it('Scenario: PascalCase filter works', async () => {
      // Given a class name
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading generated files
      const modelPath = path.join(result.projectPath, 'src/models/User.ts');
      const content = await fs.readFile(modelPath, 'utf-8');

      // Then PascalCase should be used
      expect(content).toContain('interface User');
      expect(content).toContain('CreateUserInput');
    });

    it('Scenario: camelCase filter works', async () => {
      // Given a class name
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading service file
      const servicePath = path.join(result.projectPath, 'src/services/UserService.ts');
      const content = await fs.readFile(servicePath, 'utf-8');

      // Then camelCase should be used for variables
      expect(content).toContain('userService');
    });

    it('Scenario: snake_case filter works for SQL', async () => {
      // Given a class with properties
      const scaffolder = new ProjectScaffolder(testSchema);
      const result = await scaffolder.generateProject(tempDir);

      // When reading SQL schema
      const schemaPath = path.join(result.projectPath, 'src/db/schemas/user.sql');
      const content = await fs.readFile(schemaPath, 'utf-8');

      // Then snake_case should be used
      expect(content).toContain('is_active');
      expect(content).toContain('created_at');
    });
  });
});
