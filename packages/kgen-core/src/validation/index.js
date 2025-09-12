/**
 * KGEN Enhanced Validation Engine
 * Comprehensive SHACL validation, OWL-based validation, drift detection, and state consistency
 * Migrated from src/kgen/validation/ with enhanced capabilities for 100% drift detection
 */

import SHACLValidator from 'rdf-validate-shacl';
import { Parser, Store, DataFactory } from 'n3';
import consola from 'consola';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { SemanticValidator } from './semantic-validator.js';
// Note: Using placeholder for DriftDetectionEngine - would import from TypeScript file in real implementation
// import { DriftDetectionEngine } from './DriftDetectionEngine.ts';
class DriftDetectionEngine {
  constructor(config) { this.config = config; }
  async initialize() { return { success: true }; }
  async shutdown() { return { success: true }; }
}

// Export validation exit codes for CLI integration
export const ValidationExitCodes = {
  SUCCESS: 0,
  WARNINGS: 0,
  VIOLATIONS: 3,
  DRIFT_DETECTED: 3,
  ERRORS: 1
};

/**
 * Enhanced KGEN Validation Engine with comprehensive drift detection
 * Supports SHACL, OWL, custom N3.js rules, and 100% drift detection
 */
class KGenValidationEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      // Enhanced configuration with drift detection and CLI support
      exitCodes: {
        success: 0,
        warnings: 0,
        violations: 3,
        driftDetected: 3,
        errors: 1,
        ...config.exitCodes
      },
      driftDetection: {
        enabled: true,
        autoFix: false,
        tolerance: 0.95,
        backupOriginal: true,
        failMode: 'fail', // 'fail', 'warn', 'fix'
        detectUnauthorized: true,
        stateConsistency: true,
        ...config.driftDetection
      },
      validation: {
        strictMode: false,
        enableOWL: true,
        enableSHACL: true,
        enableCustomRules: true,
        enableN3Rules: true,
        parallelValidation: true,
        maxConcurrency: 4,
        ...config.validation
      },
      reporting: {
        format: 'json',
        outputPath: './validation-reports',
        includeStatistics: true,
        timestamped: true,
        humanReadable: true,
        ...config.reporting
      },
      ...config
    };
    
    this.status = 'uninitialized';
    this.validationId = null;
    this.activeValidations = new Map();
    
    // Enhanced validation statistics with drift detection metrics
    this.stats = {
      validationsPerformed: 0,
      validationsPassed: 0,
      validationsFailed: 0,
      averageValidationTime: 0,
      totalValidationTime: 0,
      customRulesExecuted: 0,
      driftDetections: 0,
      driftFixed: 0,
      unauthorizedModifications: 0,
      stateConsistencyChecks: 0,
      shaclValidations: 0,
      owlValidations: 0,
      n3RuleExecutions: 0
    };
    
    // Enhanced cached validators and rules
    this.cachedValidators = new Map();
    this.customRules = new Map();
    this.n3Rules = new Map();
    this.owlRules = new Map();
    
    // Drift detection baseline storage
    this.driftBaseline = new Map();
    this.baselineFile = path.join(this.config.reporting.outputPath, '.drift-baseline.json');
    
    // Sub-engines for comprehensive validation
    this.semanticValidator = new SemanticValidator(this.config.validation);
    this.driftEngine = new DriftDetectionEngine({
      ...this.config.driftDetection,
      lockFile: path.join(this.config.reporting.outputPath, 'kgen.lock.json'),
      validateSHACL: this.config.validation.enableSHACL,
      validateSemantic: this.config.validation.enableCustomRules,
      attestationValidation: true
    });
    
    // Configuration
    this.allowWarnings = config.shacl?.allowWarnings || false;
    this.validateShapes = config.shacl?.validateShapes !== false;
    this.maxGraphSize = config.maxGraphSize || 1000000; // 1M nodes
  }

  /**
   * Initialize enhanced validation engine with all sub-components
   */
  async initialize() {
    try {
      this.status = 'initializing';
      this.validationId = crypto.randomUUID();
      
      // Ensure reporting directory exists
      await fs.ensureDir(this.config.reporting.outputPath);
      
      // Initialize drift detection engine
      await this.driftEngine.initialize();
      
      // Load custom validation rules if enabled
      if (this.config.validation.enableCustomRules) {
        await this.loadCustomRules();
      }
      
      // Load N3.js rules if enabled
      if (this.config.validation.enableN3Rules) {
        await this.loadN3Rules();
      }
      
      // Load OWL rules if enabled
      if (this.config.validation.enableOWL) {
        await this.loadOWLRules();
      }
      
      // Setup default validation rules
      this.setupDefaultRules();
      
      // Load drift baseline if it exists
      await this.loadDriftBaseline();
      
      this.status = 'ready';
      consola.success('✅ KGEN Enhanced Validation Engine initialized');
      
      this.emit('initialized');
      
      return {
        success: true,
        validationId: this.validationId,
        status: this.status,
        capabilities: {
          shacl: this.config.validation.enableSHACL,
          owl: this.config.validation.enableOWL,
          customRules: this.config.validation.enableCustomRules,
          n3Rules: this.config.validation.enableN3Rules,
          driftDetection: this.config.driftDetection.enabled,
          autoFix: this.config.driftDetection.autoFix
        }
      };
    } catch (error) {
      this.status = 'error';
      consola.error('❌ KGEN Validation Engine initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load N3.js-based custom rules for semantic validation
   */
  async loadN3Rules() {
    try {
      const rulesPath = this.config.validation.n3RulesPath || './validation-rules/n3';
      if (!await fs.pathExists(rulesPath)) {
        consola.info('📋 N3.js rules path not found, using built-in rules only');
        return;
      }
      
      const rulesFiles = await fs.readdir(rulesPath);
      const n3Files = rulesFiles.filter(file => file.endsWith('.n3') || file.endsWith('.ttl'));
      
      for (const file of n3Files) {
        const fullPath = path.join(rulesPath, file);
        const ruleContent = await fs.readFile(fullPath, 'utf8');
        
        this.n3Rules.set(path.basename(file, path.extname(file)), {
          path: fullPath,
          content: ruleContent,
          loadedAt: new Date().toISOString(),
          type: 'n3-rule'
        });
        
        consola.success(`✅ Loaded N3.js rule: ${file}`);
      }
      
      consola.success(`✅ Loaded ${this.n3Rules.size} N3.js validation rules`);
    } catch (error) {
      consola.error('❌ Failed to load N3.js rules:', error.message);
      throw new Error(`N3.js rules loading failed: ${error.message}`);
    }
  }

  /**
   * Load OWL-based validation rules for ontology consistency
   */
  async loadOWLRules() {
    try {
      // Load built-in OWL validation rules
      this.owlRules.set('owl-consistency', {
        name: 'OWL Consistency Validation',
        description: 'Validates OWL ontology consistency and constraints',
        execute: this.validateOWLConsistency.bind(this),
        severity: 'CRITICAL',
        category: 'owl-validation'
      });
      
      this.owlRules.set('owl-completeness', {
        name: 'OWL Completeness Check',
        description: 'Ensures OWL ontology completeness and proper structure',
        execute: this.validateOWLCompleteness.bind(this),
        severity: 'HIGH',
        category: 'owl-validation'
      });
      
      this.owlRules.set('owl-cardinality', {
        name: 'OWL Cardinality Constraints',
        description: 'Validates OWL cardinality constraints and restrictions',
        execute: this.validateOWLCardinality.bind(this),
        severity: 'HIGH',
        category: 'owl-validation'
      });
      
      consola.success(`✅ Loaded ${this.owlRules.size} OWL validation rules`);
    } catch (error) {
      consola.error('❌ Failed to load OWL rules:', error.message);
      throw new Error(`OWL rules loading failed: ${error.message}`);
    }
  }

  /**
   * Load custom validation rules with comprehensive error handling
   */
  async loadCustomRules() {
    try {
      const rulesPath = this.config.validation.customRulesPath || './validation-rules/custom';
      if (!await fs.pathExists(rulesPath)) {
        consola.info('📋 Custom rules path not found, using built-in rules only');
        return;
      }
      
      consola.info(`📋 Loading custom validation rules from ${rulesPath}`);
      
      // Validate rules path exists and is accessible
      if (!await fs.pathExists(rulesPath)) {
        throw new Error(`Custom rules path does not exist: ${rulesPath}`);
      }
      
      const rulesFiles = await fs.readdir(rulesPath);
      const jsFiles = rulesFiles.filter(file => file.endsWith('.js') || file.endsWith('.mjs'));
      
      for (const file of jsFiles) {
        try {
          const fullPath = path.join(rulesPath, file);
          const ruleModule = await import(fullPath);
          
          if (ruleModule.default && typeof ruleModule.default === 'object') {
            const rule = ruleModule.default;
            
            // Validate rule structure
            this.validateRuleStructure(rule);
            
            this.customRules.set(rule.id, {
              ...rule,
              source: file,
              loadedAt: new Date().toISOString()
            });
            
            consola.success(`✅ Loaded custom rule: ${rule.id} from ${file}`);
          }
        } catch (ruleError) {
          consola.warn(`⚠️ Failed to load rule from ${file}:`, ruleError.message);
        }
      }
      
      // Load built-in advanced rules
      this.customRules.set('datatype-consistency', {
        name: 'Datatype Consistency Check',
        description: 'Ensures consistent datatype usage across the graph',
        execute: this.checkDatatypeConsistency.bind(this),
        severity: 'MEDIUM',
        category: 'data-quality'
      });
      
      this.customRules.set('uri-format', {
        name: 'URI Format Validation',
        description: 'Validates URI format and accessibility with comprehensive checks',
        execute: this.checkURIFormat.bind(this),
        severity: 'HIGH',
        category: 'format'
      });
      
      this.customRules.set('ontology-completeness', {
        name: 'Ontology Completeness Check',
        description: 'Validates ontology structure and completeness',
        execute: this.checkOntologyCompleteness.bind(this),
        severity: 'HIGH',
        category: 'ontology'
      });
      
      this.customRules.set('semantic-consistency', {
        name: 'Semantic Consistency Check',
        description: 'Validates semantic relationships and constraints',
        execute: this.checkSemanticConsistency.bind(this),
        severity: 'CRITICAL',
        category: 'semantics'
      });
      
      consola.success(`✅ Loaded ${this.customRules.size} validation rules`);
      
    } catch (error) {
      consola.error('❌ Failed to load custom validation rules:', error);
      throw new Error(`Custom rules loading failed: ${error.message}`);
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
   * Add custom validation rule with comprehensive validation
   */
  addCustomRule(name, rule) {
    try {
      // Comprehensive rule validation
      this.validateRuleStructure({ id: name, ...rule });
      
      if (typeof rule.execute !== 'function') {
        throw new Error('Custom rule must have an execute function');
      }
      
      // Test rule execution with sample data
      const testGraph = new Store();
      testGraph.addQuad(
        DataFactory.namedNode('http://test.example/subject'),
        DataFactory.namedNode('http://test.example/predicate'),
        DataFactory.literal('test value')
      );
      
      // Validate rule can execute without errors
      const testResult = rule.execute(testGraph);
      if (testResult && typeof testResult.then === 'function') {
        // Async rule - validate structure but don't wait
        testResult.catch(error => {
          consola.warn(`⚠️ Custom rule ${name} failed test execution:`, error.message);
        });
      }
      
      const enrichedRule = {
        ...rule,
        id: name,
        addedAt: new Date().toISOString(),
        validated: true,
        category: rule.category || 'custom',
        severity: rule.severity || 'MEDIUM'
      };
      
      this.customRules.set(name, enrichedRule);
      this.emit('custom-rule-added', { name, rule: rule.name, category: enrichedRule.category });
      
      // Clear validation cache to force re-validation with new rule
      this.clearValidatorCache();
      
      consola.success(`✅ Added custom validation rule: ${name}`);
      
    } catch (error) {
      consola.error(`❌ Failed to add custom rule ${name}:`, error);
      throw new Error(`Custom rule addition failed: ${error.message}`);
    }
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
   * Advanced validation methods for comprehensive checking
   */
  
  async checkOntologyCompleteness(dataGraph) {
    const store = new Store(dataGraph);
    const violations = [];
    const warnings = [];
    
    // Check for essential ontology components
    const classCount = Array.from(store).filter(quad => 
      quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
      quad.object.value === 'http://www.w3.org/2002/07/owl#Class'
    ).length;
    
    const propertyCount = Array.from(store).filter(quad => 
      quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
      (quad.object.value === 'http://www.w3.org/2002/07/owl#ObjectProperty' ||
       quad.object.value === 'http://www.w3.org/2002/07/owl#DatatypeProperty')
    ).length;
    
    if (classCount === 0) {
      violations.push({
        type: 'no-classes',
        message: 'Ontology contains no OWL classes',
        severity: 'HIGH'
      });
    }
    
    if (propertyCount === 0) {
      warnings.push({
        type: 'no-properties',
        message: 'Ontology contains no OWL properties',
        severity: 'MEDIUM'
      });
    }
    
    // Check for ontology metadata
    const ontologyDeclarations = Array.from(store).filter(quad => 
      quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
      quad.object.value === 'http://www.w3.org/2002/07/owl#Ontology'
    );
    
    if (ontologyDeclarations.length === 0) {
      warnings.push({
        type: 'no-ontology-declaration',
        message: 'No owl:Ontology declaration found',
        severity: 'MEDIUM'
      });
    }
    
    return {
      passed: violations.length === 0,
      violations,
      warnings,
      metadata: { 
        classCount, 
        propertyCount,
        ontologyDeclarations: ontologyDeclarations.length
      }
    };
  }
  
  async checkSemanticConsistency(dataGraph) {
    const store = new Store(dataGraph);
    const violations = [];
    const warnings = [];
    
    // Check for circular class hierarchies
    const subClassOfTriples = Array.from(store).filter(quad => 
      quad.predicate.value === 'http://www.w3.org/2000/01/rdf-schema#subClassOf'
    );
    
    const classHierarchy = new Map();
    for (const triple of subClassOfTriples) {
      const subject = triple.subject.value;
      const object = triple.object.value;
      
      if (!classHierarchy.has(subject)) {
        classHierarchy.set(subject, new Set());
      }
      classHierarchy.get(subject).add(object);
    }
    
    // Detect cycles using DFS
    const visited = new Set();
    const recursionStack = new Set();
    
    const hasCycle = (node) => {
      visited.add(node);
      recursionStack.add(node);
      
      const neighbors = classHierarchy.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }
      
      recursionStack.delete(node);
      return false;
    };
    
    for (const [node] of classHierarchy) {
      if (!visited.has(node) && hasCycle(node)) {
        violations.push({
          type: 'circular-hierarchy',
          message: `Circular class hierarchy detected involving: ${node}`,
          class: node,
          severity: 'HIGH'
        });
      }
    }
    
    // Check for domain/range consistency
    const domainViolations = this.checkDomainRangeConsistency(store);
    violations.push(...domainViolations.violations);
    warnings.push(...domainViolations.warnings);
    
    return {
      passed: violations.length === 0,
      violations,
      warnings,
      metadata: { 
        classHierarchySize: classHierarchy.size,
        subClassRelations: subClassOfTriples.length
      }
    };
  }
  
  checkDomainRangeConsistency(store) {
    const violations = [];
    const warnings = [];
    
    // Get all domain and range declarations
    const domains = new Map();
    const ranges = new Map();
    
    for (const quad of store) {
      if (quad.predicate.value === 'http://www.w3.org/2000/01/rdf-schema#domain') {
        domains.set(quad.subject.value, quad.object.value);
      } else if (quad.predicate.value === 'http://www.w3.org/2000/01/rdf-schema#range') {
        ranges.set(quad.subject.value, quad.object.value);
      }
    }
    
    // Check property usage against declared domains and ranges
    for (const quad of store) {
      const propertyIRI = quad.predicate.value;
      
      // Skip RDF/RDFS/OWL built-in properties
      if (propertyIRI.startsWith('http://www.w3.org/1999/02/22-rdf-syntax-ns#') ||
          propertyIRI.startsWith('http://www.w3.org/2000/01/rdf-schema#') ||
          propertyIRI.startsWith('http://www.w3.org/2002/07/owl#')) {
        continue;
      }
      
      // Check domain consistency
      if (domains.has(propertyIRI)) {
        const expectedDomain = domains.get(propertyIRI);
        // In a full implementation, would check if subject is instance of domain class
        // This is a simplified check
        warnings.push({
          type: 'domain-check-needed',
          message: `Property ${propertyIRI} usage should be verified against domain ${expectedDomain}`,
          property: propertyIRI,
          subject: quad.subject.value,
          expectedDomain
        });
      }
      
      // Check range consistency for object properties
      if (ranges.has(propertyIRI) && quad.object.termType === 'NamedNode') {
        const expectedRange = ranges.get(propertyIRI);
        warnings.push({
          type: 'range-check-needed',
          message: `Property ${propertyIRI} object should be verified against range ${expectedRange}`,
          property: propertyIRI,
          object: quad.object.value,
          expectedRange
        });
      }
    }
    
    return { violations, warnings };
  }
  
  /**
   * Validate rule structure comprehensively
   */
  validateRuleStructure(rule) {
    if (!rule || typeof rule !== 'object') {
      throw new Error('Rule must be an object');
    }
    
    if (!rule.id || typeof rule.id !== 'string') {
      throw new Error('Rule must have a string id');
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(rule.id)) {
      throw new Error('Rule id must contain only alphanumeric characters, underscores, and hyphens');
    }
    
    if (!rule.name || typeof rule.name !== 'string') {
      throw new Error('Rule must have a string name');
    }
    
    if (!rule.description || typeof rule.description !== 'string') {
      throw new Error('Rule must have a string description');
    }
    
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!rule.severity || !validSeverities.includes(rule.severity)) {
      throw new Error(`Rule severity must be one of: ${validSeverities.join(', ')}`);
    }
    
    const validCategories = ['data-quality', 'format', 'ontology', 'semantics', 'security', 'performance', 'custom'];
    if (rule.category && !validCategories.includes(rule.category)) {
      throw new Error(`Rule category must be one of: ${validCategories.join(', ')}`);
    }
    
    if (rule.enabled !== undefined && typeof rule.enabled !== 'boolean') {
      throw new Error('Rule enabled flag must be a boolean');
    }
    
    if (rule.timeout && (typeof rule.timeout !== 'number' || rule.timeout <= 0)) {
      throw new Error('Rule timeout must be a positive number');
    }
    
    return true;
  }
  
  /**
   * Main entry point for comprehensive validation with drift detection
   * This is the primary method for KGEN validation tasks
   */
  async validateWithDriftDetection(options = {}) {
    const validationId = crypto.randomUUID();
    const startTime = Date.now();
    
    const results = {
      validationId,
      timestamp: new Date().toISOString(),
      exitCode: ValidationExitCodes.SUCCESS,
      success: false,
      summary: {
        totalViolations: 0,
        totalWarnings: 0,
        driftDetected: false,
        fixesApplied: 0
      },
      validation: null,
      drift: null,
      reportPath: null,
      validationTime: 0
    };
    
    this.activeValidations.set(validationId, results);
    
    try {
      // Step 1: Run SHACL validation if data and shapes provided
      if (options.dataGraph && options.shapesGraph) {
        consola.start('🔍 Running SHACL validation...');
        results.validation = await this.validateSHACL(
          options.dataGraph,
          options.shapesGraph,
          options.validationOptions || {}
        );
        
        results.summary.totalViolations += results.validation.totalViolations;
        this.stats.shaclValidations++;
      }
      
      // Step 2: Run drift detection if target file specified
      if (options.targetPath) {
        consola.start('🔄 Running drift detection...');
        results.drift = await this.detectDrift(
          options.targetPath,
          options.expectedData || options.dataGraph
        );
        
        results.summary.driftDetected = results.drift.driftDetected;
        if (results.summary.driftDetected && this.config.driftDetection.autoFix) {
          const fixResult = await this.applyDriftFixes(results.drift);
          results.summary.fixesApplied = fixResult.fixesApplied;
        }
      }
      
      // Step 3: Run custom validation rules
      if (this.config.validation.enableCustomRules && options.dataGraph) {
        consola.start('🧩 Running custom validation rules...');
        const customResult = await this.validateCustom(options.dataGraph);
        results.summary.totalViolations += customResult.totalViolations;
        results.summary.totalWarnings += customResult.totalWarnings;
      }
      
      // Step 4: Run OWL validation if enabled
      if (this.config.validation.enableOWL && options.dataGraph) {
        consola.start('🦉 Running OWL validation...');
        const owlResult = await this.validateOWLRules(options.dataGraph);
        results.summary.totalViolations += owlResult.totalViolations;
        results.summary.totalWarnings += owlResult.totalWarnings;
        this.stats.owlValidations++;
      }
      
      // Step 5: Calculate exit code and final status
      results.exitCode = this.calculateExitCode(results);
      results.success = results.exitCode === ValidationExitCodes.SUCCESS;
      results.validationTime = Date.now() - startTime;
      
      // Step 6: Generate comprehensive report
      if (this.config.reporting.format) {
        results.reportPath = await this.generateReport(results);
      }
      
      // Update statistics
      this.updateValidationStats(results.success, results.validationTime);
      
      this.emit('validation-complete', results);
      consola.success(`✅ Validation completed in ${results.validationTime}ms`);
      
    } catch (error) {
      results.validationTime = Date.now() - startTime;
      results.exitCode = ValidationExitCodes.ERRORS;
      results.error = error.message;
      
      this.updateValidationStats(false, results.validationTime);
      this.emit('validation-error', { validationId, error });
      
      consola.error(`❌ Validation failed: ${error.message}`);
      throw error;
    } finally {
      this.activeValidations.delete(validationId);
    }
    
    return results;
  }

  /**
   * Enhanced drift detection with 100% unauthorized modification detection
   */
  async detectDrift(targetPath, expectedData) {
    const startTime = Date.now();
    this.stats.driftDetections++;
    
    try {
      const fullPath = path.resolve(targetPath);
      const baselineKey = this.getBaselineKey(fullPath);
      
      // Load current file content
      let currentContent = '';
      let fileExists = false;
      
      if (await fs.pathExists(fullPath)) {
        currentContent = await fs.readFile(fullPath, 'utf8');
        fileExists = true;
      }
      
      // Determine expected content (from parameter or baseline)
      let expectedContent = expectedData;
      if (!expectedContent && this.driftBaseline.has(baselineKey)) {
        expectedContent = this.driftBaseline.get(baselineKey).content;
      }
      
      if (!expectedContent) {
        throw new Error(`No expected data or baseline found for ${targetPath}`);
      }
      
      // Calculate similarity score and detect differences
      const driftScore = this.calculateSimilarityScore(currentContent, expectedContent);
      const driftDetected = driftScore < this.config.driftDetection.tolerance;
      
      const differences = driftDetected ? 
        await this.analyzeDifferences(currentContent, expectedContent, fullPath) : [];
      
      // Check for unauthorized modifications using content hashing
      const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');
      const expectedHash = crypto.createHash('sha256').update(expectedContent).digest('hex');
      const unauthorizedModification = currentHash !== expectedHash && fileExists;
      
      if (unauthorizedModification) {
        this.stats.unauthorizedModifications++;
      }
      
      // State consistency check
      let stateConsistency = null;
      if (this.config.driftDetection.stateConsistency && fileExists) {
        stateConsistency = await this.checkStateConsistency(fullPath, currentContent);
        this.stats.stateConsistencyChecks++;
      }
      
      const result = {
        driftDetected,
        driftScore,
        differences,
        unauthorizedModification,
        stateConsistency,
        current: {
          content: currentContent,
          hash: currentHash,
          size: currentContent.length,
          exists: fileExists
        },
        expected: {
          content: expectedContent,
          hash: expectedHash,
          size: expectedContent.length
        },
        metadata: {
          targetPath: fullPath,
          detectionTime: Date.now() - startTime,
          tolerance: this.config.driftDetection.tolerance,
          detectionMode: this.config.driftDetection.failMode
        }
      };
      
      // Handle different failure modes
      await this.handleDriftDetectionMode(result);
      
      return result;
      
    } catch (error) {
      consola.error(`❌ Drift detection failed for ${targetPath}:`, error.message);
      throw new Error(`Drift detection failed: ${error.message}`);
    }
  }

  /**
   * Calculate exit code based on validation results
   */
  calculateExitCode(results) {
    if (results.error) {
      return this.config.exitCodes.errors;
    }
    
    if (results.summary.totalViolations > 0) {
      return this.config.exitCodes.violations;
    }
    
    if (results.summary.driftDetected) {
      return this.config.exitCodes.driftDetected;
    }
    
    if (results.summary.totalWarnings > 0) {
      return this.config.exitCodes.warnings;
    }
    
    return this.config.exitCodes.success;
  }

  /**
   * Comprehensive validation with detailed error reporting
   */
  async validateWithDetailedErrors(dataGraph, shapesGraph = null, options = {}) {
    const validationId = crypto.randomUUID();
    const startTime = Date.now();
    
    const result = {
      validationId,
      timestamp: new Date().toISOString(),
      success: false,
      summary: {
        totalViolations: 0,
        totalWarnings: 0,
        totalRulesExecuted: 0,
        validationTime: 0
      },
      details: {
        shacl: null,
        custom: null,
        errors: []
      },
      metadata: {
        engineStatus: this.status,
        configUsed: { ...this.config },
        cacheStats: {
          hits: this.metrics?.cacheHits || 0,
          misses: this.metrics?.cacheMisses || 0
        }
      }
    };
    
    try {
      // Run comprehensive validation
      const validationResults = await this.validate(dataGraph, shapesGraph, options);
      
      result.details.shacl = validationResults.shacl;
      result.details.custom = validationResults.custom;
      
      result.summary.totalViolations = validationResults.overall.totalViolations;
      result.summary.totalWarnings = validationResults.overall.totalWarnings;
      result.summary.validationTime = validationResults.overall.validationTime;
      result.summary.totalRulesExecuted = validationResults.custom?.rulesExecuted || 0;
      
      result.success = validationResults.overall.passed;
      
      // Generate recommendations based on violations
      result.recommendations = this.generateRecommendations(validationResults);
      
    } catch (error) {
      result.details.errors.push({
        type: 'validation-error',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      consola.error(`❌ Validation ${validationId} failed:`, error);
    } finally {
      result.summary.validationTime = Date.now() - startTime;
    }
    
    // Emit comprehensive validation event
    this.emit('detailed-validation', result);
    
    return result;
  }
  
  generateRecommendations(validationResults) {
    const recommendations = [];
    
    if (validationResults.shacl && !validationResults.shacl.conforms) {
      recommendations.push({
        type: 'shacl-violations',
        priority: 'HIGH',
        message: 'Fix SHACL constraint violations to ensure data conforms to defined shapes',
        actions: [
          'Review SHACL shapes and data structure',
          'Validate required properties are present',
          'Check datatype constraints',
          'Verify cardinality restrictions'
        ]
      });
    }
    
    if (validationResults.custom && !validationResults.custom.passed) {
      const criticalRules = validationResults.custom.results.filter(r => 
        !r.passed && r.violations?.some(v => v.severity === 'CRITICAL')
      );
      
      if (criticalRules.length > 0) {
        recommendations.push({
          type: 'critical-violations',
          priority: 'CRITICAL',
          message: 'Address critical validation violations immediately',
          actions: criticalRules.map(rule => `Fix violations in rule: ${rule.name}`)
        });
      }
    }
    
    // Performance recommendations
    if (validationResults.overall.validationTime > 10000) { // 10 seconds
      recommendations.push({
        type: 'performance',
        priority: 'MEDIUM',
        message: 'Validation performance is slow, consider optimization',
        actions: [
          'Enable validation caching',
          'Reduce graph size if possible',
          'Optimize custom validation rules',
          'Consider parallel validation'
        ]
      });
    }
    
    return recommendations;
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
    
    consola.info('🛑 KGEN Enhanced Validation Engine shutdown complete');
  }
}

// Import and integrate helper methods
import { DriftHelperMethods } from './drift-helpers.js';
import { OWLValidationMethods } from './owl-validators.js';
import { ReportGeneratorMethods } from './report-generator.js';

// Mix in all helper methods to the main validation engine
Object.assign(KGenValidationEngine.prototype, DriftHelperMethods);
Object.assign(KGenValidationEngine.prototype, OWLValidationMethods);
Object.assign(KGenValidationEngine.prototype, ReportGeneratorMethods);

// Export main engine and types  
export { KGenValidationEngine };
export default KGenValidationEngine;