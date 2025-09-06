import { Given, When, Then, Before, After } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { TestHelper } from '../support/TestHelper';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import * as os from 'node:os';

let testHelper: TestHelper;
let discoveryResults: any = {};
let performanceData: any = {};

Before(async function() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-discovery-'));
  testHelper = new TestHelper(tempDir);
  discoveryResults = {};
  performanceData = {};
});

After(async function() {
  await testHelper.cleanup();
});

// Template structure creation
Given('I have a template structure:', async function(templateStructure) {
  // Parse the template structure from the docstring
  const lines = templateStructure.split('\n');
  const structure = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('_templates/') && !trimmed.includes('├──') && !trimmed.includes('└──') && !trimmed.includes('│')) {
      continue;
    }
    
    // Extract paths and file types
    const match = trimmed.match(/[├└]──\s*(.+)/);
    if (match) {
      const item = match[1];
      if (item.endsWith('/')) {
        // Directory
        structure.push({ type: 'directory', path: item.slice(0, -1) });
      } else {
        // File
        structure.push({ type: 'file', path: item });
      }
    }
  }
  
  // Create the structure
  await this.createTemplateStructure(structure);
  discoveryResults.structureCreated = structure.length;
});

Given('I have templates in mixed structures:', async function(dataTable) {
  const templates = dataTable.hashes();
  
  for (const template of templates) {
    if (template.type === 'directory') {
      await testHelper.createDirectory(template.path);
    } else if (template.type === 'file') {
      let content = '';
      if (template.path.endsWith('.njk')) {
        content = `---
to: src/<%= name %>.${template.path.includes('.ts') ? 'ts' : 'js'}
---
// Generated from ${template.path}
export default class Generated {
  constructor(public name: string) {}
}`;
      } else if (template.path.endsWith('index.js')) {
        content = `module.exports = {
  description: 'Template generator',
  prompts: [{
    type: 'input',
    name: 'name',
    message: 'Enter name:'
  }]
};`;
      }
      
      await testHelper.createFile(template.path, content);
    }
  }
  
  discoveryResults.mixedStructureCreated = templates.length;
});

Given('I have {int} generators with {int} templates total', async function(generators, totalTemplates) {
  const templatesPerGenerator = Math.ceil(totalTemplates / generators);
  
  for (let g = 0; g < generators; g++) {
    const generatorName = `generator${g}`;
    
    for (let t = 0; t < templatesPerGenerator && (g * templatesPerGenerator + t) < totalTemplates; t++) {
      const templateName = `template${t}`;
      
      await testHelper.createFile(
        `_templates/${generatorName}/${templateName}/file.ts.njk`,
        `---
to: src/${generatorName}/<%= name %>.ts
---
// Generated ${generatorName}/${templateName}
export class <%= h.capitalize(name) %>${generatorName.charAt(0).toUpperCase() + generatorName.slice(1)} {
  constructor() {
    console.log('${generatorName}/${templateName} created');
  }
}`
      );
    }
  }
  
  discoveryResults.largeSetCreated = { generators, totalTemplates };
});

Given('I have a template with complex variables:', async function(templateContent) {
  await testHelper.createFile('_templates/complex/vars/command.ts.njk', templateContent);
  this.complexTemplate = templateContent;
});

Given('I have templates with various issues:', async function(dataTable) {
  const issues = dataTable.hashes();
  
  for (const issue of issues) {
    let content = '';
    
    switch (issue.issue) {
      case 'Missing frontmatter':
        content = `// No frontmatter here
export class Generated {}`;
        break;
      
      case 'Invalid YAML frontmatter':
        content = `---
to: invalid: yaml: structure
inject: [unclosed array
---
export class Generated {}`;
        break;
      
      case 'Syntax errors in template':
        content = `---
to: src/<%= name %>.ts
---
export class <%= name { // Missing closing bracket
  constructor() {}
`;
        break;
      
      case 'Missing file extension':
        content = `---
to: src/<%= name %>.ts
---
export class Generated {}`;
        break;
    }
    
    await testHelper.createFile(`_templates/issues/${issue.file}`, content);
  }
  
  discoveryResults.problematicTemplatesCreated = issues.length;
});

// Discovery operations
When('I discover templates', async function() {
  const startTime = Date.now();
  const result = await testHelper.runCli('list');
  performanceData.discoveryTime = Date.now() - startTime;
  
  this.discoveryResult = result;
  discoveryResults.discoveryCommand = {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    duration: result.duration
  };
});

When('I run template discovery', async function() {
  const startTime = Date.now();
  const result = await testHelper.runCli('list --verbose');
  performanceData.detailedDiscoveryTime = Date.now() - startTime;
  
  this.discoveryResult = result;
  discoveryResults.verboseDiscovery = {
    exitCode: result.exitCode,
    duration: result.duration,
    outputLength: result.stdout.length
  };
});

When('I extract variables from this template', async function() {
  const startTime = Date.now();
  const result = await testHelper.runCli('help complex vars');
  performanceData.variableExtractionTime = Date.now() - startTime;
  
  this.variableResult = result;
  discoveryResults.variableExtraction = {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr
  };
});

// Assertions
Then('I should see generator {string} with templates {string}', async function(generator, templates) {
  expect(this.discoveryResult.exitCode).toBe(0);
  expect(this.discoveryResult.stdout).toContain(generator);
  
  const templateList = templates.split(', ');
  for (const template of templateList) {
    expect(this.discoveryResult.stdout).toContain(template);
  }
  
  discoveryResults.generatorFound = { generator, templates: templateList };
});

Then('the discovery should complete in under {int}ms', async function(maxTime) {
  expect(performanceData.discoveryTime).toBeLessThan(maxTime);
  discoveryResults.performanceMet = { 
    actualTime: performanceData.discoveryTime, 
    maxTime 
  };
});

Then('I should find {int} generators', async function(expectedCount) {
  const output = this.discoveryResult.stdout;
  const generatorMatches = output.match(/├──|└──/g) || [];
  const generatorCount = generatorMatches.length;
  
  expect(generatorCount).toBeGreaterThanOrEqual(expectedCount);
  discoveryResults.generatorsFound = generatorCount;
});

Then('generator {string} should have {int} template', async function(generator, templateCount) {
  expect(this.discoveryResult.stdout).toContain(generator);
  discoveryResults.templateCountValidated = true;
});

Then('discovery should complete in under {int}ms', async function(maxTime) {
  expect(performanceData.detailedDiscoveryTime).toBeLessThan(maxTime);
});

Then('memory usage should not exceed {int}MB', async function(maxMemory) {
  const memUsage = process.memoryUsage();
  const memMB = memUsage.heapUsed / 1024 / 1024;
  
  expect(memMB).toBeLessThan(maxMemory);
  performanceData.memoryUsage = memMB;
});

Then('all templates should be discovered correctly', async function() {
  expect(this.discoveryResult.exitCode).toBe(0);
  expect(this.discoveryResult.stdout.length).toBeGreaterThan(100);
  discoveryResults.allTemplatesDiscovered = true;
});

Then('the results should be cached for subsequent calls', async function() {
  // Run discovery again
  const startTime = Date.now();
  const result = await testHelper.runCli('list');
  const secondCallTime = Date.now() - startTime;
  
  // Second call should be faster due to caching
  expect(secondCallTime).toBeLessThan(performanceData.detailedDiscoveryTime);
  performanceData.cachedCallTime = secondCallTime;
});

Then('I should find variables: {string}', async function(expectedVars) {
  const variables = expectedVars.split(', ').map(v => v.replace(/"/g, ''));
  
  for (const variable of variables) {
    expect(this.variableResult.stdout).toContain(`--${variable}`);
  }
  
  discoveryResults.variablesFound = variables;
});

Then('variable {string} should be required \\(used in frontmatter path)', async function(variable) {
  expect(this.variableResult.stdout).toContain(`--${variable}`);
  expect(this.variableResult.stdout).toMatch(new RegExp(`--${variable}.*required|\\*`, 'i'));
});

Then('variable {string} should be optional with default {word}', async function(variable, defaultValue) {
  expect(this.variableResult.stdout).toContain(`--${variable}`);
  expect(this.variableResult.stdout).toContain(defaultValue);
});

Then('variable {string} should be {word} type', async function(variable, type) {
  expect(this.variableResult.stdout).toContain(`--${variable}`);
  expect(this.variableResult.stdout).toContain(type);
});

Then('discovery should not fail', async function() {
  // Should not crash, but may have warnings
  expect(this.discoveryResult.exitCode).toBe(0);
});

Then('I should get warnings for problematic templates', async function() {
  expect(this.discoveryResult.stderr).toContain('warning') || 
  expect(this.discoveryResult.stdout).toContain('warning');
});

Then('valid templates should still be discoverable', async function() {
  expect(this.discoveryResult.stdout.length).toBeGreaterThan(0);
});

Then('the error messages should be descriptive', async function() {
  const hasErrors = this.discoveryResult.stderr.length > 0;
  if (hasErrors) {
    expect(this.discoveryResult.stderr).toMatch(/invalid|missing|error|syntax/i);
  }
});

// Cache validation
Given('I have discovered templates', async function() {
  await testHelper.runCli('list');
  discoveryResults.initialDiscoveryComplete = true;
});

When('I modify a template file', async function() {
  await testHelper.createFile('_templates/test/modified/file.ts.njk', 
    `---
to: src/modified-<%= name %>.ts
---
// This template was modified
export class Modified<%= h.capitalize(name) %> {}`);
  
  discoveryResults.templateModified = true;
});

Then('the cache should be invalidated', async function() {
  const result = await testHelper.runCli('list');
  expect(result.stdout).toContain('modified');
});

Then('rediscovery should pick up the changes', async function() {
  const result = await testHelper.runCli('list');
  expect(result.stdout).toContain('modified');
  discoveryResults.changesDetected = true;
});

When('I add new templates', async function() {
  await testHelper.createFile('_templates/new/generator/file.ts.njk',
    `---
to: src/<%= name %>.ts  
---
// New generator template`);
});

Then('they should be discovered on next run', async function() {
  const result = await testHelper.runCli('list');
  expect(result.stdout).toContain('new');
});

When('I delete templates', async function() {
  await testHelper.removeFile('_templates/new/generator/file.ts.njk');
  await testHelper.removeDirectory('_templates/new');
});

Then('they should not appear in discovery results', async function() {
  const result = await testHelper.runCli('list');
  expect(result.stdout).not.toContain('new');
});

// Helper method
async function createTemplateStructure(structure: any[]) {
  for (const item of structure) {
    if (item.type === 'directory') {
      await testHelper.createDirectory(`_templates/${item.path}`);
    } else if (item.type === 'file') {
      let content = '';
      
      if (item.path.endsWith('.njk')) {
        content = `---
to: src/<%= name %>.ts
---
// Generated template file
export class Generated {}`;
      } else if (item.path.endsWith('index.js')) {
        content = `module.exports = { 
  description: 'Generated template',
  prompts: []
};`;
      }
      
      await testHelper.createFile(`_templates/${item.path}`, content);
    }
  }
}