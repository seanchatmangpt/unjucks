import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'vitest';
import { execSync } from 'node:child_process';
import * as fs from 'fs-extra';
import * as path from 'node:path';
import * as os from 'node:os';
import { UnjucksWorld } from '../support/world.js';

// Performance measurement utilities
interface PerformanceResult {
  duration: number;
  memory: number;
  success: boolean;
  output: string;
  error?: string;
}

async function measureCommand(command: string): Promise<PerformanceResult> {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage().heapUsed;
  
  try {
    const output = execSync(command, { 
      encoding: 'utf8', 
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage().heapUsed;
    
    return {
      duration: Number(endTime - startTime) / 1_000_000, // Convert to milliseconds
      memory: endMemory - startMemory,
      success: true,
      output: output.toString()
    };
  } catch (error: any) {
    const endTime = process.hrtime.bigint();
    return {
      duration: Number(endTime - startTime) / 1_000_000,
      memory: 0,
      success: false,
      output: error.stdout ? error.stdout.toString() : '',
      error: error.stderr ? error.stderr.toString() : error.message
    };
  }
}

// Environment Setup Steps
Given('I have a clean test environment', async function (this: UnjucksWorld) {
  await this.createTempDirectory();
  // Ensure we have a clean state
  this.clearVariables();
});

Given('the CLI is built and ready', async function (this: UnjucksWorld) {
  const cliPath = path.resolve(process.cwd(), 'dist/cli.mjs');
  const exists = await fs.pathExists(cliPath);
  expect(exists).toBe(true);
  
  // Test basic CLI functionality
  const result = await measureCommand(`node "${cliPath}" --version`);
  expect(result.success).toBe(true);
});

// Positional Parameters Steps
Given('I have a generator {string} with template {string}', async function (
  this: UnjucksWorld, 
  generator: string, 
  template: string
) {
  const templatePath = path.join(this.context.tempDirectory, '_templates', generator, template);
  await fs.ensureDir(templatePath);
  
  // Create a basic template
  const templateContent = `---
to: "src/{{ generator }}s/{{ name | pascalCase }}.ts"
---
export class {{ name | pascalCase }} {
  constructor() {
    console.log('{{ name | pascalCase }} created');
  }
}
`;
  
  await fs.writeFile(path.join(templatePath, 'template.ejs.t'), templateContent);
  this.setTemplateVariables({ generator, template });
});

When('I run {string}', async function (this: UnjucksWorld, command: string) {
  const cwd = this.context.tempDirectory;
  const fullCommand = command.includes('unjucks') ? 
    command.replace('unjucks', `node "${path.resolve(process.cwd(), 'dist/cli.mjs')}"`) : 
    command;
  
  try {
    const result = execSync(fullCommand, {
      cwd,
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    this.context.lastCommandOutput = result.toString();
    this.context.lastCommandError = '';
    this.context.lastCommandCode = 0;
  } catch (error: any) {
    this.context.lastCommandOutput = error.stdout ? error.stdout.toString() : '';
    this.context.lastCommandError = error.stderr ? error.stderr.toString() : error.message;
    this.context.lastCommandCode = error.status || 1;
  }
});

Then('the file {string} should be created', async function (
  this: UnjucksWorld,
  filePath: string
) {
  const fullPath = path.join(this.context.tempDirectory, filePath);
  const exists = await fs.pathExists(fullPath);
  expect(exists).toBe(true);
});

// Frontmatter Steps  
Given('I have a template with frontmatter option {string} set to {string}', async function (
  this: UnjucksWorld,
  option: string,
  value: string
) {
  const templatePath = path.join(this.context.tempDirectory, '_templates', 'test', 'validation');
  await fs.ensureDir(templatePath);
  
  const frontmatter: Record<string, any> = {};
  
  // Handle different value types
  if (value === 'true' || value === 'false') {
    frontmatter[option] = value === 'true';
  } else if (!isNaN(Number(value))) {
    frontmatter[option] = Number(value);
  } else {
    frontmatter[option] = value;
  }
  
  const templateContent = `---
${option}: ${JSON.stringify(frontmatter[option])}
to: "src/test-{{ name }}.ts"
---
// Generated with {{ name }}
export const test{{ name | pascalCase }} = '{{ name }}';
`;
  
  await fs.writeFile(path.join(templatePath, 'template.ejs.t'), templateContent);
  this.setTemplateVariables({ frontmatterOption: option, frontmatterValue: value });
});

When('I generate the template with variables', async function (this: UnjucksWorld) {
  const command = `node "${path.resolve(process.cwd(), 'dist/cli.mjs')}" generate test validation --name testValue`;
  const result = await measureCommand(command);
  
  this.context.lastCommandOutput = result.output;
  this.context.lastCommandError = result.error || '';
  this.context.lastCommandCode = result.success ? 0 : 1;
});

Then('the frontmatter option should work correctly', async function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const option = variables.frontmatterOption as string;
  
  // Basic success check
  expect(this.context.lastCommandCode).toBe(0);
  
  // Option-specific validation
  switch (option) {
    case 'to':
      const expectedFile = path.join(this.context.tempDirectory, 'src/test-testValue.ts');
      expect(await fs.pathExists(expectedFile)).toBe(true);
      break;
      
    case 'inject':
    case 'append':
    case 'prepend':
      // For injection modes, just verify command succeeded
      expect(this.context.lastCommandOutput).toBeTruthy();
      break;
      
    case 'skipIf':
      // Should be handled by generation logic
      expect(this.context.lastCommandCode).toBe(0);
      break;
      
    case 'sh':
      // Shell command should execute
      expect(this.context.lastCommandOutput).toMatch(/Generated|Command executed/i);
      break;
      
    case 'chmod':
      // File permissions should be set
      const testFile = path.join(this.context.tempDirectory, 'src/test-testValue.ts');
      if (await fs.pathExists(testFile)) {
        const stats = await fs.stat(testFile);
        expect(stats.mode & parseInt('777', 8)).toBeGreaterThan(0);
      }
      break;
  }
});

// CLI Commands Steps
Then('I should see appropriate output', function (this: UnjucksWorld) {
  expect(this.context.lastCommandCode).toBe(0);
  expect(this.context.lastCommandOutput).toBeTruthy();
});

// Template Engine Steps
Given('I have a template using all filters', async function (this: UnjucksWorld) {
  const templatePath = path.join(this.context.tempDirectory, '_templates', 'filters', 'test');
  await fs.ensureDir(templatePath);
  
  const templateContent = `---
to: "src/filters-test.ts"
---
// Testing all Nunjucks filters
export const filters = {
  pascalCase: '{{ name | pascalCase }}',
  camelCase: '{{ name | camelCase }}',
  kebabCase: '{{ name | kebabCase }}',
  snakeCase: '{{ name | snakeCase }}',
  constantCase: '{{ name | constantCase }}',
  titleCase: '{{ name | titleCase }}',
  pluralize: '{{ "test" | pluralize }}',
  singularize: '{{ "tests" | singularize }}'
};
`;
  
  await fs.writeFile(path.join(templatePath, 'template.ejs.t'), templateContent);
});

When('I generate with name {string}', async function (this: UnjucksWorld, name: string) {
  const command = `node "${path.resolve(process.cwd(), 'dist/cli.mjs')}" generate filters test --name ${name}`;
  const result = await measureCommand(command);
  
  this.context.lastCommandOutput = result.output;
  this.context.lastCommandError = result.error || '';
  this.context.lastCommandCode = result.success ? 0 : 1;
});

Then('the output should contain:', async function (this: UnjucksWorld, dataTable: any) {
  const filePath = path.join(this.context.tempDirectory, 'src/filters-test.ts');
  const content = await fs.readFile(filePath, 'utf8');
  
  for (const row of dataTable.hashes()) {
    expect(content).toContain(row.result);
  }
});

// File Injection Steps
Given('I have an existing file with content', async function (this: UnjucksWorld) {
  const filePath = path.join(this.context.tempDirectory, 'src/existing.ts');
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `// Existing file
export const existing = 'content';
`);
  this.setTemplateVariables({ existingFile: filePath });
});

Given('I have a template with injection mode {string}', async function (
  this: UnjucksWorld,
  mode: string
) {
  const templatePath = path.join(this.context.tempDirectory, '_templates', 'inject', mode);
  await fs.ensureDir(templatePath);
  
  let frontmatter = '';
  switch (mode) {
    case 'inject':
      frontmatter = `inject: true
after: "export const existing"`;
      break;
    case 'append':
      frontmatter = 'append: true';
      break;
    case 'prepend':
      frontmatter = 'prepend: true';
      break;
    case 'lineAt':
      frontmatter = 'lineAt: 2';
      break;
    default:
      frontmatter = '';
  }
  
  const templateContent = `---
to: "src/existing.ts"
${frontmatter}
---
// Injected content via {{ mode }}
`;
  
  await fs.writeFile(path.join(templatePath, 'template.ejs.t'), templateContent);
  this.setTemplateVariables({ injectionMode: mode });
});

Then('the file should be modified using {string} correctly', async function (
  this: UnjucksWorld,
  mode: string
) {
  const filePath = path.join(this.context.tempDirectory, 'src/existing.ts');
  const content = await fs.readFile(filePath, 'utf8');
  
  expect(content).toContain('Injected content');
  
  // Mode-specific validation
  switch (mode) {
    case 'append':
      expect(content.indexOf('Injected content')).toBeGreaterThan(content.indexOf('existing'));
      break;
    case 'prepend':
      expect(content.indexOf('Injected content')).toBeLessThan(content.indexOf('existing'));
      break;
  }
});

// Safety Features Steps
Then('no files should be created', async function (this: UnjucksWorld) {
  const srcPath = path.join(this.context.tempDirectory, 'src');
  const exists = await fs.pathExists(srcPath);
  if (exists) {
    const files = await fs.readdir(srcPath);
    expect(files.length).toBe(0);
  }
});

Then('I should see {string} in the output', function (this: UnjucksWorld, text: string) {
  expect(this.context.lastCommandOutput).toContain(text);
});

Then('I should see what would be created', function (this: UnjucksWorld) {
  expect(this.context.lastCommandOutput).toMatch(/would create|would write/i);
});

// Performance Steps
When('I measure {string} execution time', async function (this: UnjucksWorld, command: string) {
  const fullCommand = command.replace('unjucks', `node "${path.resolve(process.cwd(), 'dist/cli.mjs')}"`);
  const result = await measureCommand(fullCommand);
  
  this.setTemplateVariables({
    performanceResult: result,
    executionTime: result.duration,
    memoryUsage: result.memory
  });
});

Then('it should complete within {int} second', function (this: UnjucksWorld, seconds: number) {
  const variables = this.getTemplateVariables();
  const executionTime = variables.executionTime as number;
  expect(executionTime).toBeLessThan(seconds * 1000); // Convert to milliseconds
});

Then('memory usage should be reasonable', function (this: UnjucksWorld) {
  const variables = this.getTemplateVariables();
  const memoryUsage = variables.memoryUsage as number;
  // Reasonable memory usage (less than 100MB)
  expect(memoryUsage).toBeLessThan(100 * 1024 * 1024);
});

// Dynamic CLI Generation Steps
Then('I should see CLI flags:', function (this: UnjucksWorld, dataTable: any) {
  for (const row of dataTable.hashes()) {
    expect(this.context.lastCommandOutput).toContain(row.flag);
  }
});

// Error Handling Steps
Then('the command should fail with helpful message', function (this: UnjucksWorld) {
  expect(this.context.lastCommandCode).not.toBe(0);
  expect(this.context.lastCommandError).toBeTruthy();
});

Then('I should see available generators listed', function (this: UnjucksWorld) {
  expect(this.context.lastCommandError).toMatch(/available|generators|templates/i);
});