/**
 * @file Hygen Generator
 * @module unjucks-v4/template/hygen-generator
 * @description Hygen-style generator/action/file pattern matching
 */

import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { EventEmitter } from 'events';

/**
 * Hygen Generator - Implements Hygen-style generator/action/file patterns
 * 
 * @class HygenGenerator
 * @extends EventEmitter
 */
export class HygenGenerator extends EventEmitter {
  /**
   * Create a new HygenGenerator instance
   * @param {Object} options - Generator options
   * @param {string} options.templatesDir - Templates directory
   */
  constructor(options = {}) {
    super();
    
    this.config = {
      templatesDir: options.templatesDir || '_templates',
      supportedExtensions: ['.njk', '.nunjucks', '.hbs', '.ejs'],
      ...options
    };
  }

  /**
   * Discover templates for generator/action pattern
   * @param {string} generator - Generator name
   * @param {string} action - Action name
   * @returns {Promise<Array>} Array of template files
   */
  async discoverTemplates(generator, action) {
    const templatePath = join(this.config.templatesDir, generator, action);
    
    try {
      this.emit('discover:start', { generator, action, path: templatePath });

      const files = await this._scanDirectory(templatePath);
      const templates = files
        .filter(file => this._isTemplateFile(file))
        .map(file => ({
          path: file,
          generator,
          action,
          name: this._extractTemplateName(file)
        }));

      this.emit('discover:complete', { generator, action, count: templates.length });
      return templates;

    } catch (error) {
      if (error.code === 'ENOENT') {
        this.emit('discover:notfound', { generator, action, path: templatePath });
        return [];
      }
      
      this.emit('discover:error', { generator, action, error });
      throw new Error(`Failed to discover templates: ${error.message}`);
    }
  }

  /**
   * Scan directory recursively for template files
   * @private
   * @param {string} dir - Directory path
   * @returns {Promise<Array<string>>} Array of file paths
   */
  async _scanDirectory(dir) {
    const files = [];
    
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this._scanDirectory(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
      throw error;
    }
    
    return files;
  }

  /**
   * Check if file is a template file
   * @private
   * @param {string} filePath - File path
   * @returns {boolean} True if template file
   */
  _isTemplateFile(filePath) {
    const ext = extname(filePath);
    return this.config.supportedExtensions.includes(ext);
  }

  /**
   * Extract template name from path
   * @private
   * @param {string} filePath - File path
   * @returns {string} Template name
   */
  _extractTemplateName(filePath) {
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  }
}


