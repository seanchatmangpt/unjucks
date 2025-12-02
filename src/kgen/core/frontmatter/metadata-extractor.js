/**
 * KGEN Metadata Extractor
 * 
 * Extracts comprehensive metadata from templates and frontmatter for provenance
 * tracking, variable analysis, dependency mapping, and audit trail generation.
 */

import { EventEmitter } from 'events';
import { Consola } from 'consola';
import path from 'path';

export class MetadataExtractor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableProvenance: true,
      enableDependencyAnalysis: true,
      enableVariableTracking: true,
      enableComplexityAnalysis: true,
      enableSecurityAnalysis: true,
      maxAnalysisDepth: 10,
      enableCaching: true,
      ...options
    };
    
    this.logger = new Consola({ tag: 'kgen-metadata-extractor' });
    this.extractionCache = new Map();
    this.dependencyGraph = new Map();
    this.variableRegistry = new Map();
  }

  /**
   * Extract comprehensive metadata from frontmatter and template
   * @param {Object} frontmatter - Parsed frontmatter
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Extracted metadata
   */
  async extract(frontmatter, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    const extractionId = this._generateExtractionId();
    
    try {
      this.logger.debug(`Starting metadata extraction ${extractionId}`);
      
      // Generate cache key
      const cacheKey = this._generateCacheKey(frontmatter, options);
      
      // Check cache if enabled
      if (this.options.enableCaching && this.extractionCache.has(cacheKey)) {
        const cached = this.extractionCache.get(cacheKey);
        return {
          ...cached,
          extractionMetadata: {
            ...cached.extractionMetadata,
            cacheHit: true,
            extractionId
          }
        };
      }
      
      // Extract core metadata
      const coreMetadata = this._extractCoreMetadata(frontmatter, options);
      
      // Extract operational metadata
      const operationalMetadata = this._extractOperationalMetadata(frontmatter, options);
      
      // Extract variable metadata
      let variableMetadata = {};
      if (this.options.enableVariableTracking) {
        variableMetadata = await this._extractVariableMetadata(frontmatter, options);
      }
      
      // Extract dependency metadata
      let dependencyMetadata = {};
      if (this.options.enableDependencyAnalysis) {
        dependencyMetadata = await this._extractDependencyMetadata(frontmatter, options);
      }
      
      // Extract complexity metadata
      let complexityMetadata = {};
      if (this.options.enableComplexityAnalysis) {
        complexityMetadata = this._extractComplexityMetadata(frontmatter, options);
      }
      
      // Extract security metadata
      let securityMetadata = {};
      if (this.options.enableSecurityAnalysis) {
        securityMetadata = this._extractSecurityMetadata(frontmatter, options);
      }
      
      // Extract provenance metadata
      let provenanceMetadata = {};
      if (this.options.enableProvenance) {
        provenanceMetadata = this._extractProvenanceMetadata(frontmatter, options);
      }
      
      // Combine all metadata
      const metadata = {
        extractionId,
        core: coreMetadata,
        operational: operationalMetadata,
        variables: variableMetadata,
        dependencies: dependencyMetadata,
        complexity: complexityMetadata,
        security: securityMetadata,
        provenance: provenanceMetadata,
        extractionMetadata: {
          extractionTime: this.getDeterministicTimestamp() - startTime,
          extractionId,
          cacheHit: false,
          enabledFeatures: this._getEnabledFeatures(),
          timestamp: this.getDeterministicDate()
        }
      };
      
      // Cache result
      if (this.options.enableCaching) {
        this.extractionCache.set(cacheKey, metadata);
      }
      
      // Emit extraction event
      this.emit('metadata:extracted', {
        extractionId,
        metadata,
        extractionTime: this.getDeterministicTimestamp() - startTime
      });
      
      return metadata;
      
    } catch (error) {
      this.emit('metadata:error', { extractionId, error });
      this.logger.error(`Metadata extraction ${extractionId} failed:`, error);
      throw error;
    }
  }

  /**
   * Extract variables from frontmatter and template content
   * @param {Object} frontmatter - Parsed frontmatter
   * @param {string} templateContent - Template content
   * @returns {Promise<Object>} Variable extraction result
   */
  async extractVariables(frontmatter, templateContent) {
    try {
      const variables = {
        frontmatterVariables: [],
        templateVariables: [],
        allVariables: [],
        variableDefinitions: {},
        variableUsage: {},
        undefinedVariables: []
      };
      
      // Extract from frontmatter
      const frontmatterVars = this._extractVariablesFromObject(frontmatter);
      variables.frontmatterVariables = frontmatterVars;
      
      // Extract from template content
      if (templateContent) {
        const templateVars = this._extractTemplateVariables(templateContent);
        variables.templateVariables = templateVars.variables;
        variables.variableUsage = templateVars.usage;
      }
      
      // Extract variable definitions
      if (frontmatter.variables && typeof frontmatter.variables === 'object') {
        variables.variableDefinitions = this._processVariableDefinitions(frontmatter.variables);
      }
      
      // Combine all variables
      const allVars = new Set([
        ...variables.frontmatterVariables,
        ...variables.templateVariables,
        ...Object.keys(variables.variableDefinitions)
      ]);
      variables.allVariables = Array.from(allVars).sort();
      
      // Find undefined variables (used but not defined)
      const definedVars = new Set([
        ...Object.keys(variables.variableDefinitions),
        ...this._getBuiltinVariables()
      ]);
      
      variables.undefinedVariables = variables.allVariables.filter(v => !definedVars.has(v));
      
      return variables;
      
    } catch (error) {
      this.logger.error('Variable extraction failed:', error);
      return {
        frontmatterVariables: [],
        templateVariables: [],
        allVariables: [],
        variableDefinitions: {},
        variableUsage: {},
        undefinedVariables: []
      };
    }
  }

  /**
   * Extract core metadata from frontmatter
   * @param {Object} frontmatter - Parsed frontmatter
   * @param {Object} options - Extraction options
   * @returns {Object} Core metadata
   */
  _extractCoreMetadata(frontmatter, options) {
    return {
      templateType: this._determineTemplateType(frontmatter),
      outputPath: frontmatter.to || frontmatter.outputPath || null,
      operationMode: this._determineOperationMode(frontmatter),
      hasConditions: !!(frontmatter.skipIf || frontmatter.when),
      hasVariables: !!(frontmatter.variables && Object.keys(frontmatter.variables).length > 0),
      hasShellCommands: !!(frontmatter.sh && frontmatter.sh.length > 0),
      hasPermissions: !!frontmatter.chmod,
      frontmatterKeys: Object.keys(frontmatter).sort(),
      frontmatterSize: JSON.stringify(frontmatter).length
    };
  }

  /**
   * Extract operational metadata
   * @param {Object} frontmatter - Parsed frontmatter
   * @param {Object} options - Extraction options
   * @returns {Object} Operational metadata
   */
  _extractOperationalMetadata(frontmatter, options) {
    const metadata = {
      operationMode: this._determineOperationMode(frontmatter),
      isDestructive: this._isDestructiveOperation(frontmatter),
      requiresExistingFile: this._requiresExistingFile(frontmatter),
      createsNewFile: this._createsNewFile(frontmatter),
      modifiesExistingFile: this._modifiesExistingFile(frontmatter),
      hasBackupStrategy: !!frontmatter.backup,
      allowsOverwrite: !!frontmatter.overwrite,
      isDryRunSupported: true
    };
    
    // Add operation-specific metadata
    if (frontmatter.inject) {
      metadata.injectionStrategy = {
        hasMarkers: !!(frontmatter.before || frontmatter.after),
        beforeMarker: frontmatter.before || null,
        afterMarker: frontmatter.after || null,
        fallbackToEnd: !frontmatter.before && !frontmatter.after
      };
    }
    
    if (frontmatter.lineAt) {
      metadata.lineInsertion = {
        lineNumber: frontmatter.lineAt,
        isValidLineNumber: typeof frontmatter.lineAt === 'number' && frontmatter.lineAt > 0
      };
    }
    
    return metadata;
  }

  /**
   * Extract variable metadata
   * @param {Object} frontmatter - Parsed frontmatter
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Variable metadata
   */
  async _extractVariableMetadata(frontmatter, options) {
    const templateContent = options.templateContent || '';
    const context = options.context || {};
    
    // Extract variables using the dedicated method
    const variableData = await this.extractVariables(frontmatter, templateContent);
    
    // Add additional metadata
    return {
      ...variableData,
      contextVariables: Object.keys(context).sort(),
      variableComplexity: this._calculateVariableComplexity(variableData),
      hasCircularReferences: this._detectCircularReferences(variableData),
      variableTypes: this._inferVariableTypes(variableData.variableDefinitions)
    };
  }

  /**
   * Extract dependency metadata
   * @param {Object} frontmatter - Parsed frontmatter
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Dependency metadata
   */
  async _extractDependencyMetadata(frontmatter, options) {
    const dependencies = {
      fileDependencies: [],
      templateDependencies: [],
      externalDependencies: [],
      systemDependencies: []
    };
    
    // File dependencies from output path
    if (frontmatter.to) {
      const outputDir = path.dirname(frontmatter.to);
      dependencies.fileDependencies.push({
        type: 'output_directory',
        path: outputDir,
        required: true
      });
      
      // Check for injection dependencies
      if (frontmatter.inject && frontmatter.to) {
        dependencies.fileDependencies.push({
          type: 'target_file',
          path: frontmatter.to,
          required: true,
          operation: 'inject'
        });
      }
    }
    
    // Shell command dependencies
    if (frontmatter.sh && Array.isArray(frontmatter.sh)) {
      const shellDeps = this._extractShellDependencies(frontmatter.sh);
      dependencies.systemDependencies.push(...shellDeps);
    }
    
    // Template include dependencies (if template content is provided)
    if (options.templateContent) {
      const templateDeps = this._extractTemplateDependencies(options.templateContent);
      dependencies.templateDependencies.push(...templateDeps);
    }
    
    return dependencies;
  }

  /**
   * Extract complexity metadata
   * @param {Object} frontmatter - Parsed frontmatter
   * @param {Object} options - Extraction options
   * @returns {Object} Complexity metadata
   */
  _extractComplexityMetadata(frontmatter, options) {
    let complexity = 1; // Base complexity
    const factors = [];
    
    // Conditional complexity
    if (frontmatter.skipIf) {
      const conditionComplexity = this._calculateConditionComplexity(frontmatter.skipIf);
      complexity += conditionComplexity;
      factors.push({ type: 'conditional', value: conditionComplexity });
    }
    
    // Operation complexity
    const operationComplexity = this._calculateOperationComplexity(frontmatter);
    complexity += operationComplexity;
    factors.push({ type: 'operation', value: operationComplexity });
    
    // Variable complexity
    if (frontmatter.variables) {
      const variableComplexity = Object.keys(frontmatter.variables).length;
      complexity += variableComplexity * 0.5;
      factors.push({ type: 'variables', value: variableComplexity });
    }
    
    // Shell command complexity
    if (frontmatter.sh && Array.isArray(frontmatter.sh)) {
      const shellComplexity = frontmatter.sh.length * 2;
      complexity += shellComplexity;
      factors.push({ type: 'shell_commands', value: shellComplexity });
    }
    
    return {
      totalComplexity: Math.round(complexity),
      complexityFactors: factors,
      complexityLevel: this._getComplexityLevel(complexity),
      estimatedProcessingTime: this._estimateProcessingTime(complexity)
    };
  }

  /**
   * Extract security metadata
   * @param {Object} frontmatter - Parsed frontmatter
   * @param {Object} options - Extraction options
   * @returns {Object} Security metadata
   */
  _extractSecurityMetadata(frontmatter, options) {
    const securityIssues = [];
    const securityWarnings = [];
    let riskLevel = 'low';
    
    // Check shell commands for security risks
    if (frontmatter.sh && Array.isArray(frontmatter.sh)) {
      const shellAnalysis = this._analyzeShellSecurity(frontmatter.sh);
      securityIssues.push(...shellAnalysis.issues);
      securityWarnings.push(...shellAnalysis.warnings);
      if (shellAnalysis.riskLevel === 'high') riskLevel = 'high';
      else if (shellAnalysis.riskLevel === 'medium' && riskLevel !== 'high') riskLevel = 'medium';
    }
    
    // Check file permissions
    if (frontmatter.chmod) {
      const permissionAnalysis = this._analyzePermissions(frontmatter.chmod);
      if (permissionAnalysis.warnings.length > 0) {
        securityWarnings.push(...permissionAnalysis.warnings);
      }
    }
    
    // Check output path for security issues
    if (frontmatter.to) {
      const pathAnalysis = this._analyzePathSecurity(frontmatter.to);
      if (pathAnalysis.issues.length > 0) {
        securityIssues.push(...pathAnalysis.issues);
        if (riskLevel !== 'high') riskLevel = 'medium';
      }
    }
    
    // Check for overwrite risks
    if (frontmatter.overwrite) {
      securityWarnings.push({
        type: 'overwrite_enabled',
        message: 'File overwrite is enabled, existing files may be lost',
        severity: 'medium'
      });
    }
    
    return {
      riskLevel,
      securityIssues,
      securityWarnings,
      hasShellCommands: !!(frontmatter.sh && frontmatter.sh.length > 0),
      hasFilePermissions: !!frontmatter.chmod,
      allowsOverwrite: !!frontmatter.overwrite,
      securityScore: this._calculateSecurityScore(securityIssues, securityWarnings)
    };
  }

  /**
   * Extract provenance metadata
   * @param {Object} frontmatter - Parsed frontmatter
   * @param {Object} options - Extraction options
   * @returns {Object} Provenance metadata
   */
  _extractProvenanceMetadata(frontmatter, options) {
    return {
      extractionTimestamp: this.getDeterministicDate(),
      operationId: options.operationId || null,
      parentOperationId: options.parentOperationId || null,
      provenanceContext: options.provenanceContext || null,
      templateFingerprint: this._calculateTemplateFingerprint(frontmatter),
      contextFingerprint: this._calculateContextFingerprint(options.context),
      extractionVersion: '1.0.0',
      metadataVersion: '1.0.0'
    };
  }

  /**
   * Extract variables from object recursively
   * @param {Object} obj - Object to scan
   * @returns {Array} Variable names
   */
  _extractVariablesFromObject(obj) {
    const variables = new Set();
    
    const extractFromValue = (value) => {
      if (typeof value === 'string') {
        const matches = value.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*(?:\|[^}]*)?\}\}/g);
        if (matches) {
          matches.forEach(match => {
            const varMatch = match.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)/);
            if (varMatch) {
              variables.add(varMatch[1].split('.')[0]);
            }
          });
        }
      } else if (Array.isArray(value)) {
        value.forEach(extractFromValue);
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(extractFromValue);
      }
    };
    
    Object.values(obj).forEach(extractFromValue);
    return Array.from(variables).sort();
  }

  /**
   * Extract variables from template content
   * @param {string} content - Template content
   * @returns {Object} Variable extraction result
   */
  _extractTemplateVariables(content) {
    const variables = new Set();
    const usage = {};
    
    // Nunjucks/Jinja2 style: {{ variable }}
    const variableRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*(?:\|.*?)?\}\}/g;
    let match;
    
    while ((match = variableRegex.exec(content)) !== null) {
      const variable = match[1].split('.')[0];
      variables.add(variable);
      
      if (!usage[variable]) {
        usage[variable] = [];
      }
      usage[variable].push({
        line: this._getLineNumber(content, match.index),
        column: this._getColumnNumber(content, match.index),
        context: this._getContext(content, match.index)
      });
    }
    
    // Control structures: {% if variable %}
    const controlRegex = /\{%\s*(?:if|unless|for|set)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g;
    while ((match = controlRegex.exec(content)) !== null) {
      const variable = match[1].split('.')[0];
      variables.add(variable);
      
      if (!usage[variable]) {
        usage[variable] = [];
      }
      usage[variable].push({
        line: this._getLineNumber(content, match.index),
        column: this._getColumnNumber(content, match.index),
        context: this._getContext(content, match.index),
        type: 'control'
      });
    }
    
    return {
      variables: Array.from(variables).sort(),
      usage
    };
  }

  /**
   * Process variable definitions
   * @param {Object} variables - Variable definitions
   * @returns {Object} Processed definitions
   */
  _processVariableDefinitions(variables) {
    const processed = {};
    
    for (const [name, definition] of Object.entries(variables)) {
      if (typeof definition === 'string') {
        processed[name] = {
          type: 'string',
          description: definition,
          required: false
        };
      } else if (typeof definition === 'object' && definition !== null) {
        processed[name] = {
          type: definition.type || 'string',
          description: definition.description || '',
          required: definition.required === true,
          default: definition.default,
          choices: definition.choices,
          validation: definition.validation
        };
      }
    }
    
    return processed;
  }

  /**
   * Get builtin variables
   * @returns {Array} Builtin variable names
   */
  _getBuiltinVariables() {
    return ['meta', 'kgen', 'loop', 'range', 'caller', '__dirname', '__filename'];
  }

  /**
   * Calculate variable complexity
   * @param {Object} variableData - Variable data
   * @returns {number} Complexity score
   */
  _calculateVariableComplexity(variableData) {
    let complexity = variableData.allVariables.length;
    
    // Add complexity for undefined variables
    complexity += variableData.undefinedVariables.length * 2;
    
    // Add complexity for variable definitions with validation
    for (const def of Object.values(variableData.variableDefinitions)) {
      if (def.validation) complexity += 2;
      if (def.choices) complexity += 1;
    }
    
    return complexity;
  }

  /**
   * Detect circular references in variables
   * @param {Object} variableData - Variable data
   * @returns {boolean} Whether circular references exist
   */
  _detectCircularReferences(variableData) {
    // Simplified circular reference detection
    // In a full implementation, this would analyze variable dependencies
    return false;
  }

  /**
   * Infer variable types from definitions
   * @param {Object} definitions - Variable definitions
   * @returns {Object} Inferred types
   */
  _inferVariableTypes(definitions) {
    const types = {};
    
    for (const [name, def] of Object.entries(definitions)) {
      types[name] = def.type || 'string';
    }
    
    return types;
  }

  /**
   * Determine template type
   * @param {Object} frontmatter - Frontmatter
   * @returns {string} Template type
   */
  _determineTemplateType(frontmatter) {
    if (frontmatter.inject) return 'injection';
    if (frontmatter.append) return 'append';
    if (frontmatter.prepend) return 'prepend';
    if (frontmatter.lineAt) return 'line_insertion';
    return 'file_generation';
  }

  /**
   * Determine operation mode
   * @param {Object} frontmatter - Frontmatter
   * @returns {string} Operation mode
   */
  _determineOperationMode(frontmatter) {
    if (frontmatter.operationMode) return frontmatter.operationMode;
    if (frontmatter.inject) return 'inject';
    if (frontmatter.append) return 'append';
    if (frontmatter.prepend) return 'prepend';
    if (frontmatter.lineAt) return 'lineAt';
    return 'write';
  }

  /**
   * Check if operation is destructive
   * @param {Object} frontmatter - Frontmatter
   * @returns {boolean} Whether operation is destructive
   */
  _isDestructiveOperation(frontmatter) {
    return !!(frontmatter.overwrite || 
             (frontmatter.operationMode === 'write' && !frontmatter.backup));
  }

  /**
   * Check if operation requires existing file
   * @param {Object} frontmatter - Frontmatter
   * @returns {boolean} Whether existing file is required
   */
  _requiresExistingFile(frontmatter) {
    return !!(frontmatter.inject || frontmatter.lineAt);
  }

  /**
   * Check if operation creates new file
   * @param {Object} frontmatter - Frontmatter
   * @returns {boolean} Whether new file is created
   */
  _createsNewFile(frontmatter) {
    const mode = this._determineOperationMode(frontmatter);
    return mode === 'write' || mode === 'append' || mode === 'prepend';
  }

  /**
   * Check if operation modifies existing file
   * @param {Object} frontmatter - Frontmatter
   * @returns {boolean} Whether existing file is modified
   */
  _modifiesExistingFile(frontmatter) {
    const mode = this._determineOperationMode(frontmatter);
    return mode === 'inject' || mode === 'lineAt' || 
           (mode === 'append' && !frontmatter.createNew) ||
           (mode === 'prepend' && !frontmatter.createNew);
  }

  /**
   * Calculate condition complexity
   * @param {string} condition - Condition string
   * @returns {number} Complexity score
   */
  _calculateConditionComplexity(condition) {
    let complexity = 1;
    
    // Count operators
    const operators = condition.match(/[=!<>]+|&&|\|\|/g) || [];
    complexity += operators.length;
    
    // Count parentheses groups
    const groups = condition.match(/\([^)]*\)/g) || [];
    complexity += groups.length;
    
    // Count function calls
    const functions = condition.match(/\w+\s*\(/g) || [];
    complexity += functions.length * 2;
    
    return complexity;
  }

  /**
   * Calculate operation complexity
   * @param {Object} frontmatter - Frontmatter
   * @returns {number} Complexity score
   */
  _calculateOperationComplexity(frontmatter) {
    const mode = this._determineOperationMode(frontmatter);
    
    switch (mode) {
      case 'write': return 1;
      case 'append':
      case 'prepend': return 2;
      case 'inject': return frontmatter.before || frontmatter.after ? 3 : 2;
      case 'lineAt': return 3;
      default: return 1;
    }
  }

  /**
   * Get complexity level description
   * @param {number} complexity - Complexity score
   * @returns {string} Complexity level
   */
  _getComplexityLevel(complexity) {
    if (complexity <= 3) return 'low';
    if (complexity <= 7) return 'medium';
    if (complexity <= 12) return 'high';
    return 'very_high';
  }

  /**
   * Estimate processing time
   * @param {number} complexity - Complexity score
   * @returns {number} Estimated processing time in milliseconds
   */
  _estimateProcessingTime(complexity) {
    // Base time + complexity factor
    return 100 + (complexity * 50);
  }

  /**
   * Extract shell dependencies
   * @param {Array} commands - Shell commands
   * @returns {Array} Dependencies
   */
  _extractShellDependencies(commands) {
    const dependencies = [];
    
    for (const command of commands) {
      // Extract command name
      const cmdName = command.trim().split(' ')[0];
      dependencies.push({
        type: 'system_command',
        name: cmdName,
        required: true,
        command
      });
      
      // Extract file references (simplified)
      const fileRefs = command.match(/[a-zA-Z0-9._/-]+\.[a-zA-Z0-9]+/g) || [];
      for (const fileRef of fileRefs) {
        dependencies.push({
          type: 'file_reference',
          path: fileRef,
          required: false,
          command
        });
      }
    }
    
    return dependencies;
  }

  /**
   * Extract template dependencies
   * @param {string} content - Template content
   * @returns {Array} Dependencies
   */
  _extractTemplateDependencies(content) {
    const dependencies = [];
    
    // Extract include statements (simplified)
    const includes = content.match(/{%\s*include\s+["']([^"']+)["']/g) || [];
    for (const include of includes) {
      const match = include.match(/["']([^"']+)["']/);
      if (match) {
        dependencies.push({
          type: 'template_include',
          path: match[1],
          required: true
        });
      }
    }
    
    return dependencies;
  }

  /**
   * Analyze shell security
   * @param {Array} commands - Shell commands
   * @returns {Object} Security analysis
   */
  _analyzeShellSecurity(commands) {
    const issues = [];
    const warnings = [];
    let riskLevel = 'low';
    
    for (const command of commands) {
      const cmd = command.toLowerCase().trim();
      
      // High-risk commands
      if (cmd.includes('rm -rf') || cmd.includes('sudo') || cmd.includes('chmod 777')) {
        issues.push({
          type: 'dangerous_command',
          message: `Potentially dangerous command: ${command}`,
          severity: 'high',
          command
        });
        riskLevel = 'high';
      }
      
      // Medium-risk patterns
      if (cmd.includes('curl') || cmd.includes('wget') || cmd.includes('eval')) {
        warnings.push({
          type: 'risky_command',
          message: `Command may pose security risk: ${command}`,
          severity: 'medium',
          command
        });
        if (riskLevel !== 'high') riskLevel = 'medium';
      }
    }
    
    return { issues, warnings, riskLevel };
  }

  /**
   * Analyze permissions
   * @param {string|number} chmod - Permissions
   * @returns {Object} Permission analysis
   */
  _analyzePermissions(chmod) {
    const warnings = [];
    
    const mode = typeof chmod === 'string' ? parseInt(chmod, 8) : chmod;
    
    // Check for overly permissive permissions
    if ((mode & 0o007) > 0o005) {
      warnings.push({
        type: 'permissive_permissions',
        message: 'World-writable permissions detected',
        severity: 'medium'
      });
    }
    
    if ((mode & 0o070) > 0o050) {
      warnings.push({
        type: 'group_writable',
        message: 'Group-writable permissions detected',
        severity: 'low'
      });
    }
    
    return { warnings };
  }

  /**
   * Analyze path security
   * @param {string} path - File path
   * @returns {Object} Path analysis
   */
  _analyzePathSecurity(path) {
    const issues = [];
    
    // Check for path traversal
    if (path.includes('..')) {
      issues.push({
        type: 'path_traversal',
        message: 'Path contains parent directory references',
        severity: 'high'
      });
    }
    
    // Check for absolute paths outside safe areas
    if (path.startsWith('/') && !path.startsWith('/tmp') && !path.startsWith('/var/tmp')) {
      issues.push({
        type: 'unsafe_absolute_path',
        message: 'Absolute path outside safe areas',
        severity: 'medium'
      });
    }
    
    return { issues };
  }

  /**
   * Calculate security score
   * @param {Array} issues - Security issues
   * @param {Array} warnings - Security warnings
   * @returns {number} Security score (0-100, higher is better)
   */
  _calculateSecurityScore(issues, warnings) {
    let score = 100;
    
    // Deduct points for issues
    for (const issue of issues) {
      switch (issue.severity) {
        case 'high': score -= 30; break;
        case 'medium': score -= 15; break;
        case 'low': score -= 5; break;
      }
    }
    
    // Deduct points for warnings
    for (const warning of warnings) {
      switch (warning.severity) {
        case 'high': score -= 10; break;
        case 'medium': score -= 5; break;
        case 'low': score -= 2; break;
      }
    }
    
    return Math.max(0, score);
  }

  /**
   * Calculate template fingerprint
   * @param {Object} frontmatter - Frontmatter
   * @returns {string} Template fingerprint
   */
  _calculateTemplateFingerprint(frontmatter) {
    const content = JSON.stringify(frontmatter, Object.keys(frontmatter).sort());
    return this._simpleHash(content);
  }

  /**
   * Calculate context fingerprint
   * @param {Object} context - Context
   * @returns {string} Context fingerprint
   */
  _calculateContextFingerprint(context) {
    if (!context) return 'no-context';
    const content = JSON.stringify(context, Object.keys(context).sort());
    return this._simpleHash(content);
  }

  /**
   * Get line number for content position
   * @param {string} content - Full content
   * @param {number} index - Character index
   * @returns {number} Line number
   */
  _getLineNumber(content, index) {
    return content.slice(0, index).split('\n').length;
  }

  /**
   * Get column number for content position
   * @param {string} content - Full content
   * @param {number} index - Character index
   * @returns {number} Column number
   */
  _getColumnNumber(content, index) {
    const lineStart = content.lastIndexOf('\n', index - 1) + 1;
    return index - lineStart + 1;
  }

  /**
   * Get context around position
   * @param {string} content - Full content
   * @param {number} index - Character index
   * @param {number} contextLength - Context length
   * @returns {string} Context string
   */
  _getContext(content, index, contextLength = 20) {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(content.length, index + contextLength);
    return content.slice(start, end);
  }

  /**
   * Get enabled features list
   * @returns {Array} Enabled features
   */
  _getEnabledFeatures() {
    const features = [];
    
    if (this.options.enableProvenance) features.push('provenance');
    if (this.options.enableDependencyAnalysis) features.push('dependency_analysis');
    if (this.options.enableVariableTracking) features.push('variable_tracking');
    if (this.options.enableComplexityAnalysis) features.push('complexity_analysis');
    if (this.options.enableSecurityAnalysis) features.push('security_analysis');
    
    return features;
  }

  /**
   * Generate extraction ID
   * @returns {string} Extraction ID
   */
  _generateExtractionId() {
    return `meta_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate cache key
   * @param {Object} frontmatter - Frontmatter
   * @param {Object} options - Options
   * @returns {string} Cache key
   */
  _generateCacheKey(frontmatter, options) {
    const keyData = {
      frontmatter: JSON.stringify(frontmatter),
      options: JSON.stringify(options || {}),
      features: this._getEnabledFeatures()
    };
    
    return this._simpleHash(JSON.stringify(keyData));
  }

  /**
   * Simple hash function
   * @param {string} str - String to hash
   * @returns {string} Hash value
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear extraction cache
   */
  clearCache() {
    this.extractionCache.clear();
    this.emit('cache:cleared');
  }

  /**
   * Get extractor statistics
   */
  getStatistics() {
    return {
      cacheSize: this.extractionCache.size,
      dependencyGraphSize: this.dependencyGraph.size,
      variableRegistrySize: this.variableRegistry.size,
      options: this.options
    };
  }
}

export default MetadataExtractor;