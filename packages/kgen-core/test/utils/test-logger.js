/**
 * Test Logger Utility
 * Captures logs deterministically for testing
 */

export class TestLogger {
  constructor() {
    this.logs = [];
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.silent = false;
  }

  log(...args) {
    const entry = {
      type: 'log',
      message: args.join(' '),
      timestamp: Date.now(),
      args: [...args]
    };
    
    this.logs.push(entry);
    
    if (!this.silent && process.env.NODE_ENV !== 'test') {
      console.log(...args);
    }
  }

  error(...args) {
    const entry = {
      type: 'error',
      message: args.join(' '),
      timestamp: Date.now(),
      args: [...args]
    };
    
    this.errors.push(entry);
    
    if (!this.silent && process.env.NODE_ENV !== 'test') {
      console.error(...args);
    }
  }

  warn(...args) {
    const entry = {
      type: 'warn',
      message: args.join(' '),
      timestamp: Date.now(),
      args: [...args]
    };
    
    this.warnings.push(entry);
    
    if (!this.silent && process.env.NODE_ENV !== 'test') {
      console.warn(...args);
    }
  }

  info(...args) {
    const entry = {
      type: 'info',
      message: args.join(' '),
      timestamp: Date.now(),
      args: [...args]
    };
    
    this.info.push(entry);
    
    if (!this.silent && process.env.NODE_ENV !== 'test') {
      console.info(...args);
    }
  }

  clear() {
    this.logs = [];
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  getAllLogs() {
    return [
      ...this.logs,
      ...this.errors,
      ...this.warnings,
      ...this.info
    ].sort((a, b) => a.timestamp - b.timestamp);
  }

  getLogsByType(type) {
    switch (type) {
      case 'error': return this.errors;
      case 'warn': return this.warnings;
      case 'info': return this.info;
      case 'log': return this.logs;
      default: return this.getAllLogs();
    }
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  hasWarnings() {
    return this.warnings.length > 0;
  }

  getLastLog() {
    const allLogs = this.getAllLogs();
    return allLogs[allLogs.length - 1];
  }

  findLogs(pattern) {
    const allLogs = this.getAllLogs();
    return allLogs.filter(log => {
      if (typeof pattern === 'string') {
        return log.message.includes(pattern);
      } else if (pattern instanceof RegExp) {
        return pattern.test(log.message);
      }
      return false;
    });
  }

  setSilent(silent = true) {
    this.silent = silent;
  }

  // Assertions for testing
  expectLog(pattern) {
    const found = this.findLogs(pattern);
    if (found.length === 0) {
      throw new Error(`Expected log matching "${pattern}" but none found`);
    }
    return found;
  }

  expectNoErrors() {
    if (this.errors.length > 0) {
      throw new Error(`Expected no errors but found ${this.errors.length}: ${this.errors.map(e => e.message).join(', ')}`);
    }
  }

  expectNoWarnings() {
    if (this.warnings.length > 0) {
      throw new Error(`Expected no warnings but found ${this.warnings.length}: ${this.warnings.map(w => w.message).join(', ')}`);
    }
  }
}