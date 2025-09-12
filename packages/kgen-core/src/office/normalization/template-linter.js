/**
 * Template Linter for Non-Deterministic Functions
 * 
 * Detects and prevents non-deterministic template functions that would
 * break deterministic document generation.
 * 
 * @module template-linter
 * @version 1.0.0
 */

/**
 * Template linter for detecting non-deterministic patterns
 */
export class TemplateLinter {
  constructor(options = {}) {
    this.options = {
      strict: true,
      allowedNonDeterministic: [],
      customChecks: [],
      ...options
    };

    // Define non-deterministic patterns to detect
    this.nonDeterministicPatterns = [
      // Date/time functions
      {
        pattern: /\b(?:now|today|date|time|timestamp)\s*\(\s*\)/gi,
        category: 'datetime',
        message: 'Date/time functions are non-deterministic',
        severity: 'error',
        examples: ['now()', 'today()', 'date()', 'time()']
      },
      
      // Random functions
      {
        pattern: /\b(?:random|rand|uuid|guid)\s*\(\s*\)/gi,
        category: 'random',
        message: 'Random/UUID functions are non-deterministic',
        severity: 'error',
        examples: ['random()', 'rand()', 'uuid()', 'guid()']
      },
      
      // System-specific functions
      {
        pattern: /\b(?:process\.pid|os\.hostname|sys\.platform)\b/gi,
        category: 'system',
        message: 'System-specific functions are non-deterministic',
        severity: 'error',
        examples: ['process.pid', 'os.hostname()', 'sys.platform']
      },
      
      // Nunjucks-specific non-deterministic
      {
        pattern: /\{\{\s*(?:loop\.index|loop\.index0|range\([^)]*\))\s*\}\}/gi,
        category: 'nunjucks-loop',
        message: 'Loop indexes can be non-deterministic depending on context',
        severity: 'warning',
        examples: ['{{ loop.index }}', '{{ range(random()) }}']
      },
      
      // File system paths that might vary
      {
        pattern: /\{\{\s*(?:__dirname|__filename|process\.cwd\(\))\s*\}\}/gi,
        category: 'filesystem',
        message: 'File system paths are environment-dependent',
        severity: 'error',
        examples: ['{{ __dirname }}', '{{ __filename }}']
      },
      
      // Network/URL functions
      {
        pattern: /\b(?:fetch|axios|request)\s*\(/gi,
        category: 'network',
        message: 'Network requests are non-deterministic',
        severity: 'error',
        examples: ['fetch()', 'axios.get()']
      },
      
      // JavaScript Date constructor with no args
      {
        pattern: /new\s+Date\s*\(\s*\)/gi,
        category: 'date-constructor',
        message: 'Date constructor without arguments uses current time',
        severity: 'error',
        examples: ['this.getDeterministicDate()']
      },
      
      // Math.random()
      {
        pattern: /Math\.random\s*\(\s*\)/gi,
        category: 'math-random',
        message: 'Math.random() is non-deterministic',
        severity: 'error',
        examples: ['Math.random()']
      },
      
      // Environment variables
      {
        pattern: /process\.env\.[A-Z_][A-Z0-9_]*/gi,
        category: 'environment',
        message: 'Environment variables can vary between runs',
        severity: 'warning',
        examples: ['process.env.NODE_ENV', 'process.env.USER']
      }
    ];
  }

  /**
   * Lint template content for non-deterministic patterns
   * 
   * @param {string} templateContent - Template content to lint
   * @param {string} [templatePath] - Optional template file path
   * @returns {LintResult} Linting results
   */
  lintTemplate(templateContent, templatePath = 'unknown') {
    const issues = [];
    const warnings = [];
    const errors = [];
    
    // Check for each non-deterministic pattern
    for (const check of this.nonDeterministicPatterns) {
      const matches = this.findPatternMatches(templateContent, check);
      
      for (const match of matches) {
        const issue = {
          type: check.category,
          severity: check.severity,
          message: check.message,
          line: match.line,
          column: match.column,
          length: match.length,
          text: match.text,
          templatePath,
          suggestions: this.getSuggestions(check, match.text)
        };
        
        issues.push(issue);
        
        if (issue.severity === 'error') {
          errors.push(issue);
        } else if (issue.severity === 'warning') {
          warnings.push(issue);
        }
      }
    }
    
    // Run custom checks if provided
    if (this.options.customChecks.length > 0) {
      for (const customCheck of this.options.customChecks) {
        const customIssues = customCheck(templateContent, templatePath);
        issues.push(...customIssues);
      }
    }
    
    // Check if template context uses deterministic data
    const contextIssues = this.checkTemplateContext(templateContent);
    issues.push(...contextIssues);
    
    // Determine if template passes linting
    const hasBlockingIssues = errors.length > 0 || (this.options.strict && warnings.length > 0);
    
    return {
      valid: !hasBlockingIssues,
      issues,
      errors,
      warnings,
      templatePath,
      suggestions: this.generateFixSuggestions(issues),
      summary: {
        totalIssues: issues.length,
        errorCount: errors.length,
        warningCount: warnings.length,
        hasBlockingIssues
      }
    };
  }

  /**
   * Find matches for a specific pattern in content
   * 
   * @param {string} content - Content to search
   * @param {Object} check - Pattern check configuration
   * @returns {Array} Array of matches with location information
   */
  findPatternMatches(content, check) {
    const matches = [];
    const lines = content.split('\n');
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      let match;
      
      // Reset regex lastIndex to ensure proper matching
      check.pattern.lastIndex = 0;
      
      while ((match = check.pattern.exec(line)) !== null) {
        matches.push({
          line: lineIndex + 1,
          column: match.index + 1,
          length: match[0].length,
          text: match[0]
        });
        
        // Prevent infinite loop on zero-length matches
        if (match.index === check.pattern.lastIndex) {
          check.pattern.lastIndex++;
        }
      }
    }
    
    return matches;
  }

  /**
   * Get suggestions for fixing non-deterministic patterns
   * 
   * @param {Object} check - Pattern check configuration
   * @param {string} matchText - Matched text
   * @returns {Array<string>} Suggested fixes
   */
  getSuggestions(check, matchText) {
    const suggestions = [];
    
    switch (check.category) {
      case 'datetime':
        suggestions.push('Use a template variable like {{ buildDate }} passed from context');
        suggestions.push('Use a fixed date for consistent output: {{ "2024-01-01" | date }}');
        break;
        
      case 'random':
        suggestions.push('Use a seeded random function or predetermined values');
        suggestions.push('Pass random values as template variables from context');
        break;
        
      case 'system':
        suggestions.push('Pass system information as template variables');
        suggestions.push('Use configuration values instead of runtime system queries');
        break;
        
      case 'environment':
        suggestions.push('Use build-time environment variables or configuration');
        suggestions.push('Pass environment values through template context');
        break;
        
      case 'filesystem':
        suggestions.push('Use relative paths or template variables');
        suggestions.push('Configure paths through build configuration');
        break;
        
      case 'network':
        suggestions.push('Pre-fetch data at build time and pass through context');
        suggestions.push('Use static data or cached responses');
        break;
        
      default:
        suggestions.push('Replace with deterministic alternative');
        suggestions.push('Pass value through template context');
    }
    
    return suggestions;
  }

  /**
   * Check template context for deterministic data patterns
   * 
   * @param {string} content - Template content
   * @returns {Array} Context-related issues
   */
  checkTemplateContext(content) {
    const issues = [];
    
    // Look for potential context issues
    const contextPatterns = [
      {
        pattern: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\|\s*(?:random|shuffle|sample)\s*\}\}/gi,
        message: 'Template filters using random operations are non-deterministic',
        severity: 'error'
      },
      {
        pattern: /\{\{\s*range\([^)]*Math\.random[^)]*\)\s*\}\}/gi,
        message: 'Range functions with random parameters are non-deterministic',
        severity: 'error'
      }
    ];
    
    for (const check of contextPatterns) {
      const matches = this.findPatternMatches(content, check);
      
      for (const match of matches) {
        issues.push({
          type: 'context',
          severity: check.severity,
          message: check.message,
          line: match.line,
          column: match.column,
          text: match.text,
          suggestions: ['Use deterministic data in template context']
        });
      }
    }
    
    return issues;
  }

  /**
   * Generate comprehensive fix suggestions
   * 
   * @param {Array} issues - Linting issues
   * @returns {Object} Organized fix suggestions
   */
  generateFixSuggestions(issues) {
    const suggestions = {
      immediate: [],
      architectural: [],
      configuration: []
    };
    
    // Group issues by category for better suggestions
    const issuesByCategory = {};
    for (const issue of issues) {
      if (!issuesByCategory[issue.type]) {
        issuesByCategory[issue.type] = [];
      }
      issuesByCategory[issue.type].push(issue);
    }
    
    // Generate category-specific suggestions
    for (const [category, categoryIssues] of Object.entries(issuesByCategory)) {
      switch (category) {
        case 'datetime':
          suggestions.architectural.push('Implement build-time date injection');
          suggestions.configuration.push('Add deterministic date configuration option');
          break;
          
        case 'random':
          suggestions.architectural.push('Use seeded random number generators');
          suggestions.immediate.push('Replace random calls with static values');
          break;
          
        case 'system':
        case 'environment':
          suggestions.configuration.push('Move system queries to build-time configuration');
          suggestions.architectural.push('Implement environment abstraction layer');
          break;
      }
    }
    
    return suggestions;
  }

  /**
   * Lint multiple templates in a directory
   * 
   * @param {Array<{path: string, content: string}>} templates - Templates to lint
   * @returns {Object} Aggregated linting results
   */
  lintTemplates(templates) {
    const results = [];
    const summary = {
      totalTemplates: templates.length,
      validTemplates: 0,
      invalidTemplates: 0,
      totalIssues: 0,
      totalErrors: 0,
      totalWarnings: 0
    };
    
    for (const template of templates) {
      const result = this.lintTemplate(template.content, template.path);
      results.push(result);
      
      if (result.valid) {
        summary.validTemplates++;
      } else {
        summary.invalidTemplates++;
      }
      
      summary.totalIssues += result.issues.length;
      summary.totalErrors += result.errors.length;
      summary.totalWarnings += result.warnings.length;
    }
    
    return {
      results,
      summary,
      overallValid: summary.invalidTemplates === 0
    };
  }

  /**
   * Create deterministic template context validator
   * 
   * @param {Object} context - Template context to validate
   * @returns {Object} Context validation result
   */
  validateTemplateContext(context) {
    const issues = [];
    
    // Check for functions in context
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'function') {
        issues.push({
          type: 'context-function',
          severity: 'warning',
          message: `Context contains function '${key}' which may be non-deterministic`,
          key,
          suggestions: ['Replace with static value or deterministic result']
        });
      }
      
      // Check for Date objects
      if (value instanceof Date) {
        issues.push({
          type: 'context-date',
          severity: 'info',
          message: `Context contains Date object '${key}'`,
          key,
          value: value.toISOString(),
          suggestions: ['Ensure Date represents fixed point in time, not current time']
        });
      }
      
      // Check for complex objects that might contain non-deterministic data
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nestedIssues = this.validateNestedContext(value, key);
        issues.push(...nestedIssues);
      }
    }
    
    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      contextKeys: Object.keys(context),
      summary: {
        totalKeys: Object.keys(context).length,
        issueCount: issues.length,
        errorCount: issues.filter(i => i.severity === 'error').length,
        warningCount: issues.filter(i => i.severity === 'warning').length
      }
    };
  }

  /**
   * Validate nested context objects
   * 
   * @param {Object} obj - Object to validate
   * @param {string} path - Current path in object
   * @returns {Array} Issues found in nested object
   */
  validateNestedContext(obj, path) {
    const issues = [];
    
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = `${path}.${key}`;
      
      if (typeof value === 'function') {
        issues.push({
          type: 'nested-context-function',
          severity: 'warning',
          message: `Nested context contains function at '${fullPath}'`,
          key: fullPath
        });
      }
      
      if (value instanceof Date) {
        issues.push({
          type: 'nested-context-date',
          severity: 'info',
          message: `Nested context contains Date at '${fullPath}'`,
          key: fullPath,
          value: value.toISOString()
        });
      }
      
      // Recursively check nested objects (with depth limit)
      if (value && typeof value === 'object' && !Array.isArray(value) && path.split('.').length < 5) {
        const nestedIssues = this.validateNestedContext(value, fullPath);
        issues.push(...nestedIssues);
      }
    }
    
    return issues;
  }
}

/**
 * Create template linter with default settings
 * 
 * @param {Object} options - Linter options
 * @returns {TemplateLinter} Configured linter
 */
export function createTemplateLinter(options = {}) {
  return new TemplateLinter(options);
}

/**
 * Quick template validation function
 * 
 * @param {string} templateContent - Template content to validate
 * @param {Object} options - Linter options
 * @returns {Object} Linting result
 */
export function validateTemplate(templateContent, options = {}) {
  const linter = new TemplateLinter(options);
  return linter.lintTemplate(templateContent);
}

/**
 * Quick context validation function
 * 
 * @param {Object} context - Template context to validate
 * @param {Object} options - Linter options
 * @returns {Object} Context validation result
 */
export function validateContext(context, options = {}) {
  const linter = new TemplateLinter(options);
  return linter.validateTemplateContext(context);
}

export default TemplateLinter;