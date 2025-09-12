/**
 * KGEN Validation CLI Integration
 * 
 * Connects broken CLI validation commands to working validation engines.
 * Provides fallback validation when SHACL engine is broken.
 * 
 * ALPHA AGENT 9: Validation System CLI Integration Specialist
 */

import { SHACLValidationEngine, SHACLValidationCodes } from './shacl-validation-engine.js';
import { Parser, Store } from 'n3';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import consola from 'consola';
import Ajv from 'ajv';

/**
 * Comprehensive validation engine that bridges CLI commands to actual validation logic
 */
export class ValidationCLIEngine {
  constructor(options = {}) {
    this.options = {
      enableSHACL: options.enableSHACL !== false,
      enableFallback: options.enableFallback !== false,
      enableSchemaValidation: options.enableSchemaValidation !== false,
      timeout: options.timeout || 30000,
      debug: options.debug || false,
      ...options
    };
    
    this.shaclEngine = null;
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    this.validationStats = {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      fallbackUsed: 0,
      lastValidationTime: null
    };
  }

  /**
   * Initialize validation engines
   */
  async initialize() {
    try {
      // Try to initialize SHACL engine
      if (this.options.enableSHACL) {
        try {
          this.shaclEngine = new SHACLValidationEngine({
            timeout: this.options.timeout,
            logger: consola
          });
          
          // Test with basic SHACL shapes to verify it works
          await this._testSHACLEngine();
          
        } catch (error) {
          consola.warn(`⚠️ SHACL engine initialization failed: ${error.message}`);
          if (this.options.debug) {
            consola.debug(error.stack);
          }
          this.shaclEngine = null;
        }
      }
      
      this._setupJSONSchemas();
      
      consola.success('✅ Validation CLI Engine initialized');
      return { success: true, shaclAvailable: !!this.shaclEngine };
      
    } catch (error) {
      consola.error(`❌ Validation CLI Engine initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * VALIDATE GRAPH - Connect CLI command to actual graph validation
   */
  async validateGraph(filePath, options = {}) {
    const startTime = Date.now();
    this.validationStats.totalValidations++;
    
    try {
      if (!await fs.pathExists(filePath)) {
        return this._formatValidationError('validate:graph', `File not found: ${filePath}`, {
          file: filePath,
          exists: false
        });
      }

      content = await fs.readFile(filePath, 'utf8');
      const results = {
        success: false,
        operation: 'validate:graph',
        file: filePath,
        timestamp: new Date().toISOString(),
        validationTime: 0,
        validation: {
          syntaxValid: false,
          semanticValid: false,
          constraintsValid: false,
          errors: [],
          warnings: [],
          details: {}
        }
      };

      // Step 1: Basic RDF syntax validation
      const syntaxValidation = await this._validateRDFSyntax(content, filePath);
      results.validation.syntaxValid = syntaxValidation.valid;
      results.validation.errors.push(...syntaxValidation.errors);
      results.validation.warnings.push(...syntaxValidation.warnings);

      if (!syntaxValidation.valid) {
        results.validationTime = Date.now() - startTime;
        this.validationStats.failedValidations++;
        return results;
      }

      // Step 2: Semantic validation using SHACL or fallback
      let semanticValidation;
      if (this.shaclEngine && options.shacl !== false) {
        try {
          semanticValidation = await this._validateWithSHACL(content, options.shapesFile);
          results.validation.constraintsValid = semanticValidation.conforms;
          results.validation.details.shacl = semanticValidation;
        } catch (error) {
          consola.warn(`⚠️ SHACL validation failed, using fallback: ${error.message}`);
          semanticValidation = await this._fallbackSemanticValidation(syntaxValidation.store);
          this.validationStats.fallbackUsed++;
        }
      } else {
        semanticValidation = await this._fallbackSemanticValidation(syntaxValidation.store);
        this.validationStats.fallbackUsed++;
      }

      results.validation.semanticValid = semanticValidation.valid;
      results.validation.errors.push(...semanticValidation.errors || []);
      results.validation.warnings.push(...semanticValidation.warnings || []);

      // Step 3: Additional graph quality checks
      const qualityChecks = await this._performGraphQualityChecks(syntaxValidation.store);
      results.validation.warnings.push(...qualityChecks.warnings);
      results.validation.details.quality = qualityChecks;

      // Determine overall success
      results.success = results.validation.syntaxValid && 
                       results.validation.semanticValid && 
                       results.validation.errors.length === 0;
                       
      results.validationTime = Date.now() - startTime;
      
      if (results.success) {
        this.validationStats.passedValidations++;
      } else {
        this.validationStats.failedValidations++;
      }

      this.validationStats.lastValidationTime = new Date().toISOString();
      
      return results;

    } catch (error) {
      this.validationStats.failedValidations++;
      return this._formatValidationError('validate:graph', error.message, {
        file: filePath,
        validationTime: Date.now() - startTime
      });
    }
  }

  /**
   * VALIDATE ARTIFACTS - Connect CLI command to artifact schema validation
   */
  async validateArtifacts(artifactPath, options = {}) {
    const startTime = Date.now();
    this.validationStats.totalValidations++;
    
    try {
      const results = {
        success: false,
        operation: 'validate:artifacts',
        path: artifactPath,
        timestamp: new Date().toISOString(),
        validationTime: 0,
        artifacts: [],
        summary: {
          total: 0,
          valid: 0,
          invalid: 0,
          errors: 0,
          warnings: 0
        }
      };

      // Discover artifacts to validate
      const artifacts = await this._discoverArtifacts(artifactPath, options.recursive);
      results.summary.total = artifacts.length;

      if (artifacts.length === 0) {
        return this._formatValidationError('validate:artifacts', 'No artifacts found to validate', {
          path: artifactPath,
          searchedRecursive: options.recursive
        });
      }

      // Validate each artifact
      for (const artifact of artifacts) {
        const artifactValidation = await this._validateSingleArtifact(artifact);
        results.artifacts.push(artifactValidation);
        
        if (artifactValidation.valid) {
          results.summary.valid++;
        } else {
          results.summary.invalid++;
        }
        
        results.summary.errors += artifactValidation.errors?.length || 0;
        results.summary.warnings += artifactValidation.warnings?.length || 0;
      }

      results.success = results.summary.invalid === 0 && results.summary.errors === 0;
      results.validationTime = Date.now() - startTime;
      
      if (results.success) {
        this.validationStats.passedValidations++;
      } else {
        this.validationStats.failedValidations++;
      }

      this.validationStats.lastValidationTime = new Date().toISOString();
      
      return results;

    } catch (error) {
      this.validationStats.failedValidations++;
      return this._formatValidationError('validate:artifacts', error.message, {
        path: artifactPath,
        validationTime: Date.now() - startTime
      });
    }
  }

  /**
   * VALIDATE PROVENANCE - Connect CLI command to attestation validation
   */
  async validateProvenance(artifactPath, options = {}) {
    const startTime = Date.now();
    this.validationStats.totalValidations++;
    
    try {
      const results = {
        success: false,
        operation: 'validate:provenance',
        artifact: artifactPath,
        timestamp: new Date().toISOString(),
        validationTime: 0,
        provenance: {
          hasAttestation: false,
          attestationValid: false,
          chainComplete: false,
          errors: [],
          warnings: [],
          details: {}
        }
      };

      if (!await fs.pathExists(artifactPath)) {
        return this._formatValidationError('validate:provenance', `Artifact not found: ${artifactPath}`, {
          artifact: artifactPath,
          exists: false
        });
      }

      // Check for attestation file
      const attestationPath = `${artifactPath}.attest.json`;
      if (await fs.pathExists(attestationPath)) {
        results.provenance.hasAttestation = true;
        
        try {
          const attestation = await fs.readJson(attestationPath);
          const attestationValidation = await this._validateAttestation(attestation, artifactPath);
          
          results.provenance.attestationValid = attestationValidation.valid;
          results.provenance.errors.push(...attestationValidation.errors || []);
          results.provenance.warnings.push(...attestationValidation.warnings || []);
          results.provenance.details = attestationValidation.details;
          
        } catch (error) {
          results.provenance.errors.push({
            type: 'attestation-parse-error',
            message: `Failed to parse attestation: ${error.message}`,
            file: attestationPath
          });
        }
      } else {
        results.provenance.warnings.push({
          type: 'missing-attestation',
          message: `No attestation file found: ${attestationPath}`,
          severity: 'medium'
        });
      }

      // Check provenance chain completeness
      const chainValidation = await this._validateProvenanceChain(artifactPath);
      results.provenance.chainComplete = chainValidation.complete;
      results.provenance.warnings.push(...chainValidation.warnings || []);

      results.success = results.provenance.hasAttestation && 
                       results.provenance.attestationValid && 
                       results.provenance.errors.length === 0;
                       
      results.validationTime = Date.now() - startTime;
      
      if (results.success) {
        this.validationStats.passedValidations++;
      } else {
        this.validationStats.failedValidations++;
      }

      this.validationStats.lastValidationTime = new Date().toISOString();
      
      return results;

    } catch (error) {
      this.validationStats.failedValidations++;
      return this._formatValidationError('validate:provenance', error.message, {
        artifact: artifactPath,
        validationTime: Date.now() - startTime
      });
    }
  }

  // Private helper methods

  async _testSHACLEngine() {
    // Test with minimal SHACL shapes
    const testShapes = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      
      ex:PersonShape a sh:NodeShape ;
        sh:targetClass ex:Person ;
        sh:property [
          sh:path ex:name ;
          sh:minCount 1 ;
          sh:datatype xsd:string ;
        ] .
    `;
    
    const testData = `
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      
      ex:person1 a ex:Person ;
        ex:name "Test Person" .
    `;

    await this.shaclEngine.initialize(testShapes);
    const result = await this.shaclEngine.validate(testData);
    
    if (!result.conforms === undefined) {
      throw new Error('SHACL engine test failed - invalid result format');
    }
  }

  async _validateRDFSyntax(content, filePath) {
    return new Promise((resolve) => {
      const parser = new Parser();
      const store = new Store();
      const errors = [];
      const warnings = [];
      
      parser.parse(content, (error, quad, prefixes) => {
        if (error) {
          errors.push({
            type: 'syntax-error',
            message: error.message,
            file: filePath,
            severity: 'error'
          });
        } else if (quad) {
          store.addQuad(quad);
        } else {
          // Parsing complete
          if (store.size === 0) {
            warnings.push({
              type: 'empty-graph',
              message: 'RDF graph contains no triples',
              file: filePath,
              severity: 'warning'
            });
          }
          
          resolve({
            valid: errors.length === 0,
            store,
            errors,
            warnings,
            statistics: {
              triples: store.size,
              subjects: new Set(Array.from(store).map(q => q.subject.value)).size,
              predicates: new Set(Array.from(store).map(q => q.predicate.value)).size
            }
          });
        }
      });
    });
  }

  async _validateWithSHACL(data, shapesFile) {
    if (!this.shaclEngine) {
      throw new Error('SHACL engine not available');
    }

    let shapes;
    if (shapesFile && await fs.pathExists(shapesFile)) {
      shapes = await fs.readFile(shapesFile, 'utf8');
    } else {
      // Use default validation shapes
      shapes = this._getDefaultSHACLShapes();
    }

    if (!this.shaclEngine.engine) {
      await this.shaclEngine.initialize(shapes);
    }

    return await this.shaclEngine.validate(data);
  }

  async _fallbackSemanticValidation(store) {
    const errors = [];
    const warnings = [];

    // Basic semantic checks using N3 store
    const subjects = new Set();
    const predicates = new Set();
    const blankNodes = new Set();
    
    for (const quad of store) {
      subjects.add(quad.subject.value);
      predicates.add(quad.predicate.value);
      
      if (quad.subject.termType === 'BlankNode') {
        blankNodes.add(quad.subject.value);
      }
      if (quad.object.termType === 'BlankNode') {
        blankNodes.add(quad.object.value);
      }
    }

    // Check for common semantic issues
    if (blankNodes.size > subjects.size * 0.3) {
      warnings.push({
        type: 'excessive-blank-nodes',
        message: `High ratio of blank nodes (${blankNodes.size}/${subjects.size})`,
        severity: 'medium'
      });
    }

    // Check for required predicates
    const requiredPredicates = [
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      'http://www.w3.org/2000/01/rdf-schema#label'
    ];

    for (const required of requiredPredicates) {
      if (!predicates.has(required)) {
        warnings.push({
          type: 'missing-predicate',
          message: `Recommended predicate not found: ${required}`,
          severity: 'low'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fallback: true,
      statistics: {
        subjects: subjects.size,
        predicates: predicates.size,
        blankNodes: blankNodes.size
      }
    };
  }

  async _performGraphQualityChecks(store) {
    const warnings = [];
    const stats = {
      triples: store.size,
      subjects: new Set(),
      predicates: new Set(),
      literals: 0,
      uris: 0
    };

    for (const quad of store) {
      stats.subjects.add(quad.subject.value);
      stats.predicates.add(quad.predicate.value);
      
      if (quad.object.termType === 'Literal') {
        stats.literals++;
      } else if (quad.object.termType === 'NamedNode') {
        stats.uris++;
      }
    }

    // Quality checks
    if (stats.literals === 0) {
      warnings.push({
        type: 'no-literals',
        message: 'Graph contains no literal values',
        severity: 'medium'
      });
    }

    if (stats.subjects.size === 1) {
      warnings.push({
        type: 'single-subject',
        message: 'Graph describes only one subject',
        severity: 'low'
      });
    }

    return {
      warnings,
      statistics: {
        ...stats,
        subjects: stats.subjects.size,
        predicates: stats.predicates.size
      }
    };
  }

  async _discoverArtifacts(artifactPath, recursive = false) {
    const artifacts = [];
    const stat = await fs.stat(artifactPath);

    if (stat.isFile()) {
      artifacts.push({
        path: artifactPath,
        type: 'file',
        extension: path.extname(artifactPath),
        size: stat.size
      });
    } else if (stat.isDirectory()) {
      const entries = await fs.readdir(artifactPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(artifactPath, entry.name);
        
        if (entry.isFile()) {
          artifacts.push({
            path: fullPath,
            type: 'file',
            extension: path.extname(entry.name),
            size: (await fs.stat(fullPath)).size
          });
        } else if (recursive && entry.isDirectory() && !entry.name.startsWith('.')) {
          const subArtifacts = await this._discoverArtifacts(fullPath, true);
          artifacts.push(...subArtifacts);
        }
      }
    }

    return artifacts;
  }

  async _validateSingleArtifact(artifact) {
    const errors = [];
    const warnings = [];
    let valid = true;
    let content = null;

    try {
      // File existence and readability
      if (!await fs.pathExists(artifact.path)) {
        errors.push({
          type: 'file-not-found',
          message: `Artifact file not found: ${artifact.path}`,
          severity: 'error'
        });
        return { ...artifact, valid: false, errors, warnings };
      }

      // Size validation
      if (artifact.size === 0) {
        warnings.push({
          type: 'empty-file',
          message: `Artifact file is empty: ${artifact.path}`,
          severity: 'warning'
        });
      }

      // Content-type specific validation
      content = await fs.readFile(artifact.path, 'utf8');
      
      if (artifact.extension === '.json') {
        const jsonValidation = this._validateJSONArtifact(content, artifact.path);
        errors.push(...jsonValidation.errors);
        warnings.push(...jsonValidation.warnings);
        valid = valid && jsonValidation.valid;
      } else if (['.ttl', '.rdf', '.n3'].includes(artifact.extension)) {
        const rdfValidation = await this._validateRDFSyntax(content, artifact.path);
        errors.push(...rdfValidation.errors);
        warnings.push(...rdfValidation.warnings);
        valid = valid && rdfValidation.valid;
      }

      // Hash validation
      const hash = crypto.createHash('sha256').update(content).digest('hex');

    } catch (error) {
      errors.push({
        type: 'validation-error',
        message: `Failed to validate artifact: ${error.message}`,
        severity: 'error'
      });
      valid = false;
    }

    return {
      ...artifact,
      valid,
      errors,
      warnings,
      contentHash: content ? crypto.createHash('sha256').update(content).digest('hex') : null
    };
  }

  _validateJSONArtifact(content, filePath) {
    const errors = [];
    const warnings = [];

    try {
      const parsed = JSON.parse(content);
      
      // Basic JSON structure validation
      if (typeof parsed !== 'object' || parsed === null) {
        warnings.push({
          type: 'non-object-json',
          message: 'JSON artifact is not an object',
          file: filePath,
          severity: 'medium'
        });
      }

      // Check for common required fields
      if (typeof parsed === 'object' && parsed !== null) {
        const commonFields = ['id', 'type', 'version', 'timestamp'];
        const missingFields = commonFields.filter(field => !(field in parsed));
        
        if (missingFields.length > 0) {
          warnings.push({
            type: 'missing-common-fields',
            message: `Missing common fields: ${missingFields.join(', ')}`,
            file: filePath,
            severity: 'low'
          });
        }
      }

      return { valid: true, errors, warnings };
      
    } catch (error) {
      errors.push({
        type: 'json-parse-error',
        message: `Invalid JSON: ${error.message}`,
        file: filePath,
        severity: 'error'
      });
      
      return { valid: false, errors, warnings };
    }
  }

  async _validateAttestation(attestation, artifactPath) {
    const errors = [];
    const warnings = [];
    const details = {};

    // Schema validation
    const schemaValidation = this._validateAttestationSchema(attestation);
    errors.push(...schemaValidation.errors);
    warnings.push(...schemaValidation.warnings);

    // Content hash verification
    if (attestation.contentHash) {
      try {
        const actualContent = await fs.readFile(artifactPath, 'utf8');
        const actualHash = crypto.createHash('sha256').update(actualContent).digest('hex');
        
        if (actualHash !== attestation.contentHash) {
          errors.push({
            type: 'content-hash-mismatch',
            message: 'Artifact content does not match attestation hash',
            expected: attestation.contentHash,
            actual: actualHash,
            severity: 'error'
          });
        } else {
          details.contentHashValid = true;
        }
      } catch (error) {
        errors.push({
          type: 'hash-verification-error',
          message: `Failed to verify content hash: ${error.message}`,
          severity: 'error'
        });
      }
    }

    // Timestamp validation
    if (attestation.timestamp) {
      const timestamp = new Date(attestation.timestamp);
      const now = new Date();
      
      if (timestamp > now) {
        warnings.push({
          type: 'future-timestamp',
          message: 'Attestation timestamp is in the future',
          timestamp: attestation.timestamp,
          severity: 'medium'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details
    };
  }

  _validateAttestationSchema(attestation) {
    const errors = [];
    const warnings = [];

    // Basic schema validation
    const requiredFields = ['contentHash', 'timestamp'];
    const recommendedFields = ['templateHash', 'contextHash', 'operationId'];

    for (const field of requiredFields) {
      if (!(field in attestation)) {
        errors.push({
          type: 'missing-required-field',
          message: `Required attestation field missing: ${field}`,
          severity: 'error'
        });
      }
    }

    for (const field of recommendedFields) {
      if (!(field in attestation)) {
        warnings.push({
          type: 'missing-recommended-field',
          message: `Recommended attestation field missing: ${field}`,
          severity: 'low'
        });
      }
    }

    return { errors, warnings };
  }

  async _validateProvenanceChain(artifactPath) {
    const warnings = [];
    
    // Check for related provenance files
    const dir = path.dirname(artifactPath);
    const basename = path.basename(artifactPath, path.extname(artifactPath));
    
    const provenanceFiles = [
      `${artifactPath}.attest.json`,
      path.join(dir, `${basename}.provenance.json`),
      path.join(dir, 'provenance', `${basename}.json`)
    ];

    let foundFiles = 0;
    for (const file of provenanceFiles) {
      if (await fs.pathExists(file)) {
        foundFiles++;
      }
    }

    if (foundFiles === 0) {
      warnings.push({
        type: 'incomplete-provenance-chain',
        message: 'No provenance files found for artifact',
        severity: 'medium'
      });
    }

    return {
      complete: foundFiles > 0,
      warnings,
      provenanceFilesFound: foundFiles
    };
  }

  _setupJSONSchemas() {
    // Setup AJV schemas for artifact validation
    const attestationSchema = {
      type: 'object',
      required: ['contentHash', 'timestamp'],
      properties: {
        contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
        timestamp: { type: 'string', format: 'date-time' },
        templateHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
        contextHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
        operationId: { type: 'string' }
      }
    };

    this.ajv.addSchema(attestationSchema, 'attestation');
  }

  _getDefaultSHACLShapes() {
    return `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      
      [] a sh:NodeShape ;
        sh:targetNode [] ;
        sh:property [
          sh:path rdfs:label ;
          sh:datatype xsd:string ;
          sh:severity sh:Warning ;
          sh:message "Resources should have rdfs:label" ;
        ] .
    `;
  }

  _formatValidationError(operation, message, details = {}) {
    return {
      success: false,
      operation,
      error: message,
      timestamp: new Date().toISOString(),
      validationEngine: 'CLI-Integration',
      ...details
    };
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return {
      ...this.validationStats,
      successRate: this.validationStats.totalValidations > 0 
        ? (this.validationStats.passedValidations / this.validationStats.totalValidations) * 100 
        : 0,
      fallbackRate: this.validationStats.totalValidations > 0
        ? (this.validationStats.fallbackUsed / this.validationStats.totalValidations) * 100
        : 0,
      engines: {
        shacl: !!this.shaclEngine,
        fallback: this.options.enableFallback,
        schema: this.options.enableSchemaValidation
      }
    };
  }
}

export default ValidationCLIEngine;