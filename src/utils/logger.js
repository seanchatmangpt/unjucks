/**
 * Simple logger utility
 */

export const logger = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  debug: (...args) => {
    if (process.env.DEBUG || process.env.VERBOSE) {
      console.log('[DEBUG]', ...args);
    }
  }
};

export default logger;
