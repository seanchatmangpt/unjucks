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
  TemplateVariable,
  VariableLocation,
  TemplateFrontmatter,
  ValidationResult,
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
  private readonly syntax: VariableSyntax;
  private readonly patterns: any;
  
  /**
   * Creates a new variable extractor
   * 
   * @param syntax - Variable syntax to use for extraction
   */
  constructor(syntax: VariableSyntax = VariableSyntax.NUNJUCKS) {
    this.syntax = syntax;
    this.patterns = SYNTAX_PATTERNS[syntax];
  }

  /**
   * Extracts all variables from text content
   * 
   * @param content - Text content to analyze
   * @param section - Document section name
   * @returns Array of variable locations
   */
  extractFromContent(content: string, section: string = 'content'): VariableLocation[] {
    const variables: VariableLocation[] = [];
    const seen = new Set<string>();
    
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
   * @param document - Document structure (varies by type)
   * @param documentType - Type of document being processed
   * @returns Array of variable locations
   */
  extractFromDocument(document: any, documentType: string): VariableLocation[] {
    const variables: VariableLocation[] = [];
    
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
   * @param document - Word document object
   * @returns Array of variable locations
   */
  private extractFromWordDocument(document: any): VariableLocation[] {
    const variables: VariableLocation[] = [];
    
    // Extract from paragraphs
    if (document.paragraphs) {
      document.paragraphs.forEach((paragraph: any, index: number) => {
        if (paragraph.text) {
          const sectionVars = this.extractFromContent(paragraph.text, `paragraph-${index}`);
          variables.push(...sectionVars);
        }
      });
    }
    
    // Extract from headers
    if (document.headers) {
      document.headers.forEach((header: any, index: number) => {
        if (header.text) {
          const sectionVars = this.extractFromContent(header.text, `header-${index}`);
          variables.push(...sectionVars);
        }
      });
    }
    
    // Extract from footers
    if (document.footers) {
      document.footers.forEach((footer: any, index: number) => {
        if (footer.text) {
          const sectionVars = this.extractFromContent(footer.text, `footer-${index}`);
          variables.push(...sectionVars);
        }
      });
    }
    
    // Extract from tables
    if (document.tables) {
      document.tables.forEach((table: any, tableIndex: number) => {
        if (table.rows) {
          table.rows.forEach((row: any, rowIndex: number) => {
            if (row.cells) {
              row.cells.forEach((cell: any, cellIndex: number) => {
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
   * @param document - Excel document object
   * @returns Array of variable locations
   */
  private extractFromExcelDocument(document: any): VariableLocation[] {
    const variables: VariableLocation[] = [];
    
    if (document.worksheets) {
      document.worksheets.forEach((worksheet: any, sheetIndex: number) => {
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
   * @param document - PowerPoint document object
   * @returns Array of variable locations
   */
  private extractFromPowerPointDocument(document: any): VariableLocation[] {
    const variables: VariableLocation[] = [];
    
    if (document.slides) {
      document.slides.forEach((slide: any, slideIndex: number) => {
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
          slide.textBoxes.forEach((textBox: any, boxIndex: number) => {
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
   * @param variables - Variables to analyze
   * @param frontmatter - Template frontmatter with variable definitions
   * @returns Array of analyzed template variables
   */
  analyzeVariables(variables: VariableLocation[], frontmatter?: TemplateFrontmatter): TemplateVariable[] {
    const analyzed: Map<string, TemplateVariable> = new Map();
    
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
        const variable: TemplateVariable = {
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
   * @param variables - Variable locations to group
   * @returns Map of variable names to their locations
   */
  private groupVariablesByName(variables: VariableLocation[]): Map<string, VariableLocation[]> {
    const grouped = new Map<string, VariableLocation[]>();
    
    for (const variable of variables) {
      // Extract variable name from reference
      const name = this.extractVariableName(variable.reference || '');
      if (name) {
        if (!grouped.has(name)) {
          grouped.set(name, []);
        }
        grouped.get(name)!.push(variable);
      }
    }
    
    return grouped;
  }

  /**
   * Extracts variable name from template reference
   * 
   * @param reference - Template reference string
   * @returns Variable name or null if not found
   */
  private extractVariableName(reference: string): string | null {
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
   * @param name - Variable name
   * @param locations - Variable locations
   * @returns Inferred variable type
   */
  private inferVariableType(name: string, locations: VariableLocation[]): TemplateVariable['type'] {
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
   * @param name - Variable name
   * @param locations - Variable locations
   * @returns Whether variable is required
   */
  private isVariableRequired(name: string, locations: VariableLocation[]): boolean {
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
   * @param name - Variable name
   * @returns Generated description
   */
  private generateVariableDescription(name: string): string {
    // Convert camelCase or snake_case to readable format
    const readable = name
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^./, str => str.toUpperCase());
    
    return `Variable for ${readable}`;
  }

  /**
   * Validates extracted variables against data
   * 
   * @param variables - Extracted template variables
   * @param data - Data to validate against
   * @returns Validation result
   */
  validateVariables(variables: TemplateVariable[], data: Record<string, any>): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];
    
    for (const variable of variables) {
      const value = this.getNestedValue(data, variable.name);
      
      // Check required variables
      if (variable.required && (value === undefined || value === null || value === '')) {
        errors.push({
          message: `Required variable '${variable.name}' is missing or empty`,
          code: 'MISSING_REQUIRED_VARIABLE',
          field: variable.name,
          severity: ErrorSeverity.ERROR
        });
        continue;
      }
      
      // Skip validation if value is not provided and variable is not required
      if (value === undefined || value === null) {
        continue;
      }
      
      // Type validation
      if (!this.validateVariableType(value, variable.type)) {
        errors.push({
          message: `Variable '${variable.name}' expected type ${variable.type} but got ${typeof value}`,
          code: 'INVALID_VARIABLE_TYPE',
          field: variable.name,
          severity: ErrorSeverity.ERROR
        });
      }
      
      // Custom validation
      if (variable.validation) {
        const validationResult = this.runCustomValidation(value, variable.validation);
        if (validationResult) {
          errors.push({
            message: `Variable '${variable.name}' validation failed: ${validationResult}`,
            code: 'CUSTOM_VALIDATION_FAILED',
            field: variable.name,
            severity: ErrorSeverity.ERROR
          });
        }
      }
    }
    
    // Check for unused variables in data
    const usedVariables = new Set(variables.map(v => v.name));
    for (const key of Object.keys(data)) {
      if (!usedVariables.has(key)) {
        warnings.push({
          message: `Data contains unused variable '${key}'`,
          code: 'UNUSED_VARIABLE',
          field: key,
          severity: ErrorSeverity.WARNING
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Gets nested value from object using dot notation
   * 
   * @param obj - Object to search in
   * @param path - Dot-separated path
   * @returns Value at path or undefined
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Validates value against expected type
   * 
   * @param value - Value to validate
   * @param expectedType - Expected type
   * @returns Whether value matches type
   */
  private validateVariableType(value: any, expectedType: TemplateVariable['type']): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return value instanceof Date || !isNaN(Date.parse(value));
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Runs custom validation for a variable
   * 
   * @param value - Value to validate
   * @param validation - Validation rules
   * @returns Error message or null if valid
   */
  private runCustomValidation(value: any, validation: any): string | null {
    // Min/max validation
    if (validation.min !== undefined) {
      if (typeof value === 'number' && value < validation.min) {
        return `Value ${value} is less than minimum ${validation.min}`;
      }
      if (typeof value === 'string' && value.length < validation.min) {
        return `Text length ${value.length} is less than minimum ${validation.min}`;
      }
    }
    
    if (validation.max !== undefined) {
      if (typeof value === 'number' && value > validation.max) {
        return `Value ${value} is greater than maximum ${validation.max}`;
      }
      if (typeof value === 'string' && value.length > validation.max) {
        return `Text length ${value.length} is greater than maximum ${validation.max}`;
      }
    }
    
    // Pattern validation
    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        return `Value does not match required pattern`;
      }
    }
    
    // Enum validation
    if (validation.enum && !validation.enum.includes(value)) {
      return `Value must be one of: ${validation.enum.join(', ')}`;
    }
    
    // Custom function validation
    if (validation.custom && typeof validation.custom === 'function') {
      const result = validation.custom(value);
      if (typeof result === 'string') {
        return result;
      }
      if (result === false) {
        return 'Custom validation failed';
      }
    }
    
    return null;
  }

  /**
   * Replaces variables in content with provided data
   * 
   * @param content - Content with variables to replace
   * @param data - Data for replacement
   * @returns Content with variables replaced
   */
  replaceVariables(content: string, data: Record<string, any>): string {
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
   * @returns Current variable syntax
   */
  getSyntax(): VariableSyntax {
    return this.syntax;
  }

  /**
   * Gets available syntax patterns
   * 
   * @returns Available syntax options
   */
  static getAvailableSyntax(): VariableSyntax[] {
    return Object.values(VariableSyntax);
  }
}
