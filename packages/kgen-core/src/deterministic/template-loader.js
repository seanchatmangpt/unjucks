/**
 * KGEN Core Template Discovery and Loading System - Pure JavaScript
 * 
 * Provides deterministic template discovery, loading, and caching:
 * - Template directory scanning
 * - File-based template loading
 * - In-memory template management
 * - Template metadata extraction
 * - Deterministic template indexing
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { FrontmatterParser } from './frontmatter.js';

class TemplateLoader {
  constructor(options = {}) {
    this.config = {
      // Template directories
      templatesDir: options.templatesDir || '_templates',
      searchPaths: options.searchPaths || ['_templates', 'templates'],
      
      // File patterns
      templateExtensions: options.templateExtensions || ['.njk', '.nunjucks', '.j2', '.jinja2'],
      excludePatterns: options.excludePatterns || [
        /^\./, // Hidden files
        /~$/, // Backup files
        /\.bak$/, // Backup files
        /node_modules/, // Dependencies
        /\.git/ // Git directory
      ],
      
      // Deterministic settings
      sortTemplates: options.sortTemplates !== false,
      canonicalPaths: options.canonicalPaths !== false,
      enableCache: options.enableCache !== false,
      
      // Template metadata
      extractMetadata: options.extractMetadata !== false,
      validateTemplates: options.validateTemplates !== false,
      
      ...options
    };
    
    this.logger = this._createLogger('kgen-template-loader');
    this.frontmatterParser = new FrontmatterParser(options.frontmatter || {});
    
    // Template cache
    this.templateCache = new Map();
    this.directoryCache = new Map();
    this.indexCache = null;
    
    // Statistics
    this.stats = {
      templatesLoaded: 0,
      directoriesScanned: 0,
      cacheHits: 0,
      cacheMisses: 0,
      parseErrors: 0
    };
  }
  
  _createLogger(tag) {
    return {
      debug: (msg, ...args) => this.config.debug && console.log(`[${tag}] ${msg}`, ...args),
      info: (msg, ...args) => console.log(`[${tag}] ${msg}`, ...args),
      warn: (msg, ...args) => console.warn(`[${tag}] ${msg}`, ...args),
      error: (msg, ...args) => console.error(`[${tag}] ${msg}`, ...args)
    };
  }
  
  /**
   * Discover all templates in configured directories
   * @returns {Promise<Array>} Array of template metadata
   */
  async discoverTemplates() {
    const cacheKey = 'template-index';
    
    if (this.config.enableCache && this.indexCache) {
      this.stats.cacheHits++;
      this.logger.debug('Using cached template index');
      return this.indexCache;
    }
    
    const templates = [];
    const searchPaths = Array.isArray(this.config.searchPaths) 
      ? this.config.searchPaths 
      : [this.config.templatesDir];
    
    for (const searchPath of searchPaths) {
      try {
        const pathTemplates = await this._scanDirectory(searchPath);
        templates.push(...pathTemplates);
        this.stats.directoriesScanned++;
      } catch (error) {
        this.logger.warn(`Failed to scan directory ${searchPath}:`, error.message);
      }
    }
    
    // Sort templates deterministically
    const sortedTemplates = this.config.sortTemplates 
      ? templates.sort((a, b) => a.path.localeCompare(b.path))
      : templates;
    
    // Cache the index
    if (this.config.enableCache) {
      this.indexCache = sortedTemplates;
    }
    
    this.logger.info(`Discovered ${sortedTemplates.length} templates`);
    return sortedTemplates;
  }
  
  /**
   * Load a specific template by path
   * @param {string} templatePath - Path to template
   * @returns {Promise<Object>} Template object
   */
  async loadTemplate(templatePath) {
    const normalizedPath = this._normalizePath(templatePath);
    
    // Check cache first
    const cacheKey = `template:${normalizedPath}`;
    if (this.config.enableCache && this.templateCache.has(cacheKey)) {
      this.stats.cacheHits++;
      this.logger.debug(`Template cache hit: ${normalizedPath}`);
      return this.templateCache.get(cacheKey);
    }
    
    this.stats.cacheMisses++;
    
    try {
      const template = await this._loadTemplateFile(normalizedPath);
      
      // Cache the template
      if (this.config.enableCache) {
        this.templateCache.set(cacheKey, template);
      }
      
      this.stats.templatesLoaded++;
      this.logger.debug(`Template loaded: ${normalizedPath}`);
      return template;
      
    } catch (error) {
      this.logger.error(`Failed to load template ${normalizedPath}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Load template from string content
   * @param {string} content - Template content
   * @param {string} id - Template identifier
   * @returns {Object} Template object
   */
  loadTemplateFromString(content, id = 'string-template') {
    try {
      const template = this._parseTemplateContent(content, {
        id,
        path: `string:${id}`,
        source: 'string',
        size: content.length,
        isString: true
      });
      
      this.logger.debug(`String template loaded: ${id}`);
      return template;
      
    } catch (error) {
      this.logger.error(`Failed to load string template ${id}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get template by ID or path
   * @param {string} identifier - Template ID or path
   * @returns {Promise<Object>} Template object
   */
  async getTemplate(identifier) {
    // Try to find in cache first
    for (const [cacheKey, template] of this.templateCache) {
      if (template.id === identifier || template.path === identifier) {
        this.stats.cacheHits++;
        return template;
      }
    }
    
    // Try to resolve as path
    try {
      return await this.loadTemplate(identifier);
    } catch (error) {
      // Try to find in discovered templates
      const templates = await this.discoverTemplates();
      const found = templates.find(t => t.id === identifier || t.name === identifier);
      
      if (found) {
        return await this.loadTemplate(found.path);
      }
      
      throw new Error(`Template not found: ${identifier}`);
    }
  }
  
  /**
   * List all available templates
   * @returns {Promise<Array>} Array of template summaries
   */
  async listTemplates() {
    const templates = await this.discoverTemplates();
    
    return templates.map(template => ({
      id: template.id,
      name: template.name || template.id,
      path: template.path,
      category: template.category,
      description: template.description,
      size: template.size,
      hash: template.hash,
      hasConfig: Boolean(template.config && Object.keys(template.config).length > 0)
    }));
  }
  
  /**
   * Scan directory for templates recursively
   * @private
   */
  async _scanDirectory(dirPath) {
    const templates = [];
    
    try {
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        return templates;
      }
    } catch (error) {
      // Directory doesn't exist
      return templates;
    }
    
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // Skip excluded patterns
      if (this._shouldExclude(fullPath)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subTemplates = await this._scanDirectory(fullPath);
        templates.push(...subTemplates);
      } else if (entry.isFile() && this._isTemplateFile(entry.name)) {
        try {
          const templateMeta = await this._extractTemplateMetadata(fullPath);
          templates.push(templateMeta);
        } catch (error) {
          this.logger.warn(`Failed to extract metadata from ${fullPath}:`, error.message);
          this.stats.parseErrors++;
        }
      }
    }
    
    return templates;
  }
  
  /**
   * Load template file from filesystem
   * @private
   */
  async _loadTemplateFile(templatePath) {
    const resolvedPath = await this._resolveTemplatePath(templatePath);
    const stats = await fs.stat(resolvedPath);
    const content = await fs.readFile(resolvedPath, 'utf8');
    
    const template = this._parseTemplateContent(content, {
      path: templatePath,
      resolvedPath,
      source: 'file',
      size: stats.size,
      mtime: stats.mtime.toISOString(),
      isString: false
    });
    
    return template;
  }
  
  /**
   * Parse template content and extract metadata
   * @private
   */
  _parseTemplateContent(content, fileInfo) {
    // Parse frontmatter
    const { data: frontmatter, content: templateBody, metadata } = this.frontmatterParser.parse(content);
    
    // Generate template ID
    const id = frontmatter.id || frontmatter.name || this._generateTemplateId(fileInfo.path);
    
    // Extract template configuration
    const config = metadata.config || {};
    
    // Compute content hash
    const contentHash = this._computeHash(content);
    
    const template = {
      // Template identification
      id,
      name: frontmatter.name || id,
      path: this._normalizePath(fileInfo.path),
      
      // Content
      content: templateBody,
      frontmatter,
      raw: content,
      
      // Metadata
      description: frontmatter.description,
      category: frontmatter.category || 'general',
      version: frontmatter.version || '1.0.0',
      author: frontmatter.author,
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      
      // Template configuration
      config,
      
      // File information
      source: fileInfo.source,
      size: fileInfo.size,
      mtime: fileInfo.mtime,
      isString: fileInfo.isString,
      
      // Hashes and validation
      hash: contentHash,
      frontmatterHash: metadata.hash,
      templateHash: this._computeHash(templateBody),
      
      // Processing metadata
      hasFrontmatter: metadata.hasFrontmatter,
      frontmatterFormat: metadata.format,
      
      // Validation
      ...(this.config.validateTemplates ? this._validateTemplate(frontmatter, templateBody) : {})
    };
    
    return template;
  }
  
  /**
   * Extract basic template metadata without full parsing
   * @private
   */
  async _extractTemplateMetadata(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      
      // Quick frontmatter parsing for metadata only
      const { data: frontmatter } = this.frontmatterParser.parse(content);
      
      const relativePath = path.relative(process.cwd(), filePath);
      const id = frontmatter.id || frontmatter.name || this._generateTemplateId(relativePath);
      
      return {
        id,
        name: frontmatter.name || id,
        path: this._normalizePath(relativePath),
        category: frontmatter.category || 'general',
        description: frontmatter.description,
        size: stats.size,
        mtime: stats.mtime.toISOString(),
        hash: this._computeHash(content),
        hasConfig: Boolean(this.frontmatterParser._extractTemplateConfig(frontmatter))
      };
      
    } catch (error) {
      throw new Error(`Failed to extract metadata from ${filePath}: ${error.message}`);
    }
  }
  
  /**
   * Resolve template path to absolute path
   * @private
   */
  async _resolveTemplatePath(templatePath) {
    // If already absolute, use as-is
    if (path.isAbsolute(templatePath)) {
      return templatePath;
    }
    
    // Try each search path
    for (const searchPath of this.config.searchPaths) {
      const fullPath = path.resolve(searchPath, templatePath);
      try {
        await fs.access(fullPath);
        return fullPath;
      } catch {
        // Continue to next search path
      }
    }
    
    throw new Error(`Template not found in search paths: ${templatePath}`);
  }
  
  /**
   * Generate template ID from path
   * @private
   */
  _generateTemplateId(templatePath) {
    const normalized = this._normalizePath(templatePath);
    const parsed = path.parse(normalized);
    
    // Remove template extensions
    let id = parsed.name;
    for (const ext of this.config.templateExtensions) {
      if (id.endsWith(ext.slice(1))) { // Remove the dot
        id = id.slice(0, -ext.length + 1);
        break;
      }
    }
    
    return id;
  }
  
  /**
   * Check if file should be excluded
   * @private
   */
  _shouldExclude(filePath) {
    const relativePath = path.relative(process.cwd(), filePath);
    
    for (const pattern of this.config.excludePatterns) {
      if (pattern instanceof RegExp) {
        if (pattern.test(relativePath)) return true;
      } else if (typeof pattern === 'string') {
        if (relativePath.includes(pattern)) return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if file is a template file
   * @private
   */
  _isTemplateFile(filename) {
    return this.config.templateExtensions.some(ext => 
      filename.endsWith(ext)
    );
  }
  
  /**
   * Normalize path for cross-platform consistency
   * @private
   */
  _normalizePath(filePath) {
    if (!this.config.canonicalPaths) return filePath;
    
    // Always use forward slashes
    return filePath.replace(/\\/g, '/');
  }
  
  /**
   * Validate template content
   * @private
   */
  _validateTemplate(frontmatter, templateBody) {
    const validation = this.frontmatterParser.validate(frontmatter);
    const issues = [];
    
    // Check for empty template body
    if (!templateBody.trim()) {
      issues.push('Template body is empty');
    }
    
    // Check for Nunjucks syntax errors (basic)
    if (templateBody.includes('{{') && !templateBody.includes('}}')) {
      issues.push('Unclosed template expression detected');
    }
    
    if (templateBody.includes('{%') && !templateBody.includes('%}')) {
      issues.push('Unclosed template statement detected');
    }
    
    return {
      validation: {
        valid: validation.valid && issues.length === 0,
        errors: [...validation.errors, ...issues],
        warnings: validation.warnings
      }
    };
  }
  
  /**
   * Compute deterministic hash
   * @private
   */
  _computeHash(input) {
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
  }
  
  // Public API methods
  
  /**
   * Clear all caches
   */
  clearCache() {
    this.templateCache.clear();
    this.directoryCache.clear();
    this.indexCache = null;
    this.logger.debug('Template caches cleared');
  }
  
  /**
   * Get loader statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      cacheSize: this.templateCache.size,
      directoryCacheSize: this.directoryCache.size,
      hasIndex: Boolean(this.indexCache),
      config: {
        templatesDir: this.config.templatesDir,
        searchPaths: this.config.searchPaths,
        templateExtensions: this.config.templateExtensions,
        enableCache: this.config.enableCache,
        sortTemplates: this.config.sortTemplates
      }
    };
  }
  
  /**
   * Reload template by path (bypassing cache)
   */
  async reloadTemplate(templatePath) {
    const normalizedPath = this._normalizePath(templatePath);
    const cacheKey = `template:${normalizedPath}`;
    
    // Remove from cache
    this.templateCache.delete(cacheKey);
    
    // Reload
    return await this.loadTemplate(templatePath);
  }
}

/**
 * Factory function for creating template loader
 */
function createTemplateLoader(options = {}) {
  return new TemplateLoader(options);
}

export {
  TemplateLoader,
  createTemplateLoader
};