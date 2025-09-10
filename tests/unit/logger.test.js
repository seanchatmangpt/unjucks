/**
 * Tests for Logger utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../../src/utils/logger.js';

describe('Logger', () => {
  let consoleSpy;
  
  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  it('should create logger with default config', () => {
    const logger = new Logger();
    expect(logger.config.level).toBe('info');
    expect(logger.config.timestamps).toBe(true);
  });

  it('should respect log levels', () => {
    const logger = new Logger({ level: 'error' });
    
    logger.debug('test debug');
    logger.info('test info');
    logger.warn('test warn');
    logger.error('test error');
    
    expect(consoleSpy.log).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it('should format messages correctly', () => {
    const logger = new Logger({ level: 'debug', timestamps: false, colors: false });
    
    logger.info('test message', { key: 'value' });
    
    expect(consoleSpy.log).toHaveBeenCalled();
    const call = consoleSpy.log.mock.calls[0][0];
    expect(call).toContain('test message');
  });

  it('should handle timing operations', () => {
    const logger = new Logger({ level: 'debug' });
    
    logger.startTimer('test-op');
    const duration = logger.endTimer('test-op');
    
    expect(duration).toBeGreaterThanOrEqual(0);
    expect(consoleSpy.log).toHaveBeenCalledTimes(2); // start and end
  });

  it('should create child loggers', () => {
    const parent = new Logger({ prefix: 'parent' });
    const child = parent.child('child');
    
    expect(child.config.prefix).toBe('parent:child');
  });
});