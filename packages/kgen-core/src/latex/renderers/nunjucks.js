/**
 * KGEN LaTeX Template Renderer with Nunjucks Integration
 * Advanced template rendering system for LaTeX document generation
 * Provides secure, extensible template processing with KGEN integration
 */

import nunjucks from 'nunjucks';
import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { LaTeXSyntaxValidator } from '../validators/syntax.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Custom LaTeX filters for Nunjucks
 */
class LaTeXFilters {
  /**
   * Escape LaTeX special characters
   */
  static latexEscape(str) {
    if (typeof str !== 'string') return str;
    
    const escapeMap = {
      '&': '\\&',
      '%': '\\%',
      '$': '\\$',
      '#': '\\#',
      '^': '\\textasciicircum{}',
      '_': '\\_',
      '{': '\\{',
      '}': '\\}',
      '~': '\\textasciitilde{}',
      '\\': '\\textbackslash{}'
    };
    
    return str.replace(/[&%$#^_{}~\\]/g, char => escapeMap[char] || char);
  }
  
  /**
   * Format text as LaTeX command
   */
  static latexCommand(str, command = 'textbf') {
    if (typeof str !== 'string') return str;
    return `\\${command}{${str}}`;
  }
  
  /**
   * Format as LaTeX section
   */
  static section(str, level = 'section') {
    if (typeof str !== 'string') return str;
    return `\\${level}{${str}}`;
  }
  
  /**
   * Format as LaTeX list item
   */
  static listItem(str) {
    if (typeof str !== 'string') return str;
    return `\\item ${str}`;
  }
  
  /**
   * Format date for LaTeX
   */
  static latexDate(date) {
    if (!date) return '\\today';
    if (typeof date === 'string') return date;
    if (date instanceof Date) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    return '\\today';
  }
  
  /**
   * Format as LaTeX citation
   */
  static cite(str) {
    if (typeof str !== 'string') return str;
    return `\\cite{${str}}`;
  }
  
  /**
   * Format as LaTeX reference
   */
  static ref(str) {
    if (typeof str !== 'string') return str;
    return `\\ref{${str}}`;
  }
  
  /**
   * Join array with LaTeX formatting
   */
  static latexJoin(arr, separator = ', ', lastSeparator = ' and ') {
    if (!Array.isArray(arr)) return arr;
    if (arr.length === 0) return '';
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return arr.join(lastSeparator);
    
    const lastItem = arr.pop();
    return arr.join(separator) + lastSeparator + lastItem;
  }
  
  /**
   * Format boolean as LaTeX true/false
   */
  static latexBool(value) {
    return value ? 'true' : 'false';
  }
  
  /**
   * Convert to LaTeX verbatim
   */
  static verbatim(str) {
    if (typeof str !== 'string') return str;
    return `\\texttt{${str.replace(/[{}]/g, char => char === '{' ? '\\{' : '\\}')}}}`;
  }
  
  /**
   * Format as LaTeX math mode
   */
  static math(str, inline = true) {
    if (typeof str !== 'string') return str;
    return inline ? `$${str}$` : `\\[${str}\\]`;
  }
}

/**
 * LaTeX-specific Nunjucks extensions
 */
class LaTeXExtensions {
  /**
   * Conditional LaTeX block extension
   * {% latexif condition %}...{% endlatexif %}
   */
  static createLatexIfExtension() {
    return new (class {
      constructor() {
        this.tags = ['latexif'];
      }
      
      parse(parser, nodes, lexer) {
        const tok = parser.nextToken();
        const args = parser.parseExpression();
        
        parser.advanceAfterBlockEnd(tok.value);
        const body = parser.parseUntilBlocks('endlatexif');
        parser.advanceAfterBlockEnd();
        
        return new nodes.CallExtension(this, 'run', args, [body]);
      }
      
      run(context, condition, body) {
        if (condition) {
          return new nunjucks.runtime.SafeString(body());
        }
        return '';
      }
    })();
  }
  
  /**
   * LaTeX package inclusion extension
   * {% usepackage 'package' with options %}
   */
  static createUsePackageExtension() {
    return new (class {
      constructor() {
        this.tags = ['usepackage'];
      }
      
      parse(parser, nodes, lexer) {
        const tok = parser.nextToken();
        const packageName = parser.parseExpression();
        
        let options = null;
        if (parser.peekToken().value === 'with') {
          parser.nextToken(); // consume 'with'
          options = parser.parseExpression();
        }
        
        parser.advanceAfterBlockEnd(tok.value);
        
        return new nodes.CallExtension(this, 'run', packageName, [options]);
      }
      
      run(context, packageName, options) {
        let result = '\\usepackage';
        if (options) {
          result += `[${options}]`;
        }
        result += `{${packageName}}`;
        return new nunjucks.runtime.SafeString(result);
      }
    })();
  }
  
  /**
   * LaTeX environment extension
   * {% latexenv 'itemize' %}...{% endlatexenv %}
   */
  static createLatexEnvExtension() {
    return new (class {
      constructor() {
        this.tags = ['latexenv'];
      }
      
      parse(parser, nodes, lexer) {
        const tok = parser.nextToken();
        const envName = parser.parseExpression();
        
        let options = null;
        if (parser.peekToken().value === 'with') {
          parser.nextToken(); // consume 'with'
          options = parser.parseExpression();
        }
        
        parser.advanceAfterBlockEnd(tok.value);
        const body = parser.parseUntilBlocks('endlatexenv');
        parser.advanceAfterBlockEnd();
        
        return new nodes.CallExtension(this, 'run', envName, [options, body]);
      }
      
      run(context, envName, options, body) {
        let result = `\\begin{${envName}}`;
        if (options) {
          result += `[${options}]`;
        }
        result += '\n' + body() + `\\end{${envName}}`;
        return new nunjucks.runtime.SafeString(result);
      }
    })();
  }
}

/**
 * Advanced LaTeX Template Renderer
 */
export class LaTeXTemplateRenderer {
  constructor(options = {}) {
    this.options = {
      templatesDir: options.templatesDir || join(__dirname, '../templates'),
      outputDir: options.outputDir || './dist/latex',
      validateOutput: true,
      strictMode: false,
      customFilters: {},
      customExtensions: [],
      cache: true,
      ...options
    };
    
    this.nunjucks = null;
    this.validator = new LaTeXSyntaxValidator({
      strictMode: this.options.strictMode
    });
    
    this.initialized = false;
  }
  
  /**
   * Initialize the renderer
   */
  async initialize() {
    if (this.initialized) return;
    
    // Setup Nunjucks environment
    const loader = new nunjucks.FileSystemLoader(this.options.templatesDir, {
      watch: !this.options.cache,
      noCache: !this.options.cache
    });
    
    this.nunjucks = new nunjucks.Environment(loader, {
      autoescape: false, // LaTeX doesn't use HTML-style escaping
      trimBlocks: true,
      lstripBlocks: true
    });
    
    // Add LaTeX filters
    this.addLaTeXFilters();
    
    // Add LaTeX extensions
    this.addLaTeXExtensions();
    
    // Add custom filters
    this.addCustomFilters();
    
    // Add custom extensions
    this.addCustomExtensions();
    
    this.initialized = true;
  }
  
  /**
   * Add LaTeX-specific filters
   */
  addLaTeXFilters() {
    const filters = {
      'latex_escape': LaTeXFilters.latexEscape,
      'latex_command': LaTeXFilters.latexCommand,
      'section': LaTeXFilters.section,
      'list_item': LaTeXFilters.listItem,
      'latex_date': LaTeXFilters.latexDate,
      'cite': LaTeXFilters.cite,
      'ref': LaTeXFilters.ref,
      'latex_join': LaTeXFilters.latexJoin,
      'latex_bool': LaTeXFilters.latexBool,
      'verbatim': LaTeXFilters.verbatim,
      'math': LaTeXFilters.math
    };
    
    Object.entries(filters).forEach(([name, filter]) => {
      this.nunjucks.addFilter(name, filter);
    });
  }
  
  /**
   * Add LaTeX-specific extensions
   */
  addLaTeXExtensions() {
    const extensions = [
      LaTeXExtensions.createLatexIfExtension(),
      LaTeXExtensions.createUsePackageExtension(),
      LaTeXExtensions.createLatexEnvExtension()
    ];
    
    extensions.forEach(ext => {
      this.nunjucks.addExtension(ext.constructor.name, ext);
    });
  }
  
  /**
   * Add custom filters from options
   */
  addCustomFilters() {
    Object.entries(this.options.customFilters).forEach(([name, filter]) => {
      this.nunjucks.addFilter(name, filter);
    });
  }
  
  /**
   * Add custom extensions from options
   */
  addCustomExtensions() {
    this.options.customExtensions.forEach(extension => {
      if (typeof extension === 'function') {
        const ext = extension();
        this.nunjucks.addExtension(ext.constructor.name, ext);
      } else {
        this.nunjucks.addExtension(extension.name, extension);
      }
    });
  }
  
  /**
   * Render a LaTeX template
   */
  async render(templateName, context = {}, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const renderOptions = { ...this.options, ...options };
    
    try {
      // Enhanced context with LaTeX utilities
      const enhancedContext = {
        ...context,
        latex: {
          escape: LaTeXFilters.latexEscape,
          today: this.getDeterministicDate().toISOString().split('T')[0],
          timestamp: this.getDeterministicDate().toISOString()
        },
        kgen: {
          version: process.env.KGEN_VERSION || '1.0.0',
          generated_at: this.getDeterministicDate().toISOString()
        }
      };
      
      // Render template
      const rendered = await new Promise((resolve, reject) => {
        this.nunjucks.render(templateName, enhancedContext, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      // Validate rendered LaTeX if enabled
      let validationResult = null;
      if (renderOptions.validateOutput) {
        validationResult = await this.validator.validate(rendered);
        
        if (!validationResult.valid && renderOptions.strictMode) {
          throw new Error(`Template validation failed: ${validationResult.summary.errors} errors found`);
        }
      }
      
      return {
        content: rendered,
        template: templateName,
        context: enhancedContext,
        validation: validationResult,
        metadata: {
          renderedAt: this.getDeterministicDate().toISOString(),
          templateName,
          contextKeys: Object.keys(enhancedContext),
          contentLength: rendered.length
        }
      };
      
    } catch (error) {
      throw new Error(`Template rendering failed: ${error.message}`);
    }
  }
  
  /**
   * Render template from string
   */
  async renderString(templateString, context = {}, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const renderOptions = { ...this.options, ...options };
    
    try {
      const enhancedContext = {
        ...context,
        latex: {
          escape: LaTeXFilters.latexEscape,
          today: this.getDeterministicDate().toISOString().split('T')[0],
          timestamp: this.getDeterministicDate().toISOString()
        },
        kgen: {
          version: process.env.KGEN_VERSION || '1.0.0',
          generated_at: this.getDeterministicDate().toISOString()
        }
      };
      
      const rendered = await new Promise((resolve, reject) => {
        this.nunjucks.renderString(templateString, enhancedContext, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      // Validate if enabled
      let validationResult = null;
      if (renderOptions.validateOutput) {
        validationResult = await this.validator.validate(rendered);
      }
      
      return {
        content: rendered,
        context: enhancedContext,
        validation: validationResult,
        metadata: {
          renderedAt: this.getDeterministicDate().toISOString(),
          templateLength: templateString.length,
          contentLength: rendered.length
        }
      };
      
    } catch (error) {
      throw new Error(`String template rendering failed: ${error.message}`);
    }
  }
  
  /**
   * Render and save to file
   */
  async renderToFile(templateName, outputPath, context = {}, options = {}) {
    const result = await this.render(templateName, context, options);
    
    // Ensure output directory exists
    await fs.mkdir(dirname(outputPath), { recursive: true });
    
    // Write rendered content
    await fs.writeFile(outputPath, result.content, 'utf8');
    
    return {
      ...result,
      outputPath,
      saved: true
    };
  }
  
  /**
   * Batch render multiple templates
   */
  async batchRender(templates, baseContext = {}, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const results = [];
    
    for (const template of templates) {
      try {
        const templateContext = {
          ...baseContext,
          ...(template.context || {})
        };
        
        const result = await this.render(
          template.name || template.template,
          templateContext,
          { ...options, ...(template.options || {}) }
        );
        
        // Save to file if output path specified
        if (template.output) {
          await fs.mkdir(dirname(template.output), { recursive: true });
          await fs.writeFile(template.output, result.content, 'utf8');
          result.outputPath = template.output;
          result.saved = true;
        }
        
        results.push({
          ...result,
          templateConfig: template,
          success: true
        });
        
      } catch (error) {
        results.push({
          templateConfig: template,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      results,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      total: results.length
    };
  }
  
  /**
   * List available templates
   */
  async listTemplates() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const templates = [];
    
    try {
      const files = await fs.readdir(this.options.templatesDir, { recursive: true });
      
      for (const file of files) {
        const ext = extname(file);
        if (['.tex', '.njk', '.j2'].includes(ext)) {
          const templatePath = join(this.options.templatesDir, file);
          const stats = await fs.stat(templatePath);
          
          templates.push({
            name: file,
            path: templatePath,
            size: stats.size,
            modified: stats.mtime,
            extension: ext
          });
        }
      }
    } catch (error) {
      throw new Error(`Failed to list templates: ${error.message}`);
    }
    
    return templates;
  }
  
  /**
   * Validate template syntax
   */
  async validateTemplate(templateName) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Try to render with minimal context
      const result = await this.render(templateName, {}, {
        validateOutput: true,
        strictMode: false
      });
      
      return {
        valid: result.validation?.valid !== false,
        issues: result.validation?.issues || [],
        template: templateName
      };
      
    } catch (error) {
      return {
        valid: false,
        issues: [{
          type: 'template_error',
          severity: 'error',
          message: error.message,
          line: 1,
          column: 1
        }],
        template: templateName
      };
    }
  }
  
  /**
   * Get renderer statistics
   */
  getStatistics() {
    return {
      initialized: this.initialized,
      templatesDir: this.options.templatesDir,
      filtersCount: Object.keys(this.options.customFilters).length + 10, // 10 built-in filters
      extensionsCount: this.options.customExtensions.length + 3, // 3 built-in extensions
      cacheEnabled: this.options.cache,
      validationEnabled: this.options.validateOutput
    };
  }
  
  /**
   * Clear template cache
   */
  clearCache() {
    if (this.nunjucks) {
      this.nunjucks.loaders.forEach(loader => {
        if (loader.cache) {
          loader.cache = {};
        }
      });
    }
  }
  
  /**
   * Add global variable
   */
  addGlobal(name, value) {
    if (this.nunjucks) {
      this.nunjucks.addGlobal(name, value);
    }
  }
  
  /**
   * Create template from KGEN template structure
   */
  async createFromKgenTemplate(kgenTemplate, context = {}) {
    // Extract template metadata
    const frontmatter = kgenTemplate.frontmatter || {};
    const templateContent = kgenTemplate.content || kgenTemplate.body || '';
    
    // Merge context with template variables
    const mergedContext = {
      ...context,
      ...frontmatter.variables,
      template: {
        name: frontmatter.name || 'Unknown',
        description: frontmatter.description || '',
        version: frontmatter.version || '1.0.0'
      }
    };
    
    // Render the template
    return this.renderString(templateContent, mergedContext);
  }
}

export default LaTeXTemplateRenderer;