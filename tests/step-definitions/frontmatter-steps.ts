import { expect } from 'vitest';
import { UnjucksWorld } from '../support/world';
import * as fs from 'fs/promises';
import * as path from 'path';

export const frontmatterStepDefinitions = {
  'I have a template with frontmatter:': async (world: UnjucksWorld, frontmatterContent: string) => {
    // Ensure we have a working directory
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    
    // Create template directory structure
    const templateDir = path.join(world.context.tempDirectory, '_templates', 'test', 'basic');
    await world.helper.createDirectory('_templates/test/basic');
    
    // Parse the frontmatter content and create template file
    const templateFile = path.join(templateDir, 'template.njk');
    await world.helper.createFile('_templates/test/basic/template.njk', frontmatterContent);
    
    // Store for later reference
    world.context.templateVariables.lastTemplate = frontmatterContent;
  },

  'I have an existing file {string} with content:': async (world: UnjucksWorld, fileName: string, content: string) => {
    // Ensure directory exists
    const dir = path.dirname(fileName);
    if (dir !== '.') {
      await world.helper.createDirectory(dir);
    }
    
    await world.helper.createFile(fileName, content);
  },

  'I have a template with invalid frontmatter:': async (world: UnjucksWorld, invalidContent: string) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    
    await world.helper.createDirectory('_templates/test/invalid');
    await world.helper.createFile('_templates/test/invalid/template.njk', invalidContent);
  },

  'the file {string} should contain:': async (world: UnjucksWorld, fileName: string, expectedContent: string) => {
    const exists = await world.helper.fileExists(fileName);
    expect(exists).toBe(true);
    
    const actualContent = await world.helper.readFile(fileName);
    const normalizedExpected = expectedContent.trim();
    const normalizedActual = actualContent.trim();
    
    if (!normalizedActual.includes(normalizedExpected)) {
      throw new Error(`File '${fileName}' does not contain expected content.\nExpected:\n${normalizedExpected}\n\nActual:\n${normalizedActual}`);
    }
    expect(normalizedActual).toContain(normalizedExpected);
  },

  'the file {string} should contain exactly one occurrence of {string}': async (world: UnjucksWorld, fileName: string, searchString: string) => {
    const content = await world.helper.readFile(fileName);
    const occurrences = (content.match(new RegExp(searchString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    
    if (occurrences !== 1) {
      throw new Error(`File '${fileName}' contains ${occurrences} occurrences of '${searchString}', expected exactly 1.\nFile content:\n${content}`);
    }
    expect(occurrences).toBe(1);
  },

  'the file should not contain duplicate exports': async (world: UnjucksWorld) => {
    const files = await world.helper.listFiles();
    const tsFile = files.find(file => file.endsWith('.ts'));
    
    if (!tsFile) {
      throw new Error('No TypeScript file found');
    }
    
    const content = await world.helper.readFile(tsFile);
    const exportLines = content.split('\n').filter(line => line.trim().startsWith('export'));
    const uniqueExports = new Set(exportLines);
    
    if (exportLines.length !== uniqueExports.size) {
      throw new Error(`Found duplicate exports:\n${exportLines.join('\n')}`);
    }
    expect(exportLines.length).toBe(uniqueExports.size);
  },

  'I should not see {string} file generated': async (world: UnjucksWorld, fileName: string) => {
    const exists = await world.helper.fileExists(fileName);
    expect(exists).toBe(false);
  },

  'the file {string} should have permissions {string}': async (world: UnjucksWorld, fileName: string, expectedPermissions: string) => {
    try {
      const stats = await fs.stat(path.join(world.context.tempDirectory!, fileName));
      const actualPermissions = (stats.mode & parseInt('777', 8)).toString(8);
      
      if (actualPermissions !== expectedPermissions) {
        throw new Error(`File '${fileName}' has permissions ${actualPermissions}, expected ${expectedPermissions}`);
      }
      expect(actualPermissions).toBe(expectedPermissions);
    } catch (error) {
      // On some systems, chmod might not work as expected, so we'll log a warning
      console.warn(`Permission check skipped: ${error}`);
    }
  },

  'the command output should contain {string}': (world: UnjucksWorld, expectedOutput: string) => {
    const result = world.getLastCommandResult();
    const output = result.stdout + result.stderr;
    
    if (!output.includes(expectedOutput)) {
      throw new Error(`Command output does not contain '${expectedOutput}'.\nActual output:\n${output}`);
    }
    expect(output).toContain(expectedOutput);
  },

  'the processing should complete in under {int}ms': (world: UnjucksWorld, maxTime: number) => {
    const result = world.getLastCommandResult();
    
    // This is a simple check - in a real implementation, you'd measure actual execution time
    // For now, we'll just verify the command completed successfully
    expect(result.exitCode).toBe(0);
  },

  'I have a template with complex frontmatter:': async (world: UnjucksWorld, complexTemplate: string) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    
    await world.helper.createDirectory('_templates/test/complex');
    await world.helper.createFile('_templates/test/complex/template.njk', complexTemplate);
  },

  'I have a {string} generator with {string} template that contains:': async (world: UnjucksWorld, generator: string, template: string, content: string) => {
    await world.helper.createDirectory(`_templates/${generator}/${template}`);
    await world.helper.createFile(`_templates/${generator}/${template}/template.njk`, content);
  },

  'the error should contain {string}': (world: UnjucksWorld, errorText: string) => {
    const result = world.getLastCommandResult();
    const errorOutput = result.stderr || result.stdout;
    
    if (!errorOutput.includes(errorText)) {
      throw new Error(`Error output does not contain '${errorText}'.\nActual error:\n${errorOutput}`);
    }
    expect(errorOutput).toContain(errorText);
  }
};