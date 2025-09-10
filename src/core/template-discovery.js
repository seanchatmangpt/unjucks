/**
 * Template Discovery Engine
 * 
 * Discovers and indexes templates in the _templates directory,
 * parsing metadata and providing template resolution capabilities.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, extname, basename, dirname } from 'path';
import { glob } from 'glob';
import YAML from 'yaml';
import matter from 'gray-matter';

import { Logger } from '../utils/logger.js';

/**
 * Template Discovery Engine
 * 
 * Handles template discovery, metadata parsing, and template resolution
 * across multiple categories and hierarchies.
 */
export class TemplateDiscovery {
  /**
   * Initialize the template discovery engine
   * @param {Object} options - Configuration options
   * @param {string} options.templatesDir - Templates directory path
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.templatesDir = options.templatesDir || '_templates';
    this.logger = options.logger || new Logger();
    this.templateCache = new Map();
    this.metadataCache = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the discovery engine and scan for templates
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;

    this.logger.debug('Initializing template discovery', {
      templatesDir: this.templatesDir
    });

    await this.scanTemplates();
    this.initialized = true;

    this.logger.info('Template discovery initialized', {
      templates: this.templateCache.size,
      categories: this.getCategories().length
    });
  }

  /**
   * Scan templates directory and build index
   * @returns {Promise<void>}
   */
  async scanTemplates() {
    const templatesPath = resolve(this.templatesDir);
    
    if (!existsSync(templatesPath)) {
      this.logger.warn('Templates directory not found', { path: templatesPath });
      return;
    }

    try {
      // Find all template files and metadata
      const templateFiles = await glob('**/*.njk', { 
        cwd: templatesPath,
        absolute: false 
      });
      
      const metaFiles = await glob('**/meta.yml', { 
        cwd: templatesPath,
        absolute: false 
      });

      // Process metadata files first
      for (const metaFile of metaFiles) {
        await this.loadCategoryMetadata(metaFile);
      }

      // Process template files
      for (const templateFile of templateFiles) {
        await this.indexTemplate(templateFile);
      }

      this.logger.debug('Template scanning complete', {
        templates: templateFiles.length,
        metadata: metaFiles.length
      });

    } catch (error) {
      this.logger.error('Failed to scan templates', {
        error: error.message,
        templatesDir: this.templatesDir
      });
      throw error;
    }
  }

  /**
   * Load category metadata from meta.yml files
   * @param {string} metaFile - Relative path to meta.yml file
   * @returns {Promise<void>}
   */
  async loadCategoryMetadata(metaFile) {
    try {
      const metaPath = join(this.templatesDir, metaFile);
      const metaContent = readFileSync(metaPath, 'utf8');
      const metadata = YAML.parse(metaContent);
      
      const category = dirname(metaFile);
      
      this.metadataCache.set(category === '.' ? 'root' : category, {
        ...metadata,
        path: metaFile,
        category
      });

      this.logger.debug('Loaded category metadata', {
        category,
        name: metadata.name
      });

    } catch (error) {
      this.logger.error('Failed to load category metadata', {
        file: metaFile,
        error: error.message
      });
    }
  }

  /**
   * Index a template file and extract metadata
   * @param {string} templateFile - Relative path to template file
   * @returns {Promise<void>}
   */
  async indexTemplate(templateFile) {
    try {
      const templatePath = join(this.templatesDir, templateFile);
      const templateContent = readFileSync(templatePath, 'utf8');
      
      // Parse frontmatter and content
      const { data: frontmatter, content } = matter(templateContent);
      
      // Extract template information
      const category = dirname(templateFile);
      const fileName = basename(templateFile);
      const templateName = fileName.replace(/\.njk$/, '');
      
      // Extract variables from template content
      const variables = this.extractVariables(content, frontmatter);
      
      const templateInfo = {
        name: templateName,
        category: category === '.' ? 'root' : category,
        file: templateFile,
        path: templatePath,
        frontmatter,
        content,
        variables,
        extension: this.getTargetExtension(frontmatter.to || fileName),
        indexed: new Date().toISOString()
      };

      const templateKey = `${templateInfo.category}/${templateName}`;
      this.templateCache.set(templateKey, templateInfo);

      this.logger.debug('Indexed template', {
        key: templateKey,
        variables: variables.length,
        extension: templateInfo.extension
      });

    } catch (error) {
      this.logger.error('Failed to index template', {
        file: templateFile,
        error: error.message
      });
    }
  }

  /**
   * Extract variables from template content and frontmatter
   * @param {string} content - Template content
   * @param {Object} frontmatter - Template frontmatter
   * @returns {Array<Object>} Array of variable definitions
   */
  extractVariables(content, frontmatter) {
    const variables = [];
    const variableNames = new Set();

    // Regular expressions for different variable patterns
    const patterns = {
      simple: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
      filtered: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\|[^}]+\}\}/g,
      conditional: /\{%\s*if\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
      loop: /\{%\s*for\s+\w+\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
    };

    // Extract variables from content
    for (const [type, pattern] of Object.entries(patterns)) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const varName = match[1];
        if (!variableNames.has(varName)) {
          variableNames.add(varName);
          variables.push({
            name: varName,
            type: this.inferVariableType(varName, content),
            required: true,
            description: `Variable: ${varName}`,
            source: type
          });
        }
      }
    }

    // Extract variables from frontmatter path templates
    if (frontmatter.to) {
      const pathVars = frontmatter.to.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g);
      if (pathVars) {
        pathVars.forEach(varMatch => {
          const varName = varMatch.replace(/[{}]/g, '').trim();
          if (!variableNames.has(varName)) {
            variableNames.add(varName);
            variables.push({
              name: varName,
              type: 'string',
              required: true,
              description: `Path variable: ${varName}`,
              source: 'frontmatter'
            });
          }
        });
      }
    }

    // Add metadata variables if defined in frontmatter
    if (frontmatter.meta && frontmatter.meta.variables) {
      frontmatter.meta.variables.forEach(metaVar => {
        if (!variableNames.has(metaVar.name)) {
          variableNames.add(metaVar.name);
          variables.push({
            ...metaVar,
            source: 'metadata'
          });
        }
      });
    }

    return variables.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Infer variable type from name and usage context
   * @param {string} varName - Variable name
   * @param {string} content - Template content for context
   * @returns {string} Inferred type
   */
  inferVariableType(varName, content) {
    // Boolean patterns
    if (/^(with|is|has|enable|disable)[A-Z]/.test(varName)) {
      return 'boolean';
    }

    // Array patterns
    if (varName.endsWith('s') || content.includes(`${varName}.length`) || content.includes(`${varName}.map`)) {
      return 'array';
    }

    // Object patterns
    if (content.includes(`${varName}.`) && !content.includes(`${varName}.length`)) {
      return 'object';
    }

    // Default to string
    return 'string';
  }

  /**
   * Get target file extension from template path
   * @param {string} templatePath - Template output path
   * @returns {string} Target extension
   */
  getTargetExtension(templatePath) {
    if (!templatePath) return '';
    
    // Remove variable placeholders for extension detection
    const cleanPath = templatePath.replace(/\{\{[^}]+\}\}/g, 'placeholder');
    return extname(cleanPath).slice(1) || '';
  }

  /**
   * List all available templates
   * @param {Object} options - Filtering options
   * @param {string} options.category - Filter by category
   * @param {string} options.extension - Filter by target extension
   * @returns {Array<Object>} Array of template information
   */
  listTemplates(options = {}) {
    if (!this.initialized) {
      throw new Error('Template discovery not initialized. Call initialize() first.');
    }

    let templates = Array.from(this.templateCache.values());

    // Apply filters
    if (options.category) {
      templates = templates.filter(t => t.category === options.category);
    }

    if (options.extension) {
      templates = templates.filter(t => t.extension === options.extension);
    }

    return templates.map(template => ({
      name: template.name,
      category: template.category,
      extension: template.extension,
      description: template.frontmatter.meta?.description || '',
      variables: template.variables.length,
      file: template.file
    }));
  }

  /**
   * Get available template categories
   * @returns {Array<string>} Array of category names
   */
  getCategories() {
    if (!this.initialized) {
      throw new Error('Template discovery not initialized. Call initialize() first.');
    }

    const categories = new Set();
    this.templateCache.forEach(template => {
      if (template.category !== 'root') {
        categories.add(template.category);
      }
    });

    return Array.from(categories).sort();
  }

  /**
   * Resolve a template by category and name
   * @param {string} category - Template category
   * @param {string} name - Template name
   * @returns {Object|null} Template information or null if not found
   */
  resolveTemplate(category, name) {
    if (!this.initialized) {
      throw new Error('Template discovery not initialized. Call initialize() first.');
    }

    const templateKey = `${category}/${name}`;
    return this.templateCache.get(templateKey) || null;
  }

  /**
   * Get category metadata
   * @param {string} category - Category name
   * @returns {Object|null} Category metadata or null if not found
   */
  getCategoryMetadata(category) {
    return this.metadataCache.get(category) || null;
  }

  /**
   * Search templates by query
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array<Object>} Matching templates
   */
  searchTemplates(query, options = {}) {
    if (!this.initialized) {
      throw new Error('Template discovery not initialized. Call initialize() first.');
    }

    const searchQuery = query.toLowerCase();
    let templates = Array.from(this.templateCache.values());

    // Filter by search query
    templates = templates.filter(template => {
      return template.name.toLowerCase().includes(searchQuery) ||
             template.category.toLowerCase().includes(searchQuery) ||
             (template.frontmatter.meta?.description || '').toLowerCase().includes(searchQuery) ||
             (template.frontmatter.meta?.tags || []).some(tag => 
               tag.toLowerCase().includes(searchQuery)
             );
    });

    // Apply additional filters
    if (options.category) {
      templates = templates.filter(t => t.category === options.category);
    }

    return templates.map(template => ({
      name: template.name,
      category: template.category,
      extension: template.extension,
      description: template.frontmatter.meta?.description || '',
      variables: template.variables.length,
      file: template.file,
      relevance: this.calculateRelevance(template, searchQuery)
    })).sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Calculate search relevance score
   * @param {Object} template - Template object
   * @param {string} query - Search query
   * @returns {number} Relevance score
   */
  calculateRelevance(template, query) {
    let score = 0;

    // Exact name match
    if (template.name.toLowerCase() === query) score += 100;
    
    // Name contains query
    if (template.name.toLowerCase().includes(query)) score += 50;
    
    // Category match
    if (template.category.toLowerCase().includes(query)) score += 30;
    
    // Description match
    if ((template.frontmatter.meta?.description || '').toLowerCase().includes(query)) score += 20;
    
    // Tag match
    const tags = template.frontmatter.meta?.tags || [];
    if (tags.some(tag => tag.toLowerCase().includes(query))) score += 40;

    return score;
  }

  /**
   * Refresh template cache
   * @returns {Promise<void>}
   */
  async refresh() {
    this.templateCache.clear();
    this.metadataCache.clear();
    this.initialized = false;
    await this.initialize();
  }

  /**
   * Get discovery statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    if (!this.initialized) {
      return { templates: 0, categories: 0, variables: 0 };
    }

    const templates = Array.from(this.templateCache.values());
    const totalVariables = templates.reduce((sum, t) => sum + t.variables.length, 0);

    return {
      templates: templates.length,
      categories: this.getCategories().length,
      variables: totalVariables,
      extensions: new Set(templates.map(t => t.extension)).size
    };
  }
}