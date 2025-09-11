/**
 * Validation Engine
 * Handles SHACL validation, custom rules, and data quality checks
 */

import SHACLValidator from 'rdf-validate-shacl';
import { Parser, Store, DataFactory } from 'n3';
import consola from 'consola';
import { EventEmitter } from 'events';
import crypto from 'crypto';

export class ValidationEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.status = 'uninitialized';
    
    // Validation statistics
    this.stats = {
      validationsPerformed: 0,
      validationsPassed: 0,
      validationsFailed: 0,
      averageValidationTime: 0,
      totalValidationTime: 0,
      customRulesExecuted: 0
    };
    
    // Cached validators and shapes
    this.cachedValidators = new Map();
    this.customRules = new Map();
    
    // Configuration
    this.allowWarnings = config.shacl?.allowWarnings || false;
    this.validateShapes = config.shacl?.validateShapes !== false;
    this.maxGraphSize = config.maxGraphSize || 1000000; // 1M nodes
  }

  /**
   * Initialize validation engine
   */
  async initialize() {
    try {
      this.status = 'initializing';
      
      // Load custom validation rules if enabled
      if (this.config.customRules?.enabled) {
        await this.loadCustomRules();
      }
      
      // Setup default validation rules
      this.setupDefaultRules();
      
      this.status = 'ready';
      consola.success('✅ Validation Engine initialized');
      
      this.emit('initialized');
    } catch (error) {
      this.status = 'error';
      consola.error('❌ Validation Engine initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load custom validation rules
   */
  async loadCustomRules() {
    try {
      const rulesPath = this.config.customRules.rulesPath;
      if (!rulesPath) return;
      
      // In a real implementation, you would load rules from files
      // This is a placeholder for the structure
      consola.info(`📋 Loading custom validation rules from ${rulesPath}`);
      
      // Example custom rule structure
      this.customRules.set('datatype-consistency', {
        name: 'Datatype Consistency Check',
        description: 'Ensures consistent datatype usage across the graph',
        execute: this.checkDatatypeConsistency.bind(this)
      });
      
      this.customRules.set('uri-format', {
        name: 'URI Format Validation',
        description: 'Validates URI format and accessibility',
        execute: this.checkURIFormat.bind(this)
      });
      
    } catch (error) {
      consola.warn('⚠️ Failed to load custom validation rules:', error);
    }
  }

  /**
   * Setup default validation rules
   */
  setupDefaultRules() {
    // Built-in validation rules
    this.customRules.set('graph-size', {
      name: 'Graph Size Check',
      description: 'Ensures graph doesn\'t exceed size limits',
      execute: this.checkGraphSize.bind(this)
    });
    
    this.customRules.set('blank-node-usage', {
      name: 'Blank Node Usage Check',
      description: 'Validates proper blank node usage',
      execute: this.checkBlankNodeUsage.bind(this)
    });
    
    this.customRules.set('namespace-consistency', {
      name: 'Namespace Consistency Check',
      description: 'Ensures consistent namespace usage',
      execute: this.checkNamespaceConsistency.bind(this)
    });
  }

  /**
   * Validate RDF data against SHACL shapes
   */
  async validateSHACL(dataGraph, shapesGraph, options = {}) {
    const startTime = Date.now();
    
    try {
      // Parse data and shapes if they're strings
      const parsedData = typeof dataGraph === 'string' 
        ? await this.parseRDF(dataGraph, options.dataFormat || 'turtle')
        : dataGraph;
        
      const parsedShapes = typeof shapesGraph === 'string'
        ? await this.parseRDF(shapesGraph, options.shapesFormat || 'turtle')
        : shapesGraph;
      
      // Create or get cached validator
      const shapesHash = this.hashGraph(parsedShapes);
      let validator = this.cachedValidators.get(shapesHash);
      
      if (!validator) {
        validator = new SHACLValidator(parsedShapes, {
          factory: DataFactory
        });
        this.cachedValidators.set(shapesHash, validator);
      }
      
      // Perform validation
      const report = validator.validate(parsedData);
      
      // Update statistics
      const validationTime = Date.now() - startTime;
      this.updateValidationStats(report.conforms, validationTime);
      
      // Process validation results
      const result = {
        conforms: report.conforms,
        results: report.results.map(violation => ({
          focusNode: violation.focusNode?.value,
          path: violation.path?.value,
          value: violation.value?.value,
          message: violation.message?.map(msg => msg.value) || [],
          severity: violation.severity?.value,
          sourceConstraintComponent: violation.sourceConstraintComponent?.value,
          sourceShape: violation.sourceShape?.value
        })),
        totalViolations: report.results.length,
        validationTime,
        shapesUsed: shapesHash
      };
      
      // Emit validation event
      this.emit('shacl-validation', {
        conforms: result.conforms,
        violations: result.totalViolations,
        time: validationTime
      });
      
      return result;
      
    } catch (error) {
      const validationTime = Date.now() - startTime;
      this.updateValidationStats(false, validationTime);
      
      this.emit('validation-error', { error, time: validationTime });
      throw new Error(`SHACL validation failed: ${error.message}`);
    }
  }

  /**
   * Validate using custom rules
   */
  async validateCustom(dataGraph, ruleNames = null, options = {}) {
    const startTime = Date.now();
    const results = [];
    
    try {
      // Parse data if it's a string
      const parsedData = typeof dataGraph === 'string' 
        ? await this.parseRDF(dataGraph, options.format || 'turtle')
        : dataGraph;
      
      // Determine which rules to execute
      const rulesToExecute = ruleNames 
        ? ruleNames.filter(name => this.customRules.has(name))
        : Array.from(this.customRules.keys());
      
      // Execute each rule
      for (const ruleName of rulesToExecute) {
        const rule = this.customRules.get(ruleName);
        if (!rule) continue;
        
        try {
          const ruleStartTime = Date.now();
          const ruleResult = await rule.execute(parsedData, options);
          const ruleTime = Date.now() - ruleStartTime;
          
          results.push({
            rule: ruleName,
            name: rule.name,
            description: rule.description,
            passed: ruleResult.passed,
            violations: ruleResult.violations || [],
            warnings: ruleResult.warnings || [],
            executionTime: ruleTime,
            metadata: ruleResult.metadata || {}
          });
          
          this.stats.customRulesExecuted++;
          
        } catch (ruleError) {
          results.push({
            rule: ruleName,
            name: rule.name,
            error: ruleError.message,
            passed: false,
            executionTime: 0
          });
        }
      }
      
      // Calculate overall result
      const overallPassed = results.every(result => result.passed && !result.error);
      const totalViolations = results.reduce((sum, result) => sum + (result.violations?.length || 0), 0);
      const totalWarnings = results.reduce((sum, result) => sum + (result.warnings?.length || 0), 0);
      
      const validationTime = Date.now() - startTime;
      this.updateValidationStats(overallPassed, validationTime);
      
      const finalResult = {
        passed: overallPassed,
        totalViolations,
        totalWarnings,
        rulesExecuted: results.length,
        validationTime,
        results
      };
      
      this.emit('custom-validation', finalResult);
      
      return finalResult;
      
    } catch (error) {
      const validationTime = Date.now() - startTime;
      this.updateValidationStats(false, validationTime);
      
      throw new Error(`Custom validation failed: ${error.message}`);
    }
  }

  /**
   * Comprehensive validation (SHACL + Custom)
   */
  async validate(dataGraph, shapesGraph = null, options = {}) {
    const results = {
      shacl: null,
      custom: null,
      overall: {
        passed: false,
        totalViolations: 0,
        totalWarnings: 0,
        validationTime: 0
      }
    };
    
    const startTime = Date.now();
    
    try {
      // Run SHACL validation if shapes provided
      if (shapesGraph) {
        results.shacl = await this.validateSHACL(dataGraph, shapesGraph, options);
      }
      
      // Run custom validation
      if (options.customRules !== false) {
        results.custom = await this.validateCustom(dataGraph, options.customRules, options);
      }
      
      // Calculate overall results
      const shaclPassed = !results.shacl || results.shacl.conforms;
      const customPassed = !results.custom || results.custom.passed;
      
      results.overall = {
        passed: shaclPassed && customPassed,
        totalViolations: (results.shacl?.totalViolations || 0) + (results.custom?.totalViolations || 0),
        totalWarnings: (results.custom?.totalWarnings || 0),
        validationTime: Date.now() - startTime
      };
      
      return results;
      
    } catch (error) {
      results.overall.validationTime = Date.now() - startTime;
      results.error = error.message;
      throw error;
    }
  }

  /**
   * Custom rule implementations
   */
  
  async checkGraphSize(dataGraph) {
    const store = new Store(dataGraph);
    const size = store.size;
    
    const violations = [];
    if (size > this.maxGraphSize) {
      violations.push({
        type: 'graph-too-large',
        message: `Graph contains ${size} triples, exceeding limit of ${this.maxGraphSize}`,
        severity: 'violation'
      });
    }
    
    return {
      passed: violations.length === 0,
      violations,
      metadata: { graphSize: size, maxSize: this.maxGraphSize }
    };
  }

  async checkDatatypeConsistency(dataGraph) {
    const store = new Store(dataGraph);
    const violations = [];
    const warnings = [];
    
    // Track datatype usage for each predicate
    const predicateDatatypes = new Map();
    
    for (const quad of store) {
      if (quad.object.termType === 'Literal' && quad.object.datatype) {
        const predicateIRI = quad.predicate.value;
        
        if (!predicateDatatypes.has(predicateIRI)) {
          predicateDatatypes.set(predicateIRI, new Set());
        }
        
        predicateDatatypes.get(predicateIRI).add(quad.object.datatype.value);
      }
    }
    
    // Check for inconsistent datatype usage
    for (const [predicate, datatypes] of predicateDatatypes) {
      if (datatypes.size > 1) {
        warnings.push({
          type: 'inconsistent-datatype',
          message: `Predicate ${predicate} uses multiple datatypes: ${Array.from(datatypes).join(', ')}`,
          predicate,
          datatypes: Array.from(datatypes)
        });
      }
    }
    
    return {
      passed: violations.length === 0,
      violations,
      warnings,
      metadata: { predicatesChecked: predicateDatatypes.size }
    };
  }

  async checkURIFormat(dataGraph) {
    const store = new Store(dataGraph);
    const violations = [];
    const warnings = [];
    
    const urlPattern = /^https?:\/\/.+/;
    
    for (const quad of store) {
      // Check subject URIs
      if (quad.subject.termType === 'NamedNode') {
        if (!urlPattern.test(quad.subject.value)) {
          warnings.push({
            type: 'non-http-uri',
            message: `Subject URI does not use HTTP/HTTPS scheme: ${quad.subject.value}`,
            uri: quad.subject.value
          });
        }
      }
      
      // Check predicate URIs
      if (quad.predicate.termType === 'NamedNode') {
        if (!urlPattern.test(quad.predicate.value)) {
          warnings.push({
            type: 'non-http-uri',
            message: `Predicate URI does not use HTTP/HTTPS scheme: ${quad.predicate.value}`,
            uri: quad.predicate.value
          });
        }
      }
      
      // Check object URIs
      if (quad.object.termType === 'NamedNode') {
        if (!urlPattern.test(quad.object.value)) {
          warnings.push({
            type: 'non-http-uri',
            message: `Object URI does not use HTTP/HTTPS scheme: ${quad.object.value}`,
            uri: quad.object.value
          });
        }
      }
    }
    
    return {
      passed: violations.length === 0,
      violations,
      warnings,
      metadata: { triplesChecked: store.size }
    };
  }

  async checkBlankNodeUsage(dataGraph) {
    const store = new Store(dataGraph);
    const violations = [];
    const warnings = [];
    
    const blankNodes = new Set();
    const blankNodeConnections = new Map();
    
    // Collect blank node usage
    for (const quad of store) {
      if (quad.subject.termType === 'BlankNode') {
        blankNodes.add(quad.subject.value);
        if (!blankNodeConnections.has(quad.subject.value)) {
          blankNodeConnections.set(quad.subject.value, { asSubject: 0, asObject: 0 });
        }
        blankNodeConnections.get(quad.subject.value).asSubject++;
      }
      
      if (quad.object.termType === 'BlankNode') {
        blankNodes.add(quad.object.value);
        if (!blankNodeConnections.has(quad.object.value)) {
          blankNodeConnections.set(quad.object.value, { asSubject: 0, asObject: 0 });
        }
        blankNodeConnections.get(quad.object.value).asObject++;
      }
    }
    
    // Check for isolated blank nodes
    for (const [blankNodeId, connections] of blankNodeConnections) {
      if (connections.asSubject === 0 && connections.asObject === 1) {
        warnings.push({
          type: 'isolated-blank-node',
          message: `Blank node ${blankNodeId} appears to be isolated (only used as object once)`,
          blankNode: blankNodeId
        });
      }
    }
    
    return {
      passed: violations.length === 0,
      violations,
      warnings,
      metadata: { 
        blankNodesFound: blankNodes.size,
        blankNodeConnections: Object.fromEntries(blankNodeConnections)
      }
    };
  }

  async checkNamespaceConsistency(dataGraph) {
    const store = new Store(dataGraph);
    const violations = [];
    const warnings = [];
    
    const namespaces = new Map();
    
    // Extract namespaces from URIs
    for (const quad of store) {
      [quad.subject, quad.predicate, quad.object].forEach(term => {
        if (term.termType === 'NamedNode') {
          const uri = term.value;
          const lastSlash = uri.lastIndexOf('/');
          const lastHash = uri.lastIndexOf('#');
          const separator = Math.max(lastSlash, lastHash);
          
          if (separator > 0) {
            const namespace = uri.substring(0, separator + 1);
            if (!namespaces.has(namespace)) {
              namespaces.set(namespace, new Set());
            }
            namespaces.get(namespace).add(uri.substring(separator + 1));
          }
        }
      });
    }
    
    // Check for potential namespace issues
    for (const [namespace, terms] of namespaces) {
      if (terms.size === 1) {
        warnings.push({
          type: 'single-term-namespace',
          message: `Namespace ${namespace} contains only one term: ${Array.from(terms)[0]}`,
          namespace,
          terms: Array.from(terms)
        });
      }
    }
    
    return {
      passed: violations.length === 0,
      violations,
      warnings,
      metadata: { 
        namespacesFound: namespaces.size,
        namespaces: Object.fromEntries(
          Array.from(namespaces.entries()).map(([ns, terms]) => [ns, Array.from(terms)])
        )
      }
    };
  }

  /**
   * Utility methods
   */
  
  async parseRDF(data, format = 'turtle') {
    return new Promise((resolve, reject) => {
      const parser = new Parser({ format });
      const store = new Store();
      
      parser.parse(data, (error, quad, prefixes) => {
        if (error) {
          reject(error);
        } else if (quad) {
          store.addQuad(quad);
        } else {
          resolve(store);
        }
      });
    });
  }

  hashGraph(graph) {
    // Create a deterministic hash of the graph
    const quads = Array.from(graph).map(quad => 
      `${quad.subject.value} ${quad.predicate.value} ${quad.object.value} ${quad.graph.value}`
    ).sort().join('\n');
    
    return crypto.createHash('sha256').update(quads).digest('hex');
  }

  updateValidationStats(passed, validationTime) {
    this.stats.validationsPerformed++;
    this.stats.totalValidationTime += validationTime;
    this.stats.averageValidationTime = this.stats.totalValidationTime / this.stats.validationsPerformed;
    
    if (passed) {
      this.stats.validationsPassed++;
    } else {
      this.stats.validationsFailed++;
    }
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.validationsPerformed > 0 
        ? (this.stats.validationsPassed / this.stats.validationsPerformed) * 100 
        : 0,
      cachedValidators: this.cachedValidators.size,
      customRules: this.customRules.size
    };
  }

  /**
   * Add custom validation rule
   */
  addCustomRule(name, rule) {
    if (typeof rule.execute !== 'function') {
      throw new Error('Custom rule must have an execute function');
    }
    
    this.customRules.set(name, rule);
    this.emit('custom-rule-added', { name, rule: rule.name });
  }

  /**
   * Remove custom validation rule
   */
  removeCustomRule(name) {
    const removed = this.customRules.delete(name);
    if (removed) {
      this.emit('custom-rule-removed', { name });
    }
    return removed;
  }

  /**
   * Clear validator cache
   */
  clearValidatorCache() {
    const cacheSize = this.cachedValidators.size;
    this.cachedValidators.clear();
    this.emit('validator-cache-cleared', { size: cacheSize });
    return cacheSize;
  }

  /**
   * Health check
   */
  async healthCheck() {
    return {
      status: this.status,
      stats: this.getStats(),
      config: {
        allowWarnings: this.allowWarnings,
        validateShapes: this.validateShapes,
        maxGraphSize: this.maxGraphSize,
        customRulesEnabled: this.config.customRules?.enabled
      }
    };
  }

  /**
   * Shutdown validation engine
   */
  async shutdown() {
    this.status = 'shutting-down';
    
    // Clear caches
    this.cachedValidators.clear();
    this.customRules.clear();
    
    this.removeAllListeners();
    this.status = 'shutdown';
    
    consola.info('🛑 Validation Engine shutdown complete');
  }
}