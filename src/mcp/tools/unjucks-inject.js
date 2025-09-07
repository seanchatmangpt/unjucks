/**
 * Implementation of the unjucks_inject MCP tool
 * Provides file injection capabilities with idempotent operations
 */

import { FileInjector } from '../../lib/file-injector.js';
import { 
  createTextToolResult, 
  createJSONToolResult, 
  handleToolError, 
  validateObjectSchema,
  sanitizeFilePath,
  formatFileSize,
  logPerformance
} from '../utils.js';
import { TOOL_SCHEMAS } from '../types.js';
import path from 'node:path';
import fs from 'fs-extra';

/**
 * Inject content into files with various positioning options
 * @param {import('../types.js').UnjucksInjectParams} params - Injection parameters
 * @returns {Promise<import('../types.js').ToolResult>}
 */
export async function unjucksInject(params) {
  const startTime = performance.now();
  
  try {
    // Validate input parameters
    const validation = validateObjectSchema(params, TOOL_SCHEMAS.unjucks_inject);
    if (!validation.valid) {
      return createTextToolResult(`Invalid parameters: ${validation.errors.join(', ')}`, true);
    }

    const { 
      file, 
      content, 
      before, 
      after, 
      append = false, 
      prepend = false, 
      lineAt, 
      force = false, 
      dry = false 
    } = params;

    // Validate file path
    /** @type {string} */
    let targetFilePath;
    try {
      targetFilePath = sanitizeFilePath(file);
      if (!path.isAbsolute(targetFilePath)) {
        targetFilePath = path.resolve(targetFilePath);
      }
    } catch (error) {
      return handleToolError(error, 'unjucks_inject', 'file path validation');
    }

    // Validate injection parameters
    const injectionMethods = [before, after, append, prepend, lineAt].filter(x => 
      x !== undefined && x !== false
    ).length;
    
    if (injectionMethods === 0) {
      return createTextToolResult(
        'Must specify at least one injection method: before, after, append, prepend, or lineAt',
        true
      );
    }
    
    if (injectionMethods > 1) {
      return createTextToolResult(
        'Can only specify one injection method at a time',
        true
      );
    }

    // Initialize file injector
    const fileInjector = new FileInjector();
    
    try {
      // Check if target file exists
      const fileExists = await fs.pathExists(targetFilePath);
      if (!fileExists && !force) {
        return createTextToolResult(
          `Target file "${targetFilePath}" does not exist. Use --force to create it.`,
          true
        );
      }

      // Read existing file content if it exists
      let existingContent = '';
      let existingSize = 0;
      if (fileExists) {
        try {
          existingContent = await fs.readFile(targetFilePath, 'utf8');
          existingSize = Buffer.byteLength(existingContent, 'utf8');
        } catch (error) {
          return handleToolError(error, 'unjucks_inject', 'reading existing file');
        }
      }

      // Build frontmatter configuration for injection
      /** @type {any} */
      const frontmatterConfig = {};
      
      if (before) {
        frontmatterConfig.inject = true;
        frontmatterConfig.before = before;
      } else if (after) {
        frontmatterConfig.inject = true;
        frontmatterConfig.after = after;
      } else if (append) {
        frontmatterConfig.inject = true;
        frontmatterConfig.append = true;
      } else if (prepend) {
        frontmatterConfig.inject = true;
        frontmatterConfig.prepend = true;
      } else if (lineAt !== undefined) {
        frontmatterConfig.inject = true;
        frontmatterConfig.lineAt = lineAt;
      }

      // Set target file path in frontmatter
      frontmatterConfig.to = targetFilePath;

      // Perform injection using FileInjector
      const injectionOptions = {
        force,
        dry,
        backup: true // Always create backups for safety
      };

      const result = await fileInjector.processFile(
        targetFilePath,
        content,
        frontmatterConfig,
        injectionOptions
      );

      // Get file stats after injection (if not dry run)
      let newSize = existingSize;
      let newContent = existingContent;
      
      if (!dry && result.success && !result.skipped) {
        try {
          newContent = await fs.readFile(targetFilePath, 'utf8');
          newSize = Buffer.byteLength(newContent, 'utf8');
        } catch {
          // If we can't read the file, use estimates
          newSize = existingSize + Buffer.byteLength(content, 'utf8');
        }
      } else if (dry) {
        // For dry run, simulate the injection to show what would happen
        newContent = simulateInjection(existingContent, content, frontmatterConfig);
        newSize = Buffer.byteLength(newContent, 'utf8');
      }

      // Build detailed response
      const injectionReport = {
        operation: dry ? 'inject-dry-run' : 'inject',
        success: result.success,
        skipped: result.skipped,
        file: {
          path: targetFilePath,
          existed: fileExists,
          originalSize: formatFileSize(existingSize),
          newSize: formatFileSize(newSize),
          sizeDelta: formatFileSize(newSize - existingSize)
        },
        injection: {
          method: getInjectionMethod(frontmatterConfig),
          target: getInjectionTarget(frontmatterConfig),
          contentLength: content.length,
          contentPreview: content.slice(0, 100) + (content.length > 100 ? '...' : '')
        },
        result: {
          action: result.action,
          message: result.message,
          linesAdded: newContent ? newContent.split('\n').length - existingContent.split('\n').length : 0
        },
        backup: result.backupPath ? {
          created: true,
          path: result.backupPath
        } : { created: false },
        preview: dry ? {
          contentPreview: newContent.slice(0, 500) + (newContent.length > 500 ? '\n...' : ''),
          fullContent: newContent // Include full content for dry runs
        } : undefined
      };

      // Performance logging
      const duration = performance.now() - startTime;
      logPerformance({
        operation: `inject to ${path.basename(targetFilePath)}`,
        duration,
        filesProcessed: 1
      });

      // Create formatted text output
      const textOutput = formatInjectionReport(injectionReport);

      return {
        content: [
          {
            type: "text",
            text: textOutput
          },
          {
            type: "text",
            text: JSON.stringify(injectionReport, null, 2)
          }
        ],
        isError: !result.success,
        _meta: {
          file: targetFilePath,
          method: getInjectionMethod(frontmatterConfig),
          success: result.success,
          skipped: result.skipped,
          dry,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      return handleToolError(error, 'unjucks_inject', `injecting content into ${targetFilePath}`);
    }
    
  } catch (error) {
    return handleToolError(error, 'unjucks_inject', 'general operation');
  }
}

/**
 * Get injection method name from frontmatter config
 * @param {any} config - Frontmatter config
 * @returns {string}
 */
function getInjectionMethod(config) {
  if (config.before) return 'before';
  if (config.after) return 'after';
  if (config.append) return 'append';
  if (config.prepend) return 'prepend';
  if (config.lineAt !== undefined) return 'lineAt';
  return 'unknown';
}

/**
 * Get injection target description
 * @param {any} config - Frontmatter config
 * @returns {string}
 */
function getInjectionTarget(config) {
  if (config.before) return `before "${config.before}"`;
  if (config.after) return `after "${config.after}"`;
  if (config.append) return 'end of file';
  if (config.prepend) return 'beginning of file';
  if (config.lineAt !== undefined) return `at line ${config.lineAt}`;
  return 'unknown location';
}

/**
 * Simulate injection for dry runs
 * @param {string} existingContent - Existing file content
 * @param {string} newContent - Content to inject
 * @param {any} config - Injection configuration
 * @returns {string}
 */
function simulateInjection(existingContent, newContent, config) {
  const lines = existingContent.split('\n');
  
  if (config.prepend) {
    return newContent + '\n' + existingContent;
  }
  
  if (config.append) {
    return existingContent + (existingContent.endsWith('\n') ? '' : '\n') + newContent;
  }
  
  if (config.lineAt !== undefined) {
    const lineIndex = Math.max(0, Math.min(config.lineAt - 1, lines.length));
    lines.splice(lineIndex, 0, newContent);
    return lines.join('\n');
  }
  
  if (config.before) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(config.before)) {
        lines.splice(i, 0, newContent);
        break;
      }
    }
    return lines.join('\n');
  }
  
  if (config.after) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(config.after)) {
        lines.splice(i + 1, 0, newContent);
        break;
      }
    }
    return lines.join('\n');
  }
  
  // Fallback: append
  return existingContent + '\n' + newContent;
}

/**
 * Format injection report as readable text
 * @param {any} report - Injection report
 * @returns {string}
 */
function formatInjectionReport(report) {
  const lines = [];
  
  lines.push(`💉 File Injection ${report.operation === 'inject-dry-run' ? '(Dry Run)' : ''}`);
  lines.push('');
  
  lines.push(`📁 Target: ${report.file.path}`);
  lines.push(`📊 Method: ${report.injection.method} ${report.injection.target}`);
  lines.push(`📄 Content: ${report.injection.contentLength} characters`);
  lines.push('');
  
  if (report.success) {
    lines.push(`✅ ${report.result.message}`);
    lines.push(`   Action: ${report.result.action}`);
    lines.push(`   Size: ${report.file.originalSize} → ${report.file.newSize} (${report.file.sizeDelta})`);
    if (report.result.linesAdded > 0) {
      lines.push(`   Lines added: ${report.result.linesAdded}`);
    }
  } else {
    lines.push(`❌ Injection failed: ${report.result.message}`);
  }
  
  if (report.skipped) {
    lines.push(`⏭️  Skipped: ${report.result.message}`);
  }
  
  if (report.backup.created) {
    lines.push(`💾 Backup: ${report.backup.path}`);
  }
  
  lines.push('');
  
  // Show content preview
  if (report.injection.contentPreview) {
    lines.push('📝 Content Preview:');
    lines.push('```');
    lines.push(report.injection.contentPreview);
    lines.push('```');
    lines.push('');
  }
  
  // Show result preview for dry runs
  if (report.preview) {
    lines.push('🔍 Result Preview:');
    lines.push('```');
    lines.push(report.preview.contentPreview);
    lines.push('```');
  }
  
  return lines.join('\n');
}