/**
 * Simple Logger for KGEN Core
 */

export class Logger {
  constructor(options = {}) {
    this.component = options.component || 'KGEN';
    this.level = options.level || 'info';
    this.silent = options.silent || false;
  }

  debug(message, meta = {}) {
    if (this.level === 'debug' && !this.silent) {
      console.debug(`[${this.component}] DEBUG:`, message, meta);
    }
  }

  info(message, meta = {}) {
    if (['debug', 'info'].includes(this.level) && !this.silent) {
      console.info(`[${this.component}] INFO:`, message, meta);
    }
  }

  warn(message, meta = {}) {
    if (['debug', 'info', 'warn'].includes(this.level) && !this.silent) {
      console.warn(`[${this.component}] WARN:`, message, meta);
    }
  }

  error(message, meta = {}) {
    if (!this.silent) {
      console.error(`[${this.component}] ERROR:`, message, meta);
    }
  }
}

export default Logger;