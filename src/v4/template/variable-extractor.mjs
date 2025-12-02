/**
 * @file Variable Extractor
 * @module unjucks-v4/template/variable-extractor
 * @description Scans templates for variables and infers types
 */

import { EventEmitter } from 'events';

/**
 * Variable Extractor - Scans templates for variables and infers types
 * 
 * @class VariableExtractor
 * @extends EventEmitter
 */
export class VariableExtractor extends EventEmitter {
  /**
   * Create a new VariableExtractor instance
   * @param {Object} options - Extractor options
   */
  constructor(options = {}) {
    super();
    this.config = options;
  }

  /**
   * Extract variables from template content
   * @param {string} template - Template content
   * @returns {Object} Extracted variables with type inference
   */
  extract(template) {
    if (!template || typeof template !== 'string') {
      return { variables: [], inferred: {} };
    }

    const variables = new Set();
    const inferred = {};

    // Extract {{ variable }} patterns
    const variablePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(\|[^}]+)?\s*\}\}/g;
    let match;
    
    while ((match = variablePattern.exec(template)) !== null) {
      const varName = match[1];
      variables.add(varName);
      
      // Infer type from filter usage
      if (match[2]) {
        const filter = match[2].trim();
        if (filter.includes('pascalCase') || filter.includes('camelCase')) {
          inferred[varName] = 'string';
        }
      }
    }

    // Extract {% if variable %} patterns (boolean inference)
    const ifPattern = /\{%\s*if\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}/g;
    while ((match = ifPattern.exec(template)) !== null) {
      const varName = match[1];
      variables.add(varName);
      inferred[varName] = 'boolean';
    }

    // Extract {% for item in items %} patterns (array inference)
    const forPattern = /\{%\s*for\s+(\w+)\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}/g;
    while ((match = forPattern.exec(template)) !== null) {
      const arrayVar = match[2];
      variables.add(arrayVar);
      inferred[arrayVar] = 'array';
    }

    // Boolean naming convention heuristics
    Array.from(variables).forEach(varName => {
      if (!inferred[varName]) {
        if (this._isBooleanName(varName)) {
          inferred[varName] = 'boolean';
        } else {
          inferred[varName] = 'string'; // Default
        }
      }
    });

    const result = {
      variables: Array.from(variables),
      inferred,
      count: variables.size
    };

    this.emit('extract:complete', result);
    return result;
  }

  /**
   * Check if variable name suggests boolean type
   * @private
   * @param {string} name - Variable name
   * @returns {boolean} True if likely boolean
   */
  _isBooleanName(name) {
    const booleanPrefixes = ['is', 'has', 'should', 'can', 'will', 'with', 'enable', 'include', 'use'];
    const lowerName = name.toLowerCase();
    return booleanPrefixes.some(prefix => lowerName.startsWith(prefix));
  }
}


