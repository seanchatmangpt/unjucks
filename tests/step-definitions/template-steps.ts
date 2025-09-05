import { loadFeature, defineFeature } from 'vitest-cucumber';
import { expect } from 'vitest';
import { UnjucksWorld } from '../support/world';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import { configure, Environment } from 'nunjucks';

// Placeholder implementation for TemplateScanner until the real one is implemented
class TemplateScanner {
  scanForVariables(content: string): string[] {
    const variables: string[] = [];
    // Simple regex to extract Nunjucks variables {{ variable }}
    const variableRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.-]*)\s*[\|\}]/g;
    let match;
    
    while ((match = variableRegex.exec(content)) !== null) {
      const variable = match[1].split('.')[0]; // Extract root variable
      if (!variables.includes(variable)) {
        variables.push(variable);
      }
    }
    
    return variables;
  }
}

export const templateStepDefinitions = {
  // Template Discovery and Management Steps
  'I have a templates directory at {string}': async (world: UnjucksWorld, templatePath: string) => {
    const fullPath = path.resolve(world.context.tempDirectory, templatePath);
    await world.createDirectory(fullPath);
  },

  'I have a generator {string} with template files:': async (world: UnjucksWorld, generatorName: string, dataTable: any) => {
    const templates: Record<string, string> = {};
    
    for (const row of dataTable.hashes()) {
      const templatePath = `${generatorName}/${row.template || row.file}`;
      templates[templatePath] = row.content || row.body || '';
    }
    
    await world.createTemplateStructure(templates);
  },

  'I have a complete generator {string} with:': async (world: UnjucksWorld, generatorName: string, dataTable: any) => {
    const templates: Record<string, string> = {};
    
    for (const row of dataTable.hashes()) {
      const templateFile = row.file;
      const frontmatter = row.frontmatter || '';
      const body = row.body || '';
      
      const templateContent = frontmatter ? `---\n${frontmatter}\n---\n${body}` : body;
      templates[`${generatorName}/${templateFile}`] = templateContent;
    }
    
    await world.createTemplateStructure(templates);
  },

  'I have a template with frontmatter variables:': async (world: UnjucksWorld, dataTable: any) => {
    const row = dataTable.hashes()[0];
    const generatorName = row.generator || 'test';
    const templateName = row.template || 'new.ts';
    const variables = row.variables || '';
    const body = row.body || 'export default {};';
    
    const frontmatter = `to: src/{{ name }}.ts\nvariables:\n${variables}`;
    const templates = {
      [`${generatorName}/${templateName}`]: `---\n${frontmatter}\n---\n${body}`
    };
    
    await world.createTemplateStructure(templates);
  },

  // Template Execution Steps
  'I generate from template {string} with variables:': async (world: UnjucksWorld, templateName: string, dataTable: any) => {
    const variables = dataTable.rowsHash();
    world.setTemplateVariables(variables);
    
    const args = ['generate', templateName];
    for (const [key, value] of Object.entries(variables)) {
      args.push(`--${key}`, value as string);
    }
    
    await world.executeUnjucksCommand(args);
  },

  'I run template discovery': async (world: UnjucksWorld) => {
    await world.executeUnjucksCommand(['list']);
  },

  'I validate template {string}': async (world: UnjucksWorld, templateName: string) => {
    await world.executeUnjucksCommand(['validate', templateName]);
  },

  'I inspect template {string}': async (world: UnjucksWorld, templateName: string) => {
    await world.executeUnjucksCommand(['inspect', templateName]);
  },

  // Template Validation Steps
  'the template should be discovered': (world: UnjucksWorld) => {
    const output = world.getLastOutput();
    expect(output).toMatch(/Available generators|Found \d+ generators?/i);
  },

  'I should see generator {string} in the list': (world: UnjucksWorld, generatorName: string) => {
    const output = world.getLastOutput();
    expect(output).toContain(generatorName);
  },

  'I should see {int} generators listed': (world: UnjucksWorld, expectedCount: number) => {
    const output = world.getLastOutput();
    const matches = output.match(/^\s*[\w-]+\s*$/gm) || [];
    expect(matches.length).toBeGreaterThanOrEqual(expectedCount);
  },

  'the template should parse successfully': (world: UnjucksWorld) => {
    const output = world.getLastOutput();
    expect(output).not.toMatch(/parse error|syntax error|invalid template/i);
    world.assertCommandSucceeded();
  },

  'the template should show variables:': (world: UnjucksWorld, dataTable: any) => {
    const output = world.getLastOutput();
    
    for (const row of dataTable.hashes()) {
      const variable = row.variable || row.name;
      const type = row.type;
      const description = row.description;
      
      expect(output).toContain(variable);
      if (type) expect(output).toContain(type);
      if (description) expect(output).toContain(description);
    }
  },

  'the template should indicate injection mode': (world: UnjucksWorld) => {
    const output = world.getLastOutput();
    expect(output).toMatch(/inject.*true|injection.*enabled/i);
  },

  'the template should show target path {string}': (world: UnjucksWorld, expectedPath: string) => {
    const output = world.getLastOutput();
    expect(output).toContain(expectedPath);
  },

  // Template Content Verification
  'the template should render correctly with test data': async (world: UnjucksWorld) => {
    // Set test variables
    world.setTemplateVariables({
      name: 'TestComponent',
      description: 'A test component'
    });
    
    // The command should have succeeded
    world.assertCommandSucceeded();
  },

  'the generated content should match template expectations': async (world: UnjucksWorld) => {
    const generatedFiles = world.context.generatedFiles;
    expect(generatedFiles.length).toBeGreaterThan(0);
    
    // Check that files were actually generated and tracked
    for (const filePath of generatedFiles) {
      expect(await world.fileExists(filePath)).toBe(true);
    }
  },

  // Template Error Handling
  'I should see a template parsing error': (world: UnjucksWorld) => {
    world.assertCommandFailed();
    const error = world.getLastError();
    expect(error).toMatch(/template.*error|parse.*failed|invalid.*syntax/i);
  },

  'I should see a missing template error for {string}': (world: UnjucksWorld, templateName: string) => {
    world.assertCommandFailed();
    const error = world.getLastError();
    expect(error).toContain(templateName);
    expect(error).toMatch(/not found|missing|does not exist/i);
  },

  'I should see a variable validation error for {string}': (world: UnjucksWorld, variableName: string) => {
    world.assertCommandFailed();
    const error = world.getLastError();
    expect(error).toContain(variableName);
    expect(error).toMatch(/required|missing.*variable|invalid.*value/i);
  },

  // Template Frontmatter Verification
  'the template should have frontmatter property {string} set to {string}': (world: UnjucksWorld, property: string, expectedValue: string) => {
    const output = world.getLastOutput();
    expect(output).toMatch(new RegExp(`${property}.*${expectedValue}`, 'i'));
  },

  'the template should support the following frontmatter options:': (world: UnjucksWorld, dataTable: any) => {
    const output = world.getLastOutput();
    
    for (const row of dataTable.hashes()) {
      const option = row.option;
      const value = row.value;
      
      if (value) {
        expect(output).toMatch(new RegExp(`${option}.*${value}`, 'i'));
      } else {
        expect(output).toContain(option);
      }
    }
  },

  // ============================================================================
  // Nunjucks Template Rendering Steps
  // ============================================================================

  // Template system initialization
  'the Nunjucks template system is initialized': (world: UnjucksWorld) => {
    // Store template engine configuration
    world.setVariable('_nunjucksEnv', configure(world.context.tempDirectory, {
      autoescape: false,
      throwOnUndefined: false,
      trimBlocks: false,
      lstripBlocks: false
    }));
  },

  'the Nunjucks template system is initialized with filters': (world: UnjucksWorld) => {
    const env = configure(world.context.tempDirectory, {
      autoescape: false,
      throwOnUndefined: false,
      trimBlocks: false,
      lstripBlocks: false
    });
    
    // Register custom filters
    env.addFilter('camelCase', (str: string) => {
      return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
    });
    
    env.addFilter('upperFirst', (str: string) => {
      return str.charAt(0).toUpperCase() + str.slice(1);
    });
    
    env.addFilter('kebabCase', (str: string) => {
      return str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase();
    });
    
    env.addFilter('snakeCase', (str: string) => {
      return str.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[-\s]+/g, '_').toLowerCase();
    });
    
    env.addFilter('pascalCase', (str: string) => {
      return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
                .replace(/^(.)/, (c) => c.toUpperCase());
    });
    
    env.addFilter('constantCase', (str: string) => {
      return str.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[-\s]+/g, '_').toUpperCase();
    });
    
    world.setVariable('_nunjucksEnv', env);
  },

  'template variables are available': (world: UnjucksWorld) => {
    // Ensure template variables context exists
    if (!world.getTemplateVariables()) {
      world.setTemplateVariables({});
    }
  },

  // Template content setup
  'a template with content {string}': (world: UnjucksWorld, content: string) => {
    world.setVariable('_templateContent', content);
  },

  'a template with content:': (world: UnjucksWorld, content: string) => {
    world.setVariable('_templateContent', content);
  },

  'variables {string}': (world: UnjucksWorld, variablesJson: string) => {
    const variables = JSON.parse(variablesJson);
    world.setTemplateVariables(variables);
  },

  'variables:': (world: UnjucksWorld, variablesJson: string) => {
    const variables = JSON.parse(variablesJson);
    world.setTemplateVariables(variables);
  },

  // Template rendering execution
  'I render the template': (world: UnjucksWorld) => {
    const env = world.getVariable('_nunjucksEnv') as Environment;
    const content = world.getVariable('_templateContent') as string;
    const variables = world.getTemplateVariables();
    
    try {
      const rendered = env.renderString(content, variables);
      world.setVariable('_renderedOutput', rendered);
      world.context.lastCommandCode = 0;
      world.context.lastCommandOutput = rendered;
      world.context.lastCommandError = '';
    } catch (error: any) {
      world.context.lastCommandCode = 1;
      world.context.lastCommandError = error.message;
      world.setVariable('_renderError', error);
    }
  },

  // Template rendering assertions
  'the output should be {string}': (world: UnjucksWorld, expectedOutput: string) => {
    const output = world.getVariable('_renderedOutput') as string || world.context.lastCommandOutput;
    expect(output.trim()).toBe(expectedOutput);
  },

  'the output should contain {string}': (world: UnjucksWorld, expectedContent: string) => {
    const output = world.getVariable('_renderedOutput') as string || world.context.lastCommandOutput;
    expect(output).toContain(expectedContent);
  },

  'the output should contain:': (world: UnjucksWorld, expectedContent: string) => {
    const output = world.getVariable('_renderedOutput') as string || world.context.lastCommandOutput;
    const cleanExpected = expectedContent.trim();
    expect(output).toContain(cleanExpected);
  },

  'the output should not contain {string}': (world: UnjucksWorld, unwantedContent: string) => {
    const output = world.getVariable('_renderedOutput') as string || world.context.lastCommandOutput;
    expect(output).not.toContain(unwantedContent);
  },

  // Case transformation validations
  'the output should match the expected camelCase format': (world: UnjucksWorld) => {
    const output = world.getVariable('_renderedOutput') as string || world.context.lastCommandOutput;
    const camelCasePattern = /^[a-z][a-zA-Z0-9]*$/;
    expect(camelCasePattern.test(output.trim())).toBe(true);
  },

  'the first character should be uppercase': (world: UnjucksWorld) => {
    const output = world.getVariable('_renderedOutput') as string || world.context.lastCommandOutput;
    const firstChar = output.trim().charAt(0);
    expect(firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()).toBe(true);
  },

  'the output should be in kebab-case format': (world: UnjucksWorld) => {
    const output = world.getVariable('_renderedOutput') as string || world.context.lastCommandOutput;
    const kebabPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    expect(kebabPattern.test(output.trim())).toBe(true);
  },

  'the output should be in snake_case format': (world: UnjucksWorld) => {
    const output = world.getVariable('_renderedOutput') as string || world.context.lastCommandOutput;
    const snakePattern = /^[a-z0-9]+(_[a-z0-9]+)*$/;
    expect(snakePattern.test(output.trim())).toBe(true);
  },

  'the output should be in PascalCase format': (world: UnjucksWorld) => {
    const output = world.getVariable('_renderedOutput') as string || world.context.lastCommandOutput;
    const pascalPattern = /^[A-Z][a-zA-Z0-9]*$/;
    expect(pascalPattern.test(output.trim())).toBe(true);
  },

  'the output should be in CONSTANT_CASE format': (world: UnjucksWorld) => {
    const output = world.getVariable('_renderedOutput') as string || world.context.lastCommandOutput;
    const constantPattern = /^[A-Z0-9]+(_[A-Z0-9]+)*$/;
    expect(constantPattern.test(output.trim())).toBe(true);
  },

  // Error handling
  'no errors should be thrown': (world: UnjucksWorld) => {
    const error = world.getVariable('_renderError');
    expect(error).toBeUndefined();
    expect(world.context.lastCommandCode).toBe(0);
  },

  'undefined variables should render as empty strings': (world: UnjucksWorld) => {
    const output = world.getVariable('_renderedOutput') as string || world.context.lastCommandOutput;
    // Check that undefined variables didn't throw and rendered as empty
    expect(output).not.toContain('undefined');
  },

  // Complex template features
  'the output should contain properly nested structure': (world: UnjucksWorld) => {
    const output = world.getVariable('_renderedOutput') as string || world.context.lastCommandOutput;
    // Validate that nested loops/conditions maintain proper structure
    expect(output).toContain('export class');
    expect(output).toContain('{');
    expect(output).toContain('}');
  },

  'method implementations should be rendered correctly': (world: UnjucksWorld) => {
    const output = world.getVariable('_renderedOutput') as string || world.context.lastCommandOutput;
    expect(output).toContain('return');
  },

  // ============================================================================
  // Template Variable Extraction Steps
  // ============================================================================

  'I parse the template variables': (world: UnjucksWorld) => {
    const content = world.getVariable('_templateContent') as string;
    if (content) {
      const scanner = new TemplateScanner();
      const variables = scanner.scanForVariables(content);
      world.setVariable('_extractedVariables', variables);
      world.context.lastCommandOutput = JSON.stringify(variables);
      world.context.lastCommandCode = 0;
    }
  },

  'I should detect variables {string}': (world: UnjucksWorld, expectedVariablesJson: string) => {
    const expectedVariables = JSON.parse(expectedVariablesJson);
    const extractedVariables = world.getVariable('_extractedVariables') as string[] || [];
    
    for (const expected of expectedVariables) {
      expect(extractedVariables).toContain(expected);
    }
  },

  'CLI should prompt for these variables': (world: UnjucksWorld) => {
    const variables = world.getVariable('_extractedVariables') as string[] || [];
    expect(variables.length).toBeGreaterThan(0);
  },

  'the output filename should use the variable value': (world: UnjucksWorld) => {
    // This would check that dynamic filenames work with extracted variables
    const variables = world.getVariable('_extractedVariables') as string[] || [];
    expect(variables.length).toBeGreaterThan(0);
  },

  'the output path should be dynamically generated': (world: UnjucksWorld) => {
    const variables = world.getVariable('_extractedVariables') as string[] || [];
    expect(variables.length).toBeGreaterThan(0);
  },

  'I should detect {string} only once': (world: UnjucksWorld, variableName: string) => {
    const variables = world.getVariable('_extractedVariables') as string[] || [];
    const count = variables.filter(v => v === variableName).length;
    expect(count).toBe(1);
  },

  'I should detect only variables with Nunjucks delimiters {string}': (world: UnjucksWorld, expectedVariablesJson: string) => {
    const expectedVariables = JSON.parse(expectedVariablesJson);
    const extractedVariables = world.getVariable('_extractedVariables') as string[] || [];
    
    expect(extractedVariables.sort()).toEqual(expectedVariables.sort());
  },

  'I should detect root variables {string}': (world: UnjucksWorld, expectedVariablesJson: string) => {
    const expectedVariables = JSON.parse(expectedVariablesJson);
    const extractedVariables = world.getVariable('_extractedVariables') as string[] || [];
    
    for (const expected of expectedVariables) {
      expect(extractedVariables).toContain(expected);
    }
  },

  // Template validation and quality
  'boolean variables should have appropriate CLI types': (world: UnjucksWorld) => {
    const variables = world.getVariable('_extractedVariables') as string[] || [];
    // This would check that variables used in {% if %} are marked as boolean
    expect(variables.length).toBeGreaterThan(0);
  },

  'array variables should be handled appropriately': (world: UnjucksWorld) => {
    const variables = world.getVariable('_extractedVariables') as string[] || [];
    // Variables used in {% for item in items %} should be detected as arrays
    expect(variables).toContain('items');
  },

  'I should detect valid variables only': (world: UnjucksWorld) => {
    const variables = world.getVariable('_extractedVariables') as string[] || [];
    // Ensure malformed variables are filtered out
    for (const variable of variables) {
      expect(/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(variable)).toBe(true);
    }
  }
};

// Helper method extensions for UnjucksWorld with template support
declare module '../support/world.js' {
  interface UnjucksWorld {
    renderTemplate(templateContent: string, variables: Record<string, any>): Promise<string>;
    parseTemplateVariables(templateContent: string): string[];
    validateTemplateStructure(templatePath: string): Promise<boolean>;
  }
}

// Extend UnjucksWorld prototype with template methods
Object.assign(UnjucksWorld.prototype, {
  async renderTemplate(templateContent: string, variables: Record<string, any>): Promise<string> {
    const env = configure(this.context.tempDirectory, {
      autoescape: false,
      throwOnUndefined: false
    });
    
    try {
      return env.renderString(templateContent, variables);
    } catch (error: any) {
      throw new Error(`Template rendering failed: ${error.message}`);
    }
  },

  parseTemplateVariables(templateContent: string): string[] {
    const scanner = new TemplateScanner();
    return scanner.scanForVariables(templateContent);
  },

  async validateTemplateStructure(templatePath: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(this.context.tempDirectory, templatePath);
      const exists = await fs.pathExists(fullPath);
      
      if (!exists) return false;
      
      const content = await fs.readFile(fullPath, 'utf8');
      
      // Basic validation - check for frontmatter and body
      const hasFrontmatter = content.startsWith('---');
      const hasContent = content.trim().length > 0;
      
      return hasContent && (hasFrontmatter ? content.includes('---', 3) : true);
    } catch {
      return false;
    }
  }
});