/**
 * KGEN LaTeX Syntax Validation System
 * Comprehensive validation for LaTeX documents with error recovery
 * Integrates with KGEN's parser for semantic validation
 */

import { LaTeXParser } from '../parser.js';

/**
 * LaTeX Syntax Rule Engine
 */
class LaTeXSyntaxRules {
  constructor() {
    this.rules = new Map();
    this.initializeStandardRules();
  }
  
  /**
   * Initialize standard LaTeX validation rules
   */
  initializeStandardRules() {
    // Document structure rules
    this.addRule('document_structure', {
      name: 'Document Structure Validation',
      description: 'Validates proper document structure and required elements',
      severity: 'error',
      validator: this.validateDocumentStructure.bind(this)
    });
    
    // Environment matching rules
    this.addRule('environment_matching', {
      name: 'Environment Matching',
      description: 'Validates that all environments have matching begin/end pairs',
      severity: 'error',
      validator: this.validateEnvironmentMatching.bind(this)
    });
    
    // Brace balancing rules
    this.addRule('brace_balancing', {
      name: 'Brace Balancing',
      description: 'Validates that all braces are properly balanced',
      severity: 'error',
      validator: this.validateBraceBalancing.bind(this)
    });
    
    // Citation validation
    this.addRule('citation_validation', {
      name: 'Citation Validation',
      description: 'Validates citation commands and bibliography consistency',
      severity: 'warning',
      validator: this.validateCitations.bind(this)
    });
    
    // Math mode validation
    this.addRule('math_mode', {
      name: 'Math Mode Validation',
      description: 'Validates math environments and inline math',
      severity: 'warning',
      validator: this.validateMathMode.bind(this)
    });
    
    // Package consistency
    this.addRule('package_consistency', {
      name: 'Package Consistency',
      description: 'Validates package usage and compatibility',
      severity: 'info',
      validator: this.validatePackageConsistency.bind(this)
    });
    
    // Label and reference validation
    this.addRule('label_reference', {
      name: 'Label and Reference Validation',
      description: 'Validates that all references have corresponding labels',
      severity: 'warning',
      validator: this.validateLabelsAndReferences.bind(this)
    });
  }
  
  /**
   * Add a custom validation rule
   */
  addRule(id, rule) {
    this.rules.set(id, {
      id,
      enabled: true,
      ...rule
    });
  }
  
  /**
   * Remove a validation rule
   */
  removeRule(id) {
    this.rules.delete(id);
  }
  
  /**
   * Enable/disable a rule
   */
  setRuleEnabled(id, enabled) {
    const rule = this.rules.get(id);
    if (rule) {
      rule.enabled = enabled;
    }
  }
  
  /**
   * Get all rules
   */
  getRules() {
    return Array.from(this.rules.values());
  }
  
  /**
   * Validate document structure
   */
  validateDocumentStructure(parseResult) {
    const issues = [];
    const { ast, documentStructure } = parseResult;
    
    // Check for documentclass
    const hasDocumentClass = documentStructure.preamble.some(node => 
      node.type === 'command' && node.value === 'documentclass'
    );
    
    if (!hasDocumentClass) {
      issues.push({
        type: 'missing_documentclass',
        severity: 'error',
        message: 'Document is missing \\documentclass command',
        line: 1,
        column: 1
      });
    }
    
    // Check for document environment
    const hasDocumentEnv = this.findNodesByType(ast, 'environment')
      .some(node => node.value === 'document');
    
    if (!hasDocumentEnv) {
      issues.push({
        type: 'missing_document_environment',
        severity: 'error',
        message: 'Document is missing document environment',
        line: 1,
        column: 1
      });
    }
    
    // Check for title, author if article class
    const docClass = documentStructure.preamble.find(node => 
      node.type === 'command' && node.value === 'documentclass'
    );
    
    if (docClass && this.isArticleClass(docClass)) {
      const hasTitle = documentStructure.preamble.some(node => 
        node.type === 'command' && node.value === 'title'
      );
      
      if (!hasTitle) {
        issues.push({
          type: 'missing_title',
          severity: 'warning',
          message: 'Article document is missing \\title command',
          line: 1,
          column: 1
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Validate environment matching
   */
  validateEnvironmentMatching(parseResult) {
    const issues = [];
    const { ast } = parseResult;
    
    const environments = [];
    this.collectEnvironments(ast, environments);
    
    // Check for unmatched environments
    const environmentStack = [];
    
    for (const env of environments) {
      if (env.type === 'begin') {
        environmentStack.push(env);
      } else if (env.type === 'end') {
        if (environmentStack.length === 0) {
          issues.push({
            type: 'unmatched_end_environment',
            severity: 'error',
            message: `Unexpected \\end{${env.name}} without matching \\begin`,
            line: env.line || 1,
            column: env.column || 1
          });
        } else {
          const beginEnv = environmentStack.pop();
          if (beginEnv.name !== env.name) {
            issues.push({
              type: 'mismatched_environment',
              severity: 'error',
              message: `Environment mismatch: \\begin{${beginEnv.name}} ... \\end{${env.name}}`,
              line: env.line || 1,
              column: env.column || 1
            });
          }
        }
      }
    }
    
    // Check for unclosed environments
    for (const unclosed of environmentStack) {
      issues.push({
        type: 'unclosed_environment',
        severity: 'error',
        message: `Unclosed environment: \\begin{${unclosed.name}}`,
        line: unclosed.line || 1,
        column: unclosed.column || 1
      });
    }
    
    return issues;
  }
  
  /**
   * Validate brace balancing
   */
  validateBraceBalancing(parseResult) {
    const issues = [];
    const { tokens } = parseResult;
    
    if (!tokens) return issues;
    
    const braceStack = [];
    const bracketStack = [];
    
    for (const token of tokens) {
      switch (token.type) {
        case 'LEFT_BRACE':
          braceStack.push(token);
          break;
          
        case 'RIGHT_BRACE':
          if (braceStack.length === 0) {
            issues.push({
              type: 'unmatched_closing_brace',
              severity: 'error',
              message: 'Unmatched closing brace',
              line: token.position.line,
              column: token.position.column
            });
          } else {
            braceStack.pop();
          }
          break;
          
        case 'LEFT_BRACKET':
          bracketStack.push(token);
          break;
          
        case 'RIGHT_BRACKET':
          if (bracketStack.length === 0) {
            issues.push({
              type: 'unmatched_closing_bracket',
              severity: 'warning',
              message: 'Unmatched closing bracket',
              line: token.position.line,
              column: token.position.column
            });
          } else {
            bracketStack.pop();
          }
          break;
      }
    }
    
    // Check for unclosed braces
    for (const unclosed of braceStack) {
      issues.push({
        type: 'unclosed_brace',
        severity: 'error',
        message: 'Unclosed brace',
        line: unclosed.position.line,
        column: unclosed.position.column
      });
    }
    
    // Check for unclosed brackets
    for (const unclosed of bracketStack) {
      issues.push({
        type: 'unclosed_bracket',
        severity: 'warning',
        message: 'Unclosed bracket',
        line: unclosed.position.line,
        column: unclosed.position.column
      });
    }
    
    return issues;
  }
  
  /**
   * Validate citations
   */
  validateCitations(parseResult) {
    const issues = [];
    const { ast } = parseResult;
    
    const citations = this.findNodesByType(ast, 'command')
      .filter(node => ['cite', 'citep', 'citet', 'citealp', 'citealt'].includes(node.value));
    
    const hasBibliography = this.findNodesByType(ast, 'command')
      .some(node => ['bibliography', 'bibliographystyle', 'printbibliography'].includes(node.value));
    
    if (citations.length > 0 && !hasBibliography) {
      issues.push({
        type: 'missing_bibliography',
        severity: 'warning',
        message: 'Document contains citations but no bibliography',
        line: citations[0].position?.line || 1,
        column: citations[0].position?.column || 1
      });
    }
    
    // Check for empty citations
    for (const citation of citations) {
      if (!citation.children || citation.children.length === 0) {
        issues.push({
          type: 'empty_citation',
          severity: 'warning',
          message: `Empty citation command: \\${citation.value}`,
          line: citation.position?.line || 1,
          column: citation.position?.column || 1
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Validate math mode
   */
  validateMathMode(parseResult) {
    const issues = [];
    const { ast } = parseResult;
    
    const mathNodes = this.findNodesByType(ast, 'math');
    
    for (const mathNode of mathNodes) {
      // Check for empty math environments
      if (!mathNode.children || mathNode.children.length === 0) {
        issues.push({
          type: 'empty_math_environment',
          severity: 'info',
          message: `Empty ${mathNode.attributes?.type || 'math'} environment`,
          line: mathNode.position?.line || 1,
          column: mathNode.position?.column || 1
        });
      }
      
      // Check for text content in math mode
      const hasTextContent = mathNode.children?.some(child => 
        child.type === 'text' && /[a-zA-Z]{2,}/.test(child.value)
      );
      
      if (hasTextContent) {
        issues.push({
          type: 'text_in_math_mode',
          severity: 'warning',
          message: 'Text content detected in math mode - consider using \\text{}',
          line: mathNode.position?.line || 1,
          column: mathNode.position?.column || 1
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Validate package consistency
   */
  validatePackageConsistency(parseResult) {
    const issues = [];
    const { documentStructure } = parseResult;
    
    const packages = documentStructure.preamble
      .filter(node => node.type === 'command' && node.value === 'usepackage')
      .map(node => this.extractPackageName(node));
    
    // Check for conflicting packages
    const conflicts = [
      ['inputenc', 'fontenc'], // Often used together
      ['babel', 'polyglossia'], // Language packages that conflict
    ];
    
    // Check for duplicate packages
    const packageCounts = {};
    for (const pkg of packages) {
      if (pkg) {
        packageCounts[pkg] = (packageCounts[pkg] || 0) + 1;
      }
    }
    
    for (const [pkg, count] of Object.entries(packageCounts)) {
      if (count > 1) {
        issues.push({
          type: 'duplicate_package',
          severity: 'info',
          message: `Package '${pkg}' is loaded multiple times`,
          line: 1,
          column: 1
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Validate labels and references
   */
  validateLabelsAndReferences(parseResult) {
    const issues = [];
    const { ast } = parseResult;
    
    const labels = new Set();
    const references = [];
    
    // Collect all labels
    const labelNodes = this.findNodesByType(ast, 'command')
      .filter(node => node.value === 'label');
    
    for (const labelNode of labelNodes) {
      const labelName = this.extractLabelName(labelNode);
      if (labelName) {
        if (labels.has(labelName)) {
          issues.push({
            type: 'duplicate_label',
            severity: 'error',
            message: `Duplicate label: ${labelName}`,
            line: labelNode.position?.line || 1,
            column: labelNode.position?.column || 1
          });
        } else {
          labels.add(labelName);
        }
      }
    }
    
    // Collect all references
    const refNodes = this.findNodesByType(ast, 'command')
      .filter(node => ['ref', 'eqref', 'pageref', 'autoref'].includes(node.value));
    
    for (const refNode of refNodes) {
      const refName = this.extractReferenceName(refNode);
      if (refName) {
        references.push({
          name: refName,
          node: refNode
        });
      }
    }
    
    // Check for undefined references
    for (const ref of references) {
      if (!labels.has(ref.name)) {
        issues.push({
          type: 'undefined_reference',
          severity: 'warning',
          message: `Undefined reference: ${ref.name}`,
          line: ref.node.position?.line || 1,
          column: ref.node.position?.column || 1
        });
      }
    }
    
    // Check for unused labels
    const referencedLabels = new Set(references.map(ref => ref.name));
    for (const label of labels) {
      if (!referencedLabels.has(label)) {
        issues.push({
          type: 'unused_label',
          severity: 'info',
          message: `Unused label: ${label}`,
          line: 1,
          column: 1
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Helper method to find nodes by type recursively
   */
  findNodesByType(node, type) {
    const results = [];
    
    if (node.type === type) {
      results.push(node);
    }
    
    if (node.children) {
      node.children.forEach(child => {
        results.push(...this.findNodesByType(child, type));
      });
    }
    
    return results;
  }
  
  /**
   * Check if document class is article-like
   */
  isArticleClass(docClassNode) {
    const className = this.extractTextFromNode(docClassNode.children[0]);
    return ['article', 'IEEEtran', 'llncs', 'acmart'].includes(className);
  }
  
  /**
   * Collect environment begin/end pairs
   */
  collectEnvironments(node, environments) {
    if (node.type === 'command') {
      if (node.value === 'begin' && node.children.length > 0) {
        const envName = this.extractTextFromNode(node.children[0]);
        environments.push({
          type: 'begin',
          name: envName,
          line: node.position?.line,
          column: node.position?.column
        });
      } else if (node.value === 'end' && node.children.length > 0) {
        const envName = this.extractTextFromNode(node.children[0]);
        environments.push({
          type: 'end',
          name: envName,
          line: node.position?.line,
          column: node.position?.column
        });
      }
    }
    
    if (node.children) {
      node.children.forEach(child => {
        this.collectEnvironments(child, environments);
      });
    }
  }
  
  /**
   * Extract package name from usepackage command
   */
  extractPackageName(packageNode) {
    if (packageNode.children && packageNode.children.length > 0) {
      return this.extractTextFromNode(packageNode.children[packageNode.children.length - 1]);
    }
    return null;
  }
  
  /**
   * Extract label name from label command
   */
  extractLabelName(labelNode) {
    if (labelNode.children && labelNode.children.length > 0) {
      return this.extractTextFromNode(labelNode.children[0]);
    }
    return null;
  }
  
  /**
   * Extract reference name from ref command
   */
  extractReferenceName(refNode) {
    if (refNode.children && refNode.children.length > 0) {
      return this.extractTextFromNode(refNode.children[0]);
    }
    return null;
  }
  
  /**
   * Extract text from node recursively
   */
  extractTextFromNode(node) {
    if (!node) return '';
    
    if (node.type === 'text') {
      return node.value;
    }
    
    if (node.children) {
      return node.children.map(child => this.extractTextFromNode(child)).join('');
    }
    
    return '';
  }
}

/**
 * Main LaTeX Syntax Validator
 */
export class LaTeXSyntaxValidator {
  constructor(options = {}) {
    this.options = {
      enableAllRules: true,
      strictMode: false,
      customRules: [],
      ...options
    };
    
    this.ruleEngine = new LaTeXSyntaxRules();
    
    // Add custom rules
    if (this.options.customRules) {
      this.options.customRules.forEach(rule => {
        this.ruleEngine.addRule(rule.id, rule);
      });
    }
  }
  
  /**
   * Validate LaTeX document syntax
   */
  async validate(input, options = {}) {
    const validateOptions = { ...this.options, ...options };
    
    // Parse the document first
    const parser = new LaTeXParser(input, {
      semanticAnalysis: true,
      strictMode: validateOptions.strictMode
    });
    
    const parseResult = parser.parse();
    
    // Collect all validation issues
    const allIssues = [];
    
    // Add parsing errors as validation issues
    parseResult.errors.forEach(error => {
      allIssues.push({
        type: 'parse_error',
        severity: 'error',
        message: error.message,
        line: error.position?.line || 1,
        column: error.position?.column || 1,
        source: 'parser'
      });
    });
    
    // Add parsing warnings as validation issues
    parseResult.warnings?.forEach(warning => {
      allIssues.push({
        type: 'parse_warning',
        severity: 'warning',
        message: warning.message,
        line: warning.position?.line || 1,
        column: warning.position?.column || 1,
        source: 'parser'
      });
    });
    
    // Run validation rules
    const enabledRules = this.ruleEngine.getRules().filter(rule => rule.enabled);
    
    for (const rule of enabledRules) {
      try {
        const ruleIssues = await rule.validator(parseResult);
        ruleIssues.forEach(issue => {
          allIssues.push({
            ...issue,
            rule: rule.id,
            source: 'validator'
          });
        });
      } catch (error) {
        allIssues.push({
          type: 'rule_error',
          severity: 'error',
          message: `Validation rule '${rule.id}' failed: ${error.message}`,
          line: 1,
          column: 1,
          source: 'validator'
        });
      }
    }
    
    // Sort issues by severity and line number
    allIssues.sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      
      return (a.line || 0) - (b.line || 0);
    });
    
    // Calculate validation summary
    const summary = this.calculateValidationSummary(allIssues, parseResult);
    
    return {
      valid: allIssues.filter(issue => issue.severity === 'error').length === 0,
      issues: allIssues,
      summary,
      parseResult,
      metadata: {
        validatedAt: new Date().toISOString(),
        rulesApplied: enabledRules.length,
        inputLength: input.length
      }
    };
  }
  
  /**
   * Calculate validation summary
   */
  calculateValidationSummary(issues, parseResult) {
    const summary = {
      totalIssues: issues.length,
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length,
      score: 0,
      quality: 'unknown'
    };
    
    // Calculate quality score (0-100)
    const maxScore = 100;
    let deductions = 0;
    
    deductions += summary.errors * 20;    // Major deduction for errors
    deductions += summary.warnings * 5;   // Minor deduction for warnings
    deductions += summary.info * 1;       // Minimal deduction for info
    
    summary.score = Math.max(0, maxScore - deductions);
    
    // Determine quality level
    if (summary.score >= 90) summary.quality = 'excellent';
    else if (summary.score >= 75) summary.quality = 'good';
    else if (summary.score >= 60) summary.quality = 'fair';
    else if (summary.score >= 40) summary.quality = 'poor';
    else summary.quality = 'critical';
    
    return summary;
  }
  
  /**
   * Add custom validation rule
   */
  addRule(id, rule) {
    this.ruleEngine.addRule(id, rule);
  }
  
  /**
   * Remove validation rule
   */
  removeRule(id) {
    this.ruleEngine.removeRule(id);
  }
  
  /**
   * Enable/disable validation rule
   */
  setRuleEnabled(id, enabled) {
    this.ruleEngine.setRuleEnabled(id, enabled);
  }
  
  /**
   * Get all validation rules
   */
  getRules() {
    return this.ruleEngine.getRules();
  }
  
  /**
   * Quick validation - returns only error count
   */
  async quickValidate(input) {
    const result = await this.validate(input);
    return {
      valid: result.valid,
      errorCount: result.summary.errors,
      warningCount: result.summary.warnings
    };
  }
}

export default LaTeXSyntaxValidator;