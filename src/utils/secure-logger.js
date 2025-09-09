/**
 * Secure Production Logger
 * Prevents debug information leakage in production environments
 */

class SecureLogger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logLevel = process.env.LOG_LEVEL || 'info';
  }

  /**
   * Production-safe debug logging
   */
  debug(...args) {
    if (!this.isProduction && this.logLevel === 'debug') {
      console.debug('[DEBUG]', ...args);
    }
  }

  /**
   * Production-safe info logging
   */
  info(...args) {
    if (!this.isProduction || this.logLevel === 'info') {
      console.info('[INFO]', ...args);
    }
  }

  /**
   * Production-safe warning logging
   */
  warn(...args) {
    console.warn('[WARN]', ...args);
  }

  /**
   * Production-safe error logging
   */
  error(...args) {
    console.error('[ERROR]', ...args);
  }

  /**
   * Test-specific logging (only in non-production)
   */
  test(...args) {
    if (!this.isProduction) {
      console.log('[TEST]', ...args);
    }
  }

  /**
   * Sanitize potentially sensitive data from logs
   */
  sanitize(data) {
    if (typeof data === 'string') {
      return data
        .replace(/password[^\s]*[\s]*[:=][\s]*[^\s]+/gi, 'password=***REDACTED***')
        .replace(/secret[^\s]*[\s]*[:=][\s]*[^\s]+/gi, 'secret=***REDACTED***')
        .replace(/token[^\s]*[\s]*[:=][\s]*[^\s]+/gi, 'token=***REDACTED***')
        .replace(/key[^\s]*[\s]*[:=][\s]*[^\s]+/gi, 'key=***REDACTED***')
        .replace(/api_key[^\s]*[\s]*[:=][\s]*[^\s]+/gi, 'api_key=***REDACTED***');
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data };
      for (const [key, value] of Object.entries(sanitized)) {
        if (/password|secret|token|key|credentials/i.test(key)) {
          sanitized[key] = '***REDACTED***';
        }
      }
      return sanitized;
    }
    
    return data;
  }

  /**
   * Production-safe logging with data sanitization
   */
  secureLog(level, message, data) {
    const sanitizedData = data ? this.sanitize(data) : undefined;
    
    switch (level) {
      case 'debug':
        this.debug(message, sanitizedData);
        break;
      case 'info':
        this.info(message, sanitizedData);
        break;
      case 'warn':
        this.warn(message, sanitizedData);
        break;
      case 'error':
        this.error(message, sanitizedData);
        break;
      case 'test':
        this.test(message, sanitizedData);
        break;
      default:
        this.info(message, sanitizedData);
    }
  }
}

// Export singleton instance
const logger = new SecureLogger();
export default logger;

// Export for CommonJS compatibility
module.exports = logger;