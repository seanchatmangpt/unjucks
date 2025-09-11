/**
 * Variable extraction utility for Office document templates
 * 
 * This module provides comprehensive variable extraction capabilities for Office documents,
 * supporting multiple syntax patterns and intelligent content parsing.
 * 
 * @module office/utils/variable-extractor
 * @version 1.0.0
 */

import {
  VariableSyntax,
  ErrorSeverity
} from '../core/types.js';

/**
 * Variable syntax patterns for different template engines
 */
const SYNTAX_PATTERNS = {
  [VariableSyntax.NUNJUCKS]: {
    simple: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)\s*\}\}/g,
    complex: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)(?:\s*\|\s*([^}]+?))?\s*\}\}/g,
    filters: /\|\s*([a-zA-Z_][a-zA-Z0-9_]*?)(?:\s*\(([^)]*)\))?/g
  },
  [VariableSyntax.SIMPLE]: {
    simple: /\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)\s*\}/g,
    complex: /\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)\s*\}/g
  },
  [VariableSyntax.MUSTACHE]: {
    simple: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)\s*\}\}/g,
    complex: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)\s*\}\}/g
  },
  [VariableSyntax.HANDLEBARS]: {
    simple: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)\s*\}\}/g,
    complex: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)(?:\s+([^}]+?))?\s*\}\}/g,
    helpers: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*?)\s+([^}]+?)\s*\}\}/g
  }
};

/**
 * Variable type inference patterns
 */
const TYPE_PATTERNS = {
  number: /^\d+(\.\d+)?$/,
  boolean: /^(true|false)$/i,
  date: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^https?:\/\//,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
};

/**
 * Variable extraction utility class
 * 
 * Provides methods to extract, analyze, and validate variables from Office document templates.
 * Supports multiple syntax patterns and intelligent type inference.
 */
export class VariableExtractor {
  /**
   * Creates a new variable extractor
   * 
   * @param {string} [syntax=VariableSyntax.NUNJUCKS] - Variable syntax to use for extraction
   */
  constructor(syntax = VariableSyntax.NUNJUCKS) {
    this.syntax = syntax;
    this.patterns = SYNTAX_PATTERNS[syntax];
  }

  /**
   * Extracts all variables from text content
   * 
   * @param {string} content - Text content to analyze
   * @param {string} [section='content'] - Document section name
   * @returns {VariableLocation[]} Array of variable locations
   */
  extractFromContent(content, section = 'content') {
    const variables = [];
    const seen = new Set();
    
    // Use complex pattern to capture variables with potential filters/helpers
    const pattern = this.patterns.complex || this.patterns.simple;
    let match;
    
    while ((match = pattern.exec(content)) !== null) {
      const variableName = match[1];
      const fullMatch = match[0];
      const position = match.index;
      
      // Skip if we've already seen this variable in this section
      const key = `${section}:${variableName}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      
      variables.push({
        section,
        reference: fullMatch,
        position
      });
    }
    
    // Reset regex lastIndex to avoid issues with global patterns
    if (pattern.global) {
      pattern.lastIndex = 0;
    }
    
    return variables;
  }

  /**
   * Extracts variables from structured document content
   * 
   * @param {*} document - Document structure (varies by type)
   * @param {string} documentType - Type of document being processed
   * @returns {VariableLocation[]} Array of variable locations
   */
  extractFromDocument(document, documentType) {
    const variables = [];
    
    switch (documentType) {
      case 'word':
        variables.push(...this.extractFromWordDocument(document));
        break;
      case 'excel':
        variables.push(...this.extractFromExcelDocument(document));
        break;
      case 'powerpoint':
        variables.push(...this.extractFromPowerPointDocument(document));
        break;
      default:
        // Generic text extraction
        if (typeof document === 'string') {
          variables.push(...this.extractFromContent(document));
        }
    }
    
    return variables;
  }

  /**
   * Extracts variables from Word document structure
   * 
   * @param {*} document - Word document object
   * @returns {VariableLocation[]} Array of variable locations
   */
  extractFromWordDocument(document) {
    const variables = [];
    
    // Extract from paragraphs
    if (document.paragraphs) {
      document.paragraphs.forEach((paragraph, index) => {
        if (paragraph.text) {
          const sectionVars = this.extractFromContent(paragraph.text, `paragraph-${index}`);
          variables.push(...sectionVars);
        }
      });
    }
    
    // Extract from headers
    if (document.headers) {
      document.headers.forEach((header, index) => {
        if (header.text) {
          const sectionVars = this.extractFromContent(header.text, `header-${index}`);
          variables.push(...sectionVars);
        }
      });
    }
    
    // Extract from footers
    if (document.footers) {
      document.footers.forEach((footer, index) => {
        if (footer.text) {
          const sectionVars = this.extractFromContent(footer.text, `footer-${index}`);
          variables.push(...sectionVars);
        }
      });
    }
    
    // Extract from tables
    if (document.tables) {
      document.tables.forEach((table, tableIndex) => {
        if (table.rows) {
          table.rows.forEach((row, rowIndex) => {
            if (row.cells) {
              row.cells.forEach((cell, cellIndex) => {
                if (cell.text) {
                  const sectionVars = this.extractFromContent(
                    cell.text, 
                    `table-${tableIndex}-row-${rowIndex}-cell-${cellIndex}`
                  );
                  variables.push(...sectionVars);
                }
              });
            }
          });
        }
      });
    }
    
    return variables;
  }

  /**
   * Extracts variables from Excel document structure
   * 
   * @param {*} document - Excel document object
   * @returns {VariableLocation[]} Array of variable locations
   */
  extractFromExcelDocument(document) {
    const variables = [];
    
    if (document.worksheets) {
      document.worksheets.forEach((worksheet, sheetIndex) => {
        const sheetName = worksheet.name || `sheet-${sheetIndex}`;
        
        if (worksheet.cells) {
          Object.keys(worksheet.cells).forEach(cellRef => {
            const cell = worksheet.cells[cellRef];
            if (cell.value && typeof cell.value === 'string') {
              const sectionVars = this.extractFromContent(
                cell.value,
                `${sheetName}-${cellRef}`
              );
              variables.push(...sectionVars.map(v => ({
                ...v,
                reference: cellRef
              })));
            }
          });
        }
        
        // Extract from named ranges
        if (worksheet.namedRanges) {
          Object.keys(worksheet.namedRanges).forEach(rangeName => {
            const range = worksheet.namedRanges[rangeName];
            if (range.value && typeof range.value === 'string') {
              const sectionVars = this.extractFromContent(
                range.value,
                `${sheetName}-range-${rangeName}`
              );
              variables.push(...sectionVars);
            }
          });
        }
      });
    }
    
    return variables;
  }

  /**
   * Extracts variables from PowerPoint document structure
   * 
   * @param {*} document - PowerPoint document object
   * @returns {VariableLocation[]} Array of variable locations
   */
  extractFromPowerPointDocument(document) {
    const variables = [];
    
    if (document.slides) {
      document.slides.forEach((slide, slideIndex) => {
        const slideName = `slide-${slideIndex + 1}`;
        
        // Extract from slide title
        if (slide.title) {
          const titleVars = this.extractFromContent(slide.title, `${slideName}-title`);
          variables.push(...titleVars);
        }
        
        // Extract from slide content
        if (slide.content) {
          const contentVars = this.extractFromContent(slide.content, `${slideName}-content`);
          variables.push(...contentVars);
        }
        
        // Extract from text boxes
        if (slide.textBoxes) {
          slide.textBoxes.forEach((textBox, boxIndex) => {
            if (textBox.text) {
              const boxVars = this.extractFromContent(
                textBox.text,
                `${slideName}-textbox-${boxIndex}`
              );
              variables.push(...boxVars);
            }
          });
        }
        
        // Extract from speaker notes
        if (slide.notes) {
          const notesVars = this.extractFromContent(slide.notes, `${slideName}-notes`);
          variables.push(...notesVars);
        }
      });
    }
    
    return variables;
  }

  /**
   * Analyzes variables and infers their types and requirements
   * 
   * @param {VariableLocation[]} variables - Variables to analyze
   * @param {TemplateFrontmatter} [frontmatter] - Template frontmatter with variable definitions
   * @returns {TemplateVariable[]} Array of analyzed template variables
   */
  analyzeVariables(variables, frontmatter) {
    const analyzed = new Map();
    
    // Group variables by name
    const grouped = this.groupVariablesByName(variables);
    
    for (const [name, locations] of grouped) {
      // Check if variable is defined in frontmatter
      const frontmatterVar = frontmatter?.variables?.find(v => v.name === name);
      
      if (frontmatterVar) {
        // Use frontmatter definition
        analyzed.set(name, {
          ...frontmatterVar,
          location: locations[0] // Use first occurrence for location
        });
      } else {
        // Infer variable properties
        const variable = {
          name,
          type: this.inferVariableType(name, locations),
          required: this.isVariableRequired(name, locations),
          description: this.generateVariableDescription(name),
          location: locations[0]
        };
        
        analyzed.set(name, variable);
      }
    }
    
    return Array.from(analyzed.values());
  }

  /**
   * Groups variable locations by variable name
   * 
   * @param {VariableLocation[]} variables - Variable locations to group
   * @returns {Map<string, VariableLocation[]>} Map of variable names to their locations
   */
  groupVariablesByName(variables) {
    const grouped = new Map();
    
    for (const variable of variables) {
      // Extract variable name from reference
      const name = this.extractVariableName(variable.reference || '');
      if (name) {
        if (!grouped.has(name)) {
          grouped.set(name, []);
        }
        grouped.get(name).push(variable);
      }
    }
    
    return grouped;
  }

  /**
   * Extracts variable name from template reference
   * 
   * @param {string} reference - Template reference string
   * @returns {string|null} Variable name or null if not found
   */
  extractVariableName(reference) {
    const pattern = this.patterns.simple;
    const match = pattern.exec(reference);
    
    if (match) {
      pattern.lastIndex = 0; // Reset for next use
      return match[1];
    }
    
    return null;
  }

  /**
   * Infers variable type based on name and context
   * 
   * @param {string} name - Variable name
   * @param {VariableLocation[]} locations - Variable locations
   * @returns {string} Inferred variable type
   */
  inferVariableType(name, locations) {
    const lowerName = name.toLowerCase();
    
    // Type inference based on name patterns
    if (lowerName.includes('date') || lowerName.includes('time')) {
      return 'date';
    }
    
    if (lowerName.includes('count') || lowerName.includes('number') || lowerName.includes('amount') || lowerName.includes('price')) {
      return 'number';
    }
    
    if (lowerName.includes('is') || lowerName.includes('has') || lowerName.includes('enabled') || lowerName.includes('visible')) {
      return 'boolean';
    }
    
    if (lowerName.includes('list') || lowerName.includes('items') || lowerName.includes('array')) {
      return 'array';
    }
    
    if (lowerName.includes('config') || lowerName.includes('settings') || lowerName.includes('data')) {
      return 'object';
    }
    
    // Default to string
    return 'string';
  }

  /**
   * Determines if a variable is required based on usage patterns
   * 
   * @param {string} name - Variable name
   * @param {VariableLocation[]} locations - Variable locations
   * @returns {boolean} Whether variable is required
   */
  isVariableRequired(name, locations) {
    // Variables used in headers, titles, or multiple locations are likely required
    return locations.some(loc => 
      loc.section.includes('header') || 
      loc.section.includes('title') ||
      locations.length > 2
    );
  }

  /**
   * Generates a description for a variable based on its name
   * 
   * @param {string} name - Variable name
   * @returns {string} Generated description
   */
  generateVariableDescription(name) {
    // Convert camelCase or snake_case to readable format
    const readable = name
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^./, str => str.toUpperCase());
    
    return `Variable for ${readable}`;
  }

  /**
   * Gets nested value from object using dot notation
   * 
   * @param {*} obj - Object to search in
   * @param {string} path - Dot-separated path
   * @returns {*} Value at path or undefined
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Replaces variables in content with provided data
   * 
   * @param {string} content - Content with variables to replace
   * @param {Object} data - Data for replacement
   * @returns {string} Content with variables replaced
   */
  replaceVariables(content, data) {
    const pattern = this.patterns.simple;
    let replaced = content;
    
    replaced = replaced.replace(pattern, (match, variableName) => {
      const value = this.getNestedValue(data, variableName);
      
      if (value === undefined || value === null) {
        return match; // Keep original if no replacement found
      }
      
      // Convert value to string
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      
      return String(value);
    });
    
    return replaced;
  }

  /**
   * Gets the current syntax being used
   * 
   * @returns {string} Current variable syntax
   */
  getSyntax() {
    return this.syntax;
  }

  /**
   * Gets available syntax patterns
   * 
   * @returns {string[]} Available syntax options
   */
  static getAvailableSyntax() {
    return Object.values(VariableSyntax);
  }
}