/**
 * Unjucks Logger Utility
 * 
 * High-performance logging system with structured output,
 * multiple levels, and performance tracking integration.
 */

import { performance } from 'perf_hooks';
import chalk from 'chalk';
import { CONSTANTS } from './constants.js';

/**
 * Advanced logging utility with structured output and performance tracking
 * 
 * @class Logger
 */
export class Logger {
  /**
   * Initialize the logger with configuration options
   * @param {Object} options - Logger configuration
   * @param {string} [options.level='info'] - Logging level
   * @param {boolean} [options.timestamps=true] - Include timestamps
   * @param {boolean} [options.colors=true] - Use colored output
   * @param {string} [options.prefix=''] - Log message prefix
   */
  constructor(options = {}) {
    this.config = {
      level: options.level || CONSTANTS.DEFAULT_LOG_LEVEL,
      timestamps: options.timestamps !== false,
      colors: options.colors !== false && process.stdout.isTTY,
      prefix: options.prefix || '',
      ...options
    };

    // Set up log levels hierarchy
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    this.currentLevel = this.levels[this.config.level] || this.levels.info;
    
    // Performance tracking
    this.startTimes = new Map();
  }

  /**
   * Check if a log level should be output
   * @param {string} level - Log level to check
   * @returns {boolean} Whether to output this level
   */
  shouldLog(level) {
    return this.levels[level] >= this.currentLevel;
  }

  /**
   * Format a log message with timestamp, level, and colors
   * @param {string} level - Log level
   * @param {string} message - Main message
   * @param {Object} [data] - Additional structured data
   * @returns {string} Formatted log message
   */
  formatMessage(level, message, data = {}) {
    const parts = [];

    // Add timestamp if enabled
    if (this.config.timestamps) {
      const timestamp = new Date().toISOString();
      parts.push(this.config.colors ? chalk.gray(timestamp) : timestamp);
    }

    // Add level indicator
    const levelIndicator = this.getLevelIndicator(level);
    parts.push(levelIndicator);

    // Add prefix if configured
    if (this.config.prefix) {
      const prefix = this.config.colors ? chalk.cyan(`[${this.config.prefix}]`) : `[${this.config.prefix}]`;
      parts.push(prefix);
    }

    // Add main message
    parts.push(this.formatMessageText(level, message));

    // Add structured data if provided
    if (Object.keys(data).length > 0) {
      const dataStr = this.formatData(data);
      parts.push(dataStr);
    }

    return parts.join(' ');
  }

  /**
   * Get colored level indicator
   * @param {string} level - Log level
   * @returns {string} Formatted level indicator
   */
  getLevelIndicator(level) {
    const indicators = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    };

    const indicator = indicators[level] || 'ℹ️';
    
    if (!this.config.colors) {
      return `[${level.toUpperCase()}]`;
    }

    const colors = {
      debug: chalk.gray,
      info: chalk.blue,
      warn: chalk.yellow,
      error: chalk.red
    };

    const colorFn = colors[level] || chalk.blue;
    return `${indicator} ${colorFn(level.toUpperCase())}`;
  }

  /**
   * Format the main message text with appropriate colors
   * @param {string} level - Log level
   * @param {string} message - Message text
   * @returns {string} Formatted message
   */
  formatMessageText(level, message) {
    if (!this.config.colors) {
      return message;
    }

    const colors = {
      debug: chalk.gray,
      info: chalk.white,
      warn: chalk.yellow,
      error: chalk.red
    };

    const colorFn = colors[level] || chalk.white;
    return colorFn(message);
  }

  /**
   * Format structured data for output
   * @param {Object} data - Data to format
   * @returns {string} Formatted data string
   */
  formatData(data) {
    try {
      if (typeof data === 'object' && data !== null) {
        const formatted = JSON.stringify(data, null, 2);
        return this.config.colors ? chalk.gray(formatted) : formatted;
      }
      return String(data);
    } catch (error) {
      return '[Unserializable Data]';
    }
  }

  /**
   * Log a debug message
   * @param {string} message - Message to log
   * @param {Object} [data] - Additional structured data
   */
  debug(message, data = {}) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  /**
   * Log an info message
   * @param {string} message - Message to log
   * @param {Object} [data] - Additional structured data
   */
  info(message, data = {}) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, data));
    }
  }

  /**
   * Log a warning message
   * @param {string} message - Message to log
   * @param {Object} [data] - Additional structured data
   */
  warn(message, data = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  /**
   * Log an error message
   * @param {string} message - Message to log
   * @param {Object} [data] - Additional structured data
   */
  error(message, data = {}) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }

  /**
   * Start timing an operation
   * @param {string} operationId - Unique identifier for the operation
   */
  startTimer(operationId) {
    this.startTimes.set(operationId, performance.now());
    this.debug(`Started timer: ${operationId}`);
  }

  /**
   * End timing an operation and log the duration
   * @param {string} operationId - Operation identifier
   * @param {string} [message] - Optional message to include
   * @returns {number} Duration in milliseconds
   */
  endTimer(operationId, message = '') {
    const startTime = this.startTimes.get(operationId);
    if (!startTime) {
      this.warn(`Timer not found: ${operationId}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(operationId);

    const logMessage = message || `Completed: ${operationId}`;
    this.info(logMessage, { 
      operationId, 
      duration: `${duration.toFixed(2)}ms` 
    });

    return duration;
  }

  /**
   * Log operation success with timing
   * @param {string} operation - Operation description
   * @param {number} [duration] - Operation duration in ms
   * @param {Object} [data] - Additional data
   */
  success(operation, duration = null, data = {}) {
    const logData = { ...data };
    if (duration !== null) {
      logData.duration = `${duration.toFixed(2)}ms`;
    }

    const message = this.config.colors 
      ? `✅ ${chalk.green(operation)}` 
      : `✅ ${operation}`;

    this.info(message, logData);
  }

  /**
   * Log operation failure with details
   * @param {string} operation - Operation description
   * @param {Error|string} error - Error details
   * @param {Object} [data] - Additional context data
   */
  failure(operation, error, data = {}) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const logData = { 
      ...data, 
      error: errorMessage 
    };

    if (error instanceof Error && error.stack) {
      logData.stack = error.stack;
    }

    const message = this.config.colors 
      ? `❌ ${chalk.red(`Failed: ${operation}`)}` 
      : `❌ Failed: ${operation}`;

    this.error(message, logData);
  }

  /**
   * Create a child logger with additional context
   * @param {string} prefix - Prefix for child logger
   * @param {Object} [options] - Additional options
   * @returns {Logger} Child logger instance
   */
  child(prefix, options = {}) {
    return new Logger({
      ...this.config,
      ...options,
      prefix: this.config.prefix 
        ? `${this.config.prefix}:${prefix}` 
        : prefix
    });
  }

  /**
   * Set the logging level
   * @param {string} level - New logging level
   */
  set level(level) {
    if (this.levels[level] !== undefined) {
      this.config.level = level;
      this.currentLevel = this.levels[level];
    } else {
      this.warn(`Invalid log level: ${level}. Using current level: ${this.config.level}`);
    }
  }

  /**
   * Get the current logging level
   * @returns {string} Current logging level
   */
  get level() {
    return this.config.level;
  }

  /**
   * Log performance statistics
   * @param {Object} stats - Performance statistics
   */
  performanceStats(stats) {
    this.info('📊 Performance Statistics', {
      ...stats,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log memory usage information
   */
  memoryUsage() {
    const usage = process.memoryUsage();
    const formatted = {
      heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(usage.external / 1024 / 1024).toFixed(2)}MB`,
      rss: `${(usage.rss / 1024 / 1024).toFixed(2)}MB`
    };

    this.debug('💾 Memory Usage', formatted);
  }
}