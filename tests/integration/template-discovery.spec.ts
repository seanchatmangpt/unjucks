import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestHelper } from '../support/TestHelper.js';
import * as os from 'node:os';
import * as path from 'node:path';
import { Generator } from '../../src/lib/generator.js';

describe('Template Discovery Integration Tests', () => {
  let testHelper: TestHelper;
  let testDir: string;

  beforeEach(async () => {
    // Create unique temporary directory for each test
    testDir = path.join(os.tmpdir(), `unjucks-test-${Date.now()}-${Math.random().toString(36)}`);
    testHelper = new TestHelper(testDir);
    
    // Setup basic template structure in the test directory
    await testHelper.createStructuredTemplates([
      // Component generator
      { type: 'directory', path: 'component' },
      { 
        type: 'file', 
        path: 'component/config.yml',
        content: `name: component
description: Generate React components
templates:
  - name: new
    description: Create a new React component
    files:
      - "{{ name | pascalCase }}.tsx"
      - "{{ name | pascalCase }}.test.tsx"
    prompts:
      - name: name
        message: Component name
        type: input
        default: MyComponent`
      },
      {
        type: 'file',
        path: 'component/new/{{ name | pascalCase }}.tsx',
        frontmatter: 'to: "src/components/{{ name | pascalCase }}.tsx"',
        content: `import React from 'react';

export interface {{ name | pascalCase }}Props {
  className?: string;
  children?: React.ReactNode;
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({ 
  className,
  children 
}) => {
  return (
    <div className={className}>
      <h1>{{ name | titleCase }} Component</h1>
      {children}
    </div>
  );
};

export default {{ name | pascalCase }};`
      },
      {
        type: 'file',
        path: 'component/new/{{ name | pascalCase }}.test.tsx',
        frontmatter: 'to: "src/components/__tests__/{{ name | pascalCase }}.test.tsx"',
        content: `import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {{ name | pascalCase }} from '../{{ name | pascalCase }}';

describe('{{ name | pascalCase }}', () => {
  it('renders correctly', () => {
    render(<{{ name | pascalCase }}>Test Content</{{ name | pascalCase }}>);
    
    expect(screen.getByText('{{ name | titleCase }} Component')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
  
  it('applies className prop', () => {
    const { container } = render(
      <{{ name | pascalCase }} className="custom-class">
        Content
      </{{ name | pascalCase }}>
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});`
      },

      // API generator
      { type: 'directory', path: 'api' },
      {
        type: 'file',
        path: 'api/config.yml',
        content: `name: api
description: Generate API endpoints
templates:
  - name: endpoint
    description: Create REST API endpoint
    files:
      - "{{ name | pascalCase }}Controller.ts"
      - "{{ name | pascalCase }}Routes.ts"
    prompts:
      - name: name
        message: API endpoint name
        type: input
        default: User
      - name: withAuth
        message: Include authentication?
        type: confirm
        default: false`
      },
      {
        type: 'file',
        path: 'api/endpoint/{{ name | pascalCase }}Controller.ts',
        frontmatter: 'to: "src/controllers/{{ name | pascalCase }}Controller.ts"',
        content: `import { Request, Response } from 'express';
{% if withAuth %}
import { requireAuth } from '../middleware/auth.js';
{% endif %}

export class {{ name | pascalCase }}Controller {
  {% if withAuth %}
  static middleware = [requireAuth];
  {% endif %}
  
  static async getAll(req: Request, res: Response) {
    try {
      // TODO: Implement get all {{ name | pluralize | lower }}
      res.json({ message: 'Get all {{ name | pluralize | lower }}' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      // TODO: Implement get {{ name | lower }} by id
      res.json({ message: \`Get {{ name | lower }} with id: \${id}\` });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  static async create(req: Request, res: Response) {
    try {
      // TODO: Implement create {{ name | lower }}
      res.status(201).json({ message: 'Create {{ name | lower }}' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      // TODO: Implement update {{ name | lower }}
      res.json({ message: \`Update {{ name | lower }} with id: \${id}\` });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      // TODO: Implement delete {{ name | lower }}
      res.json({ message: \`Delete {{ name | lower }} with id: \${id}\` });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}`
      },

      // Simple generator without config
      { type: 'directory', path: 'util' },
      { type: 'directory', path: 'util/helper' },
      {
        type: 'file',
        path: 'util/helper/{{ name | pascalCase }}Helper.ts',
        frontmatter: 'to: "src/utils/{{ name | pascalCase }}Helper.ts"',
        content: `export class {{ name | pascalCase }}Helper {
  static format(value: any): string {
    return String(value).trim();
  }
  
  static validate(value: any): boolean {
    return value != null && value !== '';
  }
}`
      }
    ]);
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('Generator Discovery', () => {
    it('should discover all generators from templates directory', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));
      const generators = await generator.listGenerators();

      expect(generators).toHaveLength(3);
      expect(generators.map(g => g.name).sort()).toEqual(['api', 'component', 'util']);
    });

    it('should discover generators with config files', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));
      const generators = await generator.listGenerators();

      const componentGen = generators.find(g => g.name === 'component');
      const apiGen = generators.find(g => g.name === 'api');

      expect(componentGen).toBeDefined();
      expect(componentGen?.description).toBe('Generate React components');
      expect(componentGen?.templates).toHaveLength(1);
      expect(componentGen?.templates[0].name).toBe('new');

      expect(apiGen).toBeDefined();
      expect(apiGen?.description).toBe('Generate API endpoints');
      expect(apiGen?.templates).toHaveLength(1);
      expect(apiGen?.templates[0].name).toBe('endpoint');
    });

    it('should discover generators without config files', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));
      const generators = await generator.listGenerators();

      const utilGen = generators.find(g => g.name === 'util');
      expect(utilGen).toBeDefined();
      expect(utilGen?.description).toBe('Generator for util');
      expect(utilGen?.templates).toHaveLength(1);
      expect(utilGen?.templates[0].name).toBe('helper');
    });

    it('should handle empty templates directory', async () => {
      const emptyDir = path.join(testDir, 'empty_templates');
      await testHelper.createDirectory('empty_templates');
      
      const generator = new Generator(emptyDir);
      const generators = await generator.listGenerators();

      expect(generators).toHaveLength(0);
    });

    it('should handle non-existent templates directory', async () => {
      const nonExistentDir = path.join(testDir, 'non_existent');
      
      const generator = new Generator(nonExistentDir);
      const generators = await generator.listGenerators();

      expect(generators).toHaveLength(0);
    });
  });

  describe('Template Discovery', () => {
    it('should list templates for a generator with config', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));
      const templates = await generator.listTemplates('component');

      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('new');
      expect(templates[0].description).toBe('Create a new React component');
      expect(templates[0].files).toContain('{{ name | pascalCase }}.tsx');
      expect(templates[0].files).toContain('{{ name | pascalCase }}.test.tsx');
    });

    it('should list templates for a generator without config', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));
      const templates = await generator.listTemplates('util');

      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('helper');
      expect(templates[0].description).toBe('Template for helper');
      expect(templates[0].files).toContain('{{ name | pascalCase }}Helper.ts');
    });

    it('should throw error for non-existent generator', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      await expect(generator.listTemplates('nonexistent')).rejects.toThrow(
        "Generator 'nonexistent' not found"
      );
    });
  });

  describe('Template Variable Scanning', () => {
    it('should scan variables from component template', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));
      const result = await generator.scanTemplateForVariables('component', 'new');

      expect(result.variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'name',
            type: 'string',
            required: true
          })
        ])
      );

      expect(result.cliArgs).toHaveProperty('name');
      expect(result.cliArgs.name.type).toBe('string');
      expect(result.cliArgs.name.description).toContain('name');
    });

    it('should scan variables from api template with conditional logic', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));
      const result = await generator.scanTemplateForVariables('api', 'endpoint');

      expect(result.variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'name',
            type: 'string', 
            required: true
          }),
          expect.objectContaining({
            name: 'withAuth',
            type: 'boolean'
          })
        ])
      );

      expect(result.cliArgs).toHaveProperty('name');
      expect(result.cliArgs).toHaveProperty('withAuth');
      expect(result.cliArgs.withAuth.type).toBe('boolean');
    });

    it('should handle templates with filename variables', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));
      const result = await generator.scanTemplateForVariables('util', 'helper');

      expect(result.variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'name',
            type: 'string',
            required: true
          })
        ])
      );
    });

    it('should throw error for non-existent template', async () => {
      const generator = new Generator(path.join(testDir, '_templates'));

      await expect(
        generator.scanTemplateForVariables('component', 'nonexistent')
      ).rejects.toThrow(
        "Template 'nonexistent' not found in generator 'component'"
      );
    });
  });

  describe('CLI Integration', () => {
    it('should list generators via CLI', async () => {
      // Change to test directory to use templates
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('list');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('component');
        expect(result.stdout).toContain('api');
        expect(result.stdout).toContain('util');
        expect(result.stdout).toContain('Generate React components');
        expect(result.stdout).toContain('Generate API endpoints');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should show template help via CLI', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('help component new');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Help for component/new');
        expect(result.stdout).toContain('name');
        expect(result.stdout).toContain('positional');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should discover templates from project directory structure', async () => {
      // Create a package.json to simulate project root
      await testHelper.createFile('package.json', JSON.stringify({
        name: 'test-project',
        version: '1.0.0'
      }));

      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await testHelper.runCli('list');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('component');
        expect(result.stdout).toContain('api');
        expect(result.stdout).toContain('util');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Template Path Discovery', () => {
    it('should find templates directory relative to package.json', async () => {
      // Create nested directory structure
      await testHelper.createDirectory('project/subdir');
      await testHelper.createFile('project/package.json', JSON.stringify({
        name: 'nested-project'
      }));
      
      // Move templates to project level
      await testHelper.createDirectory('project/_templates/simple');
      await testHelper.createDirectory('project/_templates/simple/basic');
      await testHelper.createFile(
        'project/_templates/simple/basic/file.txt',
        '---\nto: "{{ name }}.txt"\n---\nHello {{ name }}!'
      );

      const originalCwd = process.cwd();
      // Change to subdirectory - generator should still find templates at project root
      process.chdir(path.join(testDir, 'project', 'subdir'));

      try {
        const result = await testHelper.runCli('list');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('simple');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should use alternative templates directory name', async () => {
      // Create templates directory instead of _templates
      await testHelper.createDirectory('project/templates/alt');
      await testHelper.createDirectory('project/templates/alt/test');
      await testHelper.createFile('project/package.json', JSON.stringify({
        name: 'alt-project'
      }));
      await testHelper.createFile(
        'project/templates/alt/test/file.txt',
        '---\nto: "{{ name }}.txt"\n---\nContent'
      );

      const originalCwd = process.cwd();
      process.chdir(path.join(testDir, 'project'));

      try {
        const result = await testHelper.runCli('list');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('alt');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});