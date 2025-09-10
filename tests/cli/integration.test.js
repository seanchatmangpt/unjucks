/**
 * Integration Tests for CLI Framework
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { HygenArgumentParser } from '../../src/cli/parser.js';
import { CommandRouter } from '../../src/cli/router.js';
import { InteractiveMode } from '../../src/cli/interactive.js';
import { HelpSystem } from '../../src/cli/help-system.js';

describe('CLI Framework Integration', () => {
  let parser;
  let router;
  let interactive;
  let helpSystem;

  beforeEach(() => {
    parser = new HygenArgumentParser();
    router = new CommandRouter();
    interactive = new InteractiveMode();
    helpSystem = new HelpSystem();
  });

  describe('Parser and Router Integration', () => {
    test('should parse and route Hygen-style commands', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ success: true });
      
      router.register({
        command: 'generate',
        handler: mockHandler,
        description: 'Generate files from templates'
      });

      const result = await router.route(['component', 'react', 'Button']);
      
      expect(result.success).toBe(true);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'generate',
          generator: 'component',
          template: 'react',
          name: 'Button'
        })
      );
    });

    test('should parse and route explicit commands', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ success: true });
      
      router.register({
        command: 'list',
        handler: mockHandler,
        description: 'List available generators'
      });

      const result = await router.route(['list', '--verbose']);
      
      expect(result.success).toBe(true);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'list',
          flags: expect.objectContaining({ verbose: true })
        })
      );
    });
  });

  describe('Help System Integration', () => {
    test('should provide contextual help for partial commands', async () => {
      const help = await helpSystem.showContextualHelp(['component']);
      
      expect(help).toBeDefined();
      expect(typeof help).toBe('string');
    });

    test('should generate help for registered commands', () => {
      helpSystem.register({
        command: 'test',
        description: 'Test command',
        usage: ['test [options]'],
        examples: [{
          command: 'test --verbose',
          description: 'Run with verbose output'
        }]
      });

      const help = helpSystem.generateHelp();
      
      expect(help).toContain('test');
      expect(help).toContain('Test command');
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle parsing errors gracefully', async () => {
      const result = await router.route(['invalid-single-arg']);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should suggest similar commands', async () => {
      router.register({
        command: 'generate',
        handler: vi.fn(),
        description: 'Generate files'
      });

      const result = await router.route(['generat']); // typo
      
      expect(result.success).toBe(false);
      expect(result.suggestion).toBe('generate');
    });
  });

  describe('Flag Processing Integration', () => {
    test('should process complex flag combinations', () => {
      const parsed = parser.parse([
        'component', 'react', 'Button',
        '--withTests',
        '--dest=./src/components',
        '--typescript',
        '--force'
      ]);

      expect(parsed.generator).toBe('component');
      expect(parsed.template).toBe('react');
      expect(parsed.name).toBe('Button');
      expect(parsed.flags).toEqual({
        withTests: true,
        dest: './src/components',
        typescript: true,
        force: true
      });
    });

    test('should handle mixed short and long flags', () => {
      const parsed = parser.parse([
        'api', 'endpoint', 'users',
        '-f',
        '--dest', './src/api',
        '-v'
      ]);

      expect(parsed.generator).toBe('api');
      expect(parsed.template).toBe('endpoint');
      expect(parsed.name).toBe('users');
      expect(parsed.flags).toEqual({
        f: true,
        dest: './src/api',
        v: true
      });
    });
  });

  describe('Command Transformation', () => {
    test('should transform between Hygen and explicit styles', () => {
      const hygenArgs = ['component', 'react', 'Button', '--withTests'];
      const explicitArgs = parser.transformStyle(hygenArgs, 'explicit');
      
      expect(explicitArgs).toEqual([
        'generate', 'component', 'react', '--name', 'Button', '--withTests'
      ]);

      const backToHygen = parser.transformStyle(explicitArgs, 'hygen');
      expect(backToHygen).toEqual([
        'component', 'react', 'Button', '--withTests'
      ]);
    });
  });

  describe('Validation Integration', () => {
    test('should validate complete command structure', () => {
      const parsed = parser.parse(['component', 'react', 'Button']);
      const validation = parser.validate(parsed);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    test('should catch validation errors', () => {
      const parsed = {
        command: 'generate',
        generator: null, // missing
        template: 'react',
        name: 'Button'
      };
      
      const validation = parser.validate(parsed);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Generator is required');
    });
  });

  describe('End-to-End Command Processing', () => {
    test('should handle complete command lifecycle', async () => {
      const mockHandler = vi.fn().mockResolvedValue({
        success: true,
        files: ['src/components/Button.jsx', 'src/components/Button.test.js']
      });

      router.register({
        command: 'generate',
        handler: mockHandler,
        description: 'Generate files from templates',
        flags: {
          withTests: { type: 'boolean', description: 'Include tests' },
          dest: { type: 'string', default: './' }
        }
      });

      const args = ['component', 'react', 'Button', '--withTests', '--dest=./src'];
      const result = await router.route(args);

      expect(result.success).toBe(true);
      expect(result.command).toBe('generate');
      expect(result.parsed.generator).toBe('component');
      expect(result.parsed.template).toBe('react');
      expect(result.parsed.name).toBe('Button');
      expect(result.parsed.flags.withTests).toBe(true);
      expect(result.parsed.flags.dest).toBe('./src');
    });
  });

  describe('Interactive Mode Integration', () => {
    test('should build correct command from session', () => {
      interactive.session = {
        generator: 'component',
        template: 'react',
        name: 'MyButton',
        flags: { withTests: true, dest: './src' },
        preferences: { style: 'hygen' }
      };

      const command = interactive.buildCommand();
      
      expect(command).toContain('unjucks component react MyButton');
      expect(command).toContain('--withTests');
      expect(command).toContain('--dest=./src');
    });

    test('should build explicit style command', () => {
      interactive.session = {
        generator: 'component',
        template: 'react',
        name: 'MyButton',
        flags: { withTests: true },
        preferences: { style: 'explicit' }
      };

      const command = interactive.buildCommand();
      
      expect(command).toContain('unjucks generate component react');
      expect(command).toContain('--name=MyButton');
      expect(command).toContain('--withTests');
    });
  });

  describe('Error Recovery', () => {
    test('should provide helpful error messages', async () => {
      const result = await router.route(['componnt', 'react']); // typo in generator
      
      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
      expect(result.availableCommands).toBeDefined();
    });

    test('should handle malformed arguments', () => {
      const parsed = parser.parse(['--only-flags', '--no-command']);
      
      expect(parsed.command).toBe('unknown');
    });
  });

  describe('Performance and Efficiency', () => {
    test('should handle large flag sets efficiently', () => {
      const manyFlags = [];
      for (let i = 0; i < 50; i++) {
        manyFlags.push(`--flag${i}=value${i}`);
      }

      const args = ['component', 'react', 'Button', ...manyFlags];
      const start = performance.now();
      const parsed = parser.parse(args);
      const end = performance.now();

      expect(end - start).toBeLessThan(10); // Should parse in under 10ms
      expect(parsed.generator).toBe('component');
      expect(Object.keys(parsed.flags)).toHaveLength(50);
    });
  });
});