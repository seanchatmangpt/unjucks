#!/usr/bin/env node

/**
 * CRITICAL PRODUCTION FIX: Replace hostile process.exit() calls with graceful error handling
 * Found 208 files with direct process.exit() - prevents graceful shutdown
 */

import fs from 'fs';
import path from 'path';
import glob from 'glob';

const GRACEFUL_ERROR_IMPORT = `import { gracefulShutdown, createGracefulError } from '../lib/graceful-error-handler.js';`;

/**
 * Replace process.exit patterns with graceful error handling
 */
function fixProcessExitsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Skip test files and templates
  if (filePath.includes('/tests/') || 
      filePath.includes('/_templates/') || 
      filePath.includes('.test.') || 
      filePath.includes('.spec.') ||
      filePath.includes('/node_modules/')) {
    return false;
  }

  // Add graceful error handling import if needed
  if (content.includes('process.exit(')) {
    if (!content.includes('graceful-error-handler')) {
      // Determine correct import path
      const relativePath = path.relative(path.dirname(filePath), path.join(process.cwd(), 'src/lib'));
      const importPath = relativePath ? `${relativePath}/graceful-error-handler.js` : './lib/graceful-error-handler.js';
      
      // Add import after existing imports
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const nextLineIndex = content.indexOf('\n', lastImportIndex);
        if (nextLineIndex !== -1) {
          content = content.slice(0, nextLineIndex + 1) + 
                   `import { gracefulShutdown, createGracefulError } from '${importPath}';\n` + 
                   content.slice(nextLineIndex + 1);
          modified = true;
        }
      }
    }
  }

  // Replace process.exit patterns
  const replacements = [
    // process.exit(1) with error context
    {
      pattern: /console\.error\(([^)]+)\);\s*process\.exit\(1\);?/g,
      replacement: 'console.error($1);\n        await gracefulShutdown(createGracefulError($1, 1));'
    },
    // Simple process.exit(1)
    {
      pattern: /process\.exit\(1\);?/g,
      replacement: 'await gracefulShutdown(createGracefulError("Operation failed", 1));'
    },
    // process.exit(0) - success cases
    {
      pattern: /process\.exit\(0\);?/g,
      replacement: 'await gracefulShutdown();'
    },
    // process.exit with variable
    {
      pattern: /process\.exit\((\w+)\);?/g,
      replacement: 'await gracefulShutdown(createGracefulError("Process terminating", $1));'
    }
  ];

  for (const { pattern, replacement } of replacements) {
    const originalContent = content;
    content = content.replace(pattern, replacement);
    if (content !== originalContent) {
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ Fixed process.exit() calls in: ${filePath}`);
    return true;
  }
  
  return false;
}

/**
 * Create graceful error handler module
 */
function createGracefulErrorHandler() {
  const handlerPath = path.join(process.cwd(), 'src/lib/graceful-error-handler.js');
  
  // Check if handler already exists
  if (fs.existsSync(handlerPath)) {
    console.log('✓ Graceful error handler already exists');
    return;
  }

  // Ensure directory exists
  const handlerDir = path.dirname(handlerPath);
  if (!fs.existsSync(handlerDir)) {
    fs.mkdirSync(handlerDir, { recursive: true });
  }

  const handlerContent = `/**
 * Graceful Error Handler - Production-ready error handling
 * Replaces hostile process.exit() calls with proper cleanup
 */

// Simple console logging instead of external logger
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args)
};

class GracefulErrorHandler {
  constructor() {
    this.shutdownHooks = [];
    this.isShuttingDown = false;
    this.setupSignalHandlers();
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, initiating graceful shutdown...');
      this.gracefulShutdown(null, 0);
    });

    process.on('SIGINT', () => {
      logger.info('Received SIGINT, initiating graceful shutdown...');
      this.gracefulShutdown(null, 0);  
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.gracefulShutdown(error, 1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown(new Error('Unhandled rejection: ' + String(reason)), 1);
    });
  }

  /**
   * Register cleanup hook
   */
  addShutdownHook(hook) {
    if (typeof hook === 'function') {
      this.shutdownHooks.push(hook);
    }
  }

  /**
   * Graceful shutdown with cleanup
   */
  async gracefulShutdown(error = null, exitCode = 0) {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;

    if (error) {
      logger.error('Shutting down due to error:', error.message);
    } else {
      logger.info('Initiating graceful shutdown...');
    }

    // Run cleanup hooks
    for (const hook of this.shutdownHooks) {
      try {
        await hook();
      } catch (hookError) {
        logger.error('Error in shutdown hook:', hookError);
      }
    }

    logger.info('Graceful shutdown complete');
    
    // Give time for logs to flush
    setTimeout(() => {
      process.exit(exitCode);
    }, 100);
  }
}

// Singleton instance
const errorHandler = new GracefulErrorHandler();

/**
 * Create a graceful error with context
 */
export function createGracefulError(message, exitCode = 1) {
  const error = new Error(typeof message === 'string' ? message : JSON.stringify(message));
  error.exitCode = exitCode;
  return error;
}

/**
 * Initiate graceful shutdown
 */
export function gracefulShutdown(error = null, exitCode = 0) {
  const code = error?.exitCode || exitCode;
  return errorHandler.gracefulShutdown(error, code);
}

/**
 * Add shutdown hook
 */
export function addShutdownHook(hook) {
  errorHandler.addShutdownHook(hook);
}

export default errorHandler;
`;

  fs.writeFileSync(handlerPath, handlerContent);
  console.log(`✓ Created graceful error handler: ${handlerPath}`);
}

/**
 * Scan and fix all JavaScript files  
 */
function fixProcessExitsInProject() {
  console.log('🔧 CRITICAL PRODUCTION FIX: Replacing process.exit() calls...\n');
  
  // Create graceful error handler first
  createGracefulErrorHandler();
  
  const patterns = [
    'src/**/*.js',
    'scripts/**/*.js', 
    'bin/**/*.js'
  ];
  
  let totalFilesFixed = 0;
  
  for (const pattern of patterns) {
    const files = glob.sync(pattern, {
      ignore: [
        '**/node_modules/**',
        '**/tests/**',
        '**/_templates/**', 
        '**/*.test.js',
        '**/*.spec.js'
      ]
    });
    
    console.log(`\nProcessing pattern: ${pattern}`);
    console.log(`Found ${files.length} files to check\n`);
    
    for (const filePath of files) {
      try {
        if (fixProcessExitsInFile(filePath)) {
          totalFilesFixed++;
        }
      } catch (error) {
        console.error(`✗ Error processing ${filePath}: ${error.message}`);
      }
    }
  }
  
  console.log(`\n🎯 PRODUCTION FIX COMPLETE:`);
  console.log(`   • Fixed process.exit() calls in ${totalFilesFixed} files`);
  console.log(`   • Added graceful error handling`);
  console.log(`   • Signal handlers for SIGTERM/SIGINT`);
  
  if (totalFilesFixed > 0) {
    console.log(`\n⚠️  NEXT STEPS:`);
    console.log(`   1. Review changed files for correctness`);
    console.log(`   2. Test graceful shutdown behavior`);
    console.log(`   3. Update any integration tests`);
    console.log(`   4. Deploy with health check monitoring`);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixProcessExitsInProject();
}

export { fixProcessExitsInFile, fixProcessExitsInProject };