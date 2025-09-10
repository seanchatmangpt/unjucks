/**
 * Tests for Hygen-style Argument Parser
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { HygenArgumentParser, HygenStyleArgsSchema, ParsedCommandSchema } from '../../src/cli/parser.js';

describe('HygenArgumentParser', () => {
  let parser;

  beforeEach(() => {
    parser = new HygenArgumentParser();
  });

  describe('Hygen-style parsing', () => {
    test('should parse basic Hygen-style syntax', () => {
      const args = ['component', 'react', 'Button'];
      const result = parser.parse(args);

      expect(result.command).toBe('generate');
      expect(result.subcommand).toBe('hygen-style');
      expect(result.generator).toBe('component');
      expect(result.template).toBe('react');
      expect(result.name).toBe('Button');
      expect(result.flags).toEqual({});
    });

    test('should parse Hygen-style with flags', () => {
      const args = ['component', 'react', 'Button', '--withTests', '--dest=./src'];
      const result = parser.parse(args);

      expect(result.generator).toBe('component');
      expect(result.template).toBe('react');
      expect(result.name).toBe('Button');
      expect(result.flags).toEqual({
        withTests: true,
        dest: './src'
      });
    });

    test('should parse Hygen-style without name', () => {
      const args = ['api', 'endpoint', '--withAuth'];
      const result = parser.parse(args);

      expect(result.generator).toBe('api');
      expect(result.template).toBe('endpoint');
      expect(result.name).toBeNull();
      expect(result.flags).toEqual({ withAuth: true });
    });

    test('should handle mixed positional and flag arguments', () => {
      const args = ['page', 'dashboard', 'AdminPage', '--typescript', '--dest', './src/pages'];
      const result = parser.parse(args);

      expect(result.generator).toBe('page');
      expect(result.template).toBe('dashboard');
      expect(result.name).toBe('AdminPage');
      expect(result.flags).toEqual({
        typescript: true,
        dest: './src/pages'
      });
    });
  });

  describe('Explicit command parsing', () => {
    test('should parse explicit generate command', () => {
      const args = ['generate', 'component', 'react', '--name=Button', '--withTests'];
      const result = parser.parse(args);

      expect(result.command).toBe('generate');
      expect(result.generator).toBe('component');
      expect(result.template).toBe('react');
      expect(result.name).toBe('Button');
      expect(result.flags).toEqual({ withTests: true });
    });

    test('should parse help command with arguments', () => {
      const args = ['help', 'component', 'react'];
      const result = parser.parse(args);

      expect(result.command).toBe('help');
      expect(result.generator).toBe('component');
      expect(result.template).toBe('react');
    });

    test('should parse other commands', () => {
      const args = ['list', '--verbose'];
      const result = parser.parse(args);

      expect(result.command).toBe('list');
      expect(result.flags).toEqual({ verbose: true });
    });
  });

  describe('Flag parsing', () => {
    test('should parse long flags with values', () => {
      const args = ['component', 'react', '--dest=./src', '--force'];
      const result = parser.parse(args);

      expect(result.flags).toEqual({
        dest: './src',
        force: true
      });
    });

    test('should parse short flags', () => {
      const args = ['component', 'react', '-f', '-d', './src'];
      const result = parser.parse(args);

      expect(result.flags).toEqual({
        f: true,
        d: './src'
      });
    });

    test('should handle boolean flags', () => {
      const args = ['component', 'react', '--withTests', '--typescript', '--no-stories'];
      const result = parser.parse(args);

      expect(result.flags).toEqual({
        withTests: true,
        typescript: true,
        'no-stories': true
      });
    });

    test('should parse flags-only arguments', () => {
      const args = ['--help'];
      const result = parser.parse(args);

      expect(result.command).toBe('help');
      expect(result.flags).toEqual({ help: true });
    });

    test('should parse version flag', () => {
      const args = ['--version'];
      const result = parser.parse(args);

      expect(result.command).toBe('version');
      expect(result.flags).toEqual({ version: true });
    });
  });

  describe('Edge cases', () => {
    test('should handle empty arguments', () => {
      const args = [];
      const result = parser.parse(args);

      expect(result.command).toBe('help');
    });

    test('should handle single argument', () => {
      const args = ['component'];
      const result = parser.parse(args);

      expect(result.command).toBe('help');
    });

    test('should handle known commands as first argument', () => {
      const args = ['list'];
      const result = parser.parse(args);

      expect(result.command).toBe('list');
    });

    test('should handle malformed arguments gracefully', () => {
      const args = ['component', '--invalid-only-flags'];
      const result = parser.parse(args);

      // Should still try to parse as Hygen-style
      expect(result.command).toBe('error');
      expect(result.error).toBeDefined();
    });
  });

  describe('Style transformation', () => {
    test('should transform Hygen to explicit style', () => {
      const args = ['component', 'react', 'Button', '--withTests'];
      const transformed = parser.transformStyle(args, 'explicit');

      expect(transformed).toEqual([
        'generate', 'component', 'react', '--name', 'Button', '--withTests'
      ]);
    });

    test('should transform explicit to Hygen style', () => {
      const args = ['generate', 'component', 'react', '--name=Button', '--withTests'];
      const transformed = parser.transformStyle(args, 'hygen');

      expect(transformed).toEqual([
        'component', 'react', 'Button', '--withTests'
      ]);
    });

    test('should return original args if transformation not possible', () => {
      const args = ['help'];
      const transformed = parser.transformStyle(args, 'hygen');

      expect(transformed).toEqual(args);
    });
  });

  describe('Validation', () => {
    test('should validate valid Hygen-style command', () => {
      const parsed = {
        command: 'generate',
        subcommand: 'hygen-style',
        generator: 'component',
        template: 'react',
        name: 'Button',
        flags: {},
        positionalArgs: [],
        originalArgs: ['component', 'react', 'Button']
      };

      const validation = parser.validate(parsed);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    test('should validate missing generator', () => {
      const parsed = {
        command: 'generate',
        generator: null,
        template: 'react',
        name: 'Button'
      };

      const validation = parser.validate(parsed);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Generator is required');
    });

    test('should validate missing template', () => {
      const parsed = {
        command: 'generate',
        generator: 'component',
        template: null,
        name: 'Button'
      };

      const validation = parser.validate(parsed);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Template is required');
    });
  });

  describe('Error handling', () => {
    test('should generate helpful suggestions', () => {
      const suggestion = parser.generateSuggestion(['component']);
      expect(suggestion).toContain('Did you mean');
    });

    test('should suggest list command for empty args', () => {
      const suggestion = parser.generateSuggestion([]);
      expect(suggestion).toContain('unjucks list');
    });
  });

  describe('Rest arguments parsing', () => {
    test('should correctly identify name vs positional args', () => {
      const { name, flags, positionalArgs } = parser.parseRestArgs(['Button', '--withTests', 'extraArg']);

      expect(name).toBe('Button');
      expect(flags).toEqual({ withTests: true });
      expect(positionalArgs).toEqual(['extraArg']);
    });

    test('should handle arguments without name', () => {
      const { name, flags, positionalArgs } = parser.parseRestArgs(['--force', '--dest=./src', 'extra']);

      expect(name).toBeNull();
      expect(flags).toEqual({ force: true, dest: './src' });
      expect(positionalArgs).toEqual(['extra']);
    });

    test('should avoid treating flag-like values as names', () => {
      const { name } = parser.parseRestArgs(['--dest=./src', 'package.json']);

      expect(name).toBe('package.json'); // Not ideal but acceptable for now
    });
  });

  describe('Help text', () => {
    test('should provide help text', () => {
      const helpText = parser.getHelpText();
      expect(helpText).toContain('Hygen-style');
      expect(helpText).toContain('Explicit style');
      expect(helpText).toContain('Examples');
    });
  });
});