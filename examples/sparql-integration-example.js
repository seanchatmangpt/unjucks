/**
 * KGEN SPARQL Integration Example
 * 
 * Example demonstrating how to use the KGEN SPARQL Query Engine
 * for template context extraction and RDF-based code generation.
 */

import KgenSparqlIntegration from '../src/sparql-integration.js';

async function runSparqlIntegrationExample() {
  console.log('🚀 KGEN SPARQL Integration Example\n');
  
  try {
    // Initialize the SPARQL integration system
    const integration = new KgenSparqlIntegration({
      sparql: {
        enableSPARQL: true,
        enableSemanticSearch: true,
        enableContextExtraction: true,
        queryTimeout: 30000
      },
      context: {
        enableHooks: true,
        extractionDepth: 3,
        maxContextSize: 50000
      },
      formatting: {
        defaultFormat: 'template-json',
        enableTemplateContext: true
      }
    });
    
    await integration.initialize();
    
    console.log('✅ SPARQL Integration initialized successfully\n');
    
    // Example 1: Execute a predefined template query
    console.log('📋 Example 1: Execute API Resource Context Template');
    console.log('─'.repeat(60));
    
    try {
      const apiResults = await integration.executeTemplate('api-resource-context', {
        resourceType: 'User',
        includeRelations: 'true'
      }, {
        extractContext: true,
        format: 'template-json'
      });
      
      console.log(`   ✅ Template executed successfully`);
      console.log(`   📊 Results: ${apiResults.results?.bindings?.length || 0} bindings`);
      
      if (apiResults.templateContext) {
        console.log(`   🎨 Context: ${apiResults.templateContext.entities?.length || 0} entities extracted`);
      }
      
    } catch (error) {
      console.log(`   ❌ Template execution failed: ${error.message}`);
    }
    
    console.log('');
    
    // Example 2: Extract template context for a custom template
    console.log('📋 Example 2: Extract Template Context');
    console.log('─'.repeat(60));
    
    const templateInfo = {
      id: 'user-crud-controller',
      name: 'User CRUD Controller',
      type: 'controller',
      resourceType: 'User',
      uri: 'http://kgen.enterprise/templates/user-crud'
    };
    
    try {
      const contextWorkflow = await integration.executeWorkflow('context-extraction', {
        templateInfo,
        depth: 2,
        maxEntities: 50
      });
      
      console.log(`   ✅ Context extraction completed`);
      console.log(`   ⏱️  Execution time: ${contextWorkflow.executionTime}ms`);
      
      const context = contextWorkflow.result;
      if (context.entities) {
        console.log(`   🎯 Entities: ${context.entities.length}`);
        console.log(`   🔗 Relationships: ${context.relationships?.length || 0}`);
        console.log(`   📝 Variables: ${Object.keys(context.variables || {}).length}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Context extraction failed: ${error.message}`);
    }
    
    console.log('');
    
    // Example 3: Impact Analysis
    console.log('📋 Example 3: Impact Analysis');
    console.log('─'.repeat(60));
    
    try {
      const changes = [
        {
          entityUri: 'http://kgen.enterprise/entities/User',
          changeType: 'property_added',
          property: 'email_verified'
        }
      ];
      
      const impactWorkflow = await integration.executeWorkflow('impact-analysis', {
        changes,
        context: { domain: 'user-management' }
      }, {
        analysisDepth: 3
      });
      
      console.log(`   ✅ Impact analysis completed`);
      console.log(`   ⏱️  Execution time: ${impactWorkflow.executionTime}ms`);
      
      const impact = impactWorkflow.result;
      console.log(`   📊 Overall severity: ${impact.overall?.severity || 'unknown'}`);
      console.log(`   🎯 Affected entities: ${impact.overall?.totalAffectedEntities || 0}`);
      
      if (impact.recommendations?.length > 0) {
        console.log(`   💡 Recommendations: ${impact.recommendations.length}`);
        for (const rec of impact.recommendations.slice(0, 2)) {
          console.log(`      • ${rec.message}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Impact analysis failed: ${error.message}`);
    }
    
    console.log('');
    
    // Example 4: Custom Template Registration
    console.log('📋 Example 4: Register Custom Template');
    console.log('─'.repeat(60));
    
    const customTemplate = {
      name: 'custom-entity-validator',
      description: 'Validate entity properties against schema constraints',
      category: 'validation',
      complexity: 'medium',
      estimatedCost: 300,
      parameters: [
        {
          name: 'entityType',
          type: 'literal',
          required: true,
          description: 'Type of entity to validate',
          example: 'User'
        }
      ],
      sparql: `
        PREFIX kgen: <http://kgen.enterprise/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?entity ?property ?constraint ?violation WHERE {
          ?entity a kgen:{{entityType}} .
          ?entity ?property ?value .
          ?constraint kgen:appliesTo kgen:{{entityType}} .
          ?constraint kgen:property ?property .
          ?constraint kgen:validationRule ?rule .
          
          # Check for violations (simplified)
          FILTER(!kgen:validates(?value, ?rule))
          BIND("constraint_violation" AS ?violation)
        }
        ORDER BY ?entity
        LIMIT 100
      `
    };
    
    try {
      integration.registerTemplate(customTemplate);
      console.log(`   ✅ Custom template registered: ${customTemplate.name}`);
      
      // Try to execute the custom template
      const customResults = await integration.executeTemplate('custom-entity-validator', {
        entityType: 'User'
      });
      
      console.log(`   🎯 Custom template executed successfully`);
      console.log(`   📊 Results: ${customResults.results?.bindings?.length || 0} bindings`);
      
    } catch (error) {
      console.log(`   ❌ Custom template registration/execution failed: ${error.message}`);
    }
    
    console.log('');
    
    // Example 5: System Status
    console.log('📋 Example 5: System Status');
    console.log('─'.repeat(60));
    
    const status = integration.getIntegrationStatus();
    
    console.log(`   🔧 Integration State: ${status.integration.state}`);
    console.log(`   📊 Total Operations: ${status.integration.metrics.totalOperations}`);
    console.log(`   ✅ Successful: ${status.integration.metrics.successfulOperations}`);
    console.log(`   ❌ Failed: ${status.integration.metrics.failedOperations}`);
    console.log(`   ⏱️  Average Time: ${status.integration.metrics.averageOperationTime.toFixed(1)}ms`);
    
    if (status.components.sparqlEngine) {
      console.log(`   🔍 SPARQL Queries: ${status.components.sparqlEngine.metrics.totalQueries}`);
      console.log(`   💾 Cache Hits: ${status.components.sparqlEngine.metrics.cacheHits}`);
    }
    
    if (status.components.templates) {
      console.log(`   📝 Templates: ${status.components.templates.totalTemplates}`);
      console.log(`   🏷️  Categories: ${status.components.templates.categories.length}`);
    }
    
    console.log('');
    
    // Cleanup
    console.log('🛑 Shutting down integration...');
    await integration.shutdown();
    console.log('✅ Shutdown completed\n');
    
    console.log('🎉 SPARQL Integration example completed successfully!');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSparqlIntegrationExample().catch(console.error);
}

export { runSparqlIntegrationExample };
export default runSparqlIntegrationExample;