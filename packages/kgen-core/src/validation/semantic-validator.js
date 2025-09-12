/**
 * KGEN Semantic Validator
 * 
 * Validates semantic consistency and correctness of templates,
 * frontmatter, and RDF graph data.
 */

/**
 * Semantic validation for KGEN templates and data
 */
export class SemanticValidator {
  constructor(options = {}) {
    this.options = {
      enableSemanticChecks: options.enableSemanticChecks !== false,
      strictMode: options.strictMode || false,
      ...options
    };
    
    this.validationErrors = [];
    this.validationWarnings = [];
  }

  /**
   * Validate frontmatter semantics
   * @param {Object} frontmatter - Frontmatter object
   * @returns {Object} Validation result
   */
  validateFrontmatter(frontmatter) {
    this.validationErrors = [];
    this.validationWarnings = [];

    if (!frontmatter || typeof frontmatter !== 'object') {
      return { valid: true, errors: [], warnings: [] };
    }

    // Validate operation modes
    this._validateOperationMode(frontmatter);

    // Validate paths
    this._validatePaths(frontmatter);

    // Validate conditions
    this._validateConditions(frontmatter);

    // Validate KGEN-specific fields
    this._validateKgenFields(frontmatter);

    return {
      valid: this.validationErrors.length === 0,
      errors: [...this.validationErrors],
      warnings: [...this.validationWarnings]
    };
  }

  /**
   * Validate RDF graph structure
   * @param {Object} graph - RDF graph object
   * @returns {Object} Validation result
   */
  validateGraph(graph) {
    this.validationErrors = [];
    this.validationWarnings = [];

    if (!graph) {
      this.validationErrors.push('Graph is required');
      return { valid: false, errors: [...this.validationErrors], warnings: [] };
    }

    // Basic graph structure validation
    if (!graph.entities || !Array.isArray(graph.entities)) {
      this.validationErrors.push('Graph must have entities array');
    }

    if (!graph.relationships || !Array.isArray(graph.relationships)) {
      this.validationErrors.push('Graph must have relationships array');
    }

    if (!graph.triples || !Array.isArray(graph.triples)) {
      this.validationErrors.push('Graph must have triples array');
    }

    // Validate entity structure
    if (graph.entities) {
      graph.entities.forEach((entity, index) => {
        if (!entity.id) {
          this.validationErrors.push(`Entity at index ${index} missing ID`);
        }
        if (!entity.type) {
          this.validationWarnings.push(`Entity ${entity.id} missing type`);
        }
      });
    }

    return {
      valid: this.validationErrors.length === 0,
      errors: [...this.validationErrors],
      warnings: [...this.validationWarnings]
    };
  }

  /**
   * Validate template variable usage
   * @param {string} templateContent - Template content
   * @param {Object} context - Available context variables
   * @returns {Object} Validation result
   */
  validateTemplateVariables(templateContent, context = {}) {
    this.validationErrors = [];
    this.validationWarnings = [];

    if (!templateContent || typeof templateContent !== 'string') {
      return { valid: true, errors: [], warnings: [] };
    }

    // Extract variables from template
    const variables = this._extractVariableReferences(templateContent);
    const availableVars = new Set(Object.keys(context));

    // Check for undefined variables
    for (const variable of variables) {
      if (!availableVars.has(variable)) {
        this.validationWarnings.push(`Undefined variable: ${variable}`);
      }
    }

    return {
      valid: this.validationErrors.length === 0,
      errors: [...this.validationErrors],
      warnings: [...this.validationWarnings]
    };
  }

  // Private validation methods

  _validateOperationMode(frontmatter) {
    const validModes = ['create', 'inject', 'update', 'append', 'prepend'];
    const mode = frontmatter.inject ? 'inject' : 'create';

    if (frontmatter.mode && !validModes.includes(frontmatter.mode)) {
      this.validationErrors.push(`Invalid operation mode: ${frontmatter.mode}`);
    }

    // Check for conflicting modes
    if (frontmatter.inject && frontmatter.append) {
      this.validationErrors.push('Cannot use both inject and append modes');
    }

    if (frontmatter.inject && frontmatter.prepend) {
      this.validationErrors.push('Cannot use both inject and prepend modes');
    }
  }

  _validatePaths(frontmatter) {
    // Validate 'to' path
    if (frontmatter.to && typeof frontmatter.to !== 'string') {
      this.validationErrors.push('Path "to" must be a string');
    }

    // Check for path injection vulnerabilities
    if (frontmatter.to && (frontmatter.to.includes('../') || frontmatter.to.startsWith('/'))) {
      this.validationWarnings.push('Path contains potentially unsafe navigation');
    }
  }

  _validateConditions(frontmatter) {
    // Validate skipIf conditions
    if (frontmatter.skipIf) {
      if (typeof frontmatter.skipIf === 'object' && frontmatter.skipIf.exists) {
        // File existence check
        if (typeof frontmatter.skipIf.exists !== 'string') {
          this.validationErrors.push('skipIf.exists must be a string path');
        }
      }
    }

    // Validate unless conditions
    if (frontmatter.unless && typeof frontmatter.unless !== 'string' && typeof frontmatter.unless !== 'boolean') {
      this.validationErrors.push('unless condition must be string or boolean');
    }
  }

  _validateKgenFields(frontmatter) {
    // Validate KGEN-specific fields
    if (frontmatter.deterministic !== undefined && typeof frontmatter.deterministic !== 'boolean') {
      this.validationErrors.push('deterministic field must be boolean');
    }

    if (frontmatter.contentAddressed !== undefined && typeof frontmatter.contentAddressed !== 'boolean') {
      this.validationErrors.push('contentAddressed field must be boolean');
    }

    if (frontmatter.attestations !== undefined && typeof frontmatter.attestations !== 'boolean') {
      this.validationErrors.push('attestations field must be boolean');
    }

    // Validate version constraints
    if (frontmatter.kgenVersion) {
      if (typeof frontmatter.kgenVersion !== 'string') {
        this.validationErrors.push('kgenVersion must be a string');
      } else if (!/^\d+\.\d+\.\d+/.test(frontmatter.kgenVersion)) {
        this.validationWarnings.push('kgenVersion should follow semantic versioning');
      }
    }
  }

  _extractVariableReferences(templateContent) {
    const variables = new Set();
    
    // Extract Nunjucks variables: {{ variable }}
    const variablePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)(?:\s*\|.*?)?\s*\}\}/g;
    let match;
    
    while ((match = variablePattern.exec(templateContent)) !== null) {
      const varName = match[1].split('.')[0]; // Get root variable name
      variables.add(varName);
    }
    
    // Extract control structure variables
    const controlPattern = /\{\%\s*(?:if|elif|for|set)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g;
    while ((match = controlPattern.exec(templateContent)) !== null) {
      const varName = match[1].split('.')[0];
      variables.add(varName);
    }
    
    return variables;
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return {
      errorsFound: this.validationErrors.length,
      warningsFound: this.validationWarnings.length,
      lastValidation: new Date().toISOString()
    };
  }

  /**
   * Reset validation state
   */
  reset() {
    this.validationErrors = [];
    this.validationWarnings = [];
  }
}

export default SemanticValidator;