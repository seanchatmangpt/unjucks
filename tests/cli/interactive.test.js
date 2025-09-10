/**
 * Tests for Interactive Mode
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { InteractiveMode, InteractiveSessionSchema } from '../../src/cli/interactive.js';

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

// Mock template scanner
vi.mock('../../src/lib/template-scanner.js', () => ({
  TemplateScanner: vi.fn().mockImplementation(() => ({
    getGenerators: vi.fn(),
    getTemplatesForGenerator: vi.fn(),
    getTemplatePath: vi.fn(),
    readTemplate: vi.fn(),
    refresh: vi.fn()
  }))
}));

// Mock frontmatter parser
vi.mock('../../src/lib/frontmatter-parser.js', () => ({
  FrontmatterParser: vi.fn().mockImplementation(() => ({
    parse: vi.fn()
  }))
}));

import inquirer from 'inquirer';
import { TemplateScanner } from '../../src/lib/template-scanner.js';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js';

describe('InteractiveMode', () => {
  let interactive;
  let mockTemplateScanner;
  let mockFrontmatterParser;

  beforeEach(() => {
    interactive = new InteractiveMode();
    mockTemplateScanner = interactive.templateScanner;
    mockFrontmatterParser = interactive.frontmatterParser;
    
    // Setup default mocks
    mockTemplateScanner.getGenerators.mockResolvedValue([
      { name: 'component', templates: ['react', 'vue'] },
      { name: 'page', templates: ['basic', 'dashboard'] }
    ]);
    
    mockTemplateScanner.getTemplatesForGenerator.mockResolvedValue([
      { name: 'react', path: '/templates/component/react' },
      { name: 'vue', path: '/templates/component/vue' }
    ]);
    
    mockFrontmatterParser.parse.mockResolvedValue({
      description: 'React component template',
      variables: {
        withTests: { type: 'boolean', description: 'Include tests' },
        typescript: { type: 'boolean', description: 'Use TypeScript' }
      }
    });
    
    mockTemplateScanner.readTemplate.mockResolvedValue('{{ name }} component content');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session initialization', () => {
    test('should initialize with empty session', () => {
      expect(interactive.session.generator).toBeNull();
      expect(interactive.session.template).toBeNull();
      expect(interactive.session.name).toBeNull();
      expect(interactive.session.flags).toEqual({});
    });

    test('should initialize with provided options', async () => {
      const options = {
        generator: 'component',
        template: 'react'
      };

      interactive.session = { ...interactive.session, ...options };
      
      expect(interactive.session.generator).toBe('component');
      expect(interactive.session.template).toBe('react');
    });
  });

  describe('Generator selection', () => {
    test('should prompt for generator selection', async () => {
      inquirer.prompt.mockResolvedValueOnce({ generator: 'component' });
      
      await interactive.selectGenerator();
      
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'generator',
          message: 'Choose a generator:',
          choices: expect.arrayContaining([
            expect.objectContaining({
              value: 'component'
            })
          ])
        })
      ]);
      
      expect(interactive.session.generator).toBe('component');
    });

    test('should handle refresh option', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({ generator: '__refresh__' })
        .mockResolvedValueOnce({ generator: 'component' });
      
      await interactive.selectGenerator();
      
      expect(mockTemplateScanner.refresh).toHaveBeenCalled();
      expect(interactive.session.generator).toBe('component');
    });

    test('should throw error when no generators found', async () => {
      mockTemplateScanner.getGenerators.mockResolvedValue([]);
      
      await expect(interactive.selectGenerator()).rejects.toThrow(
        'No generators found. Run "unjucks init" to set up templates.'
      );
    });
  });

  describe('Template selection', () => {
    beforeEach(() => {
      interactive.session.generator = 'component';
    });

    test('should prompt for template selection', async () => {
      inquirer.prompt.mockResolvedValueOnce({ template: 'react' });
      
      await interactive.selectTemplate();
      
      expect(mockTemplateScanner.getTemplatesForGenerator).toHaveBeenCalledWith('component');
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'template',
          message: 'Choose a template:',
          choices: expect.arrayContaining([
            expect.objectContaining({
              value: 'react'
            })
          ])
        })
      ]);
      
      expect(interactive.session.template).toBe('react');
    });

    test('should handle back to generator selection', async () => {
      inquirer.prompt.mockResolvedValueOnce({ template: '__back__' });
      vi.spyOn(interactive, 'selectGenerator').mockResolvedValue();
      
      await interactive.selectTemplate();
      
      expect(interactive.session.generator).toBeNull();
      expect(interactive.selectGenerator).toHaveBeenCalled();
    });

    test('should throw error when no templates found', async () => {
      mockTemplateScanner.getTemplatesForGenerator.mockResolvedValue([]);
      
      await expect(interactive.selectTemplate()).rejects.toThrow(
        'No templates found for generator: component'
      );
    });
  });

  describe('Parameter collection', () => {
    beforeEach(() => {
      interactive.session.generator = 'component';
      interactive.session.template = 'react';
      mockTemplateScanner.getTemplatePath.mockResolvedValue('/templates/component/react');
    });

    test('should collect name parameter', async () => {
      inquirer.prompt.mockResolvedValueOnce({ name: 'MyComponent' });
      
      await interactive.collectParameters();
      
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          name: 'name',
          message: 'Enter the component/file name:'
        })
      ]);
      
      expect(interactive.session.name).toBe('MyComponent');
    });

    test('should collect template variables', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({ name: 'MyComponent' })
        .mockResolvedValueOnce({ value: true })  // withTests
        .mockResolvedValueOnce({ value: false }); // typescript
      
      await interactive.collectParameters();
      
      expect(interactive.session.flags).toEqual({
        withTests: true,
        typescript: false
      });
    });

    test('should skip name collection if already provided', async () => {
      interactive.session.name = 'ExistingName';
      
      inquirer.prompt
        .mockResolvedValueOnce({ value: true })  // withTests
        .mockResolvedValueOnce({ value: false }); // typescript
      
      await interactive.collectParameters();
      
      expect(interactive.session.name).toBe('ExistingName');
      // Should not prompt for name
      expect(inquirer.prompt).not.toHaveBeenCalledWith([
        expect.objectContaining({ name: 'name' })
      ]);
    });
  });

  describe('Variable collection', () => {
    test('should collect boolean variable', async () => {
      const config = {
        variables: {
          withTests: {
            type: 'boolean',
            description: 'Include tests',
            default: false
          }
        }
      };
      
      inquirer.prompt.mockResolvedValueOnce({ value: true });
      
      await interactive.collectVariable('withTests', config);
      
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          message: 'Include tests',
          default: false
        })
      ]);
      
      expect(interactive.session.flags.withTests).toBe(true);
    });

    test('should collect choice variable', async () => {
      const config = {
        variables: {
          framework: {
            type: 'choice',
            description: 'Choose framework',
            choices: ['react', 'vue', 'angular']
          }
        }
      };
      
      inquirer.prompt.mockResolvedValueOnce({ value: 'react' });
      
      await interactive.collectVariable('framework', config);
      
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          choices: ['react', 'vue', 'angular']
        })
      ]);
      
      expect(interactive.session.flags.framework).toBe('react');
    });

    test('should collect string variable with validation', async () => {
      const config = {
        variables: {
          description: {
            type: 'string',
            description: 'Component description',
            required: true
          }
        }
      };
      
      inquirer.prompt.mockResolvedValueOnce({ value: 'My component description' });
      
      await interactive.collectVariable('description', config);
      
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          validate: expect.any(Function)
        })
      ]);
      
      expect(interactive.session.flags.description).toBe('My component description');
    });
  });

  describe('Output configuration', () => {
    test('should configure output options', async () => {
      inquirer.prompt.mockResolvedValueOnce({
        dest: './src/components',
        dry: false,
        force: true,
        style: 'hygen'
      });
      
      await interactive.configureOutput();
      
      expect(interactive.session.flags).toEqual(
        expect.objectContaining({
          dest: './src/components',
          dry: false,
          force: true
        })
      );
      
      expect(interactive.session.preferences.style).toBe('hygen');
    });

    test('should use default destination', async () => {
      inquirer.prompt.mockResolvedValueOnce({
        dest: './',
        dry: false,
        force: false,
        style: 'explicit'
      });
      
      await interactive.configureOutput();
      
      expect(interactive.session.flags.dest).toBe('./');
    });
  });

  describe('Preview and confirmation', () => {
    beforeEach(() => {
      interactive.session = {
        generator: 'component',
        template: 'react',
        name: 'MyButton',
        flags: { dest: './src', withTests: true },
        preferences: { style: 'hygen' }
      };
    });

    test('should show preview and get confirmation', async () => {
      inquirer.prompt.mockResolvedValueOnce({ confirmed: true });
      
      const confirmed = await interactive.previewAndConfirm();
      
      expect(confirmed).toBe(true);
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'confirmed',
          message: 'Generate files with these settings?'
        })
      ]);
    });

    test('should return false when not confirmed', async () => {
      inquirer.prompt.mockResolvedValueOnce({ confirmed: false });
      
      const confirmed = await interactive.previewAndConfirm();
      
      expect(confirmed).toBe(false);
    });
  });

  describe('Command building', () => {
    beforeEach(() => {
      interactive.session = {
        generator: 'component',
        template: 'react',
        name: 'MyButton',
        flags: { withTests: true, dest: './src' },
        preferences: { style: 'hygen' }
      };
    });

    test('should build Hygen-style command', () => {
      const command = interactive.buildCommand();
      
      expect(command).toBe('unjucks component react MyButton --withTests=true --dest=./src');
    });

    test('should build explicit command', () => {
      interactive.session.preferences.style = 'explicit';
      
      const command = interactive.buildCommand();
      
      expect(command).toBe('unjucks generate component react --name=MyButton --withTests=true --dest=./src');
    });

    test('should handle boolean flags correctly', () => {
      interactive.session.flags = { withTests: true, force: false, dest: './src' };
      
      const command = interactive.buildCommand();
      
      expect(command).toContain('--withTests');
      expect(command).not.toContain('--force=false');
      expect(command).toContain('--dest=./src');
    });
  });

  describe('Full session flow', () => {
    test('should complete full interactive session', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({ generator: 'component' })
        .mockResolvedValueOnce({ template: 'react' })
        .mockResolvedValueOnce({ name: 'MyComponent' })
        .mockResolvedValueOnce({ value: true })  // withTests
        .mockResolvedValueOnce({ value: false }) // typescript
        .mockResolvedValueOnce({
          dest: './src',
          dry: false,
          force: false,
          style: 'hygen'
        })
        .mockResolvedValueOnce({ confirmed: true });
      
      const result = await interactive.start();
      
      expect(result.success).toBe(true);
      expect(result.session.generator).toBe('component');
      expect(result.session.template).toBe('react');
      expect(result.session.name).toBe('MyComponent');
      expect(result.command).toContain('unjucks component react MyComponent');
    });

    test('should handle session cancellation', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({ generator: 'component' })
        .mockResolvedValueOnce({ template: 'react' })
        .mockResolvedValueOnce({ name: 'MyComponent' })
        .mockResolvedValueOnce({ value: true })
        .mockResolvedValueOnce({ value: false })
        .mockResolvedValueOnce({
          dest: './src',
          dry: false,
          force: false,
          style: 'hygen'
        })
        .mockResolvedValueOnce({ confirmed: false });
      
      const result = await interactive.start();
      
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
    });

    test('should handle errors gracefully', async () => {
      mockTemplateScanner.getGenerators.mockRejectedValue(new Error('Template scan failed'));
      
      const result = await interactive.start();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Template scan failed');
    });
  });

  describe('Quick start mode', () => {
    test('should execute component quick start', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({ name: 'QuickComponent' })
        .mockResolvedValueOnce({ withTests: true, typescript: false });
      
      const result = await interactive.quickStart('component');
      
      expect(result.success).toBe(true);
      expect(result.session.generator).toBe('component');
      expect(result.session.template).toBe('react');
      expect(result.session.name).toBe('QuickComponent');
    });

    test('should throw error for unknown quick start type', async () => {
      await expect(interactive.quickStart('unknown')).rejects.toThrow(
        'Unknown quick start type: unknown'
      );
    });
  });

  describe('Utility methods', () => {
    test('should reset session state', () => {
      interactive.session = {
        generator: 'component',
        template: 'react',
        name: 'MyComponent',
        flags: { withTests: true },
        preferences: { style: 'hygen' }
      };
      
      interactive.reset();
      
      expect(interactive.session.generator).toBeNull();
      expect(interactive.session.template).toBeNull();
      expect(interactive.session.name).toBeNull();
      expect(interactive.session.flags).toEqual({});
    });

    test('should validate session state', () => {
      interactive.session = {
        generator: 'component',
        template: 'react',
        name: 'MyComponent'
      };
      
      const validation = interactive.validate();
      expect(validation.isValid).toBe(true);
    });

    test('should extract variables from template content', async () => {
      mockTemplateScanner.readTemplate.mockResolvedValue(
        'Hello {{ userName }}, welcome to {{ appName }}!'
      );
      
      const variables = await interactive.extractVariables('/template/path');
      
      expect(variables).toEqual(['userName', 'appName']);
    });

    test('should handle variable extraction errors', async () => {
      mockTemplateScanner.readTemplate.mockRejectedValue(new Error('Read failed'));
      
      const variables = await interactive.extractVariables('/template/path');
      
      expect(variables).toEqual([]);
    });
  });

  describe('Schema validation', () => {
    test('should validate interactive session schema', () => {
      const validSession = {
        generator: 'component',
        template: 'react',
        name: 'MyComponent',
        flags: { withTests: true },
        preferences: { style: 'hygen', verbose: true }
      };

      expect(() => InteractiveSessionSchema.parse(validSession)).not.toThrow();
    });

    test('should allow optional fields', () => {
      const minimalSession = {};

      expect(() => InteractiveSessionSchema.parse(minimalSession)).not.toThrow();
    });
  });
});