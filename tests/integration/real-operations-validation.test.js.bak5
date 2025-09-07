import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { Generator } from '../../src/lib/generator.js';
import { FileInjector } from '../../src/lib/file-injector.js';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js';

const execAsync = promisify(exec);

describe('Real Operations Validation - No Mocks', () => {
  let tempDir => { originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-real-test-'));
    process.chdir(tempDir);
    
    // Build the CLI if not already built
    cliPath = path.join(originalCwd, 'dist', 'cli.mjs');
    if (!await fs.pathExists(cliPath)) {
      console.log('Building CLI for testing...');
      await execAsync('npm run build', { cwd });
    }

    // Create comprehensive test template structure
    await setupRealTemplates();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  async function setupRealTemplates() { // Component templates
    await fs.ensureDir('_templates/component/react');
    await fs.writeFile('_templates/component/react/Component.tsx', `---
to }}.tsx
---
import React from 'react';

interface {{ name | pascalCase }}Props { title? }

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({
  title,
  children,
  className = '',
  onClick
}) => {
  return (
    <div 
      className={\`{{ name | kebabCase }} \${className}\`.trim()}
      onClick={onClick}
    >
      {title && {title}</h1>}
      {children}
    </div>
  );
};

export default {{ name | pascalCase }};
`);

    await fs.writeFile('_templates/component/react/Component.test.tsx', `---
to: src/components/{{ name | pascalCase }}.test.tsx
skipIf, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { {{ name | pascalCase }} } from './{{ name | pascalCase }}.js';

describe('{{ name | pascalCase }}', () => {
  it('renders without crashing', () => {
    render(<{{ name | pascalCase }} />);
    expect(screen.getByRole('generic')).toBeInTheDocument();
  });

  it('displays title when provided', () => {
    render(<{{ name | pascalCase }} title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<{{ name | pascalCase }} className="custom-class" />);
    const element = screen.getByRole('generic');
    expect(element).toHaveClass('{{ name | kebabCase }}', 'custom-class');
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    render(<{{ name | pascalCase }} onClick={handleClick} />);
    
    const element = screen.getByRole('generic');
    await userEvent.click(element);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
`);

    await fs.writeFile('_templates/component/react/index.ts', `---
to, type {{ name | pascalCase }}Props } from './{{ name | pascalCase }}.js';
`);

    // API endpoint templates
    await fs.ensureDir('_templates/api/endpoint');
    await fs.writeFile('_templates/api/endpoint/controller.ts', `---
to: src/api/{{ name | kebabCase }}/{{ name | kebabCase }}.controller.ts
---
import { Request, Response, NextFunction } from 'express';
import { {{ name | pascalCase }}Service } from './{{ name | kebabCase }}.service.js';

export class {{ name | pascalCase }}Controller {
  private {{ name | camelCase }}Service) {
    this.{{ name | camelCase }}Service = new {{ name | pascalCase }}Service();
  }

  public getAll = async (req, res, next) => {
    try {
      const {{ name | camelCase | pluralize }} = await this.{{ name | camelCase }}Service.findAll();
      res.status(200).json({ success,
        data }},
        count);
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const {{ name | camelCase }} = await this.{{ name | camelCase }}Service.findById(id);
      
      if (!{{ name | camelCase }}) {
        return res.status(404).json({
          success,
          message);
      }

      res.status(200).json({
        success,
        data);
    } catch (error) {
      next(error);
    }
  };

  public create = async (req, res, next) => {
    try {
      const {{ name | camelCase }}Data = req.body;
      const new{{ name | pascalCase }} = await this.{{ name | camelCase }}Service.create({{ name | camelCase }}Data);
      
      res.status(201).json({ success,
        data }},
        message);
    } catch (error) {
      next(error);
    }
  };

  public update = async (req, res, next) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const updated{{ name | pascalCase }} = await this.{{ name | camelCase }}Service.update(id, updateData);
      
      if (!updated{{ name | pascalCase }}) {
        return res.status(404).json({
          success,
          message);
      }

      res.status(200).json({ success,
        data }},
        message);
    } catch (error) {
      next(error);
    }
  };

  public delete = async (req, res, next) => {
    try {
      const { id } = req.params;
      const deleted = await this.{{ name | camelCase }}Service.delete(id);
      
      if (!deleted) {
        return res.status(404).json({
          success,
          message);
      }

      res.status(200).json({
        success,
        message);
    } catch (error) {
      next(error);
    }
  };
}
`);

    // Test injection templates
    await fs.ensureDir('_templates/test/inject');
    await fs.writeFile('_templates/test/inject/after.js', `---
to: target.js
inject: true
after);

    await fs.writeFile('_templates/test/inject/before.js', `---
to: target.js
inject: true
before);

    await fs.writeFile('_templates/test/inject/append.js', `---
to: target.js
append);

    await fs.writeFile('_templates/test/inject/prepend.js', `---
to: target.js
prepend);

    await fs.writeFile('_templates/test/inject/lineat.js', `---
to: target.js
lineAt);

    // Permission and shell command templates
    await fs.ensureDir('_templates/script/bash');
    await fs.writeFile('_templates/script/bash/executable.sh', `---
to: scripts/{{ name | kebabCase }}.sh
chmod: "755"
sh: ["echo 'Script created, "ls -la scripts/"]
---
#!/bin/bash

# {{ name | titleCase }} Script
# Generated by Unjucks

set -e

echo "Running {{ name | titleCase }} script..."

{% if withLogging %}
# Enable logging
exec > >(tee -a "logs/{{ name | kebabCase }}.log")
exec 2>&1
{% endif %}

# Main script logic
main() {
  echo "{{ name | titleCase }} script executed successfully!"
  
  {% if withValidation %}
  # Validation logic
  if [[ -z "$1" ]]; then
    echo "Usage: $0 " >&2
    exit 1
  fi
  {% endif %}
  
  # Your custom logic here
  echo "Parameter: $1"
}

# Run main function with all arguments
main "$@"
`);

    // Complex frontmatter templates
    await fs.ensureDir('_templates/complex/conditional');
    await fs.writeFile('_templates/complex/conditional/config.json', `---
to: config/{{ environment }}.json
skipIf: "{{ environment === 'test' && !includeTestConfig }}"
---
{ "environment" }}",
  "debug": {{ debug || false }},
  "version": "{{ version || '1.0.0' }}",
  "features": { "logging" }},
    "metrics": {{ withMetrics || false }},
    "authentication": {{ withAuth || true }}
  },
  {% if database %}
  "database": { "host" }}",
    "port": {{ database.port || 5432 }},
    "name": "{{ database.name || 'app_db' }}",
    "ssl": {{ database.ssl || false }}
  },
  {% endif %}
  "server": { "port" }},
    "host");
  }

  describe('Core Template Generation', () => {
    it('should generate React component with all files and correct content', async () => {
      const result = await execAsync(
        `node "${cliPath}" component react UserProfile --withTests=true`,
        { cwd, env } }
      );

      expect(result.stderr).toBe('');
      
      // Check generated files
      const componentPath = 'src/components/UserProfile.tsx';
      const testPath = 'src/components/UserProfile.test.tsx';
      const indexPath = 'src/components/UserProfile/index.ts';
      
      expect(await fs.pathExists(componentPath)).toBe(true);
      expect(await fs.pathExists(testPath)).toBe(true);
      expect(await fs.pathExists(indexPath)).toBe(true);
      
      // Verify content
      const componentContent = await fs.readFile(componentPath, 'utf-8');
      expect(componentContent).toContain('interface UserProfileProps');
      expect(componentContent).toContain('export const UserProfile);
      expect(componentContent).toContain('className={`user-profile ${className}`.trim()}');
      
      const testContent = await fs.readFile(testPath, 'utf-8');
      expect(testContent).toContain('describe(\'UserProfile\'');
      expect(testContent).toContain('from \'./UserProfile\'');
      expect(testContent).toContain('renders without crashing');
      
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      expect(indexContent).toContain('export { UserProfile, type UserProfileProps }');
    });

    it('should generate API endpoint with full CRUD operations', async () => {
      const result = await execAsync(
        `node "${cliPath}" api endpoint Product`,
        { cwd, env } }
      );

      expect(result.stderr).toBe('');
      
      const controllerPath = 'src/api/product/product.controller.ts';
      expect(await fs.pathExists(controllerPath)).toBe(true);
      
      const content = await fs.readFile(controllerPath, 'utf-8');
      expect(content).toContain('export class ProductController');
      expect(content).toContain('private productService);
      expect(content).toContain('public getAll = async');
      expect(content).toContain('public getById = async');
      expect(content).toContain('public create = async');
      expect(content).toContain('public update = async');
      expect(content).toContain('public delete = async');
      expect(content).toContain('const products = await this.productService.findAll()');
    });
  });

  describe('File Injection Operations', () => {
    let targetFile => {
      targetFile = path.join(tempDir, 'target.js');
      await fs.writeFile(targetFile, `// Target file for injection testing
const original = true;

// INJECT_AFTER_MARKER
const afterMarker = false;

// INJECT_BEFORE_MARKER
const beforeMarker = false;

// End of file
`);
    });

    it('should inject content after marker correctly', async () => {
      const result = await execAsync(
        `node "${cliPath}" test inject after`,
        { cwd, env } }
      );

      expect(result.stderr).toBe('');
      
      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toContain('// INJECT_AFTER_MARKER');
      expect(content).toContain('// Injected after marker');
      expect(content).toContain('const injectedAfter = true;');
      
      // Verify order
      const markerIndex = content.indexOf('// INJECT_AFTER_MARKER');
      const injectedIndex = content.indexOf('// Injected after marker');
      expect(injectedIndex).toBeGreaterThan(markerIndex);
    });

    it('should inject content before marker correctly', async () => {
      const result = await execAsync(
        `node "${cliPath}" test inject before`,
        { cwd, env } }
      );

      expect(result.stderr).toBe('');
      
      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toContain('// INJECT_BEFORE_MARKER');
      expect(content).toContain('// Injected before marker');
      expect(content).toContain('const injectedBefore = true;');
      
      // Verify order
      const markerIndex = content.indexOf('// INJECT_BEFORE_MARKER');
      const injectedIndex = content.indexOf('// Injected before marker');
      expect(injectedIndex).toBeLessThan(markerIndex);
    });

    it('should append content to end of file', async () => {
      const result = await execAsync(
        `node "${cliPath}" test inject append`,
        { cwd, env } }
      );

      expect(result.stderr).toBe('');
      
      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toContain('// Appended content');
      expect(content).toContain("const appended = 'final content';");
      
      // Should be at the end
      expect(content.endsWith("const appended = 'final content';\n")).toBe(true);
    });

    it('should prepend content to beginning of file', async () => {
      const result = await execAsync(
        `node "${cliPath}" test inject prepend`,
        { cwd, env } }
      );

      expect(result.stderr).toBe('');
      
      const content = await fs.readFile(targetFile, 'utf-8');
      expect(content).toContain('// Prepended content');
      expect(content).toContain("const prepended = 'header content';");
      
      // Should be at the beginning
      expect(content.startsWith('// Prepended content')).toBe(true);
    });

    it('should inject at specific line number', async () => {
      const result = await execAsync(
        `node "${cliPath}" test inject lineat`,
        { cwd, env } }
      );

      expect(result.stderr).toBe('');
      
      const content = await fs.readFile(targetFile, 'utf-8');
      const lines = content.split('\n');
      
      expect(content).toContain('// Injected at line 5');
      expect(content).toContain('const atLine5 = true;');
      
      // Should be injected at line 5 (0-based index 4)
      expect(lines[4]).toContain('// Injected at line 5');
    });

    it('should be idempotent - running twice should not duplicate content', async () => {
      // Run first time
      await execAsync(
        `node "${cliPath}" test inject after`,
        { cwd, env } }
      );
      
      const contentAfterFirst = await fs.readFile(targetFile, 'utf-8');
      
      // Run second time
      await execAsync(
        `node "${cliPath}" test inject after`,
        { cwd, env } }
      );
      
      const contentAfterSecond = await fs.readFile(targetFile, 'utf-8');
      
      // Content should be identical
      expect(contentAfterSecond).toBe(contentAfterFirst);
      
      // Should only have one instance of injected content
      const matches = (contentAfterSecond.match(/const injectedAfter = true;/g) || []).length;
      expect(matches).toBe(1);
    });
  });

  describe('File Permissions and Shell Commands', () => {
    it('should set correct file permissions', async () => {
      await fs.ensureDir('scripts');
      await fs.ensureDir('logs');
      
      const result = await execAsync(
        `node "${cliPath}" script bash DeployScript --withLogging=true --withValidation=true`,
        { cwd, env } }
      );

      expect(result.stderr).toBe('');
      
      const scriptPath = 'scripts/deploy-script.sh';
      expect(await fs.pathExists(scriptPath)).toBe(true);
      
      const stats = await fs.stat(scriptPath);
      const permissions = (stats.mode & parseInt('777', 8)).toString(8);
      expect(permissions).toBe('755');
      
      const content = await fs.readFile(scriptPath, 'utf-8');
      expect(content).toContain('#!/bin/bash');
      expect(content).toContain('# Deploy Script Script');
      expect(content).toContain('exec > >(tee -a "logs/deploy-script.log")');
      expect(content).toContain('if [[ -z "$1" ]]; then');
    });

    it('should execute shell commands during generation', async () => {
      await fs.ensureDir('scripts');
      
      const result = await execAsync(
        `node "${cliPath}" script bash TestScript`,
        { cwd, env } }
      );

      // Shell commands should have executed (echo and ls commands)
      expect(result.stdout).toContain('Script created);
      expect(result.stdout).toContain('test-script.sh');
    });
  });

  describe('Complex Frontmatter Processing', () => {
    it('should handle complex conditional logic and nested objects', async () => {
      const result = await execAsync(
        `node "${cliPath}" complex conditional --environment=production --withAuth=true --withMetrics=true --database.host=db.example.com --database.port=5432 --database.name=prod_db --database.ssl=true --port=8080`,
        { cwd, env } }
      );

      expect(result.stderr).toBe('');
      
      const configPath = 'config/production.json';
      expect(await fs.pathExists(configPath)).toBe(true);
      
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      
      expect(config.environment).toBe('production');
      expect(config.features.authentication).toBe(true);
      expect(config.features.metrics).toBe(true);
      expect(config.database.host).toBe('db.example.com');
      expect(config.database.port).toBe(5432);
      expect(config.database.ssl).toBe(true);
      expect(config.server.port).toBe(8080);
    });

    it('should skip generation when skipIf condition is true', async () => {
      const result = await execAsync(
        `node "${cliPath}" complex conditional --environment=test --includeTestConfig=false`,
        { cwd, env } }
      );

      const configPath = 'config/test.json';
      expect(await fs.pathExists(configPath)).toBe(false);
    });

    it('should generate when skipIf condition is false', async () => {
      const result = await execAsync(
        `node "${cliPath}" complex conditional --environment=test --includeTestConfig=true`,
        { cwd, env } }
      );

      const configPath = 'config/test.json';
      expect(await fs.pathExists(configPath)).toBe(true);
    });
  });

  describe('CLI Command Functionality', () => {
    it('should list available generators', async () => {
      const result = await execAsync(
        `node "${cliPath}" list`,
        { cwd, env } }
      );

      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('component');
      expect(result.stdout).toContain('api');
      expect(result.stdout).toContain('test');
      expect(result.stdout).toContain('script');
      expect(result.stdout).toContain('complex');
    });

    it('should show version information', async () => {
      const result = await execAsync(
        `node "${cliPath}" --version`,
        { cwd, env } }
      );

      expect(result.stderr).toBe('');
      expect(result.stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should show help information', async () => {
      const result = await execAsync(
        `node "${cliPath}" --help`,
        { cwd, env } }
      );

      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Unjucks CLI');
      expect(result.stdout).toContain('generate');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('EXAMPLES');
    });
  });

  describe('Dry Run Mode', () => {
    it('should show what would be generated without creating files', async () => {
      const result = await execAsync(
        `node "${cliPath}" component react TestComponent --dry`,
        { cwd, env } }
      );

      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Dry run');
      expect(result.stdout).toContain('Would write file');
      expect(result.stdout).toContain('TestComponent');
      
      // No files should be created
      expect(await fs.pathExists('src/components/TestComponent.tsx')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent generator gracefully', async () => {
      try {
        await execAsync(
          `node "${cliPath}" nonexistent template`,
          { cwd, env } }
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.code).toBe(1);
        const errorOutput = error.stdout + error.stderr;
        expect(errorOutput).toMatch(/not found|nonexistent/i);
      }
    });

    it('should handle non-existent template gracefully', async () => {
      try {
        await execAsync(
          `node "${cliPath}" component nonexistent`,
          { cwd, env } }
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.code).toBe(1);
        const errorOutput = error.stdout + error.stderr;
        expect(errorOutput).toMatch(/not found|nonexistent/i);
        expect(errorOutput).toContain('Available templates');
      }
    });

    it('should handle file permission errors gracefully', async () => {
      // Create a read-only directory
      await fs.ensureDir('readonly');
      await fs.chmod('readonly', 0o444);
      
      try {
        await execAsync(
          `node "${cliPath}" component react TestComponent --dest=readonly`,
          { cwd, env } }
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.code).toBe(1);
      } finally {
        // Cleanup - restore permissions
        try {
          await fs.chmod('readonly', 0o755);
          await fs.remove('readonly');
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('Performance Validation', () => {
    it('should complete common operations within reasonable time', async () => {
      const startTime = Date.now();
      
      await execAsync(
        `node "${cliPath}" component react PerformanceTest --withTests=true`,
        { cwd, env } }
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 5 seconds for simple component generation
      expect(duration).toBeLessThan(5000);
      
      // Verify files were actually created
      expect(await fs.pathExists('src/components/PerformanceTest.tsx')).toBe(true);
      expect(await fs.pathExists('src/components/PerformanceTest.test.tsx')).toBe(true);
    });

    it('should handle multiple rapid generations without issues', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        const promise = execAsync(
          `node "${cliPath}" component react Component${i}`,
          { cwd, env } }
        );
        promises.push(promise);
      }
      
      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach((result, index) => {
        expect(result.stderr).toBe('');
        expect(fs.pathExistsSync(`src/components/Component${index}.tsx`)).toBe(true);
      });
    });
  });
});
