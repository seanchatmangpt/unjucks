/**
 * Logging utility for Office document template processing
 * 
 * This module provides comprehensive logging capabilities for the Office document
 * processing system with support for different log levels, structured logging,
 * and integration with external logging systems.
 * 
 * @module office/utils/logger
 * @version 1.0.0
 */

/**
 * Log levels supported by the logger
 * @readonly
 * @enum {number}
 */
export const LogLevel = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5
};

/**
 * Log entry structure
 * @typedef {Object} LogEntry
 * @property {Date} timestamp - Entry timestamp
 * @property {number} level - Log level
 * @property {string} component - Component name
 * @property {string} message - Log message
 * @property {any} [data] - Additional data
 * @property {Error} [error] - Error object
 * @property {string} [correlationId] - Correlation ID
 * @property {string} [userId] - User ID
 * @property {string} [sessionId] - Session ID
 */

/**
 * Logger configuration options
 * @typedef {Object} LoggerConfig
 * @property {number} level - Minimum log level to output
 * @property {boolean} includeTimestamp - Whether to include timestamps
 * @property {boolean} colorize - Whether to colorize console output
 * @property {boolean} includeStackTrace - Whether to include stack traces for errors
 * @property {'json'|'text'|function(LogEntry): string} format - Log format
 * @property {LogOutput[]} outputs - Output targets
 */

/**
 * Log output target
 * @typedef {Object} LogOutput
 * @property {'console'|'file'|'http'|'custom'} type - Output type
 * @property {any} config - Output configuration
 * @property {function(LogEntry): Promise<void>|void} [write] - Custom write function
 */

/**
 * Default logger configuration
 * @type {LoggerConfig}
 */
const DEFAULT_CONFIG = {
  level: LogLevel.INFO,
  includeTimestamp: true,
  colorize: true,
  includeStackTrace: true,
  format: 'text',
  outputs: [{ type: 'console', config: {} }]
};

/**
 * ANSI color codes for console output
 */
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

/**
 * Logger class for Office document processing
 * 
 * Provides structured logging with support for multiple output targets,
 * log levels, formatting options, and integration with external systems.
 */
export class Logger {
  /**
   * Creates a new logger instance
   * 
   * @param {string} component - Component name for this logger
   * @param {boolean} [debug=false] - Whether debug mode is enabled
   * @param {Partial<LoggerConfig>} [config={}] - Logger configuration
   */
  constructor(component, debug = false, config = {}) {
    /** @private @readonly @type {string} */
    this.component = component;
    
    /** @private @readonly @type {LoggerConfig} */
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      level: debug ? LogLevel.DEBUG : (config.level ?? DEFAULT_CONFIG.level)
    };
    
    /** @private @type {string|undefined} */
    this.correlationId = undefined;
    
    /** @private @type {string|undefined} */
    this.userId = undefined;
    
    /** @private @type {string|undefined} */
    this.sessionId = undefined;
  }

  /**
   * Sets correlation ID for request tracking
   * 
   * @param {string} id - Correlation ID
   */
  setCorrelationId(id) {
    this.correlationId = id;
  }

  /**
   * Sets user ID for user-specific logging
   * 
   * @param {string} id - User ID
   */
  setUserId(id) {
    this.userId = id;
  }

  /**
   * Sets session ID for session tracking
   * 
   * @param {string} id - Session ID
   */
  setSessionId(id) {
    this.sessionId = id;
  }

  /**
   * Logs a trace message
   * 
   * @param {string} message - Log message
   * @param {any} [data] - Additional data
   */
  trace(message, data) {
    this.log(LogLevel.TRACE, message, data);
  }

  /**
   * Logs a debug message
   * 
   * @param {string} message - Log message
   * @param {any} [data] - Additional data
   */
  debug(message, data) {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Logs an info message
   * 
   * @param {string} message - Log message
   * @param {any} [data] - Additional data
   */
  info(message, data) {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Logs a warning message
   * 
   * @param {string} message - Log message
   * @param {any} [data] - Additional data
   */
  warn(message, data) {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Logs an error message
   * 
   * @param {string} message - Log message
   * @param {Error|any} [error] - Error object or additional data
   * @param {any} [data] - Additional data
   */
  error(message, error, data) {
    const errorObj = error instanceof Error ? error : undefined;
    const errorData = error instanceof Error ? data : error;
    this.log(LogLevel.ERROR, message, errorData, errorObj);
  }

  /**
   * Logs a fatal error message
   * 
   * @param {string} message - Log message
   * @param {Error|any} [error] - Error object or additional data
   * @param {any} [data] - Additional data
   */
  fatal(message, error, data) {
    const errorObj = error instanceof Error ? error : undefined;
    const errorData = error instanceof Error ? data : error;
    this.log(LogLevel.FATAL, message, errorData, errorObj);
  }

  /**
   * Logs a message with specified level
   * 
   * @private
   * @param {number} level - Log level
   * @param {string} message - Log message
   * @param {any} [data] - Additional data
   * @param {Error} [error] - Error object
   */
  log(level, message, data, error) {
    // Check if log level meets minimum threshold
    if (level < this.config.level) {
      return;
    }
    
    /** @type {LogEntry} */
    const entry = {
      timestamp: this.getDeterministicDate(),
      level,
      component: this.component,
      message,
      data,
      error,
      correlationId: this.correlationId,
      userId: this.userId,
      sessionId: this.sessionId
    };
    
    // Output to all configured targets
    for (const output of this.config.outputs) {
      this.writeToOutput(entry, output);
    }
  }

  /**
   * Writes log entry to output target
   * 
   * @private
   * @param {LogEntry} entry - Log entry to write
   * @param {LogOutput} output - Output target
   * @returns {Promise<void>}
   */
  async writeToOutput(entry, output) {
    try {
      switch (output.type) {
        case 'console':
          this.writeToConsole(entry);
          break;
        case 'file':
          await this.writeToFile(entry, output.config);
          break;
        case 'http':
          await this.writeToHttp(entry, output.config);
          break;
        case 'custom':
          if (output.write) {
            await output.write(entry);
          }
          break;
      }
    } catch (error) {
      // Fallback to console if output fails
      console.error(`Logger output failed for ${output.type}:`, error);
      this.writeToConsole(entry);
    }
  }

  /**
   * Writes log entry to console
   * 
   * @private
   * @param {LogEntry} entry - Log entry to write
   */
  writeToConsole(entry) {
    const formatted = this.formatEntry(entry);
    
    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formatted);
        break;
    }
  }

  /**
   * Writes log entry to file
   * 
   * @private
   * @param {LogEntry} entry - Log entry to write
   * @param {any} config - File output configuration
   * @returns {Promise<void>}
   */
  async writeToFile(entry, config) {
    // File writing implementation would go here
    // This is a placeholder for the actual file writing logic
    const formatted = this.formatEntry(entry, false); // No colors for file output
    
    // In a real implementation, you would use fs.writeFile or a similar method
    // await fs.appendFile(config.path, formatted + '\n');
  }

  /**
   * Writes log entry to HTTP endpoint
   * 
   * @private
   * @param {LogEntry} entry - Log entry to write
   * @param {any} config - HTTP output configuration
   * @returns {Promise<void>}
   */
  async writeToHttp(entry, config) {
    // HTTP logging implementation would go here
    // This is a placeholder for the actual HTTP logging logic
    
    // In a real implementation, you would send the log entry to an HTTP endpoint
    // await fetch(config.url, { method: 'POST', body: JSON.stringify(entry) });
  }

  /**
   * Formats a log entry for output
   * 
   * @private
   * @param {LogEntry} entry - Log entry to format
   * @param {boolean} [colorize] - Whether to include colors
   * @returns {string}
   */
  formatEntry(entry, colorize = this.config.colorize) {
    if (typeof this.config.format === 'function') {
      return this.config.format(entry);
    }
    
    if (this.config.format === 'json') {
      return JSON.stringify({
        ...entry,
        error: entry.error ? {
          message: entry.error.message,
          stack: this.config.includeStackTrace ? entry.error.stack : undefined
        } : undefined
      });
    }
    
    // Text format
    const parts = [];
    
    // Timestamp
    if (this.config.includeTimestamp) {
      const timestamp = entry.timestamp.toISOString();
      parts.push(colorize ? `${COLORS.gray}${timestamp}${COLORS.reset}` : timestamp);
    }
    
    // Level
    const levelText = this.getLevelName(entry.level).padEnd(5);
    const levelColor = this.getLevelColor(entry.level);
    parts.push(colorize ? `${levelColor}${levelText}${COLORS.reset}` : levelText);
    
    // Component
    const componentText = `[${entry.component}]`;
    parts.push(colorize ? `${COLORS.cyan}${componentText}${COLORS.reset}` : componentText);
    
    // Correlation ID
    if (entry.correlationId) {
      const corrText = `{${entry.correlationId}}`;
      parts.push(colorize ? `${COLORS.magenta}${corrText}${COLORS.reset}` : corrText);
    }
    
    // Message
    parts.push(entry.message);
    
    // Data
    if (entry.data) {
      const dataText = typeof entry.data === 'object' 
        ? JSON.stringify(entry.data, null, 2)
        : String(entry.data);
      parts.push(`\n  Data: ${dataText}`);
    }
    
    // Error
    if (entry.error) {
      const errorText = `Error: ${entry.error.message}`;
      parts.push(`\n  ${colorize ? `${COLORS.red}${errorText}${COLORS.reset}` : errorText}`);
      
      if (this.config.includeStackTrace && entry.error.stack) {
        const stackText = entry.error.stack;
        parts.push(`\n  Stack: ${colorize ? `${COLORS.gray}${stackText}${COLORS.reset}` : stackText}`);
      }
    }
    
    return parts.join(' ');
  }

  /**
   * Gets color for log level
   * 
   * @private
   * @param {number} level - Log level
   * @returns {string} - ANSI color code
   */
  getLevelColor(level) {
    switch (level) {
      case LogLevel.TRACE:
        return COLORS.gray;
      case LogLevel.DEBUG:
        return COLORS.blue;
      case LogLevel.INFO:
        return COLORS.green;
      case LogLevel.WARN:
        return COLORS.yellow;
      case LogLevel.ERROR:
        return COLORS.red;
      case LogLevel.FATAL:
        return `${COLORS.red}${COLORS.bright}`;
      default:
        return COLORS.reset;
    }
  }

  /**
   * Gets name for log level
   * 
   * @private
   * @param {number} level - Log level
   * @returns {string}
   */
  getLevelName(level) {
    const levels = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
    return levels[level] || 'UNKNOWN';
  }

  /**
   * Creates a child logger with additional context
   * 
   * @param {string} childComponent - Child component name
   * @param {Object} [context={}] - Additional context
   * @param {string} [context.correlationId] - Correlation ID
   * @param {string} [context.userId] - User ID
   * @param {string} [context.sessionId] - Session ID
   * @returns {Logger} - New logger instance
   */
  child(childComponent, context = {}) {
    const childLogger = new Logger(
      `${this.component}.${childComponent}`,
      this.config.level <= LogLevel.DEBUG,
      this.config
    );
    
    if (context.correlationId || this.correlationId) {
      childLogger.setCorrelationId(context.correlationId || this.correlationId);
    }
    
    if (context.userId || this.userId) {
      childLogger.setUserId(context.userId || this.userId);
    }
    
    if (context.sessionId || this.sessionId) {
      childLogger.setSessionId(context.sessionId || this.sessionId);
    }
    
    return childLogger;
  }

  /**
   * Measures execution time of a function
   * 
   * @template T
   * @param {string} label - Label for the measurement
   * @param {function(): Promise<T>|T} fn - Function to measure
   * @returns {Promise<T>}
   */
  async time(label, fn) {
    const start = this.getDeterministicTimestamp();
    this.debug(`Starting ${label}`);
    
    try {
      const result = await fn();
      const duration = this.getDeterministicTimestamp() - start;
      this.debug(`Completed ${label}`, { duration: `${duration}ms` });
      return result;
    } catch (error) {
      const duration = this.getDeterministicTimestamp() - start;
      this.error(`Failed ${label}`, error, { duration: `${duration}ms` });
      throw error;
    }
  }

  /**
   * Gets current logger configuration
   * 
   * @returns {LoggerConfig}
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Updates logger configuration
   * 
   * @param {Partial<LoggerConfig>} config - Configuration updates
   */
  updateConfig(config) {
    Object.assign(this.config, config);
  }

  /**
   * Checks if a log level is enabled
   * 
   * @param {number} level - Log level to check
   * @returns {boolean}
   */
  isLevelEnabled(level) {
    return level >= this.config.level;
  }

  /**
   * Creates a logger with default configuration for Office processing
   * 
   * @param {string} component - Component name
   * @param {boolean} [debug=false] - Whether debug mode is enabled
   * @returns {Logger}
   */
  static createOfficeLogger(component, debug = false) {
    return new Logger(component, debug, {
      level: debug ? LogLevel.DEBUG : LogLevel.INFO,
      includeTimestamp: true,
      colorize: true,
      includeStackTrace: true,
      format: 'text',
      outputs: [{ type: 'console', config: {} }]
    });
  }

  /**
   * Creates a logger for production use
   * 
   * @param {string} component - Component name
   * @param {LogOutput[]} [outputs=[]] - Output targets
   * @returns {Logger}
   */
  static createProductionLogger(component, outputs = []) {
    return new Logger(component, false, {
      level: LogLevel.INFO,
      includeTimestamp: true,
      colorize: false,
      includeStackTrace: false,
      format: 'json',
      outputs: outputs.length > 0 ? outputs : [{ type: 'console', config: {} }]
    });
  }

  /**
   * Get deterministic date for consistent behavior
   * 
   * @private
   * @returns {Date}
   */
  getDeterministicDate() {
    return new Date();
  }

  /**
   * Get deterministic timestamp for consistent behavior
   * 
   * @private
   * @returns {number}
   */
  getDeterministicTimestamp() {
    return Date.now();
  }
}