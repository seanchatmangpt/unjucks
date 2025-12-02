/**
 * Logger utility for KGEN Marketplace
 * 
 * Provides structured logging with different levels and contexts.
 */

export function createLogger(component) {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  };
  
  const currentLevel = logLevels[logLevel] || 2;
  
  function log(level, message, data = {}) {
    if (logLevels[level] <= currentLevel) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level,
        component,
        message,
        ...data
      };
      
      if (level === 'error') {
        console.error(JSON.stringify(logEntry));
      } else if (level === 'warn') {
        console.warn(JSON.stringify(logEntry));
      } else {
        console.log(JSON.stringify(logEntry));
      }
    }
  }
  
  return {
    error: (message, error) => {
      const errorData = error instanceof Error ? {
        error: error.message,
        stack: error.stack
      } : { error };
      log('error', message, errorData);
    },
    warn: (message, data) => log('warn', message, data),
    info: (message, data) => log('info', message, data),
    debug: (message, data) => log('debug', message, data)
  };
}

export default createLogger;