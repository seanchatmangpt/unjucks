import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestHelper } from '../support/TestHelper.js';
import * from 'node:os';
import * from 'node:path';
import * from 'fs-extra';

describe('File Generation Integration Tests', () => {
  let testHelper;
  let testDir => {
    // Create unique temporary directory for each test
    testDir = path.join(os.tmpdir(), `unjucks-test-${Date.now()}-${Math.random().toString(36)}`);
    testHelper = new TestHelper(testDir);
    
    // Setup template structure for testing file generation
    await testHelper.createStructuredTemplates([
      // Basic component generator
      { type },
      { type },
      { type }}.tsx',
        frontmatter: 'to: "src/components/{{ name | pascalCase }}.tsx"',
        content: `import React from 'react';

interface {{ name | pascalCase }}Props { title? }

export const {{ name | pascalCase }}) => {
  return (
    <div className="{{ name | kebabCase }}">
      {title || '{{ name | titleCase }}'}</h1>
      This is the {{ name | titleCase }} component.</p>
    </div>
  );
};

export default {{ name | pascalCase }};`
      },
      { type }}.test.tsx',
        frontmatter: 'to: "src/components/__tests__/{{ name | pascalCase }}.test.tsx"',
        content: `import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {{ name | pascalCase }} from '../{{ name | pascalCase }}.js';

describe('{{ name | pascalCase }}', () => {
  it('renders with default title', () => {
    render(<{{ name | pascalCase }} />);
    expect(screen.getByText('{{ name | titleCase }}')).toBeInTheDocument();
  });

  it('renders with custom title', () => {
    render(<{{ name | pascalCase }} title="Custom Title" />);
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('applies correct CSS class', () => {
    const { container } = render(<{{ name | pascalCase }} />);
    expect(container.querySelector('.{{ name | kebabCase }}')).toBeInTheDocument();
  });
});`
      },

      // API endpoint generator with conditional content
      { type },
      { type },
      { type }}Controller.ts',
        frontmatter: 'to: "src/api/controllers/{{ name | pascalCase }}Controller.ts"',
        content: `import { Request, Response } from 'express';
{% if withAuth %}
import { authenticate } from '../middleware/auth.js';
{% endif %}
{% if withValidation %}
import { validate } from '../middleware/validation.js';
import { {{ name | camelCase }}Schema } from '../schemas/{{ name | camelCase }}.schema.js';
{% endif %}

export class {{ name | pascalCase }}Controller {
{% if withAuth %}
  static middleware = [authenticate];
{% endif %}

  static async getAll(req, res) {
    try {
      // Get all {{ name | pluralize | lower }}
      const {{ name | pluralize | camelCase }} = []; // TODO: Implement database query
      res.json({{ name | pluralize | camelCase }});
    } catch (error) {
      res.status(500).json({ error);
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      // Get {{ name | lower }} by ID
      const {{ name | camelCase }} = null; // TODO: Implement database query
      
      if (!{{ name | camelCase }}) {
        return res.status(404).json({ error);
      }
      
      res.json({{ name | camelCase }});
    } catch (error) {
      res.status(500).json({ error);
    }
  }

{% if withValidation %}
  static async create(req, res) {
    try {
      const validation = {{ name | camelCase }}Schema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error);
      }
      
      // Create new {{ name | lower }}
      const {{ name | camelCase }} = validation.data; // TODO: Save to database
      res.status(201).json({{ name | camelCase }});
    } catch (error) {
      res.status(500).json({ error);
    }
  }
{% else %}
  static async create(req, res) {
    try {
      // Create new {{ name | lower }}
      const {{ name | camelCase }} = req.body; // TODO: Save to database
      res.status(201).json({{ name | camelCase }});
    } catch (error) {
      res.status(500).json({ error);
    }
  }
{% endif %}
}`
      },

      // Utility generator with multiple files
      { type },
      { type },
      { type }}Helper.ts',
        frontmatter: 'to: "src/utils/{{ name | pascalCase }}Helper.ts"',
        content: `export class {{ name | pascalCase }}Helper {
  /**
   * Format {{ name | lower }} value
   */
  static format(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim();
  }

  /**
   * Validate {{ name | lower }} value
   */
  static validate(value) {
    if (value === null || value === undefined) {
      return false;
    }
    
    const formatted = this.format(value);
    return formatted.length > 0;
  }

  /**
   * Parse {{ name | lower }} value
   */
  static parse(value) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}`
      },
      { type }}Helper.test.ts',
        frontmatter: 'to: "src/utils/__tests__/{{ name | pascalCase }}Helper.test.ts"',
        content: `import { describe, it, expect } from 'vitest';
import { {{ name | pascalCase }}Helper } from '../{{ name | pascalCase }}Helper.js';

describe('{{ name | pascalCase }}Helper', () => {
  describe('format', () => {
    it('formats string values', () => {
      expect({{ name | pascalCase }}Helper.format('  test  ')).toBe('test');
    });

    it('handles null and undefined', () => {
      expect({{ name | pascalCase }}Helper.format(null)).toBe('');
      expect({{ name | pascalCase }}Helper.format(undefined)).toBe('');
    });

    it('converts non-string values', () => {
      expect({{ name | pascalCase }}Helper.format(123)).toBe('123');
      expect({{ name | pascalCase }}Helper.format(true)).toBe('true');
    });
  });

  describe('validate', () => {
    it('validates non-empty strings', () => {
      expect({{ name | pascalCase }}Helper.validate('test')).toBe(true);
      expect({{ name | pascalCase }}Helper.validate('  test  ')).toBe(true);
    });

    it('rejects empty or null values', () => {
      expect({{ name | pascalCase }}Helper.validate('')).toBe(false);
      expect({{ name | pascalCase }}Helper.validate('   ')).toBe(false);
      expect({{ name | pascalCase }}Helper.validate(null)).toBe(false);
      expect({{ name | pascalCase }}Helper.validate(undefined)).toBe(false);
    });
  });

  describe('parse', () => {
    it('parses JSON strings', () => {
      expect({{ name | pascalCase }}Helper.parse('{"key")).toEqual({ key);
    });

    it('returns original string for invalid JSON', () => {
      expect({{ name | pascalCase }}Helper.parse('not json')).toBe('not json');
    });
  });
});`
      },

      // Generator with injection patterns
      { type },
      { type },
      { type }}.md"
inject: true
append: true`,
        content: `## {{ title }}

{{ description }}

Added on: {{ date || new Date().toISOString() }}
`
      },
      { type }}.md"  
inject: true
prepend: true`,
        content: `<!-- Generated header for {{ section }} -->
# {{ title }}
`
      }
    ]);

    // Create package.json to establish project root
    await testHelper.createFile('package.json', JSON.stringify({ name });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('Basic File Generation', () => { it('should generate React component files with positional parameters', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test positional syntax }</h1>');

        const testContent = await testHelper.readFile('src/components/__tests__/UserProfile.test.tsx');
        expect(testContent).toContain('import UserProfile from \'../UserProfile\'');
        expect(testContent).toContain('describe(\'UserProfile\'');
        expect(testContent).toContain('expect(screen.getByText(\'User Profile\')).toBeInTheDocument()');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should generate files with flag-based parameters', async () => { const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Test explicit flag syntax } finally {
        process.chdir(originalCwd);
      }
    });

    it('should generate API controller with conditional content', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Generate API controller with auth enabled
        const result = await testHelper.runCli('api endpoint Product --withAuth=true --withValidation=true');

        expect(result.exitCode).toBe(0);

        const controllerExists = await testHelper.fileExists('src/api/controllers/ProductController.ts');
        expect(controllerExists).toBe(true);

        const controllerContent = await testHelper.readFile('src/api/controllers/ProductController.ts');
        expect(controllerContent).toContain('import { authenticate }');
        expect(controllerContent).toContain('import { validate }');
        expect(controllerContent).toContain('import { productSchema }');
        expect(controllerContent).toContain('static middleware = [authenticate]');
        expect(controllerContent).toContain('productSchema.safeParse');
        expect(controllerContent).toContain('const products = []');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should generate multiple files for utility template', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('util helper DataParser');

        expect(result.exitCode).toBe(0);

        // Check both helper and test files were created
        const helperExists = await testHelper.fileExists('src/utils/DataParserHelper.ts');
        const testExists = await testHelper.fileExists('src/utils/__tests__/DataParserHelper.test.ts');

        expect(helperExists).toBe(true);
        expect(testExists).toBe(true);

        // Verify content
        const helperContent = await testHelper.readFile('src/utils/DataParserHelper.ts');
        expect(helperContent).toContain('export class DataParserHelper');
        expect(helperContent).toContain('Format dataparser value');
        expect(helperContent).toContain('Validate dataparser value');

        const testContent = await testHelper.readFile('src/utils/__tests__/DataParserHelper.test.ts');
        expect(testContent).toContain('import { DataParserHelper }');
        expect(testContent).toContain('describe(\'DataParserHelper\'');
        expect(testContent).toContain('expect(DataParserHelper.format(\'  test  \')).toBe(\'test\')');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Dry Run Mode', () => {
    it('should show files that would be generated without creating them', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('component new TestComponent --dry');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Dry run');
        expect(result.stdout).toContain('no files were created');
        expect(result.stdout).toContain('src/components/TestComponent.tsx');
        expect(result.stdout).toContain('src/components/__tests__/TestComponent.test.tsx');

        // Verify no files were actually created
        const componentExists = await testHelper.fileExists('src/components/TestComponent.tsx');
        const testExists = await testHelper.fileExists('src/components/__tests__/TestComponent.test.tsx');

        expect(componentExists).toBe(false);
        expect(testExists).toBe(false);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Force Mode', () => {
    it('should overwrite existing files when force flag is used', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // First generation
        await testHelper.runCli('component new OverwriteTest');

        // Verify file exists
        let componentExists = await testHelper.fileExists('src/components/OverwriteTest.tsx');
        expect(componentExists).toBe(true);

        // Modify the generated file
        const originalContent = await testHelper.readFile('src/components/OverwriteTest.tsx');
        await testHelper.createFile(
          'src/components/OverwriteTest.tsx',
          '// Modified content\n' + originalContent
        );

        // Second generation with force
        const result = await testHelper.runCli('component new OverwriteTest --force');

        expect(result.exitCode).toBe(0);

        // Verify file was overwritten (no longer contains "Modified content")
        const newContent = await testHelper.readFile('src/components/OverwriteTest.tsx');
        expect(newContent).not.toContain('// Modified content');
        expect(newContent).toContain('interface OverwriteTestProps');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('File Injection', () => { it('should append content to existing files', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Create initial documentation file
        await testHelper.createFile('docs/features.md', `# Features

## Existing Feature
This feature already exists.
`);

        // Inject new content via append
        const result = await testHelper.runCli('inject test --section=features --title="New Feature" --description="This is a new feature"');

        expect(result.exitCode).toBe(0);

        // Verify content was appended
        const docsContent = await testHelper.readFile('docs/features.md');
        expect(docsContent).toContain('# Features');
        expect(docsContent).toContain('## Existing Feature');
        expect(docsContent).toContain('## New Feature');
        expect(docsContent).toContain('This is a new feature');
        expect(docsContent).toContain('Added on } finally {
        process.chdir(originalCwd);
      }
    });

    it('should prepend content to existing files', async () => { const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        // Create initial file
        await testHelper.createFile('docs/api.md', `## Introduction
Welcome to our API.
`);

        // Use prepend injection template (need to create it first)
        await testHelper.createStructuredTemplates([
          {
            type }}.md"
inject: true  
prepend: true`,
            content: `<!-- Auto-generated header -->
# {{ title }}

This document was last updated).toISOString() }}

---
`
          }
        ]);

        const result = await testHelper.runCli('inject prepend --section=api --title="API Documentation"');

        expect(result.exitCode).toBe(0);

        // Verify content was prepended
        const docsContent = await testHelper.readFile('docs/api.md');
        expect(docsContent).toContain('<!-- Auto-generated header -->');
        expect(docsContent).toContain('# API Documentation');
        expect(docsContent).toContain('This document was last updated:');
        expect(docsContent).toContain('## Introduction'); // Original content should still be there
        expect(docsContent).toContain('Welcome to our API.');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Custom Nunjucks Filters', () => {
    it('should apply kebab-case filter correctly', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('component new MyAwesomeComponent');
        expect(result.exitCode).toBe(0);

        const content = await testHelper.readFile('src/components/MyAwesomeComponent.tsx');
        expect(content).toContain('className="my-awesome-component"');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should apply pascal-case filter correctly', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('component new user-profile-card');
        expect(result.exitCode).toBe(0);

        const content = await testHelper.readFile('src/components/UserProfileCard.tsx');
        expect(content).toContain('interface UserProfileCardProps');
        expect(content).toContain('export const UserProfileCard');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should apply title-case filter correctly', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('component new shopping_cart');
        expect(result.exitCode).toBe(0);

        const content = await testHelper.readFile('src/components/ShoppingCart.tsx');
        expect(content).toContain('{title || \'Shopping Cart\'}</h1>');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should apply pluralization filters correctly', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('api endpoint User --withAuth=true');
        expect(result.exitCode).toBe(0);

        const content = await testHelper.readFile('src/api/controllers/UserController.ts');
        expect(content).toContain('const users = []');
        expect(content).toContain('Failed to fetch users');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing template gracefully', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('component nonexistent TestName');

        expect(result.exitCode).toBe(1);
        expect(result.stderr || result.stdout).toContain('not found');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle missing generator gracefully', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('nonexistent template TestName');

        expect(result.exitCode).toBe(1);
        expect(result.stderr || result.stdout).toContain('not found');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle invalid template syntax', async () => { // Create a template with invalid Nunjucks syntax
      await testHelper.createStructuredTemplates([
        { type },
        { type },
        { type }}.txt"',
          content);

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('broken test --name=Test');

        expect(result.exitCode).toBe(1);
        expect(result.stderr || result.stdout).toContain('Error');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Directory Structure Creation', () => {
    it('should create nested directories', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('component new DeepComponent');
        expect(result.exitCode).toBe(0);

        // Verify nested directory structure was created
        const dirExists = await testHelper.directoryExists('src/components');
        const testDirExists = await testHelper.directoryExists('src/components/__tests__');

        expect(dirExists).toBe(true);
        expect(testDirExists).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});