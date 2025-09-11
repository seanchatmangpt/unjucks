/**
 * Semantic Processor Bridge
 * Integrates KnowledgeCompiler with existing KGEN semantic processor
 * Provides migration path and compatibility layer
 */

import { KnowledgeCompiler } from '../knowledge-compiler.js';
import { consola } from 'consola';
import fs from 'fs/promises';

export class SemanticProcessorBridge {
  constructor(config = {}) {
    this.config = {
      // Bridge configuration
      enableLegacySupport: true,
      migrateAutomatically: true,
      preserveSemanticCache: true,
      
      // Performance settings
      parallelProcessing: true,
      batchSize: 100,
      
      ...config
    };
    
    this.logger = consola.withTag('semantic-bridge');
    this.knowledgeCompiler = null;
    this.migrationStats = {
      processedGraphs: 0,
      compiledContexts: 0,
      migrationErrors: 0,
      startTime: null,
      endTime: null
    };
  }

  /**
   * Initialize the bridge
   */
  async initialize() {
    try {
      this.logger.info('Initializing Semantic Processor Bridge...');
      
      // Initialize knowledge compiler
      this.knowledgeCompiler = new KnowledgeCompiler(this.config);
      await this.knowledgeCompiler.initialize();
      
      this.logger.success('Semantic Processor Bridge initialized');
      
      return { status: 'success', component: 'semantic-bridge' };
      
    } catch (error) {
      this.logger.error('Failed to initialize bridge:', error);
      throw error;
    }
  }

  /**
   * Convert semantic processor output to knowledge compiler input
   * @param {Object} semanticGraph - Graph from SemanticProcessor
   * @param {Array} reasoningRules - Rules from semantic processor
   * @returns {Promise<Object>} Compiled template context
   */
  async convertSemanticToKnowledge(semanticGraph, reasoningRules = []) {
    try {
      this.logger.info('Converting semantic graph to knowledge compilation format...');
      
      // Convert semantic graph format to knowledge compiler format
      const rdfGraph = await this._convertGraphFormat(semanticGraph);
      
      // Convert reasoning rules to N3 format
      const n3Rules = await this._convertRulesToN3(reasoningRules);
      
      // Compile context using knowledge compiler
      const compiledContext = await this.knowledgeCompiler.compileContext(rdfGraph, n3Rules);
      
      // Enhance with semantic processor metadata
      const enhancedContext = await this._enhanceWithSemanticMetadata(
        compiledContext, 
        semanticGraph
      );
      
      this.migrationStats.processedGraphs++;
      this.migrationStats.compiledContexts++;
      
      this.logger.success('Semantic graph converted successfully');
      
      return enhancedContext;
      
    } catch (error) {
      this.migrationStats.migrationErrors++;
      this.logger.error('Conversion failed:', error);
      throw error;
    }
  }

  /**
   * Migrate existing semantic processor data
   * @param {string} semanticDataPath - Path to semantic processor data
   * @param {string} outputPath - Path for compiled contexts
   */
  async migrateSemanticData(semanticDataPath, outputPath) {
    this.migrationStats.startTime = Date.now();
    
    try {
      this.logger.info(`Starting migration from ${semanticDataPath} to ${outputPath}`);
      
      // Read semantic processor data
      const semanticData = await this._loadSemanticData(semanticDataPath);
      
      // Process in batches for performance
      const batches = this._createBatches(semanticData, this.config.batchSize);
      
      const migrationResults = [];
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        this.logger.info(`Processing batch ${i + 1}/${batches.length} (${batch.length} items)`);
        
        const batchResults = this.config.parallelProcessing ?
          await this._processBatchParallel(batch) :
          await this._processBatchSequential(batch);
        
        migrationResults.push(...batchResults);
        
        // Save intermediate results
        await this._saveMigrationBatch(outputPath, i, batchResults);
      }
      
      // Generate migration report
      const report = await this._generateMigrationReport(migrationResults);
      await this._saveMigrationReport(outputPath, report);
      
      this.migrationStats.endTime = Date.now();
      
      this.logger.success(`Migration completed in ${this.migrationStats.endTime - this.migrationStats.startTime}ms`);
      
      return report;
      
    } catch (error) {
      this.logger.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Create template context from enterprise governance rules
   * @param {string} rulesPath - Path to N3 rules file
   * @param {Object} domainGraph - Domain-specific RDF graph
   */
  async compileEnterpriseContext(rulesPath, domainGraph) {
    try {
      // Load enterprise governance rules
      const n3Rules = await this._loadN3Rules(rulesPath);
      
      // Compile context with enterprise rules
      const context = await this.knowledgeCompiler.compileContext(domainGraph, n3Rules);
      
      // Add enterprise-specific enhancements
      const enterpriseContext = {
        ...context,
        enterprise: {
          complianceLevel: this._assessComplianceLevel(context),
          securityRequirements: this._extractSecurityRequirements(context),
          auditTrail: {
            compiledAt: new Date().toISOString(),
            rulesApplied: n3Rules.length,
            complianceChecks: context.facts ? Object.keys(context.facts).length : 0
          }
        }
      };
      
      return enterpriseContext;
      
    } catch (error) {
      this.logger.error('Enterprise context compilation failed:', error);
      throw error;
    }
  }

  /**
   * Convert semantic graph to RDF graph format
   */
  async _convertGraphFormat(semanticGraph) {
    const triples = [];
    
    // Convert entities to triples
    if (semanticGraph.entities) {
      for (const entity of semanticGraph.entities) {
        // Add type triple
        triples.push({
          subject: entity.uri,
          predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
          object: { type: 'uri', value: entity.type }
        });
        
        // Add properties
        if (entity.properties) {
          for (const [prop, value] of Object.entries(entity.properties)) {
            triples.push({
              subject: entity.uri,
              predicate: prop,
              object: { type: 'literal', value: String(value) }
            });
          }
        }
        
        // Add template variables
        if (entity.templateVariables) {
          for (const varName of entity.templateVariables) {
            triples.push({
              subject: entity.uri,
              predicate: 'http://unjucks.dev/template/hasVariable',
              object: { type: 'literal', value: varName }
            });
          }
        }
      }
    }
    
    // Convert existing triples if present
    if (semanticGraph.triples) {
      triples.push(...semanticGraph.triples);
    }
    
    return { triples };
  }

  /**
   * Convert reasoning rules to N3 format
   */
  async _convertRulesToN3(reasoningRules) {
    return reasoningRules.map(rule => {
      if (typeof rule === 'string') {
        return { body: rule };
      }
      
      if (rule.conditions && rule.conclusions) {
        return {
          name: rule.name || 'Converted Rule',
          body: this._formatN3Rule(rule.conditions, rule.conclusions)
        };
      }
      
      return rule;
    });
  }

  /**
   * Format N3 rule from conditions and conclusions
   */
  _formatN3Rule(conditions, conclusions) {
    const formatPatterns = (patterns) => {
      return patterns.map(p => `  ${p.subject} ${p.predicate} ${p.object}`).join(' .\n');
    };
    
    return `{
${formatPatterns(conditions)}
} => {
${formatPatterns(conclusions)}
}`;
  }

  /**
   * Enhance compiled context with semantic metadata
   */
  async _enhanceWithSemanticMetadata(compiledContext, semanticGraph) {
    return {
      ...compiledContext,
      semantic: {
        originalGraph: {
          entityCount: semanticGraph.entities?.length || 0,
          tripleCount: semanticGraph.triples?.length || 0,
          namespace: semanticGraph.namespace
        },
        reasoning: {
          inferenceEngine: 'n3',
          reasoningTime: compiledContext.metadata?.compilationTime || 0,
          rulesApplied: compiledContext.metadata?.inferredFacts || 0
        },
        migration: {
          bridgeVersion: '1.0.0',
          migratedAt: new Date().toISOString()
        }
      }
    };
  }

  /**
   * Load semantic processor data
   */
  async _loadSemanticData(dataPath) {
    try {
      const files = await fs.readdir(dataPath, { withFileTypes: true });
      const semanticData = [];
      
      for (const file of files) {
        if (file.isFile() && (file.name.endsWith('.json') || file.name.endsWith('.ttl'))) {
          const filePath = `${dataPath}/${file.name}`;
          const content = await fs.readFile(filePath, 'utf-8');
          
          if (file.name.endsWith('.json')) {
            semanticData.push(JSON.parse(content));
          } else {
            // Handle Turtle/N3 files
            semanticData.push({ format: 'turtle', content, filename: file.name });
          }
        }
      }
      
      return semanticData;
      
    } catch (error) {
      this.logger.error(`Failed to load semantic data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load N3 rules from file
   */
  async _loadN3Rules(rulesPath) {
    try {
      const content = await fs.readFile(rulesPath, 'utf-8');
      
      // Simple N3 rule parsing - split by rule boundaries
      const rules = [];
      const ruleBlocks = content.split(/\}\s*\.\s*$/gm);
      
      for (const block of ruleBlocks) {
        const trimmed = block.trim();
        if (trimmed && trimmed.includes('=>')) {
          rules.push({
            body: trimmed + ' }'
          });
        }
      }
      
      return rules;
      
    } catch (error) {
      this.logger.error(`Failed to load N3 rules: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process batch in parallel
   */
  async _processBatchParallel(batch) {
    const promises = batch.map(async (item) => {
      try {
        return await this.convertSemanticToKnowledge(item, item.rules || []);
      } catch (error) {
        return { error: error.message, item: item.id || 'unknown' };
      }
    });
    
    return Promise.all(promises);
  }

  /**
   * Process batch sequentially
   */
  async _processBatchSequential(batch) {
    const results = [];
    
    for (const item of batch) {
      try {
        const result = await this.convertSemanticToKnowledge(item, item.rules || []);
        results.push(result);
      } catch (error) {
        results.push({ error: error.message, item: item.id || 'unknown' });
      }
    }
    
    return results;
  }

  /**
   * Create processing batches
   */
  _createBatches(data, batchSize) {
    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Save migration batch results
   */
  async _saveMigrationBatch(outputPath, batchIndex, results) {
    const batchPath = `${outputPath}/batch-${batchIndex}.json`;
    await fs.writeFile(batchPath, JSON.stringify(results, null, 2));
  }

  /**
   * Generate migration report
   */
  async _generateMigrationReport(results) {
    const successful = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);
    
    return {
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        successRate: Math.round((successful.length / results.length) * 100),
        processingTime: this.migrationStats.endTime - this.migrationStats.startTime
      },
      statistics: {
        averageVariables: successful.length > 0 ? 
          Math.round(successful.reduce((sum, r) => sum + Object.keys(r.variables || {}).length, 0) / successful.length) : 0,
        averageFacts: successful.length > 0 ?
          Math.round(successful.reduce((sum, r) => sum + Object.keys(r.facts || {}).length, 0) / successful.length) : 0
      },
      errors: failed.map(f => ({
        item: f.item,
        error: f.error
      })),
      performance: {
        itemsPerSecond: Math.round((results.length / (this.migrationStats.endTime - this.migrationStats.startTime)) * 1000),
        memoryUsage: process.memoryUsage()
      }
    };
  }

  /**
   * Save migration report
   */
  async _saveMigrationReport(outputPath, report) {
    const reportPath = `${outputPath}/migration-report.json`;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Also create a summary text report
    const summaryPath = `${outputPath}/migration-summary.txt`;
    const summaryText = `
Migration Summary
================

Total Items: ${report.summary.total}
Successful: ${report.summary.successful}
Failed: ${report.summary.failed}
Success Rate: ${report.summary.successRate}%
Processing Time: ${report.summary.processingTime}ms

Performance:
- Items/sec: ${report.performance.itemsPerSecond}
- Average Variables: ${report.statistics.averageVariables}
- Average Facts: ${report.statistics.averageFacts}

${report.errors.length > 0 ? 'Errors:\n' + report.errors.map(e => `- ${e.item}: ${e.error}`).join('\n') : 'No errors'}
`;
    
    await fs.writeFile(summaryPath, summaryText);
  }

  /**
   * Assess compliance level from compiled context
   */
  _assessComplianceLevel(context) {
    const complianceIndicators = [
      'requiresAuthentication',
      'requiresAuthorization',
      'requiresAuditLogging',
      'requiresDataEncryption',
      'requiresValidation'
    ];
    
    let score = 0;
    const facts = context.facts || {};
    
    for (const factSubject of Object.values(facts)) {
      for (const indicator of complianceIndicators) {
        if (factSubject[`http://unjucks.dev/compliance/${indicator}`]) {
          score++;
        }
      }
    }
    
    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  /**
   * Extract security requirements from compiled context
   */
  _extractSecurityRequirements(context) {
    const requirements = [];
    const facts = context.facts || {};
    
    for (const [subject, predicates] of Object.entries(facts)) {
      for (const [predicate, value] of Object.entries(predicates)) {
        if (predicate.includes('security') && value === true) {
          requirements.push({
            subject,
            requirement: predicate.split('/').pop(),
            value
          });
        }
      }
    }
    
    return requirements;
  }

  /**
   * Get migration statistics
   */
  getMigrationStats() {
    return { ...this.migrationStats };
  }
}

export default SemanticProcessorBridge;