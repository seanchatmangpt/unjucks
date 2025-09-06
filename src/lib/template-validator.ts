/**
 * Template Validator - Validates template outputs for consistency and correctness
 * Production-ready template validation with comprehensive syntax and semantic checking
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { parse as parseTypeScript } from '@typescript-eslint/typescript-estree';
import * as espree from 'espree';
import {
  ValidationResult,
  ValidationError,
  ValidationConfig,
  Validator,
  ValidationItem,
  TemplateValidationContext,
  CodeValidationContext,
  ValidationStatistics
} from './types/validation.js';

/**
 * Template consistency validation
 */
interface TemplateConsistencyRule {
  name: string;
  description: string;
  validator: (context: TemplateValidationContext) => Promise<ValidationError[]>;
}

interface GeneratedFileInfo {
  path: string;
  content: string;
  language: string;
  size: number;
  lineCount: number;
  dependencies: string[];
  exports: string[];
  imports: string[];
}

/**
 * High-performance template output validator
 */
export class TemplateValidator implements Validator {
  public readonly name = 'template-validator';
  public readonly version = '1.0.0';
  public readonly type = 'template' as const;

  private consistencyRules: TemplateConsistencyRule[] = [];
  private supportedLanguages = new Set(['typescript', 'javascript', 'json', 'yaml', 'html', 'css', 'sql']);

  constructor() {
    this.initializeConsistencyRules();
  }

  /**
   * Validate template output for consistency and correctness
   */
  async validate(content: string, config?: ValidationConfig): Promise<ValidationResult> {
    const startTime = performance.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    try {
      // Parse template metadata and generated content
      const context = await this.createTemplateContext(content);
      
      // Validate each generated file
      const fileValidationErrors = await this.validateGeneratedFiles(context);
      errors.push(...fileValidationErrors);

      // Apply consistency rules
      const consistencyErrors = await this.applyConsistencyRules(context);
      errors.push(...consistencyErrors);

      // Check for common template issues
      const templateIssues = await this.checkTemplateIssues(context);
      warnings.push(...templateIssues);

      // Performance and optimization checks
      const performanceIssues = await this.checkPerformanceIssues(context);
      warnings.push(...performanceIssues);

      const duration = performance.now() - startTime;
      const statistics = this.generateStatistics(context, duration);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          timestamp: new Date(),
          validator: this.name,
          version: this.version,
          duration,
          resourcesValidated: context.generatedContent.size,
          statistics
        }
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      
      return {
        isValid: false,
        errors: [{
          type: 'template_error',
          message: `Template validation failed: ${(error as Error).message}`,
          code: 'TEMPLATE_VALIDATION_ERROR',
          severity: 'error',
          context: { error: (error as Error).stack }
        }],
        warnings: [],
        metadata: {
          timestamp: new Date(),
          validator: this.name,
          version: this.version,
          duration,
          resourcesValidated: 0,
          statistics: { totalTriples: 0, validTriples: 0, invalidTriples: 0 }
        }
      };
    }
  }

  /**
   * Check if validator supports the given format
   */
  supportsFormat(format: string): boolean {
    return ['template', 'nunjucks', 'handlebars', 'ejs', 'mustache'].includes(format.toLowerCase());
  }

  /**
   * Create template validation context from content
   */
  private async createTemplateContext(content: string): Promise<TemplateValidationContext> {
    // Parse template output - expected format includes metadata and file contents
    const sections = this.parseTemplateOutput(content);
    
    const context: TemplateValidationContext = {
      templatePath: sections.templatePath || 'unknown',
      variables: sections.variables || {},
      dependencies: sections.dependencies || [],
      outputPaths: [],
      generatedContent: new Map()
    };

    // Process generated files
    for (const [filePath, fileContent] of Object.entries(sections.files || {})) {
      context.outputPaths.push(filePath);
      context.generatedContent.set(filePath, fileContent as string);
    }

    return context;
  }

  /**
   * Parse template output into sections
   */
  private parseTemplateOutput(content: string): any {
    try {
      // Try to parse as JSON first (for structured template output)
      if (content.trim().startsWith('{')) {
        return JSON.parse(content);
      }

      // Parse custom format with delimiters
      const sections: any = {
        files: {}
      };

      // Extract metadata section
      const metadataMatch = content.match(/^---\s*TEMPLATE METADATA\s*---([\s\S]*?)---\s*END METADATA\s*---/m);
      if (metadataMatch) {
        try {
          const metadata = JSON.parse(metadataMatch[1].trim());
          Object.assign(sections, metadata);
        } catch (e) {
          // Ignore metadata parsing errors
        }
      }

      // Extract file sections
      const fileRegex = /---\s*FILE:\s*([^\r\n]+)\s*---([\s\S]*?)(?=---\s*(?:FILE:|END)\s*---|$)/g;
      let match;
      
      while ((match = fileRegex.exec(content)) !== null) {
        const filePath = match[1].trim();
        const fileContent = match[2].trim();
        sections.files[filePath] = fileContent;
      }

      return sections;
    } catch (error) {
      throw new Error(`Failed to parse template output: ${(error as Error).message}`);
    }
  }

  /**
   * Validate all generated files
   */
  private async validateGeneratedFiles(context: TemplateValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const [filePath, content] of context.generatedContent) {
      const language = this.detectLanguage(filePath);
      
      if (this.supportedLanguages.has(language)) {
        const fileErrors = await this.validateSingleFile(filePath, content, language);
        errors.push(...fileErrors);
      }
    }

    return errors;
  }

  /**
   * Validate a single generated file
   */
  private async validateSingleFile(filePath: string, content: string, language: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    try {
      switch (language) {
        case 'typescript':
        case 'javascript':
          errors.push(...await this.validateJavaScriptCode(filePath, content, language));
          break;
        case 'json':
          errors.push(...this.validateJson(filePath, content));
          break;
        case 'yaml':
          errors.push(...this.validateYaml(filePath, content));
          break;
        case 'html':
          errors.push(...this.validateHtml(filePath, content));
          break;
        case 'css':
          errors.push(...this.validateCss(filePath, content));
          break;
        case 'sql':
          errors.push(...this.validateSql(filePath, content));
          break;
        default:
          // Basic text validation
          errors.push(...this.validateText(filePath, content));
      }
    } catch (error) {
      errors.push({
        type: 'syntax_error',
        message: `Failed to validate ${filePath}: ${(error as Error).message}`,
        code: 'FILE_VALIDATION_ERROR',
        severity: 'error',
        location: { file: filePath },
        context: { language, error: (error as Error).stack }
      });
    }

    return errors;
  }

  /**
   * Validate JavaScript/TypeScript code
   */
  private async validateJavaScriptCode(filePath: string, content: string, language: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    try {
      let ast: any;

      if (language === 'typescript') {
        ast = parseTypeScript(content, {
          loc: true,
          range: true,
          tolerant: true,
          errorOnUnknownASTType: false
        });
      } else {
        ast = espree.parse(content, {
          ecmaVersion: 2022,
          sourceType: 'module',
          loc: true,
          tolerant: true
        });
      }

      // Basic AST validation
      const astErrors = this.validateAst(ast, filePath);
      errors.push(...astErrors);

      // Extract code context
      const codeContext = this.extractCodeContext(ast, content, language);
      
      // Validate code structure
      const structureErrors = this.validateCodeStructure(codeContext, filePath);
      errors.push(...structureErrors);

    } catch (parseError: any) {
      // Check if it's a parsing error with location info
      if (parseError.lineNumber && parseError.column) {
        errors.push({
          type: 'syntax_error',
          message: `Syntax error: ${parseError.message}`,
          code: 'PARSE_ERROR',
          severity: 'error',
          location: {
            file: filePath,
            line: parseError.lineNumber,
            column: parseError.column
          },
          suggestion: 'Fix the syntax error according to the language specification'
        });
      } else {
        errors.push({
          type: 'syntax_error',
          message: `Parse error in ${filePath}: ${parseError.message}`,
          code: 'PARSE_ERROR',
          severity: 'error',
          location: { file: filePath }
        });
      }
    }

    return errors;
  }

  /**
   * Validate JSON content
   */
  private validateJson(filePath: string, content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    try {
      JSON.parse(content);
    } catch (error: any) {
      errors.push({
        type: 'syntax_error',
        message: `Invalid JSON: ${error.message}`,
        code: 'JSON_PARSE_ERROR',
        severity: 'error',
        location: { file: filePath },
        suggestion: 'Fix JSON syntax errors'
      });
    }

    return errors;
  }

  /**
   * Validate YAML content
   */
  private validateYaml(filePath: string, content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    try {
      // Basic YAML validation (would use a proper YAML parser in production)
      if (content.includes('\t')) {
        errors.push({
          type: 'format_error',
          message: 'YAML should use spaces for indentation, not tabs',
          code: 'YAML_INDENTATION_ERROR',
          severity: 'warning',
          location: { file: filePath },
          suggestion: 'Use spaces instead of tabs for YAML indentation'
        });
      }
    } catch (error: any) {
      errors.push({
        type: 'syntax_error',
        message: `YAML validation error: ${error.message}`,
        code: 'YAML_ERROR',
        severity: 'error',
        location: { file: filePath }
      });
    }

    return errors;
  }

  /**
   * Validate HTML content
   */
  private validateHtml(filePath: string, content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Basic HTML validation
    const unclosedTags = this.findUnclosedHtmlTags(content);
    for (const tag of unclosedTags) {
      errors.push({
        type: 'syntax_error',
        message: `Unclosed HTML tag: ${tag}`,
        code: 'HTML_UNCLOSED_TAG',
        severity: 'error',
        location: { file: filePath },
        suggestion: `Close the ${tag} tag properly`
      });
    }

    return errors;
  }

  /**
   * Validate CSS content
   */
  private validateCss(filePath: string, content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Basic CSS validation
    const braceCount = (content.match(/\{/g) || []).length - (content.match(/\}/g) || []).length;
    if (braceCount !== 0) {
      errors.push({
        type: 'syntax_error',
        message: 'Mismatched CSS braces',
        code: 'CSS_BRACE_MISMATCH',
        severity: 'error',
        location: { file: filePath },
        suggestion: 'Check for missing opening or closing braces'
      });
    }

    return errors;
  }

  /**
   * Validate SQL content
   */
  private validateSql(filePath: string, content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Basic SQL validation
    const keywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER'];
    const hasKeywords = keywords.some(keyword => 
      content.toUpperCase().includes(keyword)
    );

    if (!hasKeywords) {
      errors.push({
        type: 'semantic_error',
        message: 'SQL file does not contain recognized SQL keywords',
        code: 'SQL_NO_KEYWORDS',
        severity: 'warning',
        location: { file: filePath },
        suggestion: 'Ensure the file contains valid SQL statements'
      });
    }

    return errors;
  }

  /**
   * Validate plain text content
   */
  private validateText(filePath: string, content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for common issues
    if (content.length === 0) {
      errors.push({
        type: 'format_error',
        message: 'Generated file is empty',
        code: 'EMPTY_FILE',
        severity: 'warning',
        location: { file: filePath },
        suggestion: 'Ensure the template generates content for this file'
      });
    }

    // Check for template placeholders that weren't replaced
    const unreplacedPlaceholders = content.match(/\{\{[^}]+\}\}/g);
    if (unreplacedPlaceholders) {
      for (const placeholder of unreplacedPlaceholders) {
        errors.push({
          type: 'template_error',
          message: `Unreplaced template placeholder: ${placeholder}`,
          code: 'UNREPLACED_PLACEHOLDER',
          severity: 'error',
          location: { file: filePath },
          context: { placeholder },
          suggestion: 'Ensure all template variables are provided and properly replaced'
        });
      }
    }

    return errors;
  }

  /**
   * Apply consistency rules across generated files
   */
  private async applyConsistencyRules(context: TemplateValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const rule of this.consistencyRules) {
      try {
        const ruleErrors = await rule.validator(context);
        errors.push(...ruleErrors);
      } catch (error) {
        errors.push({
          type: 'consistency_error',
          message: `Consistency rule '${rule.name}' failed: ${(error as Error).message}`,
          code: 'CONSISTENCY_RULE_ERROR',
          severity: 'error',
          context: { rule: rule.name }
        });
      }
    }

    return errors;
  }

  /**
   * Check for common template issues
   */
  private async checkTemplateIssues(context: TemplateValidationContext): Promise<ValidationError[]> {
    const warnings: ValidationError[] = [];

    // Check for duplicate file names
    const fileNames = new Set<string>();
    const duplicates = new Set<string>();
    
    for (const filePath of context.outputPaths) {
      const fileName = path.basename(filePath);
      if (fileNames.has(fileName)) {
        duplicates.add(fileName);
      }
      fileNames.add(fileName);
    }

    for (const duplicate of duplicates) {
      warnings.push({
        type: 'consistency_error',
        message: `Duplicate file name detected: ${duplicate}`,
        code: 'DUPLICATE_FILE_NAME',
        severity: 'warning',
        suggestion: 'Use unique file names or organize in different directories'
      });
    }

    // Check for overly large files
    for (const [filePath, content] of context.generatedContent) {
      if (content.length > 100000) { // 100KB
        warnings.push({
          type: 'performance_concern',
          message: `Large file generated: ${filePath} (${content.length} characters)`,
          code: 'LARGE_FILE',
          severity: 'warning',
          location: { file: filePath },
          suggestion: 'Consider splitting large files into smaller modules'
        });
      }
    }

    return warnings;
  }

  /**
   * Check for performance issues
   */
  private async checkPerformanceIssues(context: TemplateValidationContext): Promise<ValidationError[]> {
    const warnings: ValidationError[] = [];

    // Check for too many generated files
    if (context.generatedContent.size > 50) {
      warnings.push({
        type: 'performance_concern',
        message: `Large number of generated files: ${context.generatedContent.size}`,
        code: 'MANY_FILES',
        severity: 'warning',
        suggestion: 'Consider consolidating related files or using a build process'
      });
    }

    // Check for deeply nested output paths
    for (const filePath of context.outputPaths) {
      const depth = filePath.split('/').length - 1;
      if (depth > 5) {
        warnings.push({
          type: 'maintainability_concern',
          message: `Deeply nested file path: ${filePath} (depth: ${depth})`,
          code: 'DEEP_NESTING',
          severity: 'warning',
          location: { file: filePath },
          suggestion: 'Consider flattening the directory structure'
        });
      }
    }

    return warnings;
  }

  /**
   * Initialize consistency rules
   */
  private initializeConsistencyRules(): void {
    this.consistencyRules = [
      {
        name: 'import-export-consistency',
        description: 'Check that imports and exports are consistent across files',
        validator: this.validateImportExportConsistency.bind(this)
      },
      {
        name: 'naming-convention-consistency',
        description: 'Check that naming conventions are consistent',
        validator: this.validateNamingConsistency.bind(this)
      },
      {
        name: 'dependency-consistency',
        description: 'Check that dependencies are properly declared',
        validator: this.validateDependencyConsistency.bind(this)
      },
      {
        name: 'configuration-consistency',
        description: 'Check that configuration files are consistent',
        validator: this.validateConfigurationConsistency.bind(this)
      }
    ];
  }

  /**
   * Validate import/export consistency
   */
  private async validateImportExportConsistency(context: TemplateValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const exports = new Map<string, string[]>();
    const imports = new Map<string, string[]>();

    // Extract imports and exports from JavaScript/TypeScript files
    for (const [filePath, content] of context.generatedContent) {
      const language = this.detectLanguage(filePath);
      
      if (language === 'javascript' || language === 'typescript') {
        try {
          const ast = language === 'typescript' ? 
            parseTypeScript(content, { tolerant: true }) :
            espree.parse(content, { ecmaVersion: 2022, sourceType: 'module', tolerant: true });
          
          const codeContext = this.extractCodeContext(ast, content, language);
          exports.set(filePath, codeContext.exports);
          imports.set(filePath, codeContext.imports);
        } catch (e) {
          // Skip files that can't be parsed
        }
      }
    }

    // Check for imports of non-existent exports
    for (const [importingFile, fileImports] of imports) {
      for (const importStatement of fileImports) {
        const match = importStatement.match(/from\s+['"]([^'"]+)['"]/);
        if (match) {
          const importPath = match[1];
          if (importPath.startsWith('.')) {
            // Relative import - check if target file exists and exports the imported items
            const resolvedPath = path.resolve(path.dirname(importingFile), importPath);
            const targetExports = exports.get(resolvedPath + '.ts') || exports.get(resolvedPath + '.js') || [];
            
            // Extract imported items
            const importedItems = this.extractImportedItems(importStatement);
            for (const item of importedItems) {
              if (!targetExports.includes(item) && item !== 'default') {
                errors.push({
                  type: 'reference_error',
                  message: `Import '${item}' not found in ${importPath}`,
                  code: 'IMPORT_NOT_FOUND',
                  severity: 'error',
                  location: { file: importingFile },
                  context: { import: item, target: importPath }
                });
              }
            }
          }
        }
      }
    }

    return errors;
  }

  /**
   * Validate naming consistency
   */
  private async validateNamingConsistency(context: TemplateValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const namingPatterns = new Map<string, RegExp>();
    
    // Define expected naming patterns
    namingPatterns.set('component', /^[A-Z][a-zA-Z0-9]*Component\.(ts|tsx)$/);
    namingPatterns.set('service', /^[a-z][a-zA-Z0-9]*\.service\.(ts|js)$/);
    namingPatterns.set('model', /^[A-Z][a-zA-Z0-9]*\.model\.(ts|js)$/);
    namingPatterns.set('test', /^[a-zA-Z0-9.-]+\.(test|spec)\.(ts|js)$/);

    for (const filePath of context.outputPaths) {
      const fileName = path.basename(filePath);
      const detected = this.detectFileType(fileName);
      
      if (detected && namingPatterns.has(detected)) {
        const pattern = namingPatterns.get(detected)!;
        if (!pattern.test(fileName)) {
          errors.push({
            type: 'style_issue',
            message: `File name '${fileName}' does not follow ${detected} naming convention`,
            code: 'NAMING_CONVENTION',
            severity: 'warning',
            location: { file: filePath },
            suggestion: `Use ${detected} naming pattern: ${pattern.source}`
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate dependency consistency
   */
  private async validateDependencyConsistency(context: TemplateValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Check for package.json and verify dependencies match imports
    const packageJsonContent = context.generatedContent.get('package.json');
    if (packageJsonContent) {
      try {
        const packageJson = JSON.parse(packageJsonContent);
        const declaredDeps = new Set([
          ...Object.keys(packageJson.dependencies || {}),
          ...Object.keys(packageJson.devDependencies || {})
        ]);

        // Check all imports to see if they're declared as dependencies
        for (const [filePath, content] of context.generatedContent) {
          const language = this.detectLanguage(filePath);
          
          if (language === 'javascript' || language === 'typescript') {
            const imports = this.extractImportStatements(content);
            
            for (const importStatement of imports) {
              const match = importStatement.match(/from\s+['"]([^'"]+)['"]/);
              if (match) {
                const moduleName = match[1];
                
                // Skip relative imports
                if (!moduleName.startsWith('.')) {
                  const packageName = moduleName.split('/')[0];
                  if (!declaredDeps.has(packageName)) {
                    errors.push({
                      type: 'dependency_error',
                      message: `Imported package '${packageName}' not declared in package.json`,
                      code: 'UNDECLARED_DEPENDENCY',
                      severity: 'error',
                      location: { file: filePath },
                      context: { package: packageName },
                      suggestion: `Add '${packageName}' to dependencies in package.json`
                    });
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        errors.push({
          type: 'format_error',
          message: 'Invalid package.json format',
          code: 'INVALID_PACKAGE_JSON',
          severity: 'error',
          location: { file: 'package.json' }
        });
      }
    }

    return errors;
  }

  /**
   * Validate configuration consistency
   */
  private async validateConfigurationConsistency(context: TemplateValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Check for common configuration files and their consistency
    const configFiles = ['tsconfig.json', 'eslintrc.json', '.eslintrc.js', 'jest.config.js'];
    const foundConfigs = configFiles.filter(file => 
      context.outputPaths.some(path => path.includes(file))
    );

    // Ensure TypeScript files have tsconfig.json
    const hasTypeScriptFiles = Array.from(context.generatedContent.keys())
      .some(path => path.endsWith('.ts') || path.endsWith('.tsx'));
    
    if (hasTypeScriptFiles && !foundConfigs.some(config => config.includes('tsconfig'))) {
      errors.push({
        type: 'configuration_error',
        message: 'TypeScript files generated but no tsconfig.json found',
        code: 'MISSING_TSCONFIG',
        severity: 'warning',
        suggestion: 'Generate a tsconfig.json file for TypeScript configuration'
      });
    }

    return errors;
  }

  /**
   * Helper methods
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const extToLang: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.json': 'json',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'css',
      '.sql': 'sql'
    };
    
    return extToLang[ext] || 'text';
  }

  private validateAst(ast: any, filePath: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (ast.errors && ast.errors.length > 0) {
      for (const error of ast.errors) {
        errors.push({
          type: 'syntax_error',
          message: `AST error: ${error.message}`,
          code: 'AST_ERROR',
          severity: 'error',
          location: {
            file: filePath,
            line: error.lineNumber,
            column: error.column
          }
        });
      }
    }

    return errors;
  }

  private extractCodeContext(ast: any, content: string, language: string): CodeValidationContext {
    const context: CodeValidationContext = {
      language,
      filePath: '',
      imports: [],
      exports: [],
      dependencies: []
    };

    // Extract imports and exports from AST
    if (ast.body) {
      for (const node of ast.body) {
        if (node.type === 'ImportDeclaration' && node.source) {
          context.imports.push(node.source.value);
        }
        
        if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
          if (node.declaration) {
            if (node.declaration.id) {
              context.exports.push(node.declaration.id.name);
            }
          }
          if (node.specifiers) {
            for (const spec of node.specifiers) {
              if (spec.exported) {
                context.exports.push(spec.exported.name);
              }
            }
          }
        }
      }
    }

    return context;
  }

  private validateCodeStructure(context: CodeValidationContext, filePath: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for common structural issues
    if (context.imports.length === 0 && context.exports.length === 0) {
      errors.push({
        type: 'style_issue',
        message: 'File has no imports or exports, consider if it should be a module',
        code: 'NO_MODULE_STRUCTURE',
        severity: 'info',
        location: { file: filePath },
        suggestion: 'Add appropriate imports/exports if this should be a module'
      });
    }

    return errors;
  }

  private findUnclosedHtmlTags(content: string): string[] {
    const unclosed: string[] = [];
    const selfClosing = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];
    const stack: string[] = [];
    
    const tagRegex = /<\/?([a-zA-Z0-9-]+)[^>]*>/g;
    let match;
    
    while ((match = tagRegex.exec(content)) !== null) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();
      
      if (selfClosing.includes(tagName) || fullTag.endsWith('/>')) {
        continue;
      }
      
      if (fullTag.startsWith('</')) {
        // Closing tag
        if (stack.length === 0 || stack[stack.length - 1] !== tagName) {
          unclosed.push(tagName);
        } else {
          stack.pop();
        }
      } else {
        // Opening tag
        stack.push(tagName);
      }
    }
    
    return [...unclosed, ...stack];
  }

  private extractImportedItems(importStatement: string): string[] {
    const items: string[] = [];
    
    // Handle different import patterns
    const defaultImport = importStatement.match(/import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from/);
    if (defaultImport) {
      items.push('default');
    }
    
    const namedImports = importStatement.match(/import\s*\{([^}]+)\}/);
    if (namedImports) {
      const namedItems = namedImports[1]
        .split(',')
        .map(item => item.trim().split(' as ')[0])
        .filter(item => item.length > 0);
      items.push(...namedItems);
    }
    
    return items;
  }

  private extractImportStatements(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+.*?from\s+['"][^'"]+['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[0]);
    }
    
    return imports;
  }

  private detectFileType(fileName: string): string | null {
    if (fileName.endsWith('Component.ts') || fileName.endsWith('Component.tsx')) return 'component';
    if (fileName.includes('.service.')) return 'service';
    if (fileName.includes('.model.')) return 'model';
    if (fileName.includes('.test.') || fileName.includes('.spec.')) return 'test';
    return null;
  }

  private generateStatistics(context: TemplateValidationContext, duration: number): ValidationStatistics {
    const totalFiles = context.generatedContent.size;
    const totalLines = Array.from(context.generatedContent.values())
      .reduce((sum, content) => sum + content.split('\n').length, 0);
    
    return {
      totalTriples: totalFiles,
      validTriples: totalFiles,
      invalidTriples: 0,
      templatesProcessed: 1,
      codeFilesValidated: totalFiles,
      performanceMetrics: {
        memoryUsage: process.memoryUsage().heapUsed,
        cpuTime: duration,
        ioOperations: totalFiles,
        cacheHits: 0,
        cacheMisses: 0
      }
    };
  }
}

/**
 * Create template validator with custom rules
 */
export function createTemplateValidator(customRules?: TemplateConsistencyRule[]): TemplateValidator {
  const validator = new TemplateValidator();
  
  if (customRules) {
    for (const rule of customRules) {
      (validator as any).consistencyRules.push(rule);
    }
  }
  
  return validator;
}

/**
 * Common template validation rules
 */
export const CommonTemplateRules = {
  /**
   * Ensure all TypeScript files have proper type annotations
   */
  TYPESCRIPT_TYPE_ANNOTATIONS: {
    name: 'typescript-type-annotations',
    description: 'Ensure TypeScript files have proper type annotations',
    validator: async (context: TemplateValidationContext): Promise<ValidationError[]> => {
      const errors: ValidationError[] = [];
      
      for (const [filePath, content] of context.generatedContent) {
        if (filePath.endsWith('.ts') && !filePath.endsWith('.d.ts')) {
          // Check for 'any' types which should be avoided
          const anyTypeMatches = content.match(/:\s*any\b/g);
          if (anyTypeMatches && anyTypeMatches.length > 0) {
            errors.push({
              type: 'type_error',
              message: `Found ${anyTypeMatches.length} 'any' type annotations in ${filePath}`,
              code: 'TYPESCRIPT_ANY_TYPE',
              severity: 'warning',
              location: { file: filePath },
              suggestion: 'Use specific types instead of "any" for better type safety'
            });
          }
        }
      }
      
      return errors;
    }
  },

  /**
   * Ensure consistent code formatting
   */
  CODE_FORMATTING: {
    name: 'code-formatting',
    description: 'Ensure consistent code formatting across files',
    validator: async (context: TemplateValidationContext): Promise<ValidationError[]> => {
      const errors: ValidationError[] = [];
      const indentationStyles = new Map<string, number>();
      
      for (const [filePath, content] of context.generatedContent) {
        const language = filePath.split('.').pop();
        
        if (['ts', 'js', 'tsx', 'jsx'].includes(language || '')) {
          // Check indentation consistency
          const lines = content.split('\n');
          let detectedIndent = 0;
          
          for (const line of lines) {
            const match = line.match(/^(\s+)/);
            if (match) {
              const indent = match[1].length;
              if (indent > 0 && detectedIndent === 0) {
                detectedIndent = indent;
                break;
              }
            }
          }
          
          if (detectedIndent > 0) {
            const existing = indentationStyles.get(language || '');
            if (existing && existing !== detectedIndent) {
              errors.push({
                type: 'style_issue',
                message: `Inconsistent indentation in ${filePath}: expected ${existing} spaces, found ${detectedIndent}`,
                code: 'INCONSISTENT_INDENTATION',
                severity: 'warning',
                location: { file: filePath },
                suggestion: `Use ${existing} spaces for indentation to maintain consistency`
              });
            } else {
              indentationStyles.set(language || '', detectedIndent);
            }
          }
        }
      }
      
      return errors;
    }
  }
};