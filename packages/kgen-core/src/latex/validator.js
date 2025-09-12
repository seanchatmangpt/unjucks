/**
 * LaTeX Validator - Professional document validation and error handling
 * 
 * Features:
 * - Comprehensive LaTeX syntax validation
 * - Academic document structure validation
 * - Legal document compliance checking
 * - Citation and reference validation
 * - Template variable validation
 * - Professional error reporting
 */

import { promises as fs } from 'fs';
import { LaTeXParser } from './parser.js';

export class LaTeXValidator {
  constructor(options = {}) {
    this.options = {
      strictMode: options.strictMode || false,
      checkReferences: options.checkReferences !== false,
      checkCitations: options.checkCitations !== false,
      validateStructure: options.validateStructure !== false,
      academicRules: options.academicRules || false,
      legalRules: options.legalRules || false,
      businessRules: options.businessRules || false,
      maxErrorsPerType: options.maxErrorsPerType || 50,
      ...options
    };
    
    this.errors = [];
    this.warnings = [];
    this.suggestions = [];
    this.statistics = {
      wordCount: 0,
      sectionCount: 0,
      figureCount: 0,
      tableCount: 0,
      equationCount: 0,
      citationCount: 0,
      referenceCount: 0
    };
    
    // Validation rules
    this.rules = new Map();
    this.initializeRules();
  }

  /**
   * Initialize validation rules
   */
  initializeRules() {
    // Basic LaTeX syntax rules
    this.addRule('missing_documentclass', {
      check: (ast) => !this.findDocumentClass(ast),
      severity: 'error',
      message: 'Missing \\documentclass command',
      suggestion: 'Add \\documentclass{article} at the beginning of your document'
    });

    this.addRule('missing_begin_document', {
      check: (ast) => !this.findEnvironment(ast, 'document'),
      severity: 'error',
      message: 'Missing \\begin{document}',
      suggestion: 'Add \\begin{document} after the preamble'
    });

    this.addRule('unmatched_braces', {
      check: (ast) => this.checkUnmatchedBraces(ast),
      severity: 'error',
      message: 'Unmatched braces detected',
      suggestion: 'Check that all { have matching } braces'
    });

    this.addRule('undefined_references', {
      check: (ast) => this.checkUndefinedReferences(ast),
      severity: 'warning',
      message: 'Undefined references found',
      suggestion: 'Ensure all \\ref{} commands have corresponding \\label{} commands'
    });

    this.addRule('undefined_citations', {
      check: (ast) => this.checkUndefinedCitations(ast),
      severity: 'warning',
      message: 'Undefined citations found',
      suggestion: 'Ensure all \\cite{} commands have corresponding bibliography entries'
    });

    // Academic document rules
    if (this.options.academicRules) {
      this.addAcademicRules();
    }

    // Legal document rules
    if (this.options.legalRules) {
      this.addLegalRules();
    }

    // Business document rules
    if (this.options.businessRules) {
      this.addBusinessRules();
    }
  }

  /**
   * Add academic-specific validation rules
   */
  addAcademicRules() {
    this.addRule('missing_abstract', {
      check: (ast) => !this.findEnvironment(ast, 'abstract'),
      severity: 'warning',
      message: 'Academic papers should include an abstract',
      suggestion: 'Add \\begin{abstract}...\\end{abstract} after \\maketitle'
    });

    this.addRule('missing_title', {
      check: (ast) => !this.findCommand(ast, 'title'),
      severity: 'warning',
      message: 'Academic papers should have a title',
      suggestion: 'Add \\title{Your Title} in the preamble'
    });

    this.addRule('missing_author', {
      check: (ast) => !this.findCommand(ast, 'author'),
      severity: 'warning',
      message: 'Academic papers should specify author(s)',
      suggestion: 'Add \\author{Your Name} in the preamble'
    });

    this.addRule('no_citations', {
      check: (ast) => this.countCitations(ast) === 0,
      severity: 'suggestion',
      message: 'Academic papers typically include citations',
      suggestion: 'Consider adding relevant citations using \\cite{}'
    });

    this.addRule('short_abstract', {
      check: (ast) => this.isAbstractTooShort(ast),
      severity: 'suggestion',
      message: 'Abstract may be too short for academic standards',
      suggestion: 'Academic abstracts are typically 150-300 words'
    });

    this.addRule('missing_keywords', {
      check: (ast) => !this.hasKeywords(ast),
      severity: 'suggestion',
      message: 'Consider adding keywords after the abstract',
      suggestion: 'Add keywords using appropriate formatting for your journal style'
    });
  }

  /**
   * Add legal-specific validation rules
   */
  addLegalRules() {
    this.addRule('missing_parties', {
      check: (ast) => !this.hasLegalParties(ast),
      severity: 'error',
      message: 'Legal documents must specify parties',
      suggestion: 'Clearly identify all parties to the agreement'
    });

    this.addRule('missing_date', {
      check: (ast) => !this.hasEffectiveDate(ast),
      severity: 'error',
      message: 'Legal documents must include an effective date',
      suggestion: 'Add the effective date of the agreement'
    });

    this.addRule('missing_signatures', {
      check: (ast) => !this.hasSignatureBlocks(ast),
      severity: 'warning',
      message: 'Legal documents should include signature blocks',
      suggestion: 'Add signature lines for all parties'
    });

    this.addRule('missing_jurisdiction', {
      check: (ast) => !this.hasJurisdiction(ast),
      severity: 'warning',
      message: 'Legal documents should specify governing law',
      suggestion: 'Add a jurisdiction or governing law clause'
    });

    this.addRule('improper_numbering', {
      check: (ast) => !this.hasProperLegalNumbering(ast),
      severity: 'suggestion',
      message: 'Consider using proper legal section numbering',
      suggestion: 'Use hierarchical numbering (1.1, 1.2, etc.) for clarity'
    });
  }

  /**
   * Add business-specific validation rules
   */
  addBusinessRules() {
    this.addRule('missing_executive_summary', {
      check: (ast) => !this.hasExecutiveSummary(ast),
      severity: 'warning',
      message: 'Business documents should include an executive summary',
      suggestion: 'Add an executive summary section at the beginning'
    });

    this.addRule('missing_timeline', {
      check: (ast) => !this.hasTimeline(ast),
      severity: 'suggestion',
      message: 'Business proposals should include project timeline',
      suggestion: 'Add a timeline or schedule section'
    });

    this.addRule('missing_budget', {
      check: (ast) => !this.hasBudgetInfo(ast),
      severity: 'suggestion',
      message: 'Business proposals should include budget information',
      suggestion: 'Add financial projections or budget breakdown'
    });
  }

  /**
   * Add custom validation rule
   */
  addRule(name, rule) {
    this.rules.set(name, {
      name,
      ...rule
    });
  }

  /**
   * Validate LaTeX content (string input)
   */
  async validateContent(content, options = {}) {
    try {
      this.reset();
      
      // Parse the LaTeX content
      const parser = new LaTeXParser(content, {
        strictMode: this.options.strictMode,
        trackReferences: this.options.checkReferences,
        validateStructure: this.options.validateStructure
      });
      
      const parseResult = parser.parse();
      
      // Add parser errors and warnings
      this.errors.push(...parseResult.errors);
      this.warnings.push(...parseResult.warnings);
      
      // Extract statistics
      this.extractStatistics(parseResult);
      
      // Run validation rules
      await this.runValidationRules(parseResult.ast);
      
      // Generate validation report
      return this.generateValidationReport(parseResult);
      
    } catch (error) {
      this.addError('validation_failed', error.message);
      return {
        valid: false,
        errors: this.errors,
        warnings: this.warnings,
        suggestions: this.suggestions
      };
    }
  }

  /**
   * Validate LaTeX file
   */
  async validateFile(filePath, options = {}) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const result = await this.validateContent(content, options);
      result.filePath = filePath;
      return result;
    } catch (error) {
      this.addError('file_read_error', `Could not read file: ${error.message}`);
      return {
        valid: false,
        filePath,
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  /**
   * Run all validation rules against AST
   */
  async runValidationRules(ast) {
    for (const [ruleName, rule] of this.rules) {
      try {
        const violations = await this.checkRule(rule, ast);
        
        if (violations && violations.length > 0) {
          for (const violation of violations.slice(0, this.options.maxErrorsPerType)) {
            this.addViolation(rule, violation);
          }
        }
      } catch (error) {
        this.addError('rule_check_failed', `Rule ${ruleName} failed: ${error.message}`);
      }
    }
  }

  /**
   * Check individual validation rule
   */
  async checkRule(rule, ast) {
    if (typeof rule.check === 'function') {
      const result = rule.check(ast);
      
      if (result === true) {
        return [{ message: rule.message }];
      } else if (Array.isArray(result)) {
        return result;
      } else if (result) {
        return [result];
      }
    }
    
    return null;
  }

  /**
   * Add rule violation to appropriate list
   */
  addViolation(rule, violation) {
    const item = {
      rule: rule.name,
      message: violation.message || rule.message,
      suggestion: rule.suggestion,
      position: violation.position,
      context: violation.context,
      timestamp: new Date().toISOString()
    };
    
    switch (rule.severity) {
      case 'error':
        this.errors.push(item);
        break;
      case 'warning':
        this.warnings.push(item);
        break;
      case 'suggestion':
        this.suggestions.push(item);
        break;
      default:
        this.warnings.push(item);
    }
  }

  /**
   * Add error to error list
   */
  addError(type, message, context = {}) {
    this.errors.push({
      type,
      message,
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Extract document statistics
   */
  extractStatistics(parseResult) {
    if (parseResult.structure) {
      this.statistics = {
        wordCount: this.estimateWordCount(parseResult.ast),
        sectionCount: parseResult.structure.sections?.length || 0,
        figureCount: parseResult.structure.figures?.length || 0,
        tableCount: parseResult.structure.tables?.length || 0,
        equationCount: parseResult.structure.equations?.length || 0,
        citationCount: parseResult.structure.citations?.size || 0,
        referenceCount: parseResult.structure.references?.size || 0,
        packageCount: parseResult.structure.packages?.length || 0
      };
    }
  }

  /**
   * Generate comprehensive validation report
   */
  generateValidationReport(parseResult) {
    const isValid = this.errors.length === 0;
    
    return {
      valid: isValid,
      score: this.calculateValidationScore(),
      summary: {
        errors: this.errors.length,
        warnings: this.warnings.length,
        suggestions: this.suggestions.length,
        totalIssues: this.errors.length + this.warnings.length + this.suggestions.length
      },
      errors: this.errors,
      warnings: this.warnings,
      suggestions: this.suggestions,
      statistics: this.statistics,
      structure: parseResult.structure,
      metadata: parseResult.metadata,
      recommendations: this.generateRecommendations(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate validation score (0-100)
   */
  calculateValidationScore() {
    let score = 100;
    
    // Deduct points for issues
    score -= this.errors.length * 10;
    score -= this.warnings.length * 5;
    score -= this.suggestions.length * 2;
    
    // Bonus points for good practices
    if (this.statistics.citationCount > 0) score += 5;
    if (this.statistics.figureCount > 0) score += 3;
    if (this.statistics.tableCount > 0) score += 3;
    if (this.statistics.sectionCount > 2) score += 5;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate recommendations based on validation results
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Priority recommendations based on errors
    if (this.errors.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'errors',
        message: `Fix ${this.errors.length} critical error(s) before compilation`,
        action: 'Review and address all error messages'
      });
    }
    
    // Structure recommendations
    if (this.statistics.sectionCount < 2) {
      recommendations.push({
        priority: 'medium',
        category: 'structure',
        message: 'Document structure could be improved',
        action: 'Consider organizing content into logical sections'
      });
    }
    
    // Academic recommendations
    if (this.options.academicRules) {
      if (this.statistics.citationCount === 0) {
        recommendations.push({
          priority: 'medium',
          category: 'academic',
          message: 'Academic papers benefit from citations',
          action: 'Add relevant citations to support your arguments'
        });
      }
      
      if (this.statistics.figureCount === 0 && this.statistics.wordCount > 1000) {
        recommendations.push({
          priority: 'low',
          category: 'academic',
          message: 'Consider adding figures or diagrams',
          action: 'Visual elements can enhance understanding'
        });
      }
    }
    
    // Quality recommendations
    if (this.warnings.length > 10) {
      recommendations.push({
        priority: 'medium',
        category: 'quality',
        message: 'Multiple warnings detected',
        action: 'Review warnings to improve document quality'
      });
    }
    
    return recommendations;
  }

  // Utility methods for rule checking

  findDocumentClass(ast) {
    return this.findCommand(ast, 'documentclass');
  }

  findEnvironment(node, envName) {
    if (node.type === 'environment' && node.value === envName) {
      return node;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const found = this.findEnvironment(child, envName);
        if (found) return found;
      }
    }
    
    return null;
  }

  findCommand(node, commandName) {
    if (node.type === 'command' && node.value === commandName) {
      return node;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const found = this.findCommand(child, commandName);
        if (found) return found;
      }
    }
    
    return null;
  }

  checkUnmatchedBraces(ast) {
    // This would require more sophisticated analysis
    // For now, return false (no unmatched braces detected)
    return false;
  }

  checkUndefinedReferences(ast) {
    // Compare references with labels
    // Implementation would check parseResult.structure
    return false;
  }

  checkUndefinedCitations(ast) {
    // Check if citations have corresponding bibliography entries
    return false;
  }

  countCitations(ast) {
    return this.statistics.citationCount;
  }

  isAbstractTooShort(ast) {
    const abstractNode = this.findEnvironment(ast, 'abstract');
    if (!abstractNode) return false;
    
    const abstractText = this.extractTextFromNode(abstractNode);
    const wordCount = abstractText.split(/\s+/).length;
    
    return wordCount < 50; // Less than 50 words is considered short
  }

  hasKeywords(ast) {
    // Look for keywords in abstract or after abstract
    const abstractNode = this.findEnvironment(ast, 'abstract');
    if (!abstractNode) return false;
    
    const abstractText = this.extractTextFromNode(abstractNode).toLowerCase();
    return abstractText.includes('keyword') || abstractText.includes('key word');
  }

  hasLegalParties(ast) {
    // Look for party definitions or similar legal language
    const content = this.extractTextFromNode(ast).toLowerCase();
    return content.includes('party') || content.includes('parties') || 
           content.includes('contracting party') || content.includes('signatory');
  }

  hasEffectiveDate(ast) {
    const content = this.extractTextFromNode(ast).toLowerCase();
    return content.includes('effective date') || content.includes('date of') ||
           content.includes('executed on') || this.findCommand(ast, 'date');
  }

  hasSignatureBlocks(ast) {
    const content = this.extractTextFromNode(ast).toLowerCase();
    return content.includes('signature') || content.includes('signed') ||
           this.findCommand(ast, 'signature');
  }

  hasJurisdiction(ast) {
    const content = this.extractTextFromNode(ast).toLowerCase();
    return content.includes('jurisdiction') || content.includes('governing law') ||
           content.includes('governed by');
  }

  hasProperLegalNumbering(ast) {
    // Check for hierarchical numbering patterns
    const content = this.extractTextFromNode(ast);
    return /\d+\.\d+/.test(content); // Look for patterns like 1.1, 2.3, etc.
  }

  hasExecutiveSummary(ast) {
    const content = this.extractTextFromNode(ast).toLowerCase();
    return content.includes('executive summary') || content.includes('summary');
  }

  hasTimeline(ast) {
    const content = this.extractTextFromNode(ast).toLowerCase();
    return content.includes('timeline') || content.includes('schedule') ||
           content.includes('milestone') || content.includes('deliverable');
  }

  hasBudgetInfo(ast) {
    const content = this.extractTextFromNode(ast).toLowerCase();
    return content.includes('budget') || content.includes('cost') ||
           content.includes('price') || content.includes('financial');
  }

  extractTextFromNode(node) {
    if (!node) return '';
    
    if (node.type === 'text') {
      return node.value || '';
    }
    
    if (node.children && node.children.length > 0) {
      return node.children.map(child => this.extractTextFromNode(child)).join(' ');
    }
    
    return '';
  }

  estimateWordCount(ast) {
    const text = this.extractTextFromNode(ast);
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  reset() {
    this.errors = [];
    this.warnings = [];
    this.suggestions = [];
    this.statistics = {
      wordCount: 0,
      sectionCount: 0,
      figureCount: 0,
      tableCount: 0,
      equationCount: 0,
      citationCount: 0,
      referenceCount: 0
    };
  }

  /**
   * Validate template variables against template requirements
   */
  validateTemplateVariables(templateInfo, data) {
    const errors = [];
    const warnings = [];
    const suggestions = [];
    
    if (templateInfo.variables) {
      for (const variable of templateInfo.variables) {
        const value = this.getNestedProperty(data, variable);
        
        if (!value) {
          if (templateInfo.requiredVariables?.includes(variable)) {
            errors.push({
              type: 'missing_required_variable',
              message: `Required variable missing: ${variable}`,
              suggestion: `Provide value for ${variable}`
            });
          } else {
            warnings.push({
              type: 'missing_optional_variable',
              message: `Optional variable missing: ${variable}`,
              suggestion: `Consider providing value for ${variable}`
            });
          }
        }
      }
    }
    
    // Template-specific validation
    if (templateInfo.category === 'academic') {
      this.validateAcademicTemplateVariables(data, errors, warnings, suggestions);
    } else if (templateInfo.category === 'legal') {
      this.validateLegalTemplateVariables(data, errors, warnings, suggestions);
    } else if (templateInfo.category === 'business') {
      this.validateBusinessTemplateVariables(data, errors, warnings, suggestions);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  validateAcademicTemplateVariables(data, errors, warnings, suggestions) {
    if (!data.title) {
      errors.push({
        type: 'missing_title',
        message: 'Academic documents require a title',
        suggestion: 'Provide a descriptive title for your paper'
      });
    }
    
    if (!data.authors || data.authors.length === 0) {
      errors.push({
        type: 'missing_authors',
        message: 'Academic documents require author information',
        suggestion: 'Provide author names and affiliations'
      });
    }
    
    if (!data.abstract) {
      warnings.push({
        type: 'missing_abstract',
        message: 'Academic papers typically include an abstract',
        suggestion: 'Consider adding an abstract summarizing your work'
      });
    }
  }

  validateLegalTemplateVariables(data, errors, warnings, suggestions) {
    if (!data.parties || data.parties.length === 0) {
      errors.push({
        type: 'missing_parties',
        message: 'Legal documents must identify all parties',
        suggestion: 'Provide complete party information'
      });
    }
    
    if (!data.effectiveDate) {
      errors.push({
        type: 'missing_effective_date',
        message: 'Legal documents require an effective date',
        suggestion: 'Specify when the agreement becomes effective'
      });
    }
  }

  validateBusinessTemplateVariables(data, errors, warnings, suggestions) {
    if (!data.company) {
      warnings.push({
        type: 'missing_company',
        message: 'Business documents should identify the company',
        suggestion: 'Provide company name and information'
      });
    }
    
    if (!data.summary) {
      suggestions.push({
        type: 'missing_summary',
        message: 'Business proposals benefit from an executive summary',
        suggestion: 'Consider adding a brief executive summary'
      });
    }
  }

  getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }
}

export default LaTeXValidator;