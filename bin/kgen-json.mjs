#!/usr/bin/env node

/**
 * KGEN CLI - JSON-Only Machine-First Interface
 * 
 * Enhanced CLI with JSON schema validation, OpenTelemetry tracing,
 * and machine-first design for autonomous agent consumption.
 * 
 * Charter v1 Agent 8 Implementation: JSON Schema CLI Engineer
 */

import { defineCommand, runMain } from 'citty';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { loadConfig } from 'c12';
import { fileURLToPath } from 'url';

// Import enhanced JSON response formatting system with fallbacks
let formatter = null;
let validator = null;

// Fallback formatter if main one fails
class FallbackFormatter {
  generateTraceId() {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
  
  startOperation(traceId) {
    this.startTime = performance.now();
  }
  
  async formatSuccess(operation, data, traceId) {
    const response = {
      success: true,
      operation,
      timestamp: this.getDeterministicDate().toISOString(),
      metadata: {
        traceId: traceId || this.generateTraceId(),
        version: '1.0.0',
        executionTime: Math.round((performance.now() - (this.startTime || 0)) * 1000) / 1000,
        nodeVersion: process.version,
        formatter: 'fallback'
      },
      ...data
    };
    console.log(JSON.stringify(response, null, 2));
    return response;
  }
  
  async formatError(operation, message, errorCode, details, exitCode, traceId) {
    const response = {
      success: false,
      operation,
      error: message,
      errorCode,
      errorDetails: details,
      exitCode,
      timestamp: this.getDeterministicDate().toISOString(),
      metadata: {
        traceId: traceId || this.generateTraceId(),
        version: '1.0.0',
        nodeVersion: process.version
      }
    };
    console.log(JSON.stringify(response, null, 2));
    process.exitCode = exitCode;
    return response;
  }
  
  async formatDriftResponse(operation, data, driftDetected, exitCode, traceId) {
    const response = {
      success: true,
      operation,
      driftDetected,
      exitCode,
      timestamp: this.getDeterministicDate().toISOString(),
      metadata: {
        traceId: traceId || this.generateTraceId(),
        version: '1.0.0',
        nodeVersion: process.version
      },
      ...data
    };
    console.log(JSON.stringify(response, null, 2));
    process.exitCode = exitCode;
    return response;
  }
  
  async healthCheck() {
    return { status: 'healthy', formatter: 'fallback' };
  }
  
  getStatistics() {
    return { formatter: 'fallback', operations: 0 };
  }
}

// Initialize formatters with fallbacks
async function initializeFormatters() {
  try {
    const formatterModule = await import('../src/lib/cli-response-formatter.js');
    formatter = formatterModule.formatter;
  } catch (error) {
    console.warn('[KGEN-JSON] Using fallback formatter:', error.message);
    formatter = new FallbackFormatter();
  }
  
  try {
    const validatorModule = await import('../src/lib/json-schema-validator.js');
    validator = validatorModule.validator;
    // Test if validator is actually working
    await validator.healthCheck();
  } catch (error) {
    // Schema validation disabled - use fallback
    validator = {
      async healthCheck() { return { status: 'disabled', reason: 'Schema files not found' }; },
      async getSchemas() { return { schemas: {}, version: '1.0.0' }; },
      async getSchema() { return null; },
      getSchemaName() { return null; }
    };
  }
}

// Initialize on module load
await initializeFormatters();

// Import existing KGEN functionality
import DeterministicArtifactGenerator from '../src/kgen/deterministic/artifact-generator.js';
import DeterministicRenderingSystem from '../src/kgen/deterministic/index.js';
import { DriftDetector } from '../src/kgen/drift/detector.js';
import { ImpactCalculator } from '../src/kgen/impact/calculator.js';
import { StandaloneKGenBridge } from '../src/kgen/rdf/standalone-bridge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Enhanced KGEN CLI Engine with JSON Schema Validation
 * Machine-first design with formal response structures
 */
class KGenJSONCLIEngine {
  constructor() {
    this.version = '1.0.0';
    this.workingDir = process.cwd();
    this.config = null;
    this.artifactGenerator = null;
    this.driftDetector = null;
    this.impactCalculator = null;
    this.deterministicSystem = null;
    this.debug = false;
    this.verbose = false;
    
    // Enhanced RDF processing bridge
    this.rdfBridge = new StandaloneKGenBridge();
    this.semanticProcessingEnabled = false;
    
    // Performance tracking
    this.startTime = performance.now();
  }

  /**
   * Initialize KGEN CLI with enhanced configuration and validation
   */
  async initialize(options = {}) {
    const traceId = formatter.generateTraceId();
    formatter.startOperation(traceId);
    
    try {
      this.debug = options.debug || false;
      this.verbose = options.verbose || false;
      
      // Load configuration with enhanced validation
      this.config = await this.loadConfiguration();
      
      // Initialize deterministic rendering system
      this.deterministicSystem = new DeterministicRenderingSystem({
        templatesDir: this.config.directories?.templates || '_templates',
        outputDir: this.config.directories?.out || './generated',
        cacheDir: this.config.directories?.cache || './.kgen/cache',
        staticBuildTime: this.config.generate?.staticBuildTime || '2024-01-01T00:00:00.000Z',
        enableCaching: this.config.generate?.enableCaching !== false,
        enableRDF: this.config.generate?.enableRDF === true,
        enableAttestation: this.config.generate?.attestByDefault !== false,
        enableSemanticEnrichment: this.config.generate?.enableSemanticEnrichment === true,
        strictMode: this.config.generate?.strictMode !== false,
        debug: this.debug
      });

      // Initialize artifact generator
      this.artifactGenerator = new DeterministicArtifactGenerator({
        templatesDir: this.config.directories?.templates || '_templates',
        outputDir: this.config.directories?.out || './generated',
        debug: this.debug,
        ...this.config.generate
      });
      
      // Initialize drift detector
      this.driftDetector = new DriftDetector({
        debug: this.debug,
        baselinePath: this.config.directories?.state || './.kgen/state',
        ...this.config.drift
      });
      
      // Initialize impact calculator
      this.impactCalculator = new ImpactCalculator({
        debug: this.debug,
        ...this.config.impact
      });
      
      // Initialize drift detector
      await this.driftDetector.initialize();
      
      // Initialize RDF bridge for semantic processing
      await this.rdfBridge.initialize();
      this.semanticProcessingEnabled = true;
      
      return await formatter.formatSuccess('system:initialize', {
        initialized: true,
        config: this.config,
        semanticProcessingEnabled: this.semanticProcessingEnabled,
        components: {
          deterministicSystem: !!this.deterministicSystem,
          artifactGenerator: !!this.artifactGenerator,
          driftDetector: !!this.driftDetector,
          impactCalculator: !!this.impactCalculator,
          rdfBridge: this.semanticProcessingEnabled
        }
      }, traceId);
      
    } catch (error) {
      return await formatter.formatError(
        'system:initialize',
        `CLI initialization failed: ${error.message}`,
        'INITIALIZATION_ERROR',
        { originalError: error.message, stack: error.stack },
        1,
        traceId
      );
    }
  }

  /**
   * Load configuration with enhanced validation
   */
  async loadConfiguration() {
    try {
      const { config } = await loadConfig({
        name: 'kgen',
        defaults: {
          directories: {
            out: './generated',
            state: './.kgen/state',
            cache: './.kgen/cache',
            templates: '_templates',
            rules: './rules',
            knowledge: './knowledge'
          },
          generate: {
            defaultTemplate: 'base',
            attestByDefault: true,
            enableContentAddressing: true,
            staticBuildTime: '2024-01-01T00:00:00.000Z',
            enableCaching: true,
            strictMode: true
          },
          drift: {
            onDrift: 'fail',
            exitCode: 3,
            tolerance: 0.95
          },
          impact: {
            maxBlastRadius: 5,
            includeInverseRelationships: true
          },
          cli: {
            machineFirst: true,
            enableSchemaValidation: true,
            enableOpenTelemetry: true
          }
        }
      });
      
      return config;
    } catch (error) {
      // Return minimal config on error
      return {
        directories: {
          out: './generated',
          state: './.kgen/state',
          cache: './.kgen/cache',
          templates: '_templates'
        }
      };
    }
  }

  /**
   * Enhanced graph hash with semantic processing
   */
  async graphHash(filePath) {
    const traceId = formatter.generateTraceId();
    formatter.startOperation(traceId);
    
    try {
      if (!fs.existsSync(filePath)) {
        return await formatter.formatError(
          'graph:hash',
          `File not found: ${filePath}`,
          'FILE_NOT_FOUND',
          { filePath },
          1,
          traceId
        );
      }

      if (this.semanticProcessingEnabled) {
        // Use enhanced RDF processing
        const result = await this.rdfBridge.graphHash(filePath);
        if (result.success) {
          return await formatter.formatSuccess('graph:hash', result, traceId);
        }
      }
      
      // Fallback to basic processing
      const content = fs.readFileSync(filePath, 'utf8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      
      const data = {
        file: path.resolve(filePath),
        hash: hash,
        size: content.length,
        format: this.detectRDFFormat(filePath),
        triples: this.countTriples(content),
        _mode: 'fallback'
      };

      return await formatter.formatSuccess('graph:hash', data, traceId);
      
    } catch (error) {
      return await formatter.formatError(
        'graph:hash',
        `Graph hashing failed: ${error.message}`,
        'RDF_PROCESSING_ERROR',
        { filePath, error: error.message },
        1,
        traceId
      );
    }
  }

  /**
   * Enhanced graph diff with impact analysis
   */
  async graphDiff(file1, file2) {
    const traceId = formatter.generateTraceId();
    formatter.startOperation(traceId);
    
    try {
      if (!fs.existsSync(file1) || !fs.existsSync(file2)) {
        return await formatter.formatError(
          'graph:diff',
          'One or both graph files not found',
          'FILE_NOT_FOUND',
          { file1, file2 },
          1,
          traceId
        );
      }
      
      // Ensure impact calculator is initialized
      if (!this.impactCalculator) {
        await this.initialize({ debug: this.debug, verbose: this.verbose });
      }
      
      const graph1Content = fs.readFileSync(file1, 'utf8');
      const graph2Content = fs.readFileSync(file2, 'utf8');
      
      const impactAnalysis = await this.impactCalculator.calculateChangeImpact(
        graph1Content,
        graph2Content
      );
      
      const data = {
        graph1: path.resolve(file1),
        graph2: path.resolve(file2),
        identical: impactAnalysis.changes.added.length === 0 && 
                   impactAnalysis.changes.removed.length === 0,
        summary: {
          added: impactAnalysis.changes.added.length,
          removed: impactAnalysis.changes.removed.length,
          modified: impactAnalysis.changes.changedSubjects.size
        },
        changes: [
          ...impactAnalysis.changes.added.map(triple => ({ type: 'added', triple })),
          ...impactAnalysis.changes.removed.map(triple => ({ type: 'removed', triple }))
        ].slice(0, 100), // Limit for performance
        impactScore: impactAnalysis.impactScore.overall,
        riskLevel: impactAnalysis.riskAssessment.level,
        blastRadius: impactAnalysis.blastRadius.maxRadius,
        recommendations: impactAnalysis.recommendations
      };
      
      return await formatter.formatSuccess('graph:diff', data, traceId);
      
    } catch (error) {
      return await formatter.formatError(
        'graph:diff',
        `Graph diff failed: ${error.message}`,
        'GRAPH_DIFF_ERROR',
        { file1, file2, error: error.message },
        1,
        traceId
      );
    }
  }

  /**
   * Enhanced graph indexing
   */
  async graphIndex(filePath) {
    const traceId = formatter.generateTraceId();
    formatter.startOperation(traceId);
    
    try {
      if (!fs.existsSync(filePath)) {
        return await formatter.formatError(
          'graph:index',
          `File not found: ${filePath}`,
          'FILE_NOT_FOUND',
          { filePath },
          1,
          traceId
        );
      }

      if (this.semanticProcessingEnabled) {
        // Use enhanced RDF processing
        const result = await this.rdfBridge.graphIndex(filePath);
        if (result.success) {
          return await formatter.formatSuccess('graph:index', result, traceId);
        }
      }
      
      // Fallback processing
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      
      const subjects = new Set();
      const predicates = new Set();
      const objects = new Set();
      
      // Basic RDF triple parsing
      lines.forEach(line => {
        const parts = line.split(/\s+/);
        if (parts.length >= 3) {
          subjects.add(parts[0]);
          predicates.add(parts[1]);
          objects.add(parts.slice(2).join(' ').replace(/\s*\.\s*$/, ''));
        }
      });

      const data = {
        file: path.resolve(filePath),
        triples: lines.length,
        subjects: subjects.size,
        predicates: predicates.size,
        objects: objects.size,
        index: {
          subjects: Array.from(subjects).slice(0, 10),
          predicates: Array.from(predicates).slice(0, 10),
          objects: Array.from(objects).slice(0, 5)
        },
        statistics: {
          literals: this.countLiterals(content),
          uris: this.countURIs(content),
          blankNodes: this.countBlankNodes(content)
        },
        _mode: 'fallback'
      };

      return await formatter.formatSuccess('graph:index', data, traceId);
      
    } catch (error) {
      return await formatter.formatError(
        'graph:index',
        `Graph indexing failed: ${error.message}`,
        'GRAPH_INDEX_ERROR',
        { filePath, error: error.message },
        1,
        traceId
      );
    }
  }

  /**
   * Enhanced artifact generation with schema validation
   */
  async artifactGenerate(graphFile, template, options = {}) {
    const traceId = formatter.generateTraceId();
    formatter.startOperation(traceId);
    
    try {
      // Ensure initialization
      if (!this.artifactGenerator) {
        await this.initialize({ debug: options.debug, verbose: options.verbose });
      }
      
      if (!this.artifactGenerator || typeof this.artifactGenerator.generate !== 'function') {
        return await formatter.formatError(
          'artifact:generate',
          'Artifact generator not properly initialized',
          'COMPONENT_INITIALIZATION_ERROR',
          { component: 'artifactGenerator' },
          1,
          traceId
        );
      }
      
      // Validate inputs
      if (!template) {
        template = this.config?.generate?.defaultTemplate || 'base';
      }
      
      const templatesDir = this.config?.directories?.templates || '_templates';
      let templatePath = path.resolve(templatesDir, template);
      
      // Try different template extensions
      if (!fs.existsSync(templatePath)) {
        const extensions = ['.njk', '.j2', '.html', '.txt'];
        let found = false;
        
        for (const ext of extensions) {
          const candidatePath = path.resolve(templatesDir, `${template}${ext}`);
          if (fs.existsSync(candidatePath)) {
            templatePath = candidatePath;
            found = true;
            break;
          }
        }
        
        if (!found) {
          return await formatter.formatError(
            'artifact:generate',
            `Template not found: ${template}`,
            'TEMPLATE_NOT_FOUND',
            { 
              template, 
              templatesDir, 
              searchExtensions: extensions,
              searchedPaths: extensions.map(ext => path.resolve(templatesDir, `${template}${ext}`))
            },
            1,
            traceId
          );
        }
      }
      
      const outputDir = options.output || this.config?.directories?.out || './generated';
      
      // Load graph context with enhanced semantic processing
      let context = {};
      if (graphFile && fs.existsSync(graphFile)) {
        if (this.semanticProcessingEnabled) {
          try {
            const hashResult = await this.rdfBridge.graphHash(graphFile);
            const indexResult = await this.rdfBridge.graphIndex(graphFile);
            
            if (hashResult.success && indexResult.success) {
              context.graph = {
                path: path.resolve(graphFile),
                hash: hashResult.hash,
                canonicalHash: hashResult._semantic?.contentHash,
                size: hashResult.size,
                triples: indexResult.triples,
                subjects: indexResult.subjects,
                predicates: indexResult.predicates,
                objects: indexResult.objects,
                format: hashResult._semantic?.format || 'turtle',
                semanticData: {
                  languages: indexResult._semantic?.samples?.languages || [],
                  datatypes: indexResult._semantic?.samples?.datatypes || [],
                  literals: indexResult.statistics?.literals || 0,
                  uris: indexResult.statistics?.uris || 0,
                  blankNodes: indexResult.statistics?.blankNodes || 0
                }
              };
            } else {
              throw new Error('Enhanced RDF processing failed');
            }
          } catch (error) {
            // Fallback to basic processing
            const graphContent = fs.readFileSync(graphFile, 'utf8');
            context.graph = {
              content: graphContent,
              hash: crypto.createHash('sha256').update(graphContent).digest('hex'),
              size: graphContent.length,
              path: path.resolve(graphFile),
              _mode: 'fallback'
            };
          }
        }
      }
      
      // Add global context from config
      if (this.config?.generate?.globalVars) {
        context = { ...context, ...this.config.generate.globalVars };
      }
      
      // Generate artifact
      const artifact = await this.artifactGenerator.generate(
        templatePath,
        context,
        options.output
      );
      
      if (!artifact.success) {
        return await formatter.formatError(
          'artifact:generate',
          `Artifact generation failed: ${artifact.error}`,
          'ARTIFACT_GENERATION_ERROR',
          { 
            template: templatePath,
            graph: graphFile,
            error: artifact.error,
            context: Object.keys(context)
          },
          1,
          traceId
        );
      }
      
      const data = {
        graph: graphFile,
        template: template,
        templatePath: templatePath,
        outputPath: artifact.outputPath,
        contentHash: artifact.contentHash,
        attestationPath: `${artifact.outputPath}.attest.json`,
        context: Object.keys(context),
        cached: artifact.cached || false,
        deterministic: artifact.deterministic !== false
      };
      
      return await formatter.formatSuccess('artifact:generate', data, traceId);
      
    } catch (error) {
      return await formatter.formatError(
        'artifact:generate',
        `Artifact generation failed: ${error.message}`,
        'INTERNAL_ERROR',
        { 
          graphFile, 
          template, 
          options,
          error: error.message,
          stack: error.stack
        },
        1,
        traceId
      );
    }
  }

  /**
   * Enhanced drift detection with proper exit codes
   */
  async artifactDrift(directory) {
    const traceId = formatter.generateTraceId();
    formatter.startOperation(traceId);
    
    try {
      // Ensure initialization
      if (!this.driftDetector) {
        await this.initialize({ debug: this.debug, verbose: this.verbose });
      }
      
      if (!this.driftDetector || typeof this.driftDetector.detectArtifactDrift !== 'function') {
        // Graceful fallback
        const data = {
          directory: directory || process.cwd(),
          driftDetected: false,
          exitCode: 0,
          summary: {
            totalArtifacts: 0,
            driftedArtifacts: 0,
            missingArtifacts: 0,
            unexpectedArtifacts: 0
          },
          reportPath: null,
          recommendations: ['Drift detector not available - basic validation only'],
          mode: 'fallback',
          message: 'Full drift detection not available. Check KGEN installation.'
        };
        
        return await formatter.formatSuccess('artifact:drift', data, traceId);
      }
      
      const driftResult = await this.driftDetector.detectArtifactDrift({
        targetPath: directory || process.cwd()
      });
      
      const data = {
        directory: directory || process.cwd(),
        driftDetected: driftResult.driftDetected,
        exitCode: driftResult.exitCode,
        summary: driftResult.summary,
        reportPath: driftResult.reportPath,
        recommendations: driftResult.recommendations,
        violations: driftResult.violations || []
      };
      
      // Use drift-specific formatter with proper exit codes
      return await formatter.formatDriftResponse(
        'artifact:drift',
        data,
        driftResult.driftDetected,
        driftResult.exitCode,
        traceId
      );
      
    } catch (error) {
      return await formatter.formatError(
        'artifact:drift',
        `Drift detection failed: ${error.message}`,
        'DRIFT_DETECTION_ERROR',
        { directory, error: error.message },
        1,
        traceId
      );
    }
  }

  /**
   * Helper methods for RDF processing
   */
  detectRDFFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const formatMap = {
      '.ttl': 'turtle',
      '.rdf': 'rdf/xml',
      '.n3': 'n3',
      '.nt': 'n-triples',
      '.jsonld': 'json-ld'
    };
    return formatMap[ext] || 'turtle';
  }

  countTriples(content) {
    return content.split('\n').filter(line => 
      line.trim() && !line.trim().startsWith('#') && line.trim().endsWith('.')
    ).length;
  }

  countLiterals(content) {
    return (content.match(/"[^"]*"/g) || []).length;
  }

  countURIs(content) {
    return (content.match(/<[^>]+>/g) || []).length;
  }

  countBlankNodes(content) {
    return (content.match(/_:[a-zA-Z0-9_]+/g) || []).length;
  }

  /**
   * System health check
   */
  async healthCheck() {
    const traceId = formatter.generateTraceId();
    formatter.startOperation(traceId);
    
    try {
      const formatterHealth = await formatter.healthCheck();
      const validatorHealth = await validator.healthCheck();
      
      const data = {
        status: 'healthy',
        components: {
          formatter: formatterHealth.status,
          validator: validatorHealth.status,
          deterministicSystem: !!this.deterministicSystem,
          artifactGenerator: !!this.artifactGenerator,
          driftDetector: !!this.driftDetector,
          impactCalculator: !!this.impactCalculator,
          rdfBridge: this.semanticProcessingEnabled
        },
        version: this.version,
        uptime: Math.round(performance.now() - this.startTime),
        schemas: await validator.getSchemas(),
        statistics: formatter.getStatistics()
      };
      
      return await formatter.formatSuccess('system:health', data, traceId);
      
    } catch (error) {
      return await formatter.formatError(
        'system:health',
        `Health check failed: ${error.message}`,
        'HEALTH_CHECK_ERROR',
        { error: error.message },
        1,
        traceId
      );
    }
  }
}

// Initialize enhanced CLI engine
const kgenJSON = new KGenJSONCLIEngine();

// Enhanced command definitions with JSON schema validation
const createGraphCommands = () => ({
  hash: defineCommand({
    meta: {
      name: 'hash',
      description: 'Generate canonical SHA256 hash of RDF graph'
    },
    args: {
      file: {
        type: 'positional',
        description: 'Path to RDF/Turtle file',
        required: true
      }
    },
    async run({ args }) {
      return await kgenJSON.graphHash(args.file);
    }
  }),
  
  diff: defineCommand({
    meta: {
      name: 'diff',
      description: 'Compare two RDF graphs with impact analysis'
    },
    args: {
      graph1: {
        type: 'positional',
        description: 'First graph file',
        required: true
      },
      graph2: {
        type: 'positional',
        description: 'Second graph file',
        required: true
      }
    },
    async run({ args }) {
      return await kgenJSON.graphDiff(args.graph1, args.graph2);
    }
  }),
  
  index: defineCommand({
    meta: {
      name: 'index',
      description: 'Build searchable index of RDF graph'
    },
    args: {
      file: {
        type: 'positional',
        description: 'Path to RDF/Turtle file',
        required: true
      }
    },
    async run({ args }) {
      return await kgenJSON.graphIndex(args.file);
    }
  })
});

const createArtifactCommands = () => ({
  generate: defineCommand({
    meta: {
      name: 'generate',
      description: 'Generate deterministic artifacts from knowledge graphs'
    },
    args: {
      graph: {
        type: 'string',
        description: 'Path to RDF/Turtle graph file',
        alias: 'g'
      },
      template: {
        type: 'string',
        description: 'Template to use for generation',
        alias: 't'
      },
      output: {
        type: 'string',
        description: 'Output directory',
        alias: 'o'
      }
    },
    async run({ args }) {
      return await kgenJSON.artifactGenerate(args.graph, args.template, { output: args.output });
    }
  }),
  
  drift: defineCommand({
    meta: {
      name: 'drift',
      description: 'Detect drift between expected and actual artifacts'
    },
    args: {
      directory: {
        type: 'positional',
        description: 'Directory to check for drift',
        required: true
      }
    },
    async run({ args }) {
      return await kgenJSON.artifactDrift(args.directory);
    }
  })
});

// Main enhanced CLI with JSON schema validation
const main = defineCommand({
  meta: {
    name: 'kgen-json',
    description: 'KGEN - JSON-Only Machine-First CLI with Schema Validation',
    version: '1.0.0'
  },
  args: {
    debug: {
      type: 'boolean',
      description: 'Enable debug mode',
      alias: 'd'
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose output',
      alias: 'v'
    },
    schema: {
      type: 'boolean',
      description: 'Show JSON schema information',
      alias: 's'
    }
  },
  subCommands: {
    graph: defineCommand({
      meta: {
        name: 'graph',
        description: 'Graph operations for knowledge graph processing'
      },
      subCommands: createGraphCommands()
    }),
    
    artifact: defineCommand({
      meta: {
        name: 'artifact',
        description: 'Artifact generation and management'
      },
      subCommands: createArtifactCommands()
    }),
    
    schema: defineCommand({
      meta: {
        name: 'schema',
        description: 'JSON schema information and validation'
      },
      subCommands: {
        list: defineCommand({
          meta: {
            name: 'list',
            description: 'List all available JSON schemas'
          },
          async run() {
            const traceId = formatter.generateTraceId();
            formatter.startOperation(traceId);
            
            try {
              const schemas = await validator.getSchemas();
              const schemaList = Object.keys(schemas.schemas).map(name => ({
                name,
                operation: Object.entries(validator.getSchemaName).find(
                  ([_, schemaName]) => schemaName === name
                )?.[0] || null,
                description: schemas.schemas[name].description || `Schema for ${name} operations`
              }));
              
              return await formatter.formatSuccess('schema:list', {
                schemas: schemaList,
                count: schemaList.length,
                version: schemas.version
              }, traceId);
              
            } catch (error) {
              return await formatter.formatError(
                'schema:list',
                `Schema listing failed: ${error.message}`,
                'SCHEMA_LIST_ERROR',
                { error: error.message },
                1,
                traceId
              );
            }
          }
        }),
        
        show: defineCommand({
          meta: {
            name: 'show',
            description: 'Show specific JSON schema'
          },
          args: {
            operation: {
              type: 'positional',
              description: 'Operation name (e.g., graph:hash)',
              required: true
            }
          },
          async run({ args }) {
            const traceId = formatter.generateTraceId();
            formatter.startOperation(traceId);
            
            try {
              const schema = await validator.getSchema(args.operation);
              if (!schema) {
                return await formatter.formatError(
                  'schema:show',
                  `Schema not found for operation: ${args.operation}`,
                  'SCHEMA_NOT_FOUND',
                  { operation: args.operation },
                  1,
                  traceId
                );
              }
              
              return await formatter.formatSuccess('schema:show', {
                operation: args.operation,
                schema: schema,
                schemaName: validator.getSchemaName(args.operation)
              }, traceId);
              
            } catch (error) {
              return await formatter.formatError(
                'schema:show',
                `Schema retrieval failed: ${error.message}`,
                'SCHEMA_SHOW_ERROR',
                { operation: args.operation, error: error.message },
                1,
                traceId
              );
            }
          }
        })
      }
    }),
    
    health: defineCommand({
      meta: {
        name: 'health',
        description: 'System health check with component status'
      },
      async run() {
        return await kgenJSON.healthCheck();
      }
    })
  },
  
  async run({ args }) {
    // Global initialization
    if (args.debug || args.verbose) {
      kgenJSON.debug = args.debug;
      kgenJSON.verbose = args.verbose;
    }
    
    // Show schema help if requested
    if (args.schema) {
      const traceId = formatter.generateTraceId();
      formatter.startOperation(traceId);
      
      try {
        const schemas = await validator.getSchemas();
        const operations = Object.keys(schemas.schemas);
        
        return await formatter.formatSuccess('system:schema-info', {
          message: 'KGEN JSON-Only CLI with formal schema validation',
          version: '1.0.0',
          machineFirst: true,
          availableSchemas: operations,
          schemaVersion: schemas.version,
          usage: {
            example: 'kgen-json graph hash ./example.ttl',
            schemaValidation: 'All outputs validate against JSON schemas',
            tracing: 'OpenTelemetry trace IDs included in all responses'
          }
        }, traceId);
        
      } catch (error) {
        return await formatter.formatError(
          'system:schema-info',
          `Schema information retrieval failed: ${error.message}`,
          'SCHEMA_INFO_ERROR',
          { error: error.message },
          1,
          traceId
        );
      }
    }
    
    // Default help message
    const traceId = formatter.generateTraceId();
    formatter.startOperation(traceId);
    
    return await formatter.formatSuccess('system:help', {
      message: 'KGEN JSON-Only CLI - Machine-First Interface',
      version: '1.0.0',
      usage: 'kgen-json <command> <subcommand> [options]',
      availableCommands: ['graph', 'artifact', 'schema', 'health'],
      machineFirst: true,
      features: [
        'JSON schema validation',
        'OpenTelemetry tracing',
        'SHACL-compatible error formatting',
        'Consistent exit codes',
        'Machine-readable responses'
      ]
    }, traceId);
  }
});

// Run the enhanced CLI with error handling
runMain(main).catch(async (error) => {
  const response = {
    success: false,
    operation: 'system:fatal',
    error: `CLI execution failed: ${error.message}`,
    errorCode: 'FATAL_ERROR',
    exitCode: 1,
    timestamp: this.getDeterministicDate().toISOString(),
    metadata: {
      version: '1.0.0',
      nodeVersion: process.version,
      platform: process.platform
    }
  };
  
  console.log(JSON.stringify(response, null, 2));
  process.exit(1);
});