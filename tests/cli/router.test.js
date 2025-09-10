/**
 * Tests for Command Router
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { CommandRouter, RouteConfigSchema } from '../../src/cli/router.js';

describe('CommandRouter', () => {
  let router;
  let mockHandler;

  beforeEach(() => {
    router = new CommandRouter();
    mockHandler = vi.fn();
  });

  describe('Route registration', () => {
    test('should register valid route configuration', () => {
      const config = {
        command: 'test',
        handler: mockHandler,
        description: 'Test command',
        examples: [{
          command: 'test example',
          description: 'Test example'
        }]
      };

      expect(() => router.register(config)).not.toThrow();
      expect(router.findRoute('test')).toBeDefined();
    });

    test('should register route with aliases', () => {
      const config = {
        command: 'test',
        handler: mockHandler,
        description: 'Test command',
        aliases: ['t', 'testing']
      };

      router.register(config);
      
      expect(router.findRoute('t')).toBeDefined();
      expect(router.findRoute('testing')).toBeDefined();
      expect(router.findRoute('t').command).toBe('test');
    });

    test('should throw error for invalid route configuration', () => {
      const invalidConfig = {
        command: 'test',
        // missing handler
        description: 'Test command'
      };

      expect(() => router.register(invalidConfig)).toThrow();
    });

    test('should validate route flags configuration', () => {
      const config = {
        command: 'test',
        handler: mockHandler,
        description: 'Test command',
        flags: {
          verbose: {
            type: 'boolean',
            description: 'Verbose output',
            default: false
          },
          output: {
            type: 'string',
            description: 'Output file',
            required: true
          }
        }
      };

      expect(() => router.register(config)).not.toThrow();
    });
  });

  describe('Route execution', () => {
    beforeEach(() => {
      router.register({
        command: 'test',
        handler: mockHandler,
        description: 'Test command'
      });
    });

    test('should execute registered command', async () => {
      mockHandler.mockResolvedValue({ success: true });
      
      const result = await router.route(['test']);
      
      expect(mockHandler).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.command).toBe('test');
    });

    test('should pass correct context to handler', async () => {
      mockHandler.mockResolvedValue({ success: true });
      
      await router.route(['test', '--verbose']);
      
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'test',
          flags: expect.objectContaining({ verbose: true }),
          router: expect.any(Object)
        })
      );
    });

    test('should handle Hygen-style arguments', async () => {
      router.register({
        command: 'generate',
        handler: mockHandler,
        description: 'Generate command'
      });
      
      mockHandler.mockResolvedValue({ success: true });
      
      await router.route(['component', 'react', 'Button']);
      
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'generate',
          generator: 'component',
          template: 'react',
          name: 'Button'
        })
      );
    });
  });

  describe('Flag processing', () => {
    test('should process flags according to route configuration', () => {
      const routeFlags = {
        count: { type: 'number', default: 10 },
        force: { type: 'boolean', default: false },
        name: { type: 'string', required: true }
      };

      const inputFlags = {
        count: '25',
        force: true,
        name: 'test'
      };

      const processed = router.processFlags(inputFlags, routeFlags);

      expect(processed.count).toBe(25); // converted to number
      expect(processed.force).toBe(true);
      expect(processed.name).toBe('test');
    });

    test('should apply default values', () => {
      const routeFlags = {
        count: { type: 'number', default: 10 },
        verbose: { type: 'boolean', default: false }
      };

      const processed = router.processFlags({}, routeFlags);

      expect(processed.count).toBe(10);
      expect(processed.verbose).toBe(false);
    });

    test('should throw error for missing required flags', () => {
      const routeFlags = {
        name: { type: 'string', required: true }
      };

      expect(() => router.processFlags({}, routeFlags)).toThrow('Required flag --name is missing');
    });

    test('should preserve additional flags not in route config', () => {
      const routeFlags = {
        name: { type: 'string' }
      };

      const inputFlags = {
        name: 'test',
        extra: 'value'
      };

      const processed = router.processFlags(inputFlags, routeFlags);

      expect(processed.name).toBe('test');
      expect(processed.extra).toBe('value');
    });
  });

  describe('Middleware', () => {
    test('should execute middleware before command', async () => {
      const middleware = vi.fn().mockResolvedValue(true);
      router.use(middleware);
      
      router.register({
        command: 'test',
        handler: mockHandler,
        description: 'Test command'
      });
      
      mockHandler.mockResolvedValue({ success: true });
      
      await router.route(['test']);
      
      expect(middleware).toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalled();
    });

    test('should block command execution if middleware returns false', async () => {
      const middleware = vi.fn().mockResolvedValue(false);
      router.use(middleware);
      
      router.register({
        command: 'test',
        handler: mockHandler,
        description: 'Test command'
      });
      
      const result = await router.route(['test']);
      
      expect(middleware).toHaveBeenCalled();
      expect(mockHandler).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    test('should execute multiple middleware in order', async () => {
      const middleware1 = vi.fn().mockResolvedValue(true);
      const middleware2 = vi.fn().mockResolvedValue(true);
      
      router.use(middleware1);
      router.use(middleware2);
      
      router.register({
        command: 'test',
        handler: mockHandler,
        description: 'Test command'
      });
      
      mockHandler.mockResolvedValue({ success: true });
      
      await router.route(['test']);
      
      expect(middleware1).toHaveBeenCalled();
      expect(middleware2).toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    test('should handle unknown commands', async () => {
      const result = await router.route(['unknown']);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('unknown_command');
      expect(result.message).toContain('Unknown command: unknown');
    });

    test('should suggest similar commands', async () => {
      router.register({
        command: 'generate',
        handler: mockHandler,
        description: 'Generate command'
      });
      
      const result = await router.route(['generete']); // typo
      
      expect(result.suggestion).toBe('generate');
    });

    test('should handle command execution errors', async () => {
      router.register({
        command: 'test',
        handler: mockHandler,
        description: 'Test command'
      });
      
      mockHandler.mockRejectedValue(new Error('Command failed'));
      
      const result = await router.route(['test']);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Command failed');
    });

    test('should execute error handlers', async () => {
      const errorHandler = vi.fn().mockResolvedValue({ 
        success: false, 
        handled: true 
      });
      
      router.onError(errorHandler);
      
      router.register({
        command: 'test',
        handler: mockHandler,
        description: 'Test command'
      });
      
      mockHandler.mockRejectedValue(new Error('Test error'));
      
      const result = await router.route(['test']);
      
      expect(errorHandler).toHaveBeenCalled();
      expect(result.handled).toBe(true);
    });
  });

  describe('Command suggestion', () => {
    beforeEach(() => {
      router.register({
        command: 'generate',
        handler: mockHandler,
        description: 'Generate command'
      });
      
      router.register({
        command: 'list',
        handler: mockHandler,
        description: 'List command'
      });
    });

    test('should suggest commands with small edit distance', () => {
      expect(router.suggestCommand('generete')).toBe('generate');
      expect(router.suggestCommand('generat')).toBe('generate');
      expect(router.suggestCommand('lst')).toBe('list');
    });

    test('should not suggest commands with large edit distance', () => {
      expect(router.suggestCommand('completely-different')).toBeNull();
    });

    test('should calculate Levenshtein distance correctly', () => {
      expect(router.levenshteinDistance('cat', 'bat')).toBe(1);
      expect(router.levenshteinDistance('generate', 'generete')).toBe(2);
      expect(router.levenshteinDistance('same', 'same')).toBe(0);
    });
  });

  describe('Route information', () => {
    test('should get route information', () => {
      const config = {
        command: 'test',
        handler: mockHandler,
        description: 'Test command',
        examples: [{ command: 'test example', description: 'Example' }],
        aliases: ['t']
      };
      
      router.register(config);
      
      const info = router.getRouteInfo('test');
      
      expect(info.command).toBe('test');
      expect(info.description).toBe('Test command');
      expect(info.examples).toHaveLength(1);
      expect(info.aliases).toEqual(['t']);
    });

    test('should return null for unknown route', () => {
      expect(router.getRouteInfo('unknown')).toBeNull();
    });

    test('should generate help text', () => {
      router.register({
        command: 'test',
        handler: mockHandler,
        description: 'Test command'
      });
      
      const help = router.generateHelp();
      
      expect(help).toContain('Available Commands');
      expect(help).toContain('test');
      expect(help).toContain('Test command');
    });
  });

  describe('Schema validation', () => {
    test('should validate route config schema', () => {
      const validConfig = {
        command: 'test',
        handler: () => {},
        description: 'Test command',
        examples: [{
          command: 'test example',
          description: 'Example description'
        }],
        flags: {
          verbose: {
            type: 'boolean',
            description: 'Verbose output'
          }
        }
      };

      expect(() => RouteConfigSchema.parse(validConfig)).not.toThrow();
    });

    test('should reject invalid route config', () => {
      const invalidConfig = {
        command: 'test',
        // missing handler and description
        examples: 'not an array'
      };

      expect(() => RouteConfigSchema.parse(invalidConfig)).toThrow();
    });
  });
});