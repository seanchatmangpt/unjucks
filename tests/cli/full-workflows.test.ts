/**
 * Full CLI Workflow Integration Tests
 * End-to-end testing of complete development workflows
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { tmpdir } from 'os';

const execFileAsync = promisify(execFile);
const CLI_PATH = path.resolve(__dirname, '../../bin/unjucks.cjs');

interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runCLI(args: string[] = [], cwd?: string): Promise<CLIResult> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], {
      cwd: cwd || process.cwd(),
      timeout: 60000 // Longer timeout for workflow tests
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code || 1
    };
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function verifyFileContent(filePath: string, expectedContent: string[]): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return expectedContent.every(expected => content.includes(expected));
  } catch {
    return false;
  }
}

describe('Full CLI Workflow Integration Tests', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'unjucks-workflow-'));
    process.chdir(tempDir);
    
    await createWorkflowTestEnvironment();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createWorkflowTestEnvironment() {
    // React application templates
    await fs.mkdir('_templates/react', { recursive: true });
    
    // Component template
    await fs.writeFile(
      '_templates/react/component.tsx.njk',
      `---
to: src/components/{{name}}/{{name}}.tsx
variables:
  - name: name
    type: string
    required: true
    positional: true
  - name: withProps
    type: boolean
    default: false
  - name: withState
    type: boolean
    default: false
---
import React{{#if withState}}, { useState }{{/if}} from 'react';
{{#if withProps}}
import { {{name}}Props } from './{{name}}.types';
{{/if}}
import styles from './{{name}}.module.css';

export function {{name}}({{#if withProps}}props: {{name}}Props{{/if}}) {
  {{#if withState}}
  const [state, setState] = useState(null);
  {{/if}}

  return (
    <div className={styles.{{name | lower}}}>
      <h1>{{name}}</h1>
      {{#if withProps}}
      {/* Props: {JSON.stringify(props)} */}
      {{/if}}
      {{#if withState}}
      {/* State: {JSON.stringify(state)} */}
      {{/if}}
    </div>
  );
}
`
    );

    // Props interface template
    await fs.writeFile(
      '_templates/react/props.types.ts.njk',
      `---
to: src/components/{{name}}/{{name}}.types.ts
skipIf: "{{skipProps}}"
variables:
  - name: name
    type: string
    required: true
  - name: skipProps
    type: boolean
    default: false
  - name: props
    type: array
    default: []
---
export interface {{name}}Props {
  {{#each props}}
  {{this.name}}{{#unless this.required}}?{{/unless}}: {{this.type}};
  {{/each}}
  className?: string;
  children?: React.ReactNode;
}
`
    );

    // CSS Module template
    await fs.writeFile(
      '_templates/react/styles.module.css.njk',
      `---
to: src/components/{{name}}/{{name}}.module.css
variables:
  - name: name
    type: string
    required: true
---
.{{name | lower}} {
  padding: 1rem;
  margin: 0.5rem;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.{{name | lower}} h1 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.5rem;
}
`
    );

    // Test template
    await fs.writeFile(
      '_templates/react/test.test.tsx.njk',
      `---
to: src/components/{{name}}/{{name}}.test.tsx
variables:
  - name: name
    type: string
    required: true
  - name: withProps
    type: boolean
    default: false
---
import { render, screen } from '@testing-library/react';
import { {{name}} } from './{{name}}';
{{#if withProps}}
import { {{name}}Props } from './{{name}}.types';
{{/if}}

describe('{{name}}', () => {
  it('should render without crashing', () => {
    render(<{{name}} />);
    expect(screen.getByText('{{name}}')).toBeInTheDocument();
  });

  {{#if withProps}}
  it('should accept and display props', () => {
    const props: {{name}}Props = {
      className: 'test-class'
    };
    
    render(<{{name}} {...props} />);
    const element = screen.getByText('{{name}}');
    expect(element.closest('div')).toHaveClass('test-class');
  });
  {{/if}}

  it('should apply CSS module classes', () => {
    render(<{{name}} />);
    const element = screen.getByText('{{name}}');
    expect(element.closest('div')).toHaveClass('{{name | lower}}');
  });
});
`
    );

    // Story template for Storybook
    await fs.writeFile(
      '_templates/react/story.stories.tsx.njk',
      `---
to: src/components/{{name}}/{{name}}.stories.tsx
variables:
  - name: name
    type: string
    required: true
  - name: withProps
    type: boolean
    default: false
---
import type { Meta, StoryObj } from '@storybook/react';
import { {{name}} } from './{{name}}';

const meta: Meta<typeof {{name}}> = {
  title: 'Components/{{name}}',
  component: {{name}},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

{{#if withProps}}
export const WithProps: Story = {
  args: {
    className: 'story-example',
  },
};
{{/if}}
`
    );

    // API templates
    await fs.mkdir('_templates/api', { recursive: true });
    
    // Express router template
    await fs.writeFile(
      '_templates/api/router.ts.njk',
      `---
to: src/api/routes/{{name | lower}}.ts
variables:
  - name: name
    type: string
    required: true
    positional: true
  - name: methods
    type: array
    default: ["GET", "POST"]
  - name: withValidation
    type: boolean
    default: false
  - name: withAuth
    type: boolean
    default: false
---
import { Router } from 'express';
{{#if withValidation}}
import { validate{{name}} } from '../validators/{{name | lower}}.validator';
{{/if}}
{{#if withAuth}}
import { authenticate } from '../middleware/auth';
{{/if}}
import { {{name}}Controller } from '../controllers/{{name | lower}}.controller';

const {{name | lower}}Router = Router();
const controller = new {{name}}Controller();

{{#each methods}}
{{#if (eq this "GET")}}
{{../name | lower}}Router.get('/',{{#if ../withAuth}} authenticate,{{/if}} controller.getAll);
{{../name | lower}}Router.get('/:id',{{#if ../withAuth}} authenticate,{{/if}} controller.getById);
{{/if}}
{{#if (eq this "POST")}}
{{../name | lower}}Router.post('/',{{#if ../withAuth}} authenticate,{{/if}}{{#if ../withValidation}} validate{{../name}},{{/if}} controller.create);
{{/if}}
{{#if (eq this "PUT")}}
{{../name | lower}}Router.put('/:id',{{#if ../withAuth}} authenticate,{{/if}}{{#if ../withValidation}} validate{{../name}},{{/if}} controller.update);
{{/if}}
{{#if (eq this "DELETE")}}
{{../name | lower}}Router.delete('/:id',{{#if ../withAuth}} authenticate,{{/if}} controller.delete);
{{/if}}
{{/each}}

export default {{name | lower}}Router;
`
    );

    // Controller template
    await fs.writeFile(
      '_templates/api/controller.ts.njk',
      `---
to: src/api/controllers/{{name | lower}}.controller.ts
variables:
  - name: name
    type: string
    required: true
  - name: methods
    type: array
    default: ["GET", "POST"]
---
import { Request, Response, NextFunction } from 'express';
import { {{name}}Service } from '../services/{{name | lower}}.service';

export class {{name}}Controller {
  private service = new {{name}}Service();

  {{#each methods}}
  {{#if (eq this "GET")}}
  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await this.service.findAll();
      res.json(items);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const item = await this.service.findById(id);
      if (!item) {
        return res.status(404).json({ error: '{{../name}} not found' });
      }
      res.json(item);
    } catch (error) {
      next(error);
    }
  };
  {{/if}}
  {{#if (eq this "POST")}}
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await this.service.create(req.body);
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  };
  {{/if}}
  {{#if (eq this "PUT")}}
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const item = await this.service.update(id, req.body);
      if (!item) {
        return res.status(404).json({ error: '{{../name}} not found' });
      }
      res.json(item);
    } catch (error) {
      next(error);
    }
  };
  {{/if}}
  {{#if (eq this "DELETE")}}
  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.service.delete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
  {{/if}}
  {{/each}}
}
`
    );

    // Create directory structure
    await fs.mkdir('src/components', { recursive: true });
    await fs.mkdir('src/api/routes', { recursive: true });
    await fs.mkdir('src/api/controllers', { recursive: true });
    await fs.mkdir('src/api/services', { recursive: true });
  }

  describe('React Component Workflow', () => {
    it('should create complete React component with all files', async () => {
      // Step 1: Create component
      const componentResult = await runCLI([
        'react', 'component', 'UserCard',
        '--withProps', 'true',
        '--withState', 'true'
      ]);
      
      expect(componentResult.exitCode).toBe(0);
      expect(componentResult.stdout).toContain('UserCard.tsx');
      
      // Step 2: Create props interface
      const propsResult = await runCLI([
        'react', 'props.types.ts', 'UserCard',
        '--skipProps', 'false',
        '--props', '[{"name":"userId","type":"string","required":true},{"name":"showDetails","type":"boolean","required":false}]'
      ]);
      
      expect(propsResult.exitCode).toBe(0);
      
      // Step 3: Create styles
      const stylesResult = await runCLI(['react', 'styles.module.css', 'UserCard']);
      
      expect(stylesResult.exitCode).toBe(0);
      
      // Step 4: Create tests
      const testResult = await runCLI([
        'react', 'test.test.tsx', 'UserCard',
        '--withProps', 'true'
      ]);
      
      expect(testResult.exitCode).toBe(0);
      
      // Step 5: Create Storybook story
      const storyResult = await runCLI([
        'react', 'story.stories.tsx', 'UserCard',
        '--withProps', 'true'
      ]);
      
      expect(storyResult.exitCode).toBe(0);
      
      // Verify all files exist
      const expectedFiles = [
        'src/components/UserCard/UserCard.tsx',
        'src/components/UserCard/UserCard.types.ts',
        'src/components/UserCard/UserCard.module.css',
        'src/components/UserCard/UserCard.test.tsx',
        'src/components/UserCard/UserCard.stories.tsx'
      ];
      
      for (const file of expectedFiles) {
        expect(await fileExists(file)).toBe(true);
      }
      
      // Verify content relationships
      expect(await verifyFileContent('src/components/UserCard/UserCard.tsx', [
        'import React, { useState }',
        'import { UserCardProps }',
        'import styles from',
        'export function UserCard'
      ])).toBe(true);
      
      expect(await verifyFileContent('src/components/UserCard/UserCard.types.ts', [
        'export interface UserCardProps',
        'userId: string;',
        'showDetails?: boolean;'
      ])).toBe(true);
      
      expect(await verifyFileContent('src/components/UserCard/UserCard.test.tsx', [
        'import { UserCard }',
        'import { UserCardProps }',
        'should render without crashing',
        'should accept and display props'
      ])).toBe(true);
    });

    it('should handle conditional file creation in component workflow', async () => {
      // Create component without props
      const result1 = await runCLI([
        'react', 'component', 'SimpleButton',
        '--withProps', 'false'
      ]);
      
      expect(result1.exitCode).toBe(0);
      
      // Try to create props (should be skipped)
      const result2 = await runCLI([
        'react', 'props.types.ts', 'SimpleButton',
        '--skipProps', 'true'
      ]);
      
      expect(result2.exitCode).toBe(0);
      
      // Verify component exists but props file doesn't
      expect(await fileExists('src/components/SimpleButton/SimpleButton.tsx')).toBe(true);
      expect(await fileExists('src/components/SimpleButton/SimpleButton.types.ts')).toBe(false);
      
      // Component should not import props
      const componentContent = await fs.readFile('src/components/SimpleButton/SimpleButton.tsx', 'utf-8');
      expect(componentContent).not.toContain('SimpleButtonProps');
      expect(componentContent).not.toContain('import { SimpleButtonProps }');
    });
  });

  describe('API Development Workflow', () => {
    it('should create complete API endpoint with all layers', async () => {
      // Step 1: Create router
      const routerResult = await runCLI([
        'api', 'router', 'Product',
        '--methods', 'GET,POST,PUT,DELETE',
        '--withValidation', 'true',
        '--withAuth', 'true'
      ]);
      
      expect(routerResult.exitCode).toBe(0);
      
      // Step 2: Create controller
      const controllerResult = await runCLI([
        'api', 'controller', 'Product',
        '--methods', 'GET,POST,PUT,DELETE'
      ]);
      
      expect(controllerResult.exitCode).toBe(0);
      
      // Verify files exist
      expect(await fileExists('src/api/routes/product.ts')).toBe(true);
      expect(await fileExists('src/api/controllers/product.controller.ts')).toBe(true);
      
      // Verify router content
      expect(await verifyFileContent('src/api/routes/product.ts', [
        'import { Router }',
        'import { validateProduct }',
        'import { authenticate }',
        'import { ProductController }',
        'productRouter.get',
        'productRouter.post',
        'productRouter.put',
        'productRouter.delete'
      ])).toBe(true);
      
      // Verify controller content
      expect(await verifyFileContent('src/api/controllers/product.controller.ts', [
        'export class ProductController',
        'getAll =',
        'getById =',
        'create =',
        'update =',
        'delete ='
      ])).toBe(true);
    });

    it('should handle different HTTP method combinations', async () => {
      // Create read-only API
      const readOnlyResult = await runCLI([
        'api', 'router', 'Analytics',
        '--methods', 'GET'
      ]);
      
      expect(readOnlyResult.exitCode).toBe(0);
      
      const readOnlyController = await runCLI([
        'api', 'controller', 'Analytics',
        '--methods', 'GET'
      ]);
      
      expect(readOnlyController.exitCode).toBe(0);
      
      // Verify only GET methods exist
      const routerContent = await fs.readFile('src/api/routes/analytics.ts', 'utf-8');
      expect(routerContent).toContain('analyticsRouter.get');
      expect(routerContent).not.toContain('analyticsRouter.post');
      
      const controllerContent = await fs.readFile('src/api/controllers/analytics.controller.ts', 'utf-8');
      expect(controllerContent).toContain('getAll =');
      expect(controllerContent).toContain('getById =');
      expect(controllerContent).not.toContain('create =');
    });
  });

  describe('Full-Stack Feature Workflow', () => {
    it('should create complete feature with frontend and backend', async () => {
      const featureName = 'BlogPost';
      
      // Backend: Create API
      const apiResults = await Promise.all([
        runCLI([
          'api', 'router', featureName,
          '--methods', 'GET,POST,PUT,DELETE',
          '--withAuth', 'true',
          '--withValidation', 'true'
        ]),
        runCLI([
          'api', 'controller', featureName,
          '--methods', 'GET,POST,PUT,DELETE'
        ])
      ]);
      
      // Frontend: Create components
      const frontendResults = await Promise.all([
        runCLI([
          'react', 'component', `${featureName}List`,
          '--withProps', 'true',
          '--withState', 'true'
        ]),
        runCLI([
          'react', 'component', `${featureName}Form`,
          '--withProps', 'true',
          '--withState', 'true'
        ]),
        runCLI([
          'react', 'component', `${featureName}Detail`,
          '--withProps', 'true'
        ])
      ]);
      
      // All should succeed
      [...apiResults, ...frontendResults].forEach(result => {
        expect(result.exitCode).toBe(0);
      });
      
      // Verify backend files
      expect(await fileExists('src/api/routes/blogpost.ts')).toBe(true);
      expect(await fileExists('src/api/controllers/blogpost.controller.ts')).toBe(true);
      
      // Verify frontend files
      expect(await fileExists('src/components/BlogPostList/BlogPostList.tsx')).toBe(true);
      expect(await fileExists('src/components/BlogPostForm/BlogPostForm.tsx')).toBe(true);
      expect(await fileExists('src/components/BlogPostDetail/BlogPostDetail.tsx')).toBe(true);
      
      // Create supporting files
      const supportingResults = await Promise.all([
        runCLI(['react', 'styles.module.css', 'BlogPostList']),
        runCLI(['react', 'styles.module.css', 'BlogPostForm']),
        runCLI(['react', 'styles.module.css', 'BlogPostDetail']),
        runCLI(['react', 'test.test.tsx', 'BlogPostList', '--withProps', 'true']),
        runCLI(['react', 'test.test.tsx', 'BlogPostForm', '--withProps', 'true'])
      ]);
      
      supportingResults.forEach(result => {
        expect(result.exitCode).toBe(0);
      });
      
      // Count total files created
      const allFiles = await fs.readdir('src', { recursive: true });
      const blogPostFiles = allFiles.filter(f => 
        f.toString().toLowerCase().includes('blogpost')
      );
      
      expect(blogPostFiles.length).toBeGreaterThan(10); // Should have created many files
    });
  });

  describe('Project Initialization Workflow', () => {
    it('should handle complete project setup', async () => {
      // This would test project initialization if implemented
      const result = await runCLI(['init', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Initialize');
    });
  });

  describe('Development Workflow Integration', () => {
    it('should support iterative development workflow', async () => {
      // Phase 1: Create basic component
      const phase1 = await runCLI([
        'react', 'component', 'IterativeComponent',
        '--withProps', 'false',
        '--withState', 'false'
      ]);
      
      expect(phase1.exitCode).toBe(0);
      
      let componentContent = await fs.readFile(
        'src/components/IterativeComponent/IterativeComponent.tsx', 
        'utf-8'
      );
      expect(componentContent).not.toContain('useState');
      expect(componentContent).not.toContain('IterativeComponentProps');
      
      // Phase 2: Add styles
      const phase2 = await runCLI(['react', 'styles.module.css', 'IterativeComponent']);
      expect(phase2.exitCode).toBe(0);
      
      // Phase 3: Add tests
      const phase3 = await runCLI([
        'react', 'test.test.tsx', 'IterativeComponent',
        '--withProps', 'false'
      ]);
      expect(phase3.exitCode).toBe(0);
      
      // Phase 4: Create enhanced version (simulate refactoring)
      const phase4 = await runCLI([
        'react', 'component', 'IterativeComponentV2',
        '--withProps', 'true',
        '--withState', 'true'
      ]);
      expect(phase4.exitCode).toBe(0);
      
      // Verify both versions exist
      expect(await fileExists('src/components/IterativeComponent/IterativeComponent.tsx')).toBe(true);
      expect(await fileExists('src/components/IterativeComponentV2/IterativeComponentV2.tsx')).toBe(true);
      
      // V2 should have more features
      const v2Content = await fs.readFile(
        'src/components/IterativeComponentV2/IterativeComponentV2.tsx',
        'utf-8'
      );
      expect(v2Content).toContain('useState');
      expect(v2Content).toContain('IterativeComponentV2Props');
    });

    it('should handle rapid prototyping workflow', async () => {
      const prototypes = ['ProtoA', 'ProtoB', 'ProtoC'];
      
      // Create multiple prototypes quickly
      const results = await Promise.all(
        prototypes.map(name => 
          runCLI(['react', 'component', name, '--withProps', 'true'])
        )
      );
      
      results.forEach(result => {
        expect(result.exitCode).toBe(0);
      });
      
      // All should exist
      for (const name of prototypes) {
        expect(await fileExists(`src/components/${name}/${name}.tsx`)).toBe(true);
      }
      
      // Add tests to selected prototype
      const testResult = await runCLI([
        'react', 'test.test.tsx', 'ProtoB',
        '--withProps', 'true'
      ]);
      expect(testResult.exitCode).toBe(0);
      expect(await fileExists('src/components/ProtoB/ProtoB.test.tsx')).toBe(true);
    });
  });

  describe('Error Recovery in Workflows', () => {
    it('should handle partial workflow failures gracefully', async () => {
      // Start workflow that will partially fail
      const validResult = await runCLI(['react', 'component', 'PartialWorkflow']);
      expect(validResult.exitCode).toBe(0);
      
      // Try invalid operation
      const invalidResult = await runCLI([
        'react', 'component', 'PartialWorkflow2',
        '--invalidFlag', 'true'
      ]);
      expect(invalidResult.exitCode).toBe(1);
      
      // Continue with valid operations
      const continueResult = await runCLI(['react', 'styles.module.css', 'PartialWorkflow']);
      expect(continueResult.exitCode).toBe(0);
      
      // Verify partial success
      expect(await fileExists('src/components/PartialWorkflow/PartialWorkflow.tsx')).toBe(true);
      expect(await fileExists('src/components/PartialWorkflow/PartialWorkflow.module.css')).toBe(true);
      expect(await fileExists('src/components/PartialWorkflow2/PartialWorkflow2.tsx')).toBe(false);
    });
  });

  describe('Workflow Performance', () => {
    it('should handle complex workflows efficiently', async () => {
      const startTime = Date.now();
      
      // Complex workflow with many operations
      const operations = [];
      
      // Create multiple features
      for (let i = 0; i < 3; i++) {
        const featureName = `Feature${i}`;
        
        operations.push(
          runCLI(['react', 'component', featureName, '--withProps', 'true']),
          runCLI(['react', 'styles.module.css', featureName]),
          runCLI(['react', 'test.test.tsx', featureName, '--withProps', 'true']),
          runCLI(['api', 'router', featureName, '--methods', 'GET,POST']),
          runCLI(['api', 'controller', featureName, '--methods', 'GET,POST'])
        );
      }
      
      const results = await Promise.all(operations);
      const endTime = Date.now();
      
      // Most should succeed
      const successCount = results.filter(r => r.exitCode === 0).length;
      expect(successCount).toBeGreaterThan(operations.length * 0.8);
      
      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(120000); // Less than 2 minutes
    });
  });

  describe('Documentation Workflow', () => {
    it('should generate comprehensive documentation for created components', async () => {
      // Create component with documentation
      const componentResult = await runCLI([
        'react', 'component', 'DocumentedComponent',
        '--withProps', 'true'
      ]);
      expect(componentResult.exitCode).toBe(0);
      
      // Create story for documentation
      const storyResult = await runCLI([
        'react', 'story.stories.tsx', 'DocumentedComponent',
        '--withProps', 'true'
      ]);
      expect(storyResult.exitCode).toBe(0);
      
      // Verify documentation structure
      const storyContent = await fs.readFile(
        'src/components/DocumentedComponent/DocumentedComponent.stories.tsx',
        'utf-8'
      );
      
      expect(storyContent).toContain('tags: ["autodocs"]');
      expect(storyContent).toContain('Default: Story');
      expect(storyContent).toContain('WithProps: Story');
    });
  });

  describe('Cross-Feature Integration', () => {
    it('should create related components that work together', async () => {
      // Create parent component
      const parentResult = await runCLI([
        'react', 'component', 'UserDashboard',
        '--withProps', 'true',
        '--withState', 'true'
      ]);
      expect(parentResult.exitCode).toBe(0);
      
      // Create child components
      const childResults = await Promise.all([
        runCLI(['react', 'component', 'UserProfile', '--withProps', 'true']),
        runCLI(['react', 'component', 'UserSettings', '--withProps', 'true']),
        runCLI(['react', 'component', 'UserActivity', '--withProps', 'true'])
      ]);
      
      childResults.forEach(result => {
        expect(result.exitCode).toBe(0);
      });
      
      // Create supporting API
      const apiResult = await runCLI([
        'api', 'router', 'User',
        '--methods', 'GET,PUT',
        '--withAuth', 'true'
      ]);
      expect(apiResult.exitCode).toBe(0);
      
      // Verify all components can coexist
      const componentDirs = await fs.readdir('src/components');
      expect(componentDirs).toContain('UserDashboard');
      expect(componentDirs).toContain('UserProfile');
      expect(componentDirs).toContain('UserSettings');
      expect(componentDirs).toContain('UserActivity');
      
      // Verify API exists
      expect(await fileExists('src/api/routes/user.ts')).toBe(true);
    });
  });
});
