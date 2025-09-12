/**
 * KGEN Core Utilities
 */

import Logger from './logger.js';

// Create a default logger instance
export const logger = new Logger({ component: 'KGEN' });

// Also export the Logger class for custom instances
export { Logger };