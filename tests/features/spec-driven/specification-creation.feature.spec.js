import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

// Mock implementations for specification system
class SpecificationValidator {
  validate(spec) {
    const requiredFields = ['name', 'description', 'type'];
    const errors = [];
    
    for (const field of requiredFields) {
      if (!spec[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    if (spec.type && !['feature', 'bug', 'enhancement'].includes(spec.type)) {
      errors.push('Invalid type. Must be: feature, bug, or enhancement');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }
}

class SpecificationManager {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.specs = new Map();
    this.validator = new SpecificationValidator();
  }

  async createSpecification(specData) {
    const validation = this.validator.validate(specData);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const spec = {
      id: this.generateId(),
      ...specData,
      createdAt: new Date().toISOString(),
      version: 1
    };

    await this.saveSpecification(spec);
    this.specs.set(spec.id, spec);
    
    return spec;
  }

  async saveSpecification(spec) {
    const fileName = `${spec.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    const filePath = path.join(this.baseDir, 'specifications', fileName);
    
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(spec, null, 2));
  }

  generateId() {
    return 'spec-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  async exportSpecification(specId, format) {
    const spec = this.specs.get(specId);
    if (!spec) throw new Error('Specification not found');

    switch (format) {
      case 'json':
        return JSON.stringify(spec, null, 2);
      case 'yaml':
        return this.toYaml(spec);
      case 'md':
        return this.toMarkdown(spec);
      default:
        throw new Error('Unsupported format');
    }
  }

  toYaml(spec) {
    // Simple YAML conversion for testing
    return Object.entries(spec)
      .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
      .join('\n');
  }

  toMarkdown(spec) {
    return `# ${spec.name}\n\n${spec.description}\n\n**Type:** ${spec.type}\n**Priority:** ${spec.priority || 'Not specified'}`;
  }
}

// Test context
let testContext = {};

describe('Specification Creation and Validation', () => {
  beforeEach(async () => {
    // Create temporary directory for tests
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'spec-test-'));
    testContext = {
      tempDir,
      specManager: new SpecificationManager(tempDir),
      createdSpec: null,
      validationResult: null,
      error: null
    };
  });

  afterEach(async () => {
    // Cleanup temporary directory
    if (testContext.tempDir) {
      await fs.rm(testContext.tempDir, { recursive: true, force: true });
    }
  });

  // Background steps
  it('should have a clean working environment', () => {
    expect(testContext.tempDir).toBeDefined();
    expect(testContext.specManager).toBeDefined();
  });

  // Scenario: Creating a basic specification
  describe('Creating a basic specification', () => {
    it('should create specification with required fields', async () => {
      const specData = {
        name: 'UserAuthentication',
        description: 'User login and logout system',
        type: 'feature',
        priority: 'high'
      };

      const spec = await testContext.specManager.createSpecification(specData);
      testContext.createdSpec = spec;

      expect(spec).toBeDefined();
      expect(spec.name).toBe('UserAuthentication');
      expect(spec.description).toBe('User login and logout system');
      expect(spec.type).toBe('feature');
      expect(spec.priority).toBe('high');
      expect(spec.id).toBeDefined();
      expect(spec.createdAt).toBeDefined();
      expect(spec.version).toBe(1);
    });

    it('should save specification to specifications directory', async () => {
      const specData = {
        name: 'UserAuthentication',
        description: 'User login and logout system',
        type: 'feature'
      };

      await testContext.specManager.createSpecification(specData);
      
      const expectedPath = path.join(testContext.tempDir, 'specifications', 'userauthentication.json');
      const fileExists = await fs.access(expectedPath).then(() => true).catch(() => false);
      
      expect(fileExists).toBe(true);
    });
  });

  // Scenario: Validating specification structure
  describe('Validating specification structure', () => {
    it('should validate required fields', () => {
      const validator = new SpecificationValidator();
      
      const validSpec = {
        name: 'Test',
        description: 'Test description',
        type: 'feature'
      };

      const result = validator.validate(validSpec);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const validator = new SpecificationValidator();
      
      const invalidSpec = {
        description: 'Missing name and type'
      };

      const result = validator.validate(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: name');
      expect(result.errors).toContain('Missing required field: type');
    });

    it('should validate field types', () => {
      const validator = new SpecificationValidator();
      
      const invalidSpec = {
        name: 'Test',
        description: 'Test description',
        type: 'invalid-type'
      };

      const result = validator.validate(invalidSpec);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid type. Must be: feature, bug, or enhancement');
    });
  });

  // Scenario: Specification with acceptance criteria
  describe('Specification with acceptance criteria', () => {
    it('should include acceptance criteria', async () => {
      const specData = {
        name: 'UserAuthentication',
        description: 'User login and logout system',
        type: 'feature',
        acceptance: [
          'User can login with valid credentials',
          'User receives error for invalid credentials',
          'User can logout successfully',
          'Session expires after inactivity'
        ]
      };

      const spec = await testContext.specManager.createSpecification(specData);
      
      expect(spec.acceptance).toBeDefined();
      expect(spec.acceptance).toHaveLength(4);
      expect(spec.acceptance).toContain('User can login with valid credentials');
    });
  });

  // Scenario: Invalid specification handling
  describe('Invalid specification handling', () => {
    it('should fail to create specification with missing fields', async () => {
      const invalidSpec = {
        description: 'Login'
        // Missing name and type
      };

      try {
        await testContext.specManager.createSpecification(invalidSpec);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Validation failed');
        expect(error.message).toContain('Missing required field: name');
        expect(error.message).toContain('Missing required field: type');
      }
    });

    it('should not create file when validation fails', async () => {
      const invalidSpec = {
        description: 'Login'
      };

      try {
        await testContext.specManager.createSpecification(invalidSpec);
      } catch (error) {
        // Expected to fail
      }

      // Check that no specification files were created
      const specsDir = path.join(testContext.tempDir, 'specifications');
      try {
        const files = await fs.readdir(specsDir);
        expect(files).toHaveLength(0);
      } catch (error) {
        // Directory doesn't exist, which is also acceptable
        expect(error.code).toBe('ENOENT');
      }
    });
  });

  // Scenario: Specification export formats
  describe('Specification export formats', () => {
    it('should export to JSON format', async () => {
      const specData = {
        name: 'TestSpec',
        description: 'Test specification',
        type: 'feature'
      };

      const spec = await testContext.specManager.createSpecification(specData);
      const exported = await testContext.specManager.exportSpecification(spec.id, 'json');
      
      expect(exported).toBeDefined();
      const parsed = JSON.parse(exported);
      expect(parsed.name).toBe('TestSpec');
      expect(parsed.description).toBe('Test specification');
    });

    it('should export to YAML format', async () => {
      const specData = {
        name: 'TestSpec',
        description: 'Test specification',
        type: 'feature'
      };

      const spec = await testContext.specManager.createSpecification(specData);
      const exported = await testContext.specManager.exportSpecification(spec.id, 'yaml');
      
      expect(exported).toBeDefined();
      expect(exported).toContain('name: TestSpec');
      expect(exported).toContain('description: Test specification');
    });

    it('should export to Markdown format', async () => {
      const specData = {
        name: 'TestSpec',
        description: 'Test specification',
        type: 'feature',
        priority: 'high'
      };

      const spec = await testContext.specManager.createSpecification(specData);
      const exported = await testContext.specManager.exportSpecification(spec.id, 'md');
      
      expect(exported).toBeDefined();
      expect(exported).toContain('# TestSpec');
      expect(exported).toContain('Test specification');
      expect(exported).toContain('**Type:** feature');
      expect(exported).toContain('**Priority:** high');
    });
  });

  // Scenario: Bulk specification validation
  describe('Bulk specification validation', () => {
    it('should validate multiple specifications', () => {
      const validator = new SpecificationValidator();
      const specs = [
        { name: 'Spec1', description: 'First spec', type: 'feature' },
        { name: 'Spec2', description: 'Second spec' }, // Missing type
        { name: 'Spec3', description: 'Third spec', type: 'bug' }
      ];

      const results = specs.map(spec => ({
        spec: spec.name,
        result: validator.validate(spec)
      }));

      expect(results).toHaveLength(3);
      expect(results[0].result.valid).toBe(true);
      expect(results[1].result.valid).toBe(false);
      expect(results[2].result.valid).toBe(true);

      const invalidSpecs = results.filter(r => !r.result.valid);
      expect(invalidSpecs).toHaveLength(1);
      expect(invalidSpecs[0].spec).toBe('Spec2');
    });
  });
});