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
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
  error?: Error;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel;
  /** Whether to include timestamps */
  includeTimestamp: boolean;
  /** Whether to colorize console output */
  colorize: boolean;
  /** Whether to include stack traces for errors */
  includeStackTrace: boolean;
  /** Log format (json, text, or custom formatter) */
  format: 'json' | 'text' | ((entry: LogEntry) => string);
  /** Output targets */
  outputs: LogOutput[];
}

/**
 * Log output target
 */
export interface LogOutput {
  /** Output type */
  type: 'console' | 'file' | 'http' | 'custom';
  /** Output configuration */
  config: any;
  /** Custom write function for custom outputs */
  write?: (entry: LogEntry) => Promise<void> | void;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
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
  private readonly config: LoggerConfig;
  private readonly component: string;
  private correlationId?: string;
  private userId?: string;
  private sessionId?: string;
  
  /**
   * Creates a new logger instance
   * 
   * @param component - Component name for this logger
   * @param debug - Whether debug mode is enabled
   * @param config - Logger configuration
   */
  constructor(
    component: string, 
    debug: boolean = false, 
    config: Partial<LoggerConfig> = {}
  ) {
    this.component = component;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      level: debug ? LogLevel.DEBUG : (config.level ?? DEFAULT_CONFIG.level)
    };
  }

  /**
   * Sets correlation ID for request tracking
   * 
   * @param id - Correlation ID
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Sets user ID for user-specific logging
   * 
   * @param id - User ID
   */
  setUserId(id: string): void {
    this.userId = id;
  }

  /**
   * Sets session ID for session tracking
   * 
   * @param id - Session ID
   */
  setSessionId(id: string): void {
    this.sessionId = id;
  }

  /**
   * Logs a trace message
   * 
   * @param message - Log message
   * @param data - Additional data
   */
  trace(message: string, data?: any): void {
    this.log(LogLevel.TRACE, message, data);
  }

  /**
   * Logs a debug message
   * 
   * @param message - Log message
   * @param data - Additional data
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Logs an info message
   * 
   * @param message - Log message
   * @param data - Additional data
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Logs a warning message
   * 
   * @param message - Log message
   * @param data - Additional data
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Logs an error message
   * 
   * @param message - Log message
   * @param error - Error object
   * @param data - Additional data
   */
  error(message: string, error?: Error | any, data?: any): void {
    const errorObj = error instanceof Error ? error : undefined;
    const errorData = error instanceof Error ? data : error;
    this.log(LogLevel.ERROR, message, errorData, errorObj);
  }

  /**
   * Logs a fatal error message
   * 
   * @param message - Log message
   * @param error - Error object
   * @param data - Additional data
   */
  fatal(message: string, error?: Error | any, data?: any): void {
    const errorObj = error instanceof Error ? error : undefined;
    const errorData = error instanceof Error ? data : error;
    this.log(LogLevel.FATAL, message, errorData, errorObj);
  }

  /**
   * Logs a message with specified level
   * 
   * @param level - Log level
   * @param message - Log message
   * @param data - Additional data
   * @param error - Error object
   */
  private log(level: LogLevel, message: string, data?: any, error?: Error): void {
    // Check if log level meets minimum threshold
    if (level < this.config.level) {
      return;
    }
    
    const entry: LogEntry = {
      timestamp: new Date(),
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
   * @param entry - Log entry to write
   * @param output - Output target
   */
  private async writeToOutput(entry: LogEntry, output: LogOutput): Promise<void> {
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
   * @param entry - Log entry to write
   */
  private writeToConsole(entry: LogEntry): void {
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
   * @param entry - Log entry to write
   * @param config - File output configuration
   */
  private async writeToFile(entry: LogEntry, config: any): Promise<void> {
    // File writing implementation would go here
    // This is a placeholder for the actual file writing logic
    const formatted = this.formatEntry(entry, false); // No colors for file output
    
    // In a real implementation, you would use fs.writeFile or a similar method
    // await fs.appendFile(config.path, formatted + '\n');
  }

  /**
   * Writes log entry to HTTP endpoint
   * 
   * @param entry - Log entry to write
   * @param config - HTTP output configuration
   */
  private async writeToHttp(entry: LogEntry, config: any): Promise<void> {
    // HTTP logging implementation would go here
    // This is a placeholder for the actual HTTP logging logic
    
    // In a real implementation, you would send the log entry to an HTTP endpoint
    // await fetch(config.url, { method: 'POST', body: JSON.stringify(entry) });
  }

  /**
   * Formats a log entry for output
   * 
   * @param entry - Log entry to format
   * @param colorize - Whether to include colors
   * @returns Formatted log string
   */
  private formatEntry(entry: LogEntry, colorize: boolean = this.config.colorize): string {
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
    const parts: string[] = [];
    
    // Timestamp
    if (this.config.includeTimestamp) {
      const timestamp = entry.timestamp.toISOString();
      parts.push(colorize ? `${COLORS.gray}${timestamp}${COLORS.reset}` : timestamp);
    }
    
    // Level
    const levelText = LogLevel[entry.level].toUpperCase().padEnd(5);
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
   * @param level - Log level
   * @returns ANSI color code
   */
  private getLevelColor(level: LogLevel): string {
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
   * Creates a child logger with additional context
   * 
   * @param childComponent - Child component name
   * @param context - Additional context
   * @returns New logger instance
   */
  child(childComponent: string, context: Partial<Pick<LogEntry, 'correlationId' | 'userId' | 'sessionId'>> = {}): Logger {
    const childLogger = new Logger(
      `${this.component}.${childComponent}`,
      this.config.level <= LogLevel.DEBUG,
      this.config
    );
    
    if (context.correlationId || this.correlationId) {
      childLogger.setCorrelationId(context.correlationId || this.correlationId!);
    }
    
    if (context.userId || this.userId) {
      childLogger.setUserId(context.userId || this.userId!);
    }
    
    if (context.sessionId || this.sessionId) {
      childLogger.setSessionId(context.sessionId || this.sessionId!);
    }
    
    return childLogger;
  }

  /**
   * Measures execution time of a function
   * 
   * @param label - Label for the measurement
   * @param fn - Function to measure
   * @returns Result of the function
   */
  async time<T>(label: string, fn: () => Promise<T> | T): Promise<T> {
    const start = Date.now();
    this.debug(`Starting ${label}`);
    
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.debug(`Completed ${label}`, { duration: `${duration}ms` });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`Failed ${label}`, error, { duration: `${duration}ms` });
      throw error;
    }
  }

  /**
   * Gets current logger configuration
   * 
   * @returns Logger configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Updates logger configuration
   * 
   * @param config - Configuration updates
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Checks if a log level is enabled
   * 
   * @param level - Log level to check
   * @returns Whether level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  /**
   * Creates a logger with default configuration for Office processing
   * 
   * @param component - Component name
   * @param debug - Whether debug mode is enabled
   * @returns Configured logger instance
   */
  static createOfficeLogger(component: string, debug: boolean = false): Logger {
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
   * @param component - Component name
   * @param outputs - Output targets
   * @returns Configured logger instance
   */
  static createProductionLogger(component: string, outputs: LogOutput[] = []): Logger {
    return new Logger(component, false, {
      level: LogLevel.INFO,
      includeTimestamp: true,
      colorize: false,
      includeStackTrace: false,
      format: 'json',
      outputs: outputs.length > 0 ? outputs : [{ type: 'console', config: {} }]
    });
  }
}
