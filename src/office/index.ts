/**
 * Office document template processing system for Unjucks
 * 
 * This module provides a comprehensive system for processing Office document templates
 * including Word, Excel, and PowerPoint files with advanced template capabilities.
 * 
 * @module office
 * @version 1.0.0
 */

// Core types and interfaces
export * from './core/types.js';
export { BaseOfficeProcessor } from './core/base-processor.js';

// Document processors
export { WordProcessor } from './processors/word-processor.js';
export { ExcelProcessor } from './processors/excel-processor.js';
export { PowerPointProcessor } from './processors/powerpoint-processor.js';

// Template system
export { FrontmatterParser, FrontmatterFormat } from './templates/frontmatter-parser.js';
export { SyntaxConverter } from './templates/syntax-converter.js';

// Utilities
export { VariableExtractor } from './utils/variable-extractor.js';
export { ValidationEngine } from './utils/validation-engine.js';
export { Logger, LogLevel } from './utils/logger.js';

// Input/Output system
export { BatchProcessor } from './io/batch-processor.js';

// Main factory class
export { OfficeTemplateProcessor } from './office-template-processor.js';
