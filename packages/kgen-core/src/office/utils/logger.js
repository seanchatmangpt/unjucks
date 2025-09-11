/**
 * Logger utility for Office document processing
 * 
 * This module provides a comprehensive logging system for Office template processing
 * with different log levels, structured logging, and performance tracking.
 * 
 * @module office/utils/logger
 * @version 1.0.0
 */

/**
 * Log levels enum
 * @enum {string}
 */
export const LogLevel = {
  ERROR: 'error',
  WARN: 'warn', 
  INFO: 'info',
  DEBUG: 'debug'
};

/**
 * Logger class for Office document processing
 * 
 * Provides structured logging with different levels, performance tracking,
 * and integration with external logging systems.
 */
export class Logger {
  /**
   * Creates a new logger instance
   * 
   * @param {string} [name='Office'] - Logger name/component
   * @param {boolean} [debug=false] - Enable debug logging
   * @param {Object} [options={}] - Additional logger options
   */
  constructor(name = 'Office', debug = false, options = {}) {
    this.name = name;
    this.debugEnabled = debug;
    this.options = {
      timestamp: true,
      colors: true,
      structured: false,
      ...options
    };
    
    this.logLevel = debug ? LogLevel.DEBUG : LogLevel.INFO;
    this.startTime = Date.now();
  }

  /**
   * Creates an office-specific logger
   * 
   * @param {string} component - Component name
   * @param {boolean} [debug=false] - Enable debug logging
   * @returns {Logger} New logger instance
   */
  static createOfficeLogger(component, debug = false) {
    return new Logger(`Office:${component}`, debug);
  }

  /**
   * Logs an error message
   * 
   * @param {string} message - Error message
   * @param {Error} [error] - Error object
   * @param {Object} [context] - Additional context
   */
  error(message, error, context) {
    this.log(LogLevel.ERROR, message, { error, ...context });
  }

  /**
   * Logs a warning message
   * 
   * @param {string} message - Warning message
   * @param {Object} [context] - Additional context
   */
  warn(message, context) {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Logs an info message
   * 
   * @param {string} message - Info message
   * @param {Object} [context] - Additional context
   */
  info(message, context) {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Logs a debug message
   * 
   * @param {string} message - Debug message
   * @param {Object} [context] - Additional context
   */
  debug(message, context) {
    if (this.debugEnabled !== false) {
      this.log(LogLevel.DEBUG, message, context);
    }
  }

  /**
   * Main logging method
   * 
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} [context] - Additional context
   */
  log(level, message, context = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = this.createLogEntry(level, message, context);
    
    if (this.options.structured) {
      this.outputStructuredLog(logEntry);
    } else {
      this.outputFormattedLog(logEntry);
    }
  }

  /**
   * Checks if a log level should be output
   * 
   * @param {string} level - Log level to check
   * @returns {boolean} Whether to log
   */
  shouldLog(level) {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const targetLevelIndex = levels.indexOf(level);
    
    return targetLevelIndex <= currentLevelIndex;
  }

  /**
   * Creates a structured log entry
   * 
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   * @returns {Object} Log entry object
   */
  createLogEntry(level, message, context) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.name,
      message,
      duration: Date.now() - this.startTime
    };

    // Add context if provided
    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    // Add error details if present
    if (context.error instanceof Error) {
      entry.error = {
        name: context.error.name,
        message: context.error.message,
        stack: context.error.stack
      };
    }

    return entry;
  }

  /**
   * Outputs structured JSON log
   * 
   * @param {Object} logEntry - Log entry to output
   */
  outputStructuredLog(logEntry) {
    console.log(JSON.stringify(logEntry));
  }

  /**
   * Outputs formatted console log
   * 
   * @param {Object} logEntry - Log entry to output
   */
  outputFormattedLog(logEntry) {
    const { timestamp, level, component, message, duration, context, error } = logEntry;
    
    let output = '';
    
    // Add timestamp if enabled
    if (this.options.timestamp) {
      output += `[${new Date(timestamp).toLocaleTimeString()}] `;
    }
    
    // Add level with colors if enabled
    if (this.options.colors && typeof process !== 'undefined' && process.stdout?.isTTY) {
      output += this.colorizeLevel(level);
    } else {
      output += `[${level.toUpperCase()}]`;
    }
    
    // Add component name
    output += ` ${component}: `;
    
    // Add message
    output += message;
    
    // Add duration for performance tracking
    if (level === LogLevel.DEBUG) {
      output += ` (+${duration}ms)`;
    }
    
    // Output main log line
    console.log(output);
    
    // Output context if present
    if (context && Object.keys(context).length > 0) {
      console.log('  Context:', context);
    }
    
    // Output error details if present
    if (error) {
      console.log('  Error:', error.message);
      if (this.debugEnabled && error.stack) {
        console.log('  Stack:', error.stack);
      }
    }
  }

  /**
   * Colorizes log level for console output
   * 
   * @param {string} level - Log level
   * @returns {string} Colorized level string
   */
  colorizeLevel(level) {
    const colors = {
      [LogLevel.ERROR]: '\x1b[31m',   // Red
      [LogLevel.WARN]: '\x1b[33m',    // Yellow
      [LogLevel.INFO]: '\x1b[36m',    // Cyan
      [LogLevel.DEBUG]: '\x1b[37m'    // White
    };
    
    const reset = '\x1b[0m';
    const color = colors[level] || '';
    
    return `${color}[${level.toUpperCase()}]${reset}`;
  }

  /**
   * Creates a performance timer
   * 
   * @param {string} operation - Operation name
   * @returns {Function} Function to end timing
   */
  time(operation) {
    const startTime = Date.now();
    this.debug(`Starting ${operation}`);
    
    return () => {
      const duration = Date.now() - startTime;
      this.debug(`Completed ${operation} in ${duration}ms`);
      return duration;
    };
  }

  /**
   * Logs performance metrics
   * 
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} [metrics] - Additional metrics
   */
  performance(operation, duration, metrics = {}) {
    this.info(`Performance: ${operation}`, {
      duration: `${duration}ms`,
      ...metrics
    });
  }

  /**
   * Creates a child logger with additional context
   * 
   * @param {string} childName - Child logger name
   * @param {Object} [context] - Additional context
   * @returns {Logger} Child logger instance
   */
  child(childName, context = {}) {
    const child = new Logger(`${this.name}:${childName}`, this.debugEnabled, this.options);
    child.defaultContext = context;
    return child;
  }

  /**
   * Sets the log level
   * 
   * @param {string} level - Log level to set
   */
  setLevel(level) {
    if (Object.values(LogLevel).includes(level)) {
      this.logLevel = level;
    }
  }

  /**
   * Enables or disables debug mode
   * 
   * @param {boolean} enabled - Whether to enable debug mode
   */
  setDebug(enabled) {
    this.debugEnabled = enabled;
    this.logLevel = enabled ? LogLevel.DEBUG : LogLevel.INFO;
  }

  /**
   * Gets current logger configuration
   * 
   * @returns {Object} Logger configuration
   */
  getConfig() {
    return {
      name: this.name,
      debug: this.debugEnabled,
      logLevel: this.logLevel,
      options: { ...this.options }
    };
  }
}