/**
 * KGEN Template Renderer
 * 
 * Provides deterministic Nunjucks-based template rendering
 * with RDF graph data integration and frontmatter support
 */

import nunjucks from 'nunjucks';
import path from 'path';
import fs from 'fs/promises';
import { FrontmatterParser } from './frontmatter.js';

export class TemplateRenderer {
  constructor(options = {}) {
    this.options = {
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
      ...options
    };
    
    this.env = null;
    this.frontmatterParser = new FrontmatterParser();
    this.cache = new Map();
  }

  initialize(templatesPath = './templates') {
    this.env = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(templatesPath),
      this.options
    );
    this.addCustomFilters();
    return this;
  }

  addCustomFilters() {
    if (!this.env) throw new Error('Environment not initialized');

    this.env.addFilter('hash', (str, algorithm = 'sha256') => {
      const crypto = require('crypto');
      return crypto.createHash(algorithm).update(str).digest('hex');
    });

    this.env.addFilter('namespace', (uri) => {
      const lastSlash = uri.lastIndexOf('/');
      const lastHash = uri.lastIndexOf('#');
      const separator = Math.max(lastSlash, lastHash);
      return separator > 0 ? uri.substring(0, separator + 1) : uri;
    });

    this.env.addFilter('localname', (uri) => {
      const lastSlash = uri.lastIndexOf('/');
      const lastHash = uri.lastIndexOf('#');
      const separator = Math.max(lastSlash, lastHash);
      return separator > 0 ? uri.substring(separator + 1) : uri;
    });

    this.env.addFilter('camelcase', (str) => {
      return str.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
    });

    this.env.addFilter('pascalcase', (str) => {
      const camel = str.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
      return camel.charAt(0).toUpperCase() + camel.slice(1);
    });

    this.env.addFilter('value', (literal) => {
      if (typeof literal === 'object' && literal.value !== undefined) {
        return literal.value;
      }
      return literal;
    });

    this.env.addFilter('isURI', (term) => term && term.termType === 'NamedNode');
    this.env.addFilter('isLiteral', (term) => term && term.termType === 'Literal');
    this.env.addFilter('isBlankNode', (term) => term && term.termType === 'BlankNode');
  }

  async render(templatePath, context = {}, options = {}) {
    if (!this.env) {
      throw new Error('Renderer not initialized. Call initialize() first.');
    }

    try {
      const templateContent = await fs.readFile(templatePath, 'utf8');
      const { content: templateBody, data: frontmatter } = 
        this.frontmatterParser.parse(templateContent);

      const enhancedContext = {
        ...context,
        meta: frontmatter,
        kgen: {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          template: path.basename(templatePath)
        }
      };

      const rendered = this.env.renderString(templateBody, enhancedContext);
      
      return {
        content: rendered,
        metadata: {
          template: templatePath,
          frontmatter,
          context: Object.keys(context),
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      throw new Error(`Template rendering failed for ${templatePath}: ${error.message}`);
    }
  }

  renderString(templateString, context = {}) {
    if (!this.env) {
      throw new Error('Renderer not initialized. Call initialize() first.');
    }
    return this.env.renderString(templateString, context);
  }

  clearCache() {
    this.cache.clear();
    if (this.env && this.env.cache) {
      this.env.cache = {};
    }
  }
}