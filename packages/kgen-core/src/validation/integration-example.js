#!/usr/bin/env node

/**
 * KGEN Validation Engine Integration Example
 * Demonstrates integration with existing KGEN components
 */

import { KGenValidationEngine } from './index.js';
import fs from 'fs-extra';
import path from 'path';

/**
 * Example integration with KGEN provenance tracking
 */
export class KGenIntegratedValidation {
  constructor(config = {}) {
    this.validationEngine = new KGenValidationEngine({
      reporting: { outputPath: './validation-reports' },
      driftDetection: { enabled: true, autoFix: false },
      validation: { strictMode: true },
      exitCodes: { violations: 3 },
      ...config
    });
    
    this.initialized = false;
  }

  async initialize() {
    await this.validationEngine.initialize();
    this.initialized = true;
    console.log('✅ KGEN Integrated Validation initialized');
  }

  /**
   * Validate provenance data with drift detection
   */
  async validateProvenance(provenanceData, options = {}) {
    if (!this.initialized) throw new Error('Not initialized');

    const provenanceShapes = `
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix kgen: <http://kgen.dev/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

kgen:ProvenanceShape a sh:NodeShape ;
    sh:targetClass prov:Activity ;
    sh:property [
        sh:path prov:startedAtTime ;
        sh:datatype xsd:dateTime ;
        sh:minCount 1 ;
        sh:message "Activity must have start time" ;
    ] ;
    sh:property [
        sh:path prov:endedAtTime ;
        sh:datatype xsd:dateTime ;
        sh:maxCount 1 ;
        sh:message "Activity may have end time" ;
    ] ;
    sh:property [
        sh:path prov:wasAssociatedWith ;
        sh:class prov:Agent ;
        sh:minCount 1 ;
        sh:message "Activity must be associated with an agent" ;
    ] .

kgen:EntityShape a sh:NodeShape ;
    sh:targetClass prov:Entity ;
    sh:property [
        sh:path prov:generatedAtTime ;
        sh:datatype xsd:dateTime ;
        sh:message "Entity should have generation time" ;
    ] .`;

    return await this.validationEngine.validateWithDriftDetection({
      dataGraph: provenanceData,
      shapesGraph: provenanceShapes,
      targetPath: options.targetPath,
      expectedData: options.expectedData,
      validationOptions: {
        checkOWLConstraints: true
      }
    });
  }

  /**
   * Validate blockchain anchor data
   */
  async validateBlockchainAnchor(anchorData, options = {}) {
    if (!this.initialized) throw new Error('Not initialized');

    const anchorShapes = `
@prefix kgen: <http://kgen.dev/> .
@prefix blockchain: <http://kgen.dev/blockchain/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

kgen:BlockchainAnchorShape a sh:NodeShape ;
    sh:targetClass blockchain:Anchor ;
    sh:property [
        sh:path blockchain:transactionHash ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:minLength 64 ;
        sh:maxLength 66 ;
        sh:message "Transaction hash must be valid" ;
    ] ;
    sh:property [
        sh:path blockchain:blockNumber ;
        sh:datatype xsd:integer ;
        sh:minCount 1 ;
        sh:minInclusive 0 ;
        sh:message "Block number must be positive" ;
    ] ;
    sh:property [
        sh:path blockchain:dataHash ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:message "Data hash must be present" ;
    ] .`;

    return await this.validationEngine.validateWithDriftDetection({
      dataGraph: anchorData,
      shapesGraph: anchorShapes,
      targetPath: options.targetPath,
      expectedData: options.expectedData
    });
  }

  /**
   * Validate SPARQL query results
   */
  async validateQueryResults(queryResults, schema, options = {}) {
    if (!this.initialized) throw new Error('Not initialized');

    // Convert SPARQL results to RDF for validation
    const rdfResults = this.sparqlResultsToRDF(queryResults);

    return await this.validationEngine.validateSHACL(rdfResults, schema, options);
  }

  /**
   * Validate storage compliance
   */
  async validateStorageCompliance(storageMetadata, complianceFramework = 'gdpr') {
    if (!this.initialized) throw new Error('Not initialized');

    // Load appropriate compliance shapes
    const shapesPath = path.join(
      process.cwd(), 
      'packages/kgen-core/src/validation/schemas/compliance-shapes.ttl'
    );
    
    const complianceShapes = await fs.readFile(shapesPath, 'utf8');

    return await this.validationEngine.validateSHACL(
      storageMetadata, 
      complianceShapes, 
      { 
        checkOWLConstraints: true,
        framework: complianceFramework
      }
    );
  }

  /**
   * Comprehensive KGEN system validation
   */
  async validateKGenSystem(systemData, options = {}) {
    if (!this.initialized) throw new Error('Not initialized');

    const results = {
      provenance: null,
      blockchain: null,
      storage: null,
      compliance: null,
      overall: {
        passed: false,
        totalViolations: 0,
        recommendations: []
      }
    };

    try {
      // Validate provenance data
      if (systemData.provenance) {
        results.provenance = await this.validateProvenance(
          systemData.provenance, 
          options.provenance || {}
        );
      }

      // Validate blockchain anchors
      if (systemData.blockchain) {
        results.blockchain = await this.validateBlockchainAnchor(
          systemData.blockchain, 
          options.blockchain || {}
        );
      }

      // Validate storage compliance
      if (systemData.storage) {
        results.storage = await this.validateStorageCompliance(
          systemData.storage,
          options.complianceFramework || 'gdpr'
        );
      }

      // Calculate overall results
      const allResults = [results.provenance, results.blockchain, results.storage]
        .filter(r => r !== null);
      
      results.overall.totalViolations = allResults.reduce(
        (sum, r) => sum + (r.summary?.totalViolations || r.totalViolations || 0), 
        0
      );

      results.overall.passed = results.overall.totalViolations === 0;

      // Generate recommendations
      if (!results.overall.passed) {
        results.overall.recommendations = this.generateSystemRecommendations(results);
      }

      return results;

    } catch (error) {
      throw new Error(`KGEN system validation failed: ${error.message}`);
    }
  }

  /**
   * Monitor continuous validation
   */
  async startContinuousValidation(options = {}) {
    const interval = options.interval || 60000; // 1 minute default
    const maxRuns = options.maxRuns || Infinity;
    let runCount = 0;

    console.log(`🔄 Starting continuous KGEN validation (interval: ${interval}ms)`);

    const validationTimer = setInterval(async () => {
      try {
        runCount++;
        console.log(`🔍 Validation run ${runCount}`);

        // Perform system validation
        const results = await this.validateKGenSystem(
          options.systemData || {},
          options.validationOptions || {}
        );

        // Log results
        if (results.overall.passed) {
          console.log(`✅ Validation run ${runCount}: PASSED`);
        } else {
          console.log(`❌ Validation run ${runCount}: FAILED (${results.overall.totalViolations} violations)`);
          
          // Trigger alerts if configured
          if (options.onFailure) {
            await options.onFailure(results);
          }
        }

        // Stop if max runs reached
        if (runCount >= maxRuns) {
          clearInterval(validationTimer);
          console.log('🛑 Continuous validation stopped (max runs reached)');
        }

      } catch (error) {
        console.error(`❌ Validation run ${runCount} failed:`, error.message);
        
        if (options.onError) {
          await options.onError(error);
        }
      }
    }, interval);

    return {
      stop: () => {
        clearInterval(validationTimer);
        console.log('🛑 Continuous validation stopped');
      },
      getRunCount: () => runCount
    };
  }

  /**
   * Helper methods
   */
  sparqlResultsToRDF(queryResults) {
    // Simple conversion for demonstration
    // In practice, this would be more sophisticated
    const triples = [];
    
    if (queryResults.results && queryResults.results.bindings) {
      queryResults.results.bindings.forEach((binding, index) => {
        const subject = `<http://kgen.dev/result/${index}>`;
        Object.keys(binding).forEach(variable => {
          const value = binding[variable];
          const predicate = `<http://kgen.dev/variable/${variable}>`;
          const object = value.type === 'uri' 
            ? `<${value.value}>` 
            : `"${value.value}"`;
          
          triples.push(`${subject} ${predicate} ${object} .`);
        });
      });
    }

    return `
@prefix kgen: <http://kgen.dev/> .
${triples.join('\n')}
    `;
  }

  generateSystemRecommendations(results) {
    const recommendations = [];

    if (results.provenance && !results.provenance.validation?.conforms) {
      recommendations.push({
        component: 'provenance',
        message: 'Review provenance data structure and ensure all activities have proper timestamps',
        priority: 'high'
      });
    }

    if (results.blockchain && !results.blockchain.validation?.conforms) {
      recommendations.push({
        component: 'blockchain',
        message: 'Verify blockchain anchor data integrity and transaction hashes',
        priority: 'high'
      });
    }

    if (results.storage && !results.storage.conforms) {
      recommendations.push({
        component: 'storage',
        message: 'Address storage compliance violations to meet regulatory requirements',
        priority: 'critical'
      });
    }

    return recommendations;
  }

  async shutdown() {
    if (this.validationEngine) {
      await this.validationEngine.shutdown();
    }
    console.log('🛑 KGEN Integrated Validation shutdown');
  }
}

/**
 * Example usage and demonstration
 */
async function demonstrateIntegration() {
  console.log('🚀 KGEN Validation Engine Integration Demo');
  console.log('=' .repeat(50));

  const validator = new KGenIntegratedValidation({
    reporting: { outputPath: './integration-reports' },
    driftDetection: { enabled: true, tolerance: 0.95 }
  });

  try {
    await validator.initialize();

    // Example provenance data
    const provenanceData = `
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix kgen: <http://kgen.dev/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

kgen:activity1 a prov:Activity ;
    prov:startedAtTime "2024-01-15T10:00:00Z"^^xsd:dateTime ;
    prov:endedAtTime "2024-01-15T10:30:00Z"^^xsd:dateTime ;
    prov:wasAssociatedWith kgen:agent1 .

kgen:agent1 a prov:Agent ;
    prov:type kgen:KGenSystem .

kgen:entity1 a prov:Entity ;
    prov:wasGeneratedBy kgen:activity1 ;
    prov:generatedAtTime "2024-01-15T10:30:00Z"^^xsd:dateTime .
    `;

    // Validate provenance
    console.log('\n🔍 Validating provenance data...');
    const provenanceResult = await validator.validateProvenance(provenanceData);
    console.log(`Provenance validation: ${provenanceResult.validation?.conforms ? '✅ PASSED' : '❌ FAILED'}`);

    // Example blockchain anchor data
    const blockchainData = `
@prefix blockchain: <http://kgen.dev/blockchain/> .
@prefix kgen: <http://kgen.dev/> .

kgen:anchor1 a blockchain:Anchor ;
    blockchain:transactionHash "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" ;
    blockchain:blockNumber 1234567 ;
    blockchain:dataHash "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" .
    `;

    // Validate blockchain anchor
    console.log('\n🔗 Validating blockchain anchor...');
    const blockchainResult = await validator.validateBlockchainAnchor(blockchainData);
    console.log(`Blockchain validation: ${blockchainResult.validation?.conforms ? '✅ PASSED' : '❌ FAILED'}`);

    // Example system validation
    console.log('\n🏗️ Performing comprehensive system validation...');
    const systemResults = await validator.validateKGenSystem({
      provenance: provenanceData,
      blockchain: blockchainData
    });

    console.log(`System validation: ${systemResults.overall.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Total violations: ${systemResults.overall.totalViolations}`);

    if (systemResults.overall.recommendations.length > 0) {
      console.log('\n📋 Recommendations:');
      systemResults.overall.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.component}] ${rec.message} (${rec.priority})`);
      });
    }

    await validator.shutdown();
    console.log('\n✅ Integration demo completed successfully!');

  } catch (error) {
    console.error('❌ Integration demo failed:', error.message);
    await validator.shutdown();
    process.exit(1);
  }
}

// Export for use in other modules
export default KGenIntegratedValidation;

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateIntegration().catch(error => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  });
}