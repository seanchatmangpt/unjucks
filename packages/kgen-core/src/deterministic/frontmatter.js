/**
 * KGEN Core Frontmatter Parser - Pure JavaScript
 * 
 * Deterministic frontmatter parsing with support for:
 * - YAML frontmatter
 * - JSON frontmatter
 * - Template configuration (to, inject, before, after, etc.)
 * - Canonical key ordering for deterministic output
 */

import crypto from 'crypto';

class FrontmatterParser {
  constructor(options = {}) {
    this.config = {
      // Deterministic settings
      sortKeys: options.sortKeys !== false,
      canonicalEncoding: options.canonicalEncoding || 'utf8',
      strictMode: options.strictMode !== false,
      
      // Template configuration keys
      reservedKeys: [
        'to', 'inject', 'before', 'after', 'append', 'prepend',
        'lineAt', 'skipIf', 'chmod', 'sh', 'force', 'encoding',
        'minify', 'trimBlocks', 'stripTemporal'
      ],
      
      ...options
    };
    
    this.logger = this._createLogger('kgen-frontmatter-parser');
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
   * Parse frontmatter from template content
   * @param {string} content - Template content with optional frontmatter
   * @returns {Object} { data, content, metadata }
   */
  parse(content) {
    if (typeof content !== 'string') {
      return {
        data: {},
        content: '',
        metadata: {
          hasFrontmatter: false,
          format: null,
          hash: this._computeHash('')
        }
      };
    }
    
    // Normalize line endings
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Try YAML frontmatter first
    const yamlResult = this._parseYamlFrontmatter(normalizedContent);
    if (yamlResult.hasFrontmatter) {
      return {
        data: this.config.sortKeys ? this._sortKeysRecursive(yamlResult.data) : yamlResult.data,
        content: yamlResult.content,
        metadata: {
          hasFrontmatter: true,
          format: 'yaml',
          hash: this._computeHash(JSON.stringify(yamlResult.data)),
          raw: yamlResult.raw,
          config: this._extractTemplateConfig(yamlResult.data)
        }
      };
    }
    
    // Try JSON frontmatter
    const jsonResult = this._parseJsonFrontmatter(normalizedContent);
    if (jsonResult.hasFrontmatter) {
      return {
        data: this.config.sortKeys ? this._sortKeysRecursive(jsonResult.data) : jsonResult.data,
        content: jsonResult.content,
        metadata: {
          hasFrontmatter: true,
          format: 'json',
          hash: this._computeHash(JSON.stringify(jsonResult.data)),
          raw: jsonResult.raw,
          config: this._extractTemplateConfig(jsonResult.data)
        }
      };
    }
    
    // No frontmatter found
    return {
      data: {},
      content: normalizedContent,
      metadata: {
        hasFrontmatter: false,
        format: null,
        hash: this._computeHash('{}'),
        config: {}
      }
    };
  }
  
  /**
   * Parse YAML frontmatter (--- delimiter)
   */
  _parseYamlFrontmatter(content) {
    if (!content.startsWith('---\n')) {
      return { hasFrontmatter: false };
    }
    
    const endIndex = content.indexOf('\n---\n', 4);
    if (endIndex === -1) {
      return { hasFrontmatter: false };
    }
    
    const frontmatterStr = content.slice(4, endIndex);
    const body = content.slice(endIndex + 5);
    
    try {
      const data = this._parseYamlContent(frontmatterStr);
      return {
        hasFrontmatter: true,
        data,
        content: body,
        raw: frontmatterStr
      };
    } catch (error) {
      if (this.config.strictMode) {
        throw new Error(`YAML frontmatter parse error: ${error.message}`);
      }
      
      this.logger.warn('YAML frontmatter parse failed, skipping:', error.message);
      return { hasFrontmatter: false };
    }
  }
  
  /**
   * Parse JSON frontmatter ({{{ ... }}})
   */
  _parseJsonFrontmatter(content) {
    if (!content.startsWith('{{{\n')) {
      return { hasFrontmatter: false };
    }
    
    const endIndex = content.indexOf('\n}}}', 4);
    if (endIndex === -1) {
      return { hasFrontmatter: false };
    }
    
    const frontmatterStr = content.slice(4, endIndex);
    const body = content.slice(endIndex + 5);
    
    try {
      const data = JSON.parse(frontmatterStr);
      return {
        hasFrontmatter: true,
        data,
        content: body,
        raw: frontmatterStr
      };
    } catch (error) {
      if (this.config.strictMode) {
        throw new Error(`JSON frontmatter parse error: ${error.message}`);
      }
      
      this.logger.warn('JSON frontmatter parse failed, skipping:', error.message);
      return { hasFrontmatter: false };
    }
  }
  
  /**
   * Parse YAML content deterministically
   */
  _parseYamlContent(yamlStr) {
    const lines = yamlStr.split('\n');
    const result = {};
    let currentKey = null;
    let currentValue = [];
    let inMultiline = false;
    
    for (let line of lines) {
      const originalLine = line;
      line = line.trimRight(); // Keep leading whitespace for indentation
      
      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith('#')) {
        continue;
      }
      
      // Handle multiline values
      if (inMultiline) {
        if (line.startsWith('  ') || line.startsWith('\t')) {
          currentValue.push(line.trim());
          continue;
        } else {
          // End of multiline value
          result[currentKey] = currentValue.join('\n');
          currentValue = [];
          inMultiline = false;
          currentKey = null;
        }
      }
      
      // Handle key-value pairs
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        
        if (!value || value === '|' || value === '>') {
          // Multiline value indicator
          currentKey = key;
          inMultiline = true;
          currentValue = [];
        } else {
          // Single line value
          result[key] = this._parseYamlValue(value);
        }
      }
    }
    
    // Handle final multiline value
    if (inMultiline && currentKey) {
      result[currentKey] = currentValue.join('\n');
    }
    
    return result;
  }
  
  /**
   * Parse individual YAML value deterministically
   */
  _parseYamlValue(value) {
    // Boolean values
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null' || value === '~') return null;
    
    // Numbers
    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^-?\d+\.\d+$/.test(value)) {
      return parseFloat(value);
    }
    
    // Quoted strings
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    
    // Arrays (simple format: [item1, item2, item3])
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        return JSON.parse(value);
      } catch {
        // Fallback to string if JSON parse fails
        return value;
      }
    }
    
    // Objects (simple format: {key: value})
    if (value.startsWith('{') && value.endsWith('}')) {
      try {
        return JSON.parse(value);
      } catch {
        // Fallback to string if JSON parse fails
        return value;
      }
    }
    
    // Default to string
    return value;
  }
  
  /**
   * Extract template configuration from frontmatter
   */
  _extractTemplateConfig(data) {
    const config = {};
    
    for (const key of this.config.reservedKeys) {
      if (data.hasOwnProperty(key)) {
        config[key] = data[key];
      }
    }
    
    return config;
  }
  
  /**
   * Sort object keys recursively for deterministic output
   */
  _sortKeysRecursive(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._sortKeysRecursive(item));
    }
    
    const sorted = {};
    const keys = Object.keys(obj).sort();
    
    for (const key of keys) {
      sorted[key] = this._sortKeysRecursive(obj[key]);
    }
    
    return sorted;
  }
  
  /**
   * Compute deterministic hash
   */
  _computeHash(input) {
    const canonical = typeof input === 'string' ? input.trim() : JSON.stringify(input);
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }
  
  /**
   * Serialize frontmatter back to string
   * @param {Object} data - Frontmatter data
   * @param {string} format - Output format ('yaml' or 'json')
   * @returns {string} Serialized frontmatter
   */
  serialize(data, format = 'yaml') {
    const sortedData = this.config.sortKeys ? this._sortKeysRecursive(data) : data;
    
    if (format === 'json') {
      const jsonStr = JSON.stringify(sortedData, null, 2);
      return `{{{\n${jsonStr}\n}}}`;
    } else {
      // Default to YAML
      const yamlStr = this._serializeYaml(sortedData);
      return `---\n${yamlStr}\n---`;
    }
  }
  
  /**
   * Serialize object to YAML format
   */
  _serializeYaml(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    const lines = [];
    
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        lines.push(`${spaces}${key}: null`);
      } else if (typeof value === 'boolean') {
        lines.push(`${spaces}${key}: ${value}`);
      } else if (typeof value === 'number') {
        lines.push(`${spaces}${key}: ${value}`);
      } else if (typeof value === 'string') {
        if (value.includes('\n')) {
          // Multiline string
          lines.push(`${spaces}${key}: |`);
          const valueLines = value.split('\n');
          for (const line of valueLines) {
            lines.push(`${spaces}  ${line}`);
          }
        } else if (value.includes(':') || value.includes('#') || value.trim() !== value) {
          // Quote if contains special characters
          lines.push(`${spaces}${key}: "${value.replace(/"/g, '\\"')}"`);
        } else {
          lines.push(`${spaces}${key}: ${value}`);
        }
      } else if (Array.isArray(value)) {
        lines.push(`${spaces}${key}:`);
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            lines.push(`${spaces}- `);
            const itemYaml = this._serializeYaml(item, indent + 1);
            lines.push(itemYaml.replace(/^  /, '    '));
          } else {
            lines.push(`${spaces}- ${item}`);
          }
        }
      } else if (typeof value === 'object') {
        lines.push(`${spaces}${key}:`);
        const nestedYaml = this._serializeYaml(value, indent + 1);
        lines.push(nestedYaml);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Validate frontmatter data
   */
  validate(data) {
    const errors = [];
    const warnings = [];
    
    if (typeof data !== 'object' || data === null) {
      errors.push('Frontmatter data must be an object');
      return { valid: false, errors, warnings };
    }
    
    // Validate template configuration
    const config = this._extractTemplateConfig(data);
    
    // Validate 'to' field (output path template)
    if (config.to && typeof config.to !== 'string') {
      errors.push("'to' field must be a string");
    }
    
    // Validate boolean fields
    const booleanFields = ['inject', 'force', 'skipIf', 'minify', 'trimBlocks', 'stripTemporal'];
    for (const field of booleanFields) {
      if (config[field] !== undefined && typeof config[field] !== 'boolean') {
        errors.push(`'${field}' field must be a boolean`);
      }
    }
    
    // Validate numeric fields
    if (config.lineAt !== undefined && (!Number.isInteger(config.lineAt) || config.lineAt < 0)) {
      errors.push("'lineAt' field must be a non-negative integer");
    }
    
    // Validate string fields
    const stringFields = ['before', 'after', 'chmod', 'sh', 'encoding'];
    for (const field of stringFields) {
      if (config[field] !== undefined && typeof config[field] !== 'string') {
        errors.push(`'${field}' field must be a string`);
      }
    }
    
    // Check for deprecated or unknown configuration
    const knownKeys = [...this.config.reservedKeys, 'name', 'description', 'version', 'category'];
    for (const key of Object.keys(data)) {
      if (!knownKeys.includes(key)) {
        warnings.push(`Unknown configuration key '${key}' may be ignored`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config
    };
  }
}

/**
 * Factory function for creating frontmatter parser
 */
function createFrontmatterParser(options = {}) {
  return new FrontmatterParser(options);
}

/**
 * Parse frontmatter from content (convenience function)
 */
function parseFrontmatter(content, options = {}) {
  const parser = new FrontmatterParser(options);
  return parser.parse(content);
}

export {
  FrontmatterParser,
  createFrontmatterParser,
  parseFrontmatter
};