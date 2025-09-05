/**
 * Template Step Definitions for Vitest-Cucumber
 * Modular step definitions for template and generator operations
 */
import { expect } from 'vitest';
import type { TestContext } from '../test-context.js';

export const createTemplateSteps = (context: TestContext) => ({
  /**
   * Create a templates directory structure
   */
  'I have a templates directory at "([^"]*)"': async (templatePath: string) => {
    await context.helper.createDirectory(templatePath);
    context.templatePaths.push(templatePath);
  },

  /**
   * Create a generator with files
   */
  'I have a generator "([^"]*)" with files:': async (generatorName: string, fileTable: string) => {
    const templates: Record<string, string> = {};
    const lines = fileTable.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const [filePath, ...contentParts] = line.split('|').map(part => part.trim());
      const content = contentParts.join('|') || '';
      templates[`${generatorName}/${filePath}`] = content;
    }
    
    await context.helper.createTemplateStructure(templates);
  },

  /**
   * Create a simple generator structure
   */
  'I have a generator "([^"]*)" with:': async (generatorName: string, structure: string) => {
    const items = [];
    const lines = structure.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- file:')) {
        const filePath = trimmed.replace('- file:', '').trim();
        items.push({
          type: 'file' as const,
          path: `${generatorName}/${filePath}`,
          content: ''
        });
      } else if (trimmed.startsWith('- directory:')) {
        const dirPath = trimmed.replace('- directory:', '').trim();
        items.push({
          type: 'directory' as const,
          path: `${generatorName}/${dirPath}`
        });
      }
    }
    
    await context.helper.createStructuredTemplates(items);
  },

  /**
   * Create template with frontmatter
   */
  'I have a template "([^"]*)" with frontmatter:': async (templatePath: string, frontmatter: string, content?: string) => {
    const items = [{
      type: 'file' as const,
      path: templatePath,
      content: content || '',
      frontmatter: frontmatter
    }];
    
    await context.helper.createStructuredTemplates(items);
  },

  /**
   * Run unjucks list command
   */
  'I run unjucks list': async () => {
    context.lastResult = await context.helper.runCli('list');
  },

  /**
   * Run unjucks help command
   */
  'I run unjucks help for "([^"]*)"': async (generatorName: string) => {
    context.lastResult = await context.helper.runCli(`help ${generatorName}`);
  },

  /**
   * Run unjucks generate command
   */
  'I run unjucks generate "([^"]*)"': async (generatorName: string) => {
    context.lastResult = await context.helper.runCli(`generate ${generatorName}`);
  },

  /**
   * Run unjucks generate with variables
   */
  'I run unjucks generate "([^"]*)" with variables:': async (generatorName: string, variablesTable: string) => {
    const variables = [];
    const lines = variablesTable.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const [key, value] = line.split('=').map(part => part.trim());
      if (key && value) {
        variables.push(`--${key}`, value);
      }
    }
    
    const command = `generate ${generatorName} ${variables.join(' ')}`;
    context.lastResult = await context.helper.runCli(command);
  },

  /**
   * Check generator is listed in output
   */
  'the output should list generator "([^"]*)"': (generatorName: string) => {
    const output = context.lastResult?.stdout || '';
    expect(output).toContain(generatorName);
  },

  /**
   * Check help shows variables
   */
  'the help should show variables:': (expectedVariables: string) => {
    const output = context.lastResult?.stdout || '';
    const variables = expectedVariables.split('\n').map(v => v.trim()).filter(v => v);
    
    for (const variable of variables) {
      expect(output).toContain(variable);
    }
  },

  /**
   * Check files were generated
   */
  'the following files should be generated:': async (expectedFiles: string) => {
    const files = expectedFiles.split('\n').map(f => f.trim()).filter(f => f);
    
    for (const file of files) {
      const exists = await context.helper.fileExists(file);
      expect(exists).toBe(true);
      context.generatedFiles.push(file);
    }
  },

  /**
   * Check generated file contains content
   */
  'the generated file "([^"]*)" should contain "([^"]*)"': async (filePath: string, expectedText: string) => {
    await context.helper.verifyFileExists(filePath);
    const content = await context.helper.readFile(filePath);
    expect(content).toContain(expectedText);
  },

  /**
   * Check template variables were substituted
   */
  'the generated file "([^"]*)" should have "([^"]*)" substituted with "([^"]*)"': async (filePath: string, variable: string, value: string) => {
    await context.helper.verifyFileExists(filePath);
    const content = await context.helper.readFile(filePath);
    expect(content).toContain(value);
    expect(content).not.toContain(`{{${variable}}}`);
  },

  /**
   * Check dry run mode
   */
  'I run unjucks generate "([^"]*)" with --dry': async (generatorName: string) => {
    context.lastResult = await context.helper.runCli(`generate ${generatorName} --dry`);
  },

  /**
   * Check force mode
   */
  'I run unjucks generate "([^"]*)" with --force': async (generatorName: string) => {
    context.lastResult = await context.helper.runCli(`generate ${generatorName} --force`);
  },

  /**
   * Check destination directory
   */
  'I run unjucks generate "([^"]*)" with --dest "([^"]*)"': async (generatorName: string, destPath: string) => {
    context.lastResult = await context.helper.runCli(`generate ${generatorName} --dest ${destPath}`);
  }
});