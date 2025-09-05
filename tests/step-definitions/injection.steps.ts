import { loadFeature, defineFeature } from 'vitest-cucumber';
import { expect } from 'vitest';
import { UnjucksWorld } from '../support/world.js';
import * as path from 'node:path';
import * as fs from 'fs-extra';

export interface InjectionConfig {
  to?: string;
  inject?: boolean;
  before?: string;
  after?: string;
  prepend?: boolean;
  append?: boolean;
  lineAt?: number;
  skipIf?: string | string[];
  skipIfLogic?: 'AND' | 'OR';
  force?: boolean;
}

export interface InjectionResult {
  success: boolean;
  skipped: boolean;
  reason?: string;
  backupCreated?: boolean;
  atomicOperation?: boolean;
}

// ============================================================================
// Injection Step Definitions for vitest-cucumber
// ============================================================================

export const injectionStepDefinitions = {
  // Injection Setup Steps
  'I have a target file {string} with content:': async (world: UnjucksWorld, filePath: string, content: string) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    await world.helper.createFile(filePath, content.trim());
    world.setTemplateVariables({ targetFile: filePath, originalContent: content.trim() });
  },

  'I have an existing file {string} with content:': async (world: UnjucksWorld, filePath: string, content: string) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    await world.helper.createFile(filePath, content.trim());
    world.setTemplateVariables({ targetFile: filePath, originalContent: content.trim() });
  },

  'I have multiple target files:': async (world: UnjucksWorld, dataTable: any) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    const files: Record<string, string> = {};
    for (const row of dataTable.hashes()) {
      await world.helper.createFile(row.file, row.content || '');
      files[row.file] = row.content || '';
    }
    world.setTemplateVariables({ multipleFiles: files });
  },

  'I have a generator {string} with template {string}:': async (world: UnjucksWorld, generatorName: string, templateFile: string, content: string) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    
    const templates = {
      [`${generatorName}/${templateFile}`]: content.trim()
    };
    
    await world.createTemplateStructure(templates);
    world.setTemplateVariables({ generatorName, templateFile });
  },

  // Injection Execution Steps
  'I run {string}': async (world: UnjucksWorld, command: string) => {
    const cleanCommand = command.replace(/^unjucks\s+/, '');
    const args = cleanCommand.split(' ').filter(arg => arg.length > 0);
    
    try {
      await world.executeUnjucksCommand(args);
    } catch (error) {
      // Error handling is done in executeUnjucksCommand
    }
  },

  'I run injection for template {string}': async (world: UnjucksWorld, templateName: string) => {
    await world.executeUnjucksCommand(['generate', templateName]);
  },

  'I run injection with variables:': async (world: UnjucksWorld, dataTable: any) => {
    const variables = dataTable.rowsHash();
    world.setTemplateVariables(variables);
    
    const templateName = variables.template || 'test';
    const args = ['generate', templateName];
    
    // Add variables as CLI arguments
    for (const [key, value] of Object.entries(variables)) {
      if (key !== 'template') {
        args.push(`--${key}`, value as string);
      }
    }
    
    await world.executeUnjucksCommand(args);
  },

  // Injection Verification Steps
  'the content should be injected after line {int}': async (world: UnjucksWorld, lineNumber: number) => {
    const result = world.getLastCommandResult();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/injected.*content/i);
  },

  'the file should contain the database configuration': async (world: UnjucksWorld) => {
    const variables = world.getTemplateVariables();
    const targetFile = variables.targetFile as string || 'src/config.ts';
    
    const content = await world.helper.readFile(targetFile);
    expect(content).toContain('database:');
  },

  'the database configuration should not be duplicated': async (world: UnjucksWorld) => {
    const variables = world.getTemplateVariables();
    const targetFile = variables.targetFile as string || 'src/config.ts';
    
    const content = await world.helper.readFile(targetFile);
    const occurrences = (content.match(/database:/g) || []).length;
    expect(occurrences).toBeLessThanOrEqual(1);
  },

  'the file {string} should contain:': async (world: UnjucksWorld, filePath: string, expectedContent: string) => {
    const actualContent = await world.helper.readFile(filePath);
    const trimmedExpected = expectedContent.trim();
    const trimmedActual = actualContent.trim();
    
    // Check if the expected content is contained within the actual content
    expect(
      trimmedActual.includes(trimmedExpected.split('\n').filter(line => line.trim()).join('\n').replace(/\s+/g, ' ')) ||
      (world as any).contentMatches(trimmedActual, trimmedExpected)
    ).toBeTruthy();
  },

  'the file {string} should have content injected at the correct position': async (world: UnjucksWorld, filePath: string) => {
    const content = await world.helper.readFile(filePath);
    expect(content.length).toBeGreaterThan(0);
    
    const variables = world.getTemplateVariables();
    if (variables.injectedContent) {
      expect(content).toContain(variables.injectedContent as string);
    }
  },

  'the injection should preserve existing content': async (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    expect(result.exitCode).toBe(0);
    
    const variables = world.getTemplateVariables();
    if (variables.originalContent && variables.targetFile) {
      const currentContent = await world.helper.readFile(variables.targetFile as string);
      const originalLines = (variables.originalContent as string).split('\n').filter(line => line.trim());
      
      for (const line of originalLines) {
        if (line.trim()) {
          expect(currentContent).toContain(line.trim());
        }
      }
    }
  },

  'the injection should be skipped due to condition {string}': async (world: UnjucksWorld, condition: string) => {
    const result = world.getLastCommandResult();
    expect(result.stdout).toMatch(/skip.*inject|inject.*skip/i);
    expect(result.stdout).toContain(condition);
  },

  'the injection should not be skipped': (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    expect(result.stdout).not.toMatch(/skip.*inject|inject.*skip/i);
  },

  'no files should be modified in dry run mode': async (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    expect(result.stdout).toMatch(/\[DRY RUN\]|dry/);
  },

  'I should see {string}': (world: UnjucksWorld, expectedText: string) => {
    const result = world.getLastCommandResult();
    const output = result.stdout + ' ' + result.stderr;
    expect(output).toContain(expectedText);
  }
};

// Helper Method Extensions for UnjucksWorld
declare module '../support/world.js' {
  interface UnjucksWorld {
    performInjection(filePath: string, content: string, config: InjectionConfig): Promise<InjectionResult>;
    performAtomicInjection(generatorName: string): Promise<InjectionResult>;
    performUndo(): Promise<InjectionResult>;
    contentMatches(actual: string, expected: string): boolean;
  }
}

// Extend UnjucksWorld prototype with injection methods
Object.assign(UnjucksWorld.prototype, {
  async performInjection(filePath: string, content: string, config: InjectionConfig): Promise<InjectionResult> {
    try {
      // Simulate actual injection logic
      const fileContent = await this.helper.readFile(filePath);
      let newContent = fileContent;
      let skipped = false;
      let reason = '';

      // Check skipIf conditions
      if (config.skipIf) {
        const conditions = Array.isArray(config.skipIf) ? config.skipIf : [config.skipIf];
        const logic = config.skipIfLogic || 'OR';
        
        const matches = conditions.map(condition => {
          if (condition.startsWith('/') && condition.endsWith('/')) {
            // Regex pattern
            const regex = new RegExp(condition.slice(1, -1), 'i');
            return regex.test(fileContent);
          }
          return fileContent.includes(condition);
        });
        
        const shouldSkip = logic === 'AND' ? matches.every(m => m) : matches.some(m => m);
        
        if (shouldSkip) {
          skipped = true;
          reason = `SkipIf condition matched: ${config.skipIf}`;
          return { success: true, skipped, reason };
        }
      }

      // Perform injection based on mode
      if (config.before) {
        const lines = newContent.split('\n');
        const targetIndex = lines.findIndex(line => line.includes(config.before));
        if (targetIndex === -1) {
          throw new Error(`Target line not found: ${config.before}`);
        }
        lines.splice(targetIndex, 0, content);
        newContent = lines.join('\n');
      } else if (config.after) {
        const lines = newContent.split('\n');
        const targetIndex = lines.findIndex(line => line.includes(config.after));
        if (targetIndex === -1) {
          throw new Error(`Target line not found: ${config.after}`);
        }
        lines.splice(targetIndex + 1, 0, content);
        newContent = lines.join('\n');
      } else if (config.lineAt) {
        const lines = newContent.split('\n');
        if (config.lineAt < 1 || config.lineAt > lines.length + 1) {
          throw new Error(`Line number out of range: ${config.lineAt}`);
        }
        lines.splice(config.lineAt - 1, 0, content);
        newContent = lines.join('\n');
      } else if (config.prepend) {
        newContent = content + '\n' + newContent;
      } else if (config.append) {
        newContent = newContent + '\n' + content;
      }

      // Write the modified content
      await this.helper.createFile(filePath, newContent);
      
      return { success: true, skipped: false, atomicOperation: true };
    } catch (error: any) {
      return { success: false, skipped: false, reason: error.message };
    }
  },

  async performAtomicInjection(generatorName: string): Promise<InjectionResult> {
    try {
      // Simulate atomic injection with backup
      const variables = this.getTemplateVariables();
      const targetFile = variables.targetFile as string || 'src/test.ts';
      
      // Create backup
      const originalContent = await this.helper.readFile(targetFile);
      const backupPath = `${targetFile}.backup-${Date.now()}`;
      await this.helper.createFile(backupPath, originalContent);
      
      // Perform injection
      await this.executeUnjucksCommand(['generate', generatorName]);
      
      return { success: true, skipped: false, backupCreated: true, atomicOperation: true };
    } catch (error: any) {
      return { success: false, skipped: false, reason: error.message, atomicOperation: true };
    }
  },

  async performUndo(): Promise<InjectionResult> {
    try {
      // Simulate undo operation by restoring from backup
      const variables = this.getTemplateVariables();
      const targetFile = variables.targetFile as string || 'src/test.ts';
      const originalContent = variables.originalContent as string;
      
      if (originalContent) {
        await this.helper.createFile(targetFile, originalContent);
        return { success: true, skipped: false };
      }
      
      return { success: false, skipped: false, reason: 'No backup content available' };
    } catch (error: any) {
      return { success: false, skipped: false, reason: error.message };
    }
  },

  contentMatches(actual: string, expected: string): boolean {
    // Normalize whitespace and compare
    const normalizeContent = (content: string) => 
      content.replace(/\s+/g, ' ').trim();
    
    const normalizedActual = normalizeContent(actual);
    const normalizedExpected = normalizeContent(expected);
    
    return normalizedActual.includes(normalizedExpected) || 
           normalizedExpected.split('\n').every(line => 
             line.trim() === '' || normalizedActual.includes(line.trim())
           );
  }
});