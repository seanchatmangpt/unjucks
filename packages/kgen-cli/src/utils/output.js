/**
 * Output utilities for KGEN CLI
 * Handles JSON/text formatting and machine-readable output
 */

import chalk from 'chalk';

/**
 * Format output based on JSON flag
 * @param {any} data - Data to output
 * @param {boolean} jsonFormat - Whether to output JSON
 * @param {Function} textFormatter - Function to format text output
 */
export function formatOutput(data, jsonFormat = false, textFormatter = null) {
  if (jsonFormat) {
    console.log(JSON.stringify(data, null, 2));
  } else if (textFormatter) {
    textFormatter(data);
  } else {
    console.log(data);
  }
}

/**
 * Success output with consistent formatting
 */
export function outputSuccess(message, data = null, jsonFormat = false) {
  if (jsonFormat) {
    console.log(JSON.stringify({
      success: true,
      message,
      data,
      timestamp: this.getDeterministicDate().toISOString()
    }, null, 2));
  } else {
    console.log(chalk.green('✅'), message);
    if (data && typeof data === 'object') {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

/**
 * Error output with consistent formatting
 */
export function outputError(message, error = null, jsonFormat = false) {
  if (jsonFormat) {
    console.error(JSON.stringify({
      success: false,
      error: message,
      details: error?.message || error,
      timestamp: this.getDeterministicDate().toISOString()
    }, null, 2));
  } else {
    console.error(chalk.red('❌'), message);
    if (error && error.message) {
      console.error(chalk.gray('Details:'), error.message);
    }
  }
}

/**
 * Warning output
 */
export function outputWarning(message, jsonFormat = false) {
  if (jsonFormat) {
    console.log(JSON.stringify({
      warning: message,
      timestamp: this.getDeterministicDate().toISOString()
    }, null, 2));
  } else {
    console.log(chalk.yellow('⚠️'), message);
  }
}

/**
 * Info output
 */
export function outputInfo(message, jsonFormat = false) {
  if (jsonFormat) {
    console.log(JSON.stringify({
      info: message,
      timestamp: this.getDeterministicDate().toISOString()
    }, null, 2));
  } else {
    console.log(chalk.blue('ℹ️'), message);
  }
}

/**
 * Progress output (only in text mode)
 */
export function outputProgress(message, jsonFormat = false) {
  if (!jsonFormat) {
    console.log(chalk.cyan('⏳'), message);
  }
}

/**
 * Table formatter for lists
 */
export function formatTable(headers, rows, jsonFormat = false) {
  if (jsonFormat) {
    const data = rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header.toLowerCase().replace(/\s+/g, '_')] = row[index];
      });
      return obj;
    });
    console.log(JSON.stringify(data, null, 2));
  } else {
    // Simple table formatting
    const colWidths = headers.map((header, i) => 
      Math.max(header.length, ...rows.map(row => String(row[i] || '').length))
    );
    
    // Header
    const headerRow = headers.map((header, i) => 
      header.padEnd(colWidths[i])
    ).join(' | ');
    console.log(chalk.bold(headerRow));
    console.log(colWidths.map(w => '-'.repeat(w)).join('-+-'));
    
    // Rows
    rows.forEach(row => {
      const rowStr = row.map((cell, i) => 
        String(cell || '').padEnd(colWidths[i])
      ).join(' | ');
      console.log(rowStr);
    });
  }
}

/**
 * Hash display formatter
 */
export function formatHash(hash, algorithm = 'SHA256', jsonFormat = false) {
  if (jsonFormat) {
    console.log(JSON.stringify({
      hash,
      algorithm,
      length: hash.length,
      timestamp: this.getDeterministicDate().toISOString()
    }, null, 2));
  } else {
    console.log(chalk.green('Hash:'), chalk.cyan(hash));
    console.log(chalk.gray(`Algorithm: ${algorithm}, Length: ${hash.length}`));
  }
}

/**
 * File operation result formatter
 */
export function formatFileResult(operation, files, jsonFormat = false) {
  if (jsonFormat) {
    console.log(JSON.stringify({
      operation,
      files: files.map(f => ({
        path: f.path || f,
        size: f.size,
        status: f.status || 'success'
      })),
      count: files.length,
      timestamp: this.getDeterministicDate().toISOString()
    }, null, 2));
  } else {
    console.log(chalk.green(`${operation} completed:`));
    files.forEach(file => {
      const path = typeof file === 'string' ? file : file.path;
      const size = file.size ? chalk.gray(` (${file.size} bytes)`) : '';
      const status = file.status === 'error' ? chalk.red(' [ERROR]') : chalk.green(' [OK]');
      console.log(`  ${path}${size}${status}`);
    });
    console.log(chalk.blue(`Total: ${files.length} files`));
  }
}

/**
 * Diff result formatter
 */
export function formatDiff(changes, jsonFormat = false) {
  if (jsonFormat) {
    console.log(JSON.stringify(changes, null, 2));
  } else {
    const { added = [], removed = [], modified = [] } = changes;
    
    if (added.length > 0) {
      console.log(chalk.green('Added:'));
      added.forEach(item => console.log(chalk.green(`  + ${item}`)));
    }
    
    if (removed.length > 0) {
      console.log(chalk.red('Removed:'));
      removed.forEach(item => console.log(chalk.red(`  - ${item}`)));
    }
    
    if (modified.length > 0) {
      console.log(chalk.yellow('Modified:'));
      modified.forEach(item => console.log(chalk.yellow(`  ~ ${item}`)));
    }
    
    if (added.length === 0 && removed.length === 0 && modified.length === 0) {
      console.log(chalk.gray('No changes detected'));
    }
    
    const total = added.length + removed.length + modified.length;
    if (total > 0) {
      console.log(chalk.blue(`\nTotal changes: ${total}`));
    }
  }
}

export default {
  formatOutput,
  outputSuccess,
  outputError,
  outputWarning,
  outputInfo,
  outputProgress,
  formatTable,
  formatHash,
  formatFileResult,
  formatDiff
};