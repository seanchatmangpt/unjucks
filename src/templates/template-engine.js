const nunjucks = require('nunjucks');
const path = require('path');
const fs = require('fs').promises;

/**
 * Template Engine with Inheritance System
 * Provides document template processing with variable substitution,
 * conditional rendering, and template inheritance
 */
class TemplateEngine {
  constructor(templateDir = path.join(__dirname)) {
    this.templateDir = templateDir;
    this.env = nunjucks.configure([templateDir], {
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true
    });
    
    // Template inheritance registry
    this.templates = new Map();
    this.baseTemplates = new Map();
    
    // Add custom filters
    this.addCustomFilters();
  }

  /**
   * Add custom Nunjucks filters for document formatting
   */
  addCustomFilters() {
    // Date formatting filter
    this.env.addFilter('dateFormat', (date, format = 'MMMM DD, YYYY') => {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    });

    // Currency formatting filter
    this.env.addFilter('currency', (amount, currency = 'USD') => {
      if (typeof amount !== 'number') return amount;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amount);
    });

    // Capitalize first letter filter
    this.env.addFilter('capitalize', (str) => {
      if (typeof str !== 'string') return str;
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Word count filter
    this.env.addFilter('wordCount', (str) => {
      if (typeof str !== 'string') return 0;
      return str.trim().split(/\s+/).length;
    });

    // Legal clause numbering
    this.env.addFilter('legalNumber', (index, style = 'numeric') => {
      const styles = {
        numeric: (i) => `${i + 1}.`,
        alpha: (i) => `${String.fromCharCode(97 + i)}.`,
        roman: (i) => this.toRoman(i + 1) + '.',
        parenthetical: (i) => `(${i + 1})`
      };
      return styles[style] ? styles[style](index) : styles.numeric(index);
    });
  }

  /**
   * Convert number to Roman numeral
   */
  toRoman(num) {
    const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const symbols = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
    let result = '';
    
    for (let i = 0; i < values.length; i++) {
      while (num >= values[i]) {
        result += symbols[i];
        num -= values[i];
      }
    }
    return result;
  }

  /**
   * Register a template with optional inheritance
   */
  async registerTemplate(name, templatePath, baseTemplate = null) {
    try {
      const content = await fs.readFile(templatePath, 'utf8');
      this.templates.set(name, {
        path: templatePath,
        content,
        baseTemplate,
        compiled: this.env.compile(content)
      });
      
      if (baseTemplate) {
        if (!this.baseTemplates.has(baseTemplate)) {
          this.baseTemplates.set(baseTemplate, new Set());
        }
        this.baseTemplates.get(baseTemplate).add(name);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to register template '${name}': ${error.message}`);
    }
  }

  /**
   * Load all templates from a directory
   */
  async loadTemplatesFromDirectory(dir = this.templateDir) {
    try {
      const files = await fs.readdir(dir, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isDirectory()) {
          await this.loadTemplatesFromDirectory(path.join(dir, file.name));
        } else if (file.name.endsWith('.njk')) {
          const templateName = path.basename(file.name, '.njk');
          const templatePath = path.join(dir, file.name);
          await this.registerTemplate(templateName, templatePath);
        }
      }
    } catch (error) {
      throw new Error(`Failed to load templates from directory: ${error.message}`);
    }
  }

  /**
   * Render a template with data
   */
  async render(templateName, data = {}, options = {}) {
    try {
      // Validate template exists
      if (!this.templates.has(templateName)) {
        // Try to load template file directly
        const templatePath = path.join(this.templateDir, `${templateName}.njk`);
        try {
          await this.registerTemplate(templateName, templatePath);
        } catch {
          throw new Error(`Template '${templateName}' not found`);
        }
      }

      // Merge with default data
      const mergedData = {
        ...this.getDefaultData(),
        ...data,
        ...options
      };

      // Render template
      const template = this.templates.get(templateName);
      const result = template.compiled.render(mergedData);

      // Post-process if needed
      return this.postProcess(result, options);
    } catch (error) {
      throw new Error(`Failed to render template '${templateName}': ${error.message}`);
    }
  }

  /**
   * Get default template data
   */
  getDefaultData() {
    return {
      currentDate: this.getDeterministicDate().toISOString().split('T')[0],
      currentYear: this.getDeterministicDate().getFullYear(),
      currentDateTime: this.getDeterministicDate().toISOString(),
      templateEngine: 'Unjucks Template System v1.0'
    };
  }

  /**
   * Post-process rendered content
   */
  postProcess(content, options = {}) {
    let processed = content;

    // Remove extra whitespace if requested
    if (options.trimWhitespace !== false) {
      processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n');
    }

    // Add document metadata
    if (options.addMetadata) {
      const metadata = `<!-- Generated by Unjucks Template Engine on ${this.getDeterministicDate().toISOString()} -->\n`;
      processed = metadata + processed;
    }

    return processed;
  }

  /**
   * Validate template data against schema
   */
  validateData(data, schema) {
    const errors = [];

    for (const [key, rules] of Object.entries(schema)) {
      const value = data[key];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required field '${key}' is missing`);
        continue;
      }

      if (value !== undefined && rules.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rules.type) {
          errors.push(`Field '${key}' must be of type '${rules.type}', got '${actualType}'`);
        }
      }

      if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
        errors.push(`Field '${key}' does not match required pattern`);
      }

      if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
        errors.push(`Field '${key}' must be at least ${rules.minLength} characters long`);
      }
    }

    return errors;
  }

  /**
   * Get template inheritance chain
   */
  getInheritanceChain(templateName) {
    const chain = [templateName];
    let current = this.templates.get(templateName);

    while (current && current.baseTemplate) {
      chain.unshift(current.baseTemplate);
      current = this.templates.get(current.baseTemplate);
    }

    return chain;
  }

  /**
   * List all available templates
   */
  listTemplates() {
    const templates = {};
    
    for (const [name, template] of this.templates) {
      templates[name] = {
        baseTemplate: template.baseTemplate,
        inheritedBy: Array.from(this.baseTemplates.get(name) || [])
      };
    }
    
    return templates;
  }

  /**
   * Create template from existing document
   */
  createTemplateFromDocument(content, variables = []) {
    let template = content;

    // Replace identified variables with Nunjucks syntax
    variables.forEach(variable => {
      const regex = new RegExp(variable.pattern, 'g');
      template = template.replace(regex, `{{ ${variable.name} }}`);
    });

    return template;
  }

  /**
   * Extract variables from template
   */
  extractVariables(templateContent) {
    const variables = new Set();
    
    if (!templateContent || typeof templateContent !== 'string') {
      return Array.from(variables);
    }

    // Enhanced variable extraction that handles complex expressions
    const variableRegex = /{{\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)(?:\s*\|[^}]*)?/g;
    let match;

    while ((match = variableRegex.exec(templateContent)) !== null) {
      const fullExpression = match[1];
      const rootVar = fullExpression.split('.')[0];
      
      if (rootVar && this.isValidVariableName(rootVar)) {
        variables.add(rootVar);
      }
    }

    // Also extract from control flow statements
    const controlFlowRegex = /{%\s*(if|for|elif|unless)\s+([^%]+)\s*%}/g;
    while ((match = controlFlowRegex.exec(templateContent)) !== null) {
      const statement = match[2];
      
      if (match[1] === 'for') {
        // Handle {% for item in items %}
        const forMatch = statement.match(/\w+\s+in\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (forMatch && this.isValidVariableName(forMatch[1])) {
          variables.add(forMatch[1]);
        }
      } else {
        // Handle conditionals
        const conditionVars = statement.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
        if (conditionVars) {
          for (const varName of conditionVars) {
            if (this.isValidVariableName(varName) &&
                !['and', 'or', 'not', 'in', 'is', 'true', 'false', 'null', 'undefined'].includes(varName)) {
              variables.add(varName);
            }
          }
        }
      }
    }

    return Array.from(variables);
  }

  /**
   * Check if variable name is valid
   */
  isValidVariableName(name) {
    if (!name || typeof name !== 'string') return false;
    
    // Must start with letter, $, or _
    if (!/^[a-zA-Z_$]/.test(name)) return false;
    
    // Must contain only valid characters
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) return false;
    
    // Exclude filters and reserved words
    const reserved = [
      'default', 'length', 'first', 'last', 'random', 'sort', 'reverse',
      'join', 'upper', 'lower', 'title', 'trim', 'safe', 'escape',
      'replace', 'split', 'slice', 'round', 'abs', 'min', 'max',
      'pascalCase', 'camelCase', 'kebabCase', 'snakeCase', 'capitalize'
    ];
    
    return !reserved.includes(name.toLowerCase());
  }
}

module.exports = TemplateEngine;