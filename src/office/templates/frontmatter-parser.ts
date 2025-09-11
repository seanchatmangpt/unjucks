/**
 * Frontmatter parser for Office document templates
 * 
 * This module provides comprehensive frontmatter parsing capabilities for Office documents,
 * supporting multiple formats (YAML, JSON, TOML) and integration with document-specific
 * metadata storage systems.
 * 
 * @module office/templates/frontmatter-parser
 * @version 1.0.0
 */

import {
  TemplateFrontmatter,
  DocumentType,
  VariableSyntax,
  ProcessingMode,
  ValidationResult,
  ErrorSeverity,
  TemplateVariable,
  InjectionPoint,
  OutputConfiguration
} from '../core/types.js';
import { Logger } from '../utils/logger.js';

/**
 * Frontmatter format types
 */
export enum FrontmatterFormat {
  YAML = 'yaml',
  JSON = 'json',
  TOML = 'toml',
  XML = 'xml'
}

/**
 * Frontmatter parsing options
 */
export interface FrontmatterParsingOptions {
  /** Preferred format for parsing */
  format?: FrontmatterFormat;
  /** Whether to validate parsed frontmatter */
  validate?: boolean;
  /** Whether to use strict parsing */
  strict?: boolean;
  /** Custom delimiters for frontmatter blocks */
  delimiters?: FrontmatterDelimiters;
  /** Default values for missing fields */
  defaults?: Partial<TemplateFrontmatter>;
}

/**
 * Frontmatter delimiters configuration
 */
export interface FrontmatterDelimiters {
  /** Start delimiter */
  start: string;
  /** End delimiter */
  end: string;
}

/**
 * Default delimiters for different formats
 */
const DEFAULT_DELIMITERS: Record<FrontmatterFormat, FrontmatterDelimiters> = {
  [FrontmatterFormat.YAML]: { start: '---', end: '---' },
  [FrontmatterFormat.JSON]: { start: '{', end: '}' },
  [FrontmatterFormat.TOML]: { start: '+++', end: '+++' },
  [FrontmatterFormat.XML]: { start: '<!--', end: '-->' }
};

/**
 * Frontmatter parsing result
 */
export interface FrontmatterParsingResult {
  /** Parsed frontmatter */
  frontmatter: TemplateFrontmatter | null;
  /** Detected format */
  format?: FrontmatterFormat;
  /** Validation result */
  validation: ValidationResult;
  /** Raw frontmatter content */
  raw?: string;
  /** Remaining content after frontmatter removal */
  content?: string;
}

/**
 * Frontmatter parser for Office documents
 * 
 * Provides comprehensive parsing capabilities for frontmatter in various formats,
 * with intelligent format detection and validation.
 */
export class FrontmatterParser {
  private readonly logger: Logger;
  private readonly options: FrontmatterParsingOptions;
  
  /**
   * Creates a new frontmatter parser
   * 
   * @param options - Parsing options
   */
  constructor(options: FrontmatterParsingOptions = {}) {
    this.options = {
      validate: true,
      strict: false,
      ...options
    };
    this.logger = Logger.createOfficeLogger('FrontmatterParser');
  }

  /**
   * Parses frontmatter from text content
   * 
   * @param content - Text content containing frontmatter
   * @param documentType - Type of document being parsed
   * @returns Promise resolving to parsing result
   */
  async parseFromText(content: string, documentType?: DocumentType): Promise<FrontmatterParsingResult> {
    this.logger.debug('Parsing frontmatter from text content');
    
    try {
      // Detect frontmatter format and extract content
      const detected = this.detectAndExtractFrontmatter(content);
      
      if (!detected.raw) {
        return {
          frontmatter: null,
          validation: { valid: true, errors: [], warnings: [] },
          content
        };
      }
      
      // Parse the extracted frontmatter
      const frontmatter = await this.parseFrontmatterContent(detected.raw, detected.format);
      
      // Apply defaults if specified
      const finalFrontmatter = this.applyDefaults(frontmatter, documentType);
      
      // Validate if enabled
      const validation = this.options.validate 
        ? await this.validateFrontmatter(finalFrontmatter)
        : { valid: true, errors: [], warnings: [] };
      
      this.logger.info(`Frontmatter parsed successfully using ${detected.format} format`);
      
      return {
        frontmatter: finalFrontmatter,
        format: detected.format,
        validation,
        raw: detected.raw,
        content: detected.remaining
      };
      
    } catch (error) {
      this.logger.error('Failed to parse frontmatter', error);
      
      return {
        frontmatter: null,
        validation: {
          valid: false,
          errors: [{
            message: `Frontmatter parsing failed: ${error.message}`,
            code: 'FRONTMATTER_PARSING_ERROR',
            severity: ErrorSeverity.ERROR
          }],
          warnings: []
        },
        content
      };
    }
  }

  /**
   * Parses frontmatter from JSON string
   * 
   * @param jsonContent - JSON content
   * @param documentType - Type of document
   * @returns Promise resolving to parsing result
   */
  async parseFromJSON(jsonContent: string, documentType?: DocumentType): Promise<FrontmatterParsingResult> {
    try {
      const frontmatter = JSON.parse(jsonContent);
      const finalFrontmatter = this.applyDefaults(frontmatter, documentType);
      
      const validation = this.options.validate 
        ? await this.validateFrontmatter(finalFrontmatter)
        : { valid: true, errors: [], warnings: [] };
      
      return {
        frontmatter: finalFrontmatter,
        format: FrontmatterFormat.JSON,
        validation,
        raw: jsonContent
      };
    } catch (error) {
      return {
        frontmatter: null,
        validation: {
          valid: false,
          errors: [{
            message: `JSON parsing failed: ${error.message}`,
            code: 'JSON_PARSING_ERROR',
            severity: ErrorSeverity.ERROR
          }],
          warnings: []
        }
      };
    }
  }

  /**
   * Parses frontmatter from object (custom properties)
   * 
   * @param obj - Object containing frontmatter data
   * @param documentType - Type of document
   * @returns Promise resolving to parsing result
   */
  async parseFromObject(obj: any, documentType?: DocumentType): Promise<FrontmatterParsingResult> {
    try {
      const finalFrontmatter = this.applyDefaults(obj, documentType);
      
      const validation = this.options.validate 
        ? await this.validateFrontmatter(finalFrontmatter)
        : { valid: true, errors: [], warnings: [] };
      
      return {
        frontmatter: finalFrontmatter,
        validation
      };
    } catch (error) {
      return {
        frontmatter: null,
        validation: {
          valid: false,
          errors: [{
            message: `Object parsing failed: ${error.message}`,
            code: 'OBJECT_PARSING_ERROR',
            severity: ErrorSeverity.ERROR
          }],
          warnings: []
        }
      };
    }
  }

  /**
   * Serializes frontmatter to specified format
   * 
   * @param frontmatter - Frontmatter to serialize
   * @param format - Target format
   * @returns Serialized frontmatter string
   */
  async serialize(frontmatter: TemplateFrontmatter, format: FrontmatterFormat = FrontmatterFormat.JSON): Promise<string> {
    try {
      const delimiters = this.options.delimiters || DEFAULT_DELIMITERS[format];
      
      switch (format) {
        case FrontmatterFormat.JSON:
          const jsonContent = JSON.stringify(frontmatter, null, 2);
          return format === FrontmatterFormat.JSON && delimiters.start === '{' 
            ? jsonContent
            : `${delimiters.start}\n${jsonContent}\n${delimiters.end}`;
            
        case FrontmatterFormat.YAML:
          // In a real implementation, you would use a YAML library
          const yamlContent = this.convertToYAML(frontmatter);
          return `${delimiters.start}\n${yamlContent}\n${delimiters.end}`;
          
        case FrontmatterFormat.TOML:
          // In a real implementation, you would use a TOML library
          const tomlContent = this.convertToTOML(frontmatter);
          return `${delimiters.start}\n${tomlContent}\n${delimiters.end}`;
          
        case FrontmatterFormat.XML:
          const xmlContent = this.convertToXML(frontmatter);
          return `${delimiters.start}\n${xmlContent}\n${delimiters.end}`;
          
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      this.logger.error(`Failed to serialize frontmatter to ${format}`, error);
      throw error;
    }
  }

  /**
   * Detects frontmatter format and extracts content
   * 
   * @param content - Text content
   * @returns Detected format and extracted content
   */
  private detectAndExtractFrontmatter(content: string): {
    format?: FrontmatterFormat;
    raw?: string;
    remaining: string;
  } {
    const trimmedContent = content.trim();
    
    // Try to detect format based on preferred format first
    if (this.options.format) {
      const result = this.extractWithFormat(trimmedContent, this.options.format);
      if (result.raw) {
        return { ...result, format: this.options.format };
      }
    }
    
    // Try different formats in order of likelihood
    const formats = [FrontmatterFormat.JSON, FrontmatterFormat.YAML, FrontmatterFormat.TOML, FrontmatterFormat.XML];
    
    for (const format of formats) {
      const result = this.extractWithFormat(trimmedContent, format);
      if (result.raw) {
        return { ...result, format };
      }
    }
    
    return { remaining: content };
  }

  /**
   * Extracts frontmatter using specific format
   * 
   * @param content - Text content
   * @param format - Format to use
   * @returns Extracted frontmatter and remaining content
   */
  private extractWithFormat(content: string, format: FrontmatterFormat): {
    raw?: string;
    remaining: string;
  } {
    const delimiters = this.options.delimiters || DEFAULT_DELIMITERS[format];
    
    if (format === FrontmatterFormat.JSON) {
      // Special handling for JSON - look for complete JSON object at start
      if (content.startsWith('{')) {
        try {
          let braceCount = 0;
          let endIndex = 0;
          
          for (let i = 0; i < content.length; i++) {
            if (content[i] === '{') braceCount++;
            if (content[i] === '}') braceCount--;
            
            if (braceCount === 0) {
              endIndex = i + 1;
              break;
            }
          }
          
          if (endIndex > 0) {
            const jsonPart = content.substring(0, endIndex);
            // Validate it's valid JSON
            JSON.parse(jsonPart);
            
            return {
              raw: jsonPart,
              remaining: content.substring(endIndex).trim()
            };
          }
        } catch (error) {
          // Not valid JSON, continue
        }
      }
    }
    
    // Handle delimited formats
    if (content.startsWith(delimiters.start)) {
      const startLength = delimiters.start.length;
      const endPattern = delimiters.end;
      const endIndex = content.indexOf(endPattern, startLength);
      
      if (endIndex !== -1) {
        const frontmatterContent = content.substring(startLength, endIndex).trim();
        const remainingContent = content.substring(endIndex + endPattern.length).trim();
        
        return {
          raw: frontmatterContent,
          remaining: remainingContent
        };
      }
    }
    
    return { remaining: content };
  }

  /**
   * Parses frontmatter content based on detected format
   * 
   * @param content - Raw frontmatter content
   * @param format - Detected format
   * @returns Parsed frontmatter object
   */
  private async parseFrontmatterContent(content: string, format?: FrontmatterFormat): Promise<TemplateFrontmatter> {
    if (!format) {
      throw new Error('No format specified for frontmatter parsing');
    }
    
    switch (format) {
      case FrontmatterFormat.JSON:
        return JSON.parse(content);
        
      case FrontmatterFormat.YAML:
        return this.parseYAML(content);
        
      case FrontmatterFormat.TOML:
        return this.parseTOML(content);
        
      case FrontmatterFormat.XML:
        return this.parseXML(content);
        
      default:
        throw new Error(`Unsupported frontmatter format: ${format}`);
    }
  }

  /**
   * Applies default values to frontmatter
   * 
   * @param frontmatter - Parsed frontmatter
   * @param documentType - Document type for defaults
   * @returns Frontmatter with defaults applied
   */
  private applyDefaults(frontmatter: any, documentType?: DocumentType): TemplateFrontmatter {
    const defaults: Partial<TemplateFrontmatter> = {
      syntax: VariableSyntax.NUNJUCKS,
      mode: ProcessingMode.REPLACE,
      ...this.options.defaults
    };
    
    if (documentType) {
      defaults.type = documentType;
    }
    
    return {
      ...defaults,
      ...frontmatter
    } as TemplateFrontmatter;
  }

  /**
   * Validates parsed frontmatter
   * 
   * @param frontmatter - Frontmatter to validate
   * @returns Validation result
   */
  private async validateFrontmatter(frontmatter: TemplateFrontmatter): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];
    
    // Validate required fields
    if (!frontmatter.type) {
      errors.push({
        message: 'Document type is required in frontmatter',
        code: 'MISSING_DOCUMENT_TYPE',
        field: 'type',
        severity: ErrorSeverity.ERROR
      });
    }
    
    // Validate document type
    if (frontmatter.type && !Object.values(DocumentType).includes(frontmatter.type)) {
      errors.push({
        message: `Invalid document type: ${frontmatter.type}`,
        code: 'INVALID_DOCUMENT_TYPE',
        field: 'type',
        severity: ErrorSeverity.ERROR
      });
    }
    
    // Validate syntax
    if (frontmatter.syntax && !Object.values(VariableSyntax).includes(frontmatter.syntax)) {
      errors.push({
        message: `Invalid variable syntax: ${frontmatter.syntax}`,
        code: 'INVALID_VARIABLE_SYNTAX',
        field: 'syntax',
        severity: ErrorSeverity.ERROR
      });
    }
    
    // Validate processing mode
    if (frontmatter.mode && !Object.values(ProcessingMode).includes(frontmatter.mode)) {
      errors.push({
        message: `Invalid processing mode: ${frontmatter.mode}`,
        code: 'INVALID_PROCESSING_MODE',
        field: 'mode',
        severity: ErrorSeverity.ERROR
      });
    }
    
    // Validate variables array
    if (frontmatter.variables) {
      if (!Array.isArray(frontmatter.variables)) {
        errors.push({
          message: 'Variables must be an array',
          code: 'INVALID_VARIABLES_TYPE',
          field: 'variables',
          severity: ErrorSeverity.ERROR
        });
      } else {
        const result = this.validateVariables(frontmatter.variables);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      }
    }
    
    // Validate injection points
    if (frontmatter.injectionPoints) {
      if (!Array.isArray(frontmatter.injectionPoints)) {
        errors.push({
          message: 'Injection points must be an array',
          code: 'INVALID_INJECTION_POINTS_TYPE',
          field: 'injectionPoints',
          severity: ErrorSeverity.ERROR
        });
      } else {
        const result = this.validateInjectionPoints(frontmatter.injectionPoints);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      }
    }
    
    // Validate output configuration
    if (frontmatter.output) {
      const result = this.validateOutputConfiguration(frontmatter.output);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates variables configuration
   * 
   * @param variables - Variables array to validate
   * @returns Validation result
   */
  private validateVariables(variables: TemplateVariable[]): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];
    const names = new Set<string>();
    
    for (const variable of variables) {
      // Check required fields
      if (!variable.name) {
        errors.push({
          message: 'Variable name is required',
          code: 'MISSING_VARIABLE_NAME',
          field: 'variables',
          severity: ErrorSeverity.ERROR
        });
        continue;
      }
      
      // Check for duplicates
      if (names.has(variable.name)) {
        errors.push({
          message: `Duplicate variable name: ${variable.name}`,
          code: 'DUPLICATE_VARIABLE_NAME',
          field: 'variables',
          severity: ErrorSeverity.ERROR
        });
      }
      names.add(variable.name);
      
      // Validate variable name format
      if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(variable.name)) {
        errors.push({
          message: `Invalid variable name format: ${variable.name}`,
          code: 'INVALID_VARIABLE_NAME',
          field: 'variables',
          severity: ErrorSeverity.ERROR
        });
      }
      
      // Check type
      if (!variable.type) {
        warnings.push({
          message: `Variable '${variable.name}' has no type specified`,
          code: 'MISSING_VARIABLE_TYPE',
          field: 'variables'
        });
      }
      
      // Check required without default
      if (variable.required && variable.defaultValue === undefined) {
        warnings.push({
          message: `Required variable '${variable.name}' has no default value`,
          code: 'REQUIRED_NO_DEFAULT',
          field: 'variables'
        });
      }
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates injection points configuration
   * 
   * @param injectionPoints - Injection points array to validate
   * @returns Validation result
   */
  private validateInjectionPoints(injectionPoints: InjectionPoint[]): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];
    const ids = new Set<string>();
    
    for (const point of injectionPoints) {
      // Check required fields
      if (!point.id) {
        errors.push({
          message: 'Injection point ID is required',
          code: 'MISSING_INJECTION_POINT_ID',
          field: 'injectionPoints',
          severity: ErrorSeverity.ERROR
        });
        continue;
      }
      
      if (!point.marker) {
        errors.push({
          message: 'Injection point marker is required',
          code: 'MISSING_INJECTION_POINT_MARKER',
          field: 'injectionPoints',
          severity: ErrorSeverity.ERROR
        });
      }
      
      // Check for duplicate IDs
      if (ids.has(point.id)) {
        errors.push({
          message: `Duplicate injection point ID: ${point.id}`,
          code: 'DUPLICATE_INJECTION_POINT_ID',
          field: 'injectionPoints',
          severity: ErrorSeverity.ERROR
        });
      }
      ids.add(point.id);
      
      // Validate content type
      const validTypes = ['text', 'html', 'markdown', 'table', 'image', 'chart'];
      if (point.type && !validTypes.includes(point.type)) {
        errors.push({
          message: `Invalid injection point type: ${point.type}`,
          code: 'INVALID_INJECTION_POINT_TYPE',
          field: 'injectionPoints',
          severity: ErrorSeverity.ERROR
        });
      }
      
      // Check required without default
      if (point.required && !point.defaultContent) {
        warnings.push({
          message: `Required injection point '${point.id}' has no default content`,
          code: 'REQUIRED_NO_DEFAULT_CONTENT',
          field: 'injectionPoints'
        });
      }
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates output configuration
   * 
   * @param output - Output configuration to validate
   * @returns Validation result
   */
  private validateOutputConfiguration(output: OutputConfiguration): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];
    
    // Validate extension format
    if (output.extension && !output.extension.startsWith('.')) {
      warnings.push({
        message: 'Output extension should start with a dot',
        code: 'INVALID_EXTENSION_FORMAT',
        field: 'output.extension'
      });
    }
    
    // Validate compression settings
    if (output.compression?.enabled) {
      if (output.compression.level && (output.compression.level < 1 || output.compression.level > 9)) {
        errors.push({
          message: 'Compression level must be between 1 and 9',
          code: 'INVALID_COMPRESSION_LEVEL',
          field: 'output.compression.level',
          severity: ErrorSeverity.ERROR
        });
      }
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  // Simplified parsers - in a real implementation, you would use proper libraries
  
  /**
   * Parses YAML content (simplified implementation)
   * 
   * @param content - YAML content
   * @returns Parsed object
   */
  private parseYAML(content: string): any {
    // This is a very simplified YAML parser
    // In a real implementation, you would use a library like 'js-yaml'
    const lines = content.split('\n');
    const result: any = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex !== -1) {
          const key = trimmed.substring(0, colonIndex).trim();
          const value = trimmed.substring(colonIndex + 1).trim();
          
          // Simple value parsing
          if (value === 'true' || value === 'false') {
            result[key] = value === 'true';
          } else if (!isNaN(Number(value))) {
            result[key] = Number(value);
          } else {
            result[key] = value.replace(/^["']|["']$/g, ''); // Remove quotes
          }
        }
      }
    }
    
    return result;
  }

  /**
   * Parses TOML content (simplified implementation)
   * 
   * @param content - TOML content
   * @returns Parsed object
   */
  private parseTOML(content: string): any {
    // This is a very simplified TOML parser
    // In a real implementation, you would use a library like '@iarna/toml'
    return this.parseYAML(content); // Use YAML parser as fallback
  }

  /**
   * Parses XML content (simplified implementation)
   * 
   * @param content - XML content
   * @returns Parsed object
   */
  private parseXML(content: string): any {
    // This is a very simplified XML parser
    // In a real implementation, you would use a proper XML parser
    try {
      // Try to parse as JSON embedded in XML comment
      const jsonMatch = content.match(/<frontmatter>(.*?)<\/frontmatter>/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // Fallback to simple tag parsing
      const result: any = {};
      const tagMatches = content.matchAll(/<(\w+)>(.*?)<\/\1>/g);
      
      for (const match of tagMatches) {
        const key = match[1];
        const value = match[2].trim();
        result[key] = value;
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to parse XML frontmatter: ${error.message}`);
    }
  }

  // Simplified serializers
  
  /**
   * Converts object to YAML (simplified implementation)
   * 
   * @param obj - Object to convert
   * @returns YAML string
   */
  private convertToYAML(obj: any): string {
    const lines: string[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        lines.push(`${key}: "${value}"`);
      } else if (typeof value === 'boolean' || typeof value === 'number') {
        lines.push(`${key}: ${value}`);
      } else if (Array.isArray(value)) {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${typeof item === 'string' ? `"${item}"` : item}`);
        }
      } else {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Converts object to TOML (simplified implementation)
   * 
   * @param obj - Object to convert
   * @returns TOML string
   */
  private convertToTOML(obj: any): string {
    // Simplified TOML conversion (similar to YAML for basic types)
    return this.convertToYAML(obj);
  }

  /**
   * Converts object to XML (simplified implementation)
   * 
   * @param obj - Object to convert
   * @returns XML string
   */
  private convertToXML(obj: any): string {
    const elements: string[] = ['<frontmatter>'];
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        elements.push(`  <${key}>${JSON.stringify(value)}</${key}>`);
      } else {
        elements.push(`  <${key}>${value}</${key}>`);
      }
    }
    
    elements.push('</frontmatter>');
    return elements.join('\n');
  }

  /**
   * Creates a parser with JSON format preference
   * 
   * @param options - Additional options
   * @returns JSON-preferring parser
   */
  static createJSONParser(options: Partial<FrontmatterParsingOptions> = {}): FrontmatterParser {
    return new FrontmatterParser({
      format: FrontmatterFormat.JSON,
      ...options
    });
  }

  /**
   * Creates a parser with YAML format preference
   * 
   * @param options - Additional options
   * @returns YAML-preferring parser
   */
  static createYAMLParser(options: Partial<FrontmatterParsingOptions> = {}): FrontmatterParser {
    return new FrontmatterParser({
      format: FrontmatterFormat.YAML,
      ...options
    });
  }

  /**
   * Gets available frontmatter formats
   * 
   * @returns Array of available formats
   */
  static getAvailableFormats(): FrontmatterFormat[] {
    return Object.values(FrontmatterFormat);
  }
}
