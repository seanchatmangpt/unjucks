/**
 * Unit Tests for UnjucksApp Core
 * 
 * Tests the main application class functionality including initialization,
 * command routing, configuration management, and performance monitoring.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnjucksApp } from '../../../src/core/app.js';
import { CONSTANTS } from '../../../src/utils/constants.js';
import { Logger } from '../../../src/utils/logger.js';
import { PerformanceMonitor } from '../../../src/utils/performance-monitor.js';

// Mock dependencies
vi.mock('../../../src/utils/logger.js');
vi.mock('../../../src/utils/performance-monitor.js');
vi.mock('../../../src/commands/list.js');
vi.mock('../../../src/commands/generate.js');
vi.mock('../../../src/commands/help.js');
vi.mock('../../../src/commands/init.js');
vi.mock('../../../src/commands/version.js');

describe('UnjucksApp', () => {
  let app;
  let mockLogger;
  let mockPerformanceMonitor;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup mock instances
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      level: 'info'
    };
    
    mockPerformanceMonitor = {
      recordOperation: vi.fn(),
      generateReport: vi.fn(() => ({ summary: {} }))
    };
    
    Logger.mockImplementation(() => mockLogger);
    PerformanceMonitor.mockImplementation(() => mockPerformanceMonitor);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with default configuration', () => {
      app = new UnjucksApp();
      
      expect(app.config.name).toBe(CONSTANTS.APP_NAME);
      expect(app.config.version).toBe(CONSTANTS.VERSION);
      expect(app.config.description).toBe(CONSTANTS.DESCRIPTION);
    });

    test('should override defaults with provided options', () => {
      const customOptions = {
        name: 'custom-unjucks',
        version: '2.0.0',
        description: 'Custom description'
      };
      
      app = new UnjucksApp(customOptions);
      
      expect(app.config.name).toBe('custom-unjucks');
      expect(app.config.version).toBe('2.0.0');
      expect(app.config.description).toBe('Custom description');
    });

    test('should initialize logger with correct configuration', () => {
      process.env.DEBUG = 'true';
      app = new UnjucksApp();
      
      expect(Logger).toHaveBeenCalledWith({ level: 'debug' });
      
      delete process.env.DEBUG;
    });

    test('should initialize performance monitor', () => {
      app = new UnjucksApp();
      
      expect(PerformanceMonitor).toHaveBeenCalled();
      expect(app.performanceMonitor).toBeDefined();
    });

    test('should initialize commands', () => {
      app = new UnjucksApp();
      
      expect(app.commands).toBeDefined();
      expect(typeof app.commands).toBe('object');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Commands initialized', 
        expect.objectContaining({ commands: expect.any(Array) })
      );
    });

    test('should log initialization', () => {
      app = new UnjucksApp();
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Unjucks application initialized',
        expect.objectContaining({
          version: CONSTANTS.VERSION,
          commands: expect.any(Number)
        })
      );
    });
  });

  describe('initializeCommands', () => {
    beforeEach(() => {
      app = new UnjucksApp();
    });

    test('should return commands object with all expected commands', () => {
      const commands = app.initializeCommands();
      
      expect(commands).toHaveProperty('list');
      expect(commands).toHaveProperty('generate');
      expect(commands).toHaveProperty('help');
      expect(commands).toHaveProperty('init');
      expect(commands).toHaveProperty('version');
    });

    test('should log command initialization', () => {
      app.initializeCommands();
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Commands initialized',
        expect.objectContaining({ commands: expect.any(Array) })
      );
    });
  });

  describe('createMainCommand', () => {
    beforeEach(() => {
      app = new UnjucksApp();
    });

    test('should create command with correct metadata', () => {
      const command = app.createMainCommand();
      
      expect(command.meta.name).toBe(app.config.name);
      expect(command.meta.version).toBe(app.config.version);
      expect(command.meta.description).toBe(app.config.description);
    });

    test('should include all expected arguments', () => {
      const command = app.createMainCommand();
      
      expect(command.args).toHaveProperty('template');
      expect(command.args).toHaveProperty('action');
    });

    test('should include all expected options', () => {
      const command = app.createMainCommand();
      
      expect(command.options).toHaveProperty('templates-dir');
      expect(command.options).toHaveProperty('output-dir');
      expect(command.options).toHaveProperty('dry');
      expect(command.options).toHaveProperty('force');
      expect(command.options).toHaveProperty('verbose');
      expect(command.options).toHaveProperty('debug');
    });

    test('should have run function', () => {
      const command = app.createMainCommand();
      
      expect(typeof command.run).toBe('function');
    });
  });

  describe('Command execution', () => {
    beforeEach(() => {
      app = new UnjucksApp();
      
      // Mock command implementations
      app.commands.help = {
        execute: vi.fn().mockResolvedValue({ success: true, message: 'Help executed' })
      };
      app.commands.list = {
        execute: vi.fn().mockResolvedValue({ success: true, message: 'List executed' })
      };
    });

    test('should execute help command by default', async () => {
      const command = app.createMainCommand();
      const result = await command.run({ 
        args: {}, 
        options: { verbose: false, debug: false } 
      });
      
      expect(app.commands.help.execute).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    test('should execute specified command', async () => {
      const command = app.createMainCommand();
      const result = await command.run({ 
        args: { action: 'list' }, 
        options: { verbose: false, debug: false } 
      });
      
      expect(app.commands.list.execute).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    test('should handle unknown command', async () => {
      const command = app.createMainCommand();
      const result = await command.run({ 
        args: { action: 'unknown' }, 
        options: { verbose: false, debug: false } 
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command: unknown');
      expect(mockLogger.error).toHaveBeenCalledWith('Unknown command: unknown');
    });

    test('should set debug logging when debug option is true', async () => {
      const command = app.createMainCommand();
      await command.run({ 
        args: { action: 'help' }, 
        options: { debug: true, verbose: false } 
      });
      
      expect(app.logger.level).toBe('debug');
    });

    test('should set info logging when verbose option is true', async () => {
      const command = app.createMainCommand();
      await command.run({ 
        args: { action: 'help' }, 
        options: { verbose: true, debug: false } 
      });
      
      expect(app.logger.level).toBe('info');
    });

    test('should record performance metrics when debug is enabled', async () => {
      const command = app.createMainCommand();
      await command.run({ 
        args: { action: 'help' }, 
        options: { debug: true, verbose: false } 
      });
      
      expect(mockPerformanceMonitor.recordOperation).toHaveBeenCalledWith(
        'help',
        expect.any(Number),
        expect.objectContaining({
          args: expect.any(Object),
          options: expect.any(Object),
          success: true
        })
      );
    });

    test('should log execution details when debug is enabled', async () => {
      const command = app.createMainCommand();
      await command.run({ 
        args: { action: 'help' }, 
        options: { debug: true, verbose: false } 
      });
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Executing command: help',
        expect.objectContaining({
          args: expect.any(Object),
          options: expect.any(Object)
        })
      );
    });

    test('should handle command execution errors', async () => {
      app.commands.help.execute.mockRejectedValue(new Error('Command failed'));
      
      const command = app.createMainCommand();
      const result = await command.run({ 
        args: { action: 'help' }, 
        options: { debug: false, verbose: false } 
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Command failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Command execution failed:',
        expect.objectContaining({
          error: 'Command failed',
          executionTime: expect.any(String)
        })
      );
    });

    test('should include stack trace in debug mode for errors', async () => {
      const error = new Error('Command failed');
      app.commands.help.execute.mockRejectedValue(error);
      
      const command = app.createMainCommand();
      await command.run({ 
        args: { action: 'help' }, 
        options: { debug: true, verbose: false } 
      });
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Command execution failed:',
        expect.objectContaining({
          error: 'Command failed',
          stack: error.stack,
          executionTime: expect.any(String)
        })
      );
    });
  });

  describe('run', () => {
    beforeEach(() => {
      app = new UnjucksApp();
      vi.spyOn(app, 'createMainCommand').mockReturnValue({
        run: vi.fn().mockResolvedValue({ success: true })
      });
    });

    test('should use help command when no arguments provided', async () => {
      await app.run([]);
      
      expect(app.createMainCommand().run).toHaveBeenCalledWith(
        expect.objectContaining({ rawArgs: ['help'] })
      );
    });

    test('should convert single template argument to generate command', async () => {
      await app.run(['component']);
      
      expect(app.createMainCommand().run).toHaveBeenCalledWith(
        expect.objectContaining({ rawArgs: ['generate', 'component'] })
      );
    });

    test('should preserve known commands', async () => {
      await app.run(['list']);
      
      expect(app.createMainCommand().run).toHaveBeenCalledWith(
        expect.objectContaining({ rawArgs: ['list'] })
      );
    });

    test('should handle execution errors', async () => {
      const error = new Error('Execution failed');
      app.createMainCommand().run.mockRejectedValue(error);
      
      await expect(app.run(['help'])).rejects.toThrow('Execution failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Application execution failed:',
        'Execution failed'
      );
    });
  });

  describe('getMemoryUsage', () => {
    beforeEach(() => {
      app = new UnjucksApp();
    });

    test('should return formatted memory usage', () => {
      const memoryUsage = app.getMemoryUsage();
      
      expect(memoryUsage).toHaveProperty('heapUsed');
      expect(memoryUsage).toHaveProperty('heapTotal');
      expect(memoryUsage).toHaveProperty('external');
      expect(memoryUsage).toHaveProperty('rss');
      
      // Check format (should end with 'MB')
      expect(memoryUsage.heapUsed).toMatch(/\d+\.\d{2}MB/);
      expect(memoryUsage.heapTotal).toMatch(/\d+\.\d{2}MB/);
      expect(memoryUsage.external).toMatch(/\d+\.\d{2}MB/);
      expect(memoryUsage.rss).toMatch(/\d+\.\d{2}MB/);
    });
  });

  describe('getPerformanceMetrics', () => {
    beforeEach(() => {
      app = new UnjucksApp();
    });

    test('should return performance metrics from monitor', () => {
      const mockReport = { summary: { operations: 5 } };
      mockPerformanceMonitor.generateReport.mockReturnValue(mockReport);
      
      const metrics = app.getPerformanceMetrics();
      
      expect(metrics).toBe(mockReport);
      expect(mockPerformanceMonitor.generateReport).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    beforeEach(() => {
      app = new UnjucksApp();
    });

    test('should perform graceful shutdown', async () => {
      const mockReport = { summary: { operations: 5 } };
      mockPerformanceMonitor.generateReport.mockReturnValue(mockReport);
      
      await app.shutdown();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down Unjucks application...');
      expect(mockPerformanceMonitor.generateReport).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Final performance metrics:', mockReport);
      expect(mockLogger.info).toHaveBeenCalledWith('Application shutdown complete');
    });

    test('should handle shutdown when performance monitor is not available', async () => {
      app.performanceMonitor = null;
      
      await app.shutdown();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down Unjucks application...');
      expect(mockLogger.info).toHaveBeenCalledWith('Application shutdown complete');
    });
  });

  describe('Integration scenarios', () => {
    test('should handle full application lifecycle', async () => {
      app = new UnjucksApp({
        name: 'test-app',
        version: '1.0.0'
      });
      
      // Mock command execution
      app.commands.list = {
        execute: vi.fn().mockResolvedValue({ success: true, data: [] })
      };
      
      // Run command
      const result = await app.run(['list']);
      
      // Verify execution
      expect(result).toBeDefined();
      expect(app.commands.list.execute).toHaveBeenCalled();
      
      // Shutdown
      await app.shutdown();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Application shutdown complete');
    });

    test('should maintain command isolation', async () => {
      app = new UnjucksApp();
      
      const helpMock = { execute: vi.fn().mockResolvedValue({ success: true }) };
      const listMock = { execute: vi.fn().mockResolvedValue({ success: true }) };
      
      app.commands.help = helpMock;
      app.commands.list = listMock;
      
      // Execute help
      await app.run(['help']);
      expect(helpMock.execute).toHaveBeenCalled();
      expect(listMock.execute).not.toHaveBeenCalled();
      
      // Reset and execute list
      vi.clearAllMocks();
      await app.run(['list']);
      expect(listMock.execute).toHaveBeenCalled();
      expect(helpMock.execute).not.toHaveBeenCalled();
    });
  });
});