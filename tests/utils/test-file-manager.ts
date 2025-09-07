/**
 * Test File Manager - Handles temporary file operations during BDD tests
 */

import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';

export class TestFileManager {
  private testDir: string;
  private createdPaths: Set<string> = new Set();

  constructor() {
    this.testDir = join(tmpdir(), `unjucks-test-${Date.now()}`);
  }

  setupTestDirectories(): void {
    this.createDirectory(this.testDir);
    this.createDirectory(join(this.testDir, 'templates'));
    this.createDirectory(join(this.testDir, 'src'));
    this.createDirectory(join(this.testDir, 'tests'));
    this.createDirectory(join(this.testDir, 'config'));
  }

  createDirectory(path: string): void {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
      this.createdPaths.add(path);
    }
  }

  createFile(relativePath: string, content: string): string {
    const fullPath = join(this.testDir, relativePath);
    const dir = dirname(fullPath);
    
    this.createDirectory(dir);
    writeFileSync(fullPath, content, 'utf-8');
    this.createdPaths.add(fullPath);
    
    return fullPath;
  }

  readFile(relativePath: string): string {
    const fullPath = join(this.testDir, relativePath);
    return readFileSync(fullPath, 'utf-8');
  }

  fileExists(relativePath: string): boolean {
    const fullPath = join(this.testDir, relativePath);
    return existsSync(fullPath);
  }

  getTestDir(): string {
    return this.testDir;
  }

  getFullPath(relativePath: string): string {
    return join(this.testDir, relativePath);
  }

  createRDFFile(filename: string, content: string): string {
    return this.createFile(`rdf/${filename}`, content);
  }

  createTemplate(templateName: string, templateContent: string): string {
    return this.createFile(`templates/${templateName}`, templateContent);
  }

  createSemanticTemplate(templateName: string, options: {
    to: string;
    rdfType?: string;
    properties?: Record<string, string>;
    inject?: boolean;
    skipIf?: string;
    content: string;
  }): string {
    const frontmatter = `---
to: ${options.to}
${options.rdfType ? `semantic:
  rdf_type: "${options.rdfType}"` : ''}
${options.properties ? `  properties:
${Object.entries(options.properties).map(([prop, uri]) => `    - ${prop}: "${uri}"`).join('\n')}` : ''}
${options.inject ? 'inject: true' : ''}
${options.skipIf ? `skipIf: "${options.skipIf}"` : ''}
---
${options.content}`;

    return this.createTemplate(templateName, frontmatter);
  }

  createConfigFile(filename: string, config: any): string {
    const content = typeof config === 'string' ? config : JSON.stringify(config, null, 2);
    return this.createFile(`config/${filename}`, content);
  }

  createSourceFile(filename: string, content: string): string {
    return this.createFile(`src/${filename}`, content);
  }

  createTestFile(filename: string, content: string): string {
    return this.createFile(`tests/${filename}`, content);
  }

  // Generate common test files
  generatePackageJson(): string {
    const packageJson = {
      name: 'unjucks-test-project',
      version: '1.0.0',
      description: 'Test project for Unjucks BDD testing',
      main: 'dist/index.js',
      scripts: {
        build: 'tsc',
        test: 'vitest',
        'test:bdd': 'vitest run --reporter=verbose tests/features'
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        'typescript': '^5.0.0',
        'vitest': '^1.0.0',
        '@vitest/ui': '^1.0.0',
        'vitest-cucumber': '^1.0.0'
      }
    };

    return this.createFile('package.json', JSON.stringify(packageJson, null, 2));
  }

  generateTsConfig(): string {
    const tsConfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'node',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        outDir: 'dist',
        rootDir: 'src',
        declaration: true,
        declarationMap: true,
        sourceMap: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', 'tests']
    };

    return this.createFile('jsconfig.json', JSON.stringify(tsConfig, null, 2));
  }

  generateVitestConfig(): string {
    const vitestConfig = `
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,tsx}'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
});
    `.trim();

    return this.createFile('vitest.config.ts', vitestConfig);
  }

  generateUnjucksConfig(): string {
    const config = {
      templatesDir: 'templates',
      outputDir: 'src',
      semantic: {
        enabled: true,
        rdfFormat: 'turtle',
        validation: true,
        shaclRules: 'config/shacl-rules.ttl'
      },
      mcp: {
        enabled: true,
        server: 'claude-flow',
        tools: [
          'swarm_init',
          'agent_spawn',
          'task_orchestrate',
          'semantic_validate'
        ]
      },
      templates: {
        filters: {
          kebabCase: true,
          pascalCase: true,
          camelCase: true,
          snakeCase: true
        },
        globals: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      }
    };

    return this.createConfigFile('unjucks.config.json', config);
  }

  // Cleanup methods
  cleanup(): void {
    try {
      if (existsSync(this.testDir)) {
        rmSync(this.testDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }
    this.createdPaths.clear();
  }

  cleanupFile(relativePath: string): void {
    const fullPath = join(this.testDir, relativePath);
    try {
      if (existsSync(fullPath)) {
        rmSync(fullPath, { force: true });
        this.createdPaths.delete(fullPath);
      }
    } catch (error) {
      console.warn(`Failed to cleanup file ${fullPath}:`, error);
    }
  }

  // Utility methods for test assertions
  verifyFileGenerated(relativePath: string): boolean {
    return this.fileExists(relativePath);
  }

  verifyDirectoryGenerated(relativePath: string): boolean {
    const fullPath = join(this.testDir, relativePath);
    return existsSync(fullPath);
  }

  getGeneratedFiles(directory: string = ''): string[] {
    const fullPath = directory ? join(this.testDir, directory) : this.testDir;
    const files: string[] = [];
    
    try {
      const fs = require('fs');
      const items = fs.readdirSync(fullPath);
      
      for (const item of items) {
        const itemPath = join(fullPath, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isFile()) {
          files.push(join(directory, item));
        } else if (stat.isDirectory()) {
          const subFiles = this.getGeneratedFiles(join(directory, item));
          files.push(...subFiles);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
      return [];
    }
    
    return files;
  }

  countGeneratedFiles(extension?: string): number {
    const files = this.getGeneratedFiles();
    
    if (extension) {
      return files.filter(file => file.endsWith(extension)).length;
    }
    
    return files.length;
  }
}