/**
 * @file Path Resolver
 * @module unjucks-v4/template/path-resolver
 * @description Resolves output paths using Nunjucks templating
 */

import { NunjucksRenderer } from './nunjucks-renderer.mjs';
import { EventEmitter } from 'events';

/**
 * Path Resolver - Resolves output paths using Nunjucks templating
 * 
 * @class PathResolver
 * @extends EventEmitter
 */
export class PathResolver extends EventEmitter {
  /**
   * Create a new PathResolver instance
   * @param {Object} options - Resolver options
   * @param {NunjucksRenderer} options.renderer - Nunjucks renderer instance
   */
  constructor(options = {}) {
    super();
    
    this.renderer = options.renderer || new NunjucksRenderer();
    this.config = {
      deterministic: options.deterministic !== false,
      ...options
    };
  }

  /**
   * Resolve output path from template path
   * @param {string} pathTemplate - Path template (e.g., "{{ outputDir }}/{{ name | kebabCase }}.ts")
   * @param {Object} context - Template context
   * @returns {Promise<string>} Resolved path
   */
  async resolve(pathTemplate, context = {}) {
    if (!pathTemplate || typeof pathTemplate !== 'string') {
      throw new Error('Path template is required');
    }

    try {
      this.emit('resolve:start', { pathTemplate, context });

      const resolved = await this.renderer.render(pathTemplate, context);

      // Normalize path
      const normalized = this._normalizePath(resolved);

      this.emit('resolve:complete', { original: pathTemplate, resolved: normalized });
      return normalized;

    } catch (error) {
      this.emit('resolve:error', { pathTemplate, error });
      throw new Error(`Path resolution failed: ${error.message}`);
    }
  }

  /**
   * Normalize resolved path
   * @private
   * @param {string} path - Path to normalize
   * @returns {string} Normalized path
   */
  _normalizePath(path) {
    // Remove leading/trailing whitespace
    let normalized = path.trim();
    
    // Replace multiple slashes with single slash
    normalized = normalized.replace(/\/+/g, '/');
    
    // Remove leading ./ if present
    normalized = normalized.replace(/^\.\//, '');
    
    return normalized;
  }
}


