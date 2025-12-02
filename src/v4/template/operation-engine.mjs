/**
 * @file Operation Engine
 * @module unjucks-v4/template/operation-engine
 * @description Executes file operations (write, inject, append, prepend, lineAt)
 */

import { EventEmitter } from 'events';
import { PathResolver } from './path-resolver.mjs';
import { FileOperations } from '../file-ops/index.mjs';

/**
 * Operation Engine - Executes file operations based on frontmatter
 * 
 * @class OperationEngine
 * @extends EventEmitter
 */
export class OperationEngine extends EventEmitter {
  /**
   * Create a new OperationEngine instance
   * @param {Object} options - Engine options
   * @param {PathResolver} options.pathResolver - Path resolver instance
   * @param {FileOperations} options.fileOps - File operations instance
   */
  constructor(options = {}) {
    super();
    
    this.pathResolver = options.pathResolver || new PathResolver();
    this.fileOps = options.fileOps || new FileOperations();
    this.config = options;
  }

  /**
   * Execute file operation based on frontmatter
   * @param {Object} frontmatter - Parsed frontmatter
   * @param {string} content - Rendered content
   * @param {Object} context - Template context
   * @returns {Promise<Object>} Operation result
   */
  async execute(frontmatter, content, context = {}) {
    if (!frontmatter.to) {
      throw new Error('Output path (to) is required in frontmatter');
    }

    try {
      this.emit('operation:start', { frontmatter, contentLength: content.length });

      // Resolve output path
      const outputPath = await this.pathResolver.resolve(frontmatter.to, context);

      // Determine operation mode
      const operation = this._determineOperation(frontmatter);

      // Execute operation
      const result = await this.fileOps[operation](outputPath, content, {
        before: frontmatter.before,
        after: frontmatter.after,
        lineAt: frontmatter.lineAt,
        chmod: frontmatter.chmod,
        createDirectories: frontmatter.createDirectories !== false
      });

      this.emit('operation:complete', { operation, path: outputPath, result });
      return {
        operation,
        path: outputPath,
        ...result
      };

    } catch (error) {
      this.emit('operation:error', { frontmatter, error });
      throw new Error(`File operation failed: ${error.message}`);
    }
  }

  /**
   * Determine operation mode from frontmatter
   * @private
   * @param {Object} frontmatter - Frontmatter
   * @returns {string} Operation name
   */
  _determineOperation(frontmatter) {
    if (frontmatter.inject) return 'inject';
    if (frontmatter.append) return 'append';
    if (frontmatter.prepend) return 'prepend';
    if (frontmatter.lineAt !== undefined) return 'lineAt';
    return 'write'; // Default
  }
}


