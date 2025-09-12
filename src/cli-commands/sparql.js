/**
 * KGEN SPARQL CLI Commands
 * 
 * Command-line interface for SPARQL query execution, context extraction,
 * and template integration in the KGEN system.
 */

import { createRequire } from 'module';
import KgenSparqlEngine from '../sparql-engine.js';
import KgenQueryTemplates from '../query-templates.js';
import KgenResultFormatter from '../result-formatter.js';
import KgenContextHooks from '../context-hooks.js';

const require = createRequire(import.meta.url);

export const sparqlCommands = {
  /**
   * Execute raw SPARQL query
   */
  async execute(query, options = {}) {
    try {
      console.log('🔍 Executing SPARQL query...\n');
      
      // Initialize SPARQL engine
      const engine = new KgenSparqlEngine(options.engineConfig);
      await engine.initialize(options);
      
      // Execute query
      const results = await engine.executeQuery(query, {
        extractContext: options.extractContext || false,
        format: options.format || 'json',
        maxResults: options.limit || 1000
      });
      
      // Format and display results
      const formatter = new KgenResultFormatter();
      const formatted = await formatter.formatResults(results, options.format || 'json', {
        pretty: options.pretty !== false
      });
      
      if (options.output) {
        const fs = require('fs');
        fs.writeFileSync(options.output, formatted);
        console.log(`✅ Results saved to ${options.output}`);
      } else {
        console.log(formatted);
      }
      
      // Display execution metadata
      if (options.verbose && results.metadata) {
        console.log('\n📊 Execution Metadata:');
        console.log(`   Query ID: ${results.metadata.queryId}`);
        console.log(`   Execution Time: ${results.metadata.executionTime}ms`);
        console.log(`   Result Count: ${results.metadata.resultCount}`);
        console.log(`   From Cache: ${results.metadata.fromCache ? 'Yes' : 'No'}`);
      }
      
      return results;
      
    } catch (error) {
      console.error('❌ SPARQL execution failed:', error.message);
      if (options.verbose) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    }
  },

  /**
   * Execute predefined query template
   */
  async template(templateName, parameters = {}, options = {}) {
    try {
      console.log(`🎯 Executing template: ${templateName}\n`);
      
      // Initialize components
      const engine = new KgenSparqlEngine(options.engineConfig);
      await engine.initialize(options);
      
      // Execute template
      const results = await engine.executeTemplate(templateName, parameters, {
        extractContext: options.extractContext !== false,
        format: options.format || 'template-json',
        maxResults: options.limit || 1000
      });
      
      // Format results
      const formatter = new KgenResultFormatter();
      const formatted = await formatter.formatResults(results, options.format || 'template-json', {
        pretty: options.pretty !== false
      });
      
      if (options.output) {
        const fs = require('fs');
        fs.writeFileSync(options.output, formatted);
        console.log(`✅ Results saved to ${options.output}`);
      } else {
        console.log(formatted);
      }
      
      // Display template context if extracted
      if (results.templateContext && options.verbose) {
        console.log('\n🎨 Template Context:');
        console.log(`   Entities: ${results.templateContext.entities?.length || 0}`);
        console.log(`   Properties: ${results.templateContext.properties?.size || 0}`);
        console.log(`   Patterns: ${results.templateContext.patterns?.length || 0}`);
      }
      
      return results;
      
    } catch (error) {
      console.error(`❌ Template execution failed: ${error.message}`);
      if (options.verbose) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    }
  },

  /**
   * List available query templates
   */
  async listTemplates(options = {}) {
    try {
      const templates = new KgenQueryTemplates();
      const allTemplates = templates.getAllTemplates();
      
      console.log(`📋 Available Query Templates (${allTemplates.length} total)\n`);
      
      // Group by category
      const byCategory = allTemplates.reduce((groups, template) => {
        const category = template.category || 'uncategorized';
        if (!groups[category]) groups[category] = [];
        groups[category].push(template);
        return groups;
      }, {});
      
      for (const [category, categoryTemplates] of Object.entries(byCategory)) {
        console.log(`\n📂 ${category.toUpperCase()}`);
        console.log('─'.repeat(50));
        
        for (const template of categoryTemplates) {
          console.log(`  🔸 ${template.name}`);
          console.log(`     ${template.description}`);
          console.log(`     Complexity: ${template.complexity} | Cost: ${template.estimatedCost}`);
          
          if (options.verbose && template.parameters.length > 0) {
            console.log('     Parameters:');
            for (const param of template.parameters) {
              const required = param.required ? '(required)' : '(optional)';
              console.log(`       - ${param.name} ${required}: ${param.description}`);
            }
          }
          console.log('');
        }
      }
      
      return allTemplates;
      
    } catch (error) {
      console.error('❌ Failed to list templates:', error.message);
      process.exit(1);
    }
  },

  /**
   * Get template details and examples
   */
  async templateInfo(templateName, options = {}) {
    try {
      const templates = new KgenQueryTemplates();
      const template = templates.getTemplate(templateName);
      
      if (!template) {
        console.error(`❌ Template not found: ${templateName}`);
        process.exit(1);
      }
      
      console.log(`📄 Template: ${template.name}\n`);
      console.log(`Description: ${template.description}`);
      console.log(`Category: ${template.category}`);
      console.log(`Complexity: ${template.complexity}`);
      console.log(`Estimated Cost: ${template.estimatedCost}`);
      
      if (template.optimizations && template.optimizations.length > 0) {
        console.log(`Optimizations: ${template.optimizations.join(', ')}`);
      }
      
      console.log('\n📝 Parameters:');
      for (const param of template.parameters) {
        const required = param.required ? '(required)' : '(optional)';
        console.log(`  • ${param.name} ${required}`);
        console.log(`    Type: ${param.type}`);
        console.log(`    Description: ${param.description}`);
        console.log(`    Example: ${param.example}`);
        if (param.validation) {
          console.log(`    Validation: ${param.validation.toString()}`);
        }
        console.log('');
      }
      
      if (template.examples && template.examples.length > 0) {
        console.log('🎯 Examples:');
        for (const example of template.examples) {
          console.log(`  Example: ${example.description}`);
          console.log('  Parameters:');
          for (const [param, value] of Object.entries(example.parameters)) {
            console.log(`    ${param}: ${value}`);
          }
          console.log(`  Expected Results: ${example.expectedResults}`);
          console.log('');
        }
      }
      
      if (options.showQuery) {
        console.log('🔍 SPARQL Query:');
        console.log('```sparql');
        console.log(template.sparql);
        console.log('```');
      }
      
      return template;
      
    } catch (error) {
      console.error('❌ Failed to get template info:', error.message);
      process.exit(1);
    }
  },

  /**
   * Extract context for template rendering
   */
  async extractContext(templateInfo, options = {}) {
    try {
      console.log(`🎨 Extracting context for template: ${templateInfo.name || templateInfo.id}\n`);
      
      // Initialize context hooks
      const hooks = new KgenContextHooks(options.hooksConfig);
      await hooks.initialize(options);
      
      // Extract context
      const context = await hooks.extractTemplateContext(templateInfo, {
        extractionDepth: options.depth || 3,
        maxContextEntities: options.maxEntities || 100,
        enableValidation: options.validate !== false
      });
      
      // Format context
      const formatter = new KgenResultFormatter();
      const formatted = await formatter.formatResults(
        { templateContext: context }, 
        'template-context',
        { pretty: options.pretty !== false }
      );
      
      if (options.output) {
        const fs = require('fs');
        fs.writeFileSync(options.output, formatted);
        console.log(`✅ Context saved to ${options.output}`);
      } else {
        console.log(formatted);
      }
      
      // Display extraction summary
      if (options.verbose) {
        console.log('\n📊 Context Summary:');
        console.log(`   Entities: ${context.entities?.length || 0}`);
        console.log(`   Properties: ${Object.keys(context.properties || {}).length}`);
        console.log(`   Relationships: ${context.relationships?.length || 0}`);
        console.log(`   Patterns: ${context.patterns?.length || 0}`);
        console.log(`   Variables: ${Object.keys(context.variables || {}).length}`);
        console.log(`   Extraction Time: ${context.metadata?.extractionTime || 0}ms`);
      }
      
      return context;
      
    } catch (error) {
      console.error('❌ Context extraction failed:', error.message);
      if (options.verbose) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    }
  },

  /**
   * Analyze impact of changes
   */
  async analyzeImpact(entityUri, options = {}) {
    try {
      console.log(`🔍 Analyzing impact for entity: ${entityUri}\n`);
      
      // Initialize SPARQL engine
      const engine = new KgenSparqlEngine(options.engineConfig);
      await engine.initialize(options);
      
      // Perform impact analysis
      const results = await engine.analyzeImpact(entityUri, options.depth || 3);
      
      console.log('📊 Impact Analysis Results:');
      console.log(`   Total affected entities: ${results.results.bindings.length}`);
      
      // Group by impact level
      const byLevel = results.results.bindings.reduce((groups, binding) => {
        const level = binding.impactLevel?.value || 'unknown';
        if (!groups[level]) groups[level] = [];
        groups[level].push(binding);
        return groups;
      }, {});
      
      for (const [level, bindings] of Object.entries(byLevel)) {
        console.log(`\n   ${level.toUpperCase()} Impact (${bindings.length} entities):`);
        for (const binding of bindings.slice(0, options.limit || 10)) {
          console.log(`     • ${binding.entity?.value || 'Unknown'}`);
          if (binding.relationship?.value) {
            console.log(`       Relationship: ${binding.relationship.value}`);
          }
          if (binding.timestamp?.value) {
            console.log(`       Last Modified: ${binding.timestamp.value}`);
          }
        }
      }
      
      // Save detailed results if requested
      if (options.output) {
        const formatter = new KgenResultFormatter();
        const formatted = await formatter.formatResults(results, options.format || 'json', {
          pretty: options.pretty !== false
        });
        
        const fs = require('fs');
        fs.writeFileSync(options.output, formatted);
        console.log(`\n✅ Detailed results saved to ${options.output}`);
      }
      
      return results;
      
    } catch (error) {
      console.error('❌ Impact analysis failed:', error.message);
      if (options.verbose) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    }
  },

  /**
   * Trace provenance of entities
   */
  async traceProvenance(entityUri, options = {}) {
    try {
      console.log(`🔗 Tracing provenance for entity: ${entityUri}\n`);
      
      // Initialize SPARQL engine
      const engine = new KgenSparqlEngine(options.engineConfig);
      await engine.initialize(options);
      
      // Trace provenance
      const direction = options.direction || 'both';
      const depth = options.depth || 5;
      const results = await engine.traceProvenance(entityUri, direction, depth);
      
      console.log('🔗 Provenance Trace Results:');
      console.log(`   Direction: ${direction}`);
      console.log(`   Depth: ${depth}`);
      console.log(`   Total lineage entities: ${results.results.bindings.length}`);
      
      // Group by direction if bidirectional
      if (direction === 'both') {
        const byDirection = results.results.bindings.reduce((groups, binding) => {
          const dir = binding.direction?.value || 'unknown';
          if (!groups[dir]) groups[dir] = [];
          groups[dir].push(binding);
          return groups;
        }, {});
        
        for (const [dir, bindings] of Object.entries(byDirection)) {
          console.log(`\n   ${dir.toUpperCase()} Lineage (${bindings.length} entities):`);
          
          // Sort by timestamp if available
          const sorted = bindings.sort((a, b) => {
            const timeA = new Date(a.timestamp?.value || 0);
            const timeB = new Date(b.timestamp?.value || 0);
            return timeB - timeA;
          });
          
          for (const binding of sorted.slice(0, options.limit || 10)) {
            console.log(`     • ${binding.relatedEntity?.value || binding.entity?.value || 'Unknown'}`);
            if (binding.activity?.value) {
              console.log(`       Activity: ${binding.activity.value}`);
            }
            if (binding.agent?.value) {
              console.log(`       Agent: ${binding.agent.value}`);
            }
            if (binding.timestamp?.value) {
              console.log(`       Timestamp: ${binding.timestamp.value}`);
            }
            console.log('');
          }
        }
      } else {
        // Single direction display
        const sorted = results.results.bindings.sort((a, b) => {
          const timeA = new Date(a.timestamp?.value || 0);
          const timeB = new Date(b.timestamp?.value || 0);
          return timeB - timeA;
        });
        
        for (const binding of sorted.slice(0, options.limit || 20)) {
          console.log(`   • ${binding.sourceEntity?.value || binding.derivedEntity?.value || 'Unknown'}`);
          if (binding.activity?.value) {
            console.log(`     Activity: ${binding.activity.value}`);
          }
          if (binding.agent?.value) {
            console.log(`     Agent: ${binding.agent.value}`);
          }
          if (binding.timestamp?.value) {
            console.log(`     Timestamp: ${binding.timestamp.value}`);
          }
          console.log('');
        }
      }
      
      // Save detailed results if requested
      if (options.output) {
        const formatter = new KgenResultFormatter();
        const formatted = await formatter.formatResults(results, options.format || 'json', {
          pretty: options.pretty !== false
        });
        
        const fs = require('fs');
        fs.writeFileSync(options.output, formatted);
        console.log(`✅ Detailed provenance saved to ${options.output}`);
      }
      
      return results;
      
    } catch (error) {
      console.error('❌ Provenance tracing failed:', error.message);
      if (options.verbose) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    }
  },

  /**
   * Validate rules against RDF data
   */
  async validateRules(ruleSetFile, options = {}) {
    try {
      console.log(`✅ Validating rules from: ${ruleSetFile}\n`);
      
      // Load rule set
      const fs = require('fs');
      const ruleSetData = fs.readFileSync(ruleSetFile, 'utf8');
      const ruleSet = JSON.parse(ruleSetData);
      
      // Initialize SPARQL engine
      const engine = new KgenSparqlEngine(options.engineConfig);
      await engine.initialize(options);
      
      // Execute validation
      const results = await engine.validateRules(ruleSet, options.targetEntities || []);
      
      console.log('📋 Validation Results:');
      console.log(`   Rule Set: ${results.ruleSet}`);
      console.log(`   Total Rules: ${results.totalRules}`);
      console.log(`   Passed: ${results.passed}`);
      console.log(`   Failed: ${results.failed}`);
      console.log(`   Success Rate: ${((results.passed / results.totalRules) * 100).toFixed(1)}%`);
      
      console.log('\n📊 Rule Details:');
      for (const result of results.results) {
        const status = result.passed ? '✅' : '❌';
        console.log(`   ${status} ${result.rule}`);
        console.log(`      ${result.details}`);
        
        if (!result.passed && result.error) {
          console.log(`      Error: ${result.error}`);
        }
        
        if (options.verbose && result.results) {
          console.log(`      Results: ${result.results.length} items`);
        }
        console.log('');
      }
      
      // Save detailed results if requested
      if (options.output) {
        const fs = require('fs');
        fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
        console.log(`✅ Validation results saved to ${options.output}`);
      }
      
      // Exit with error code if any rules failed
      if (results.failed > 0 && options.exitOnError !== false) {
        console.error(`\n❌ ${results.failed} validation rules failed`);
        process.exit(1);
      }
      
      return results;
      
    } catch (error) {
      console.error('❌ Rule validation failed:', error.message);
      if (options.verbose) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    }
  },

  /**
   * Get SPARQL engine status
   */
  async status(options = {}) {
    try {
      const engine = new KgenSparqlEngine(options.engineConfig);
      await engine.initialize(options);
      
      const status = engine.getStatus();
      
      console.log('🔧 SPARQL Engine Status:');
      console.log(`   State: ${status.state}`);
      console.log(`   Active Queries: ${status.activeQueries}`);
      console.log(`   Cached Queries: ${status.cachedQueries}`);
      console.log(`   Query Templates: ${status.templates}`);
      console.log(`   RDF Triples: ${status.triples}`);
      
      console.log('\n📊 Metrics:');
      console.log(`   Total Queries: ${status.metrics.totalQueries}`);
      console.log(`   Successful: ${status.metrics.successfulQueries}`);
      console.log(`   Failed: ${status.metrics.failedQueries}`);
      console.log(`   Average Execution Time: ${status.metrics.averageExecutionTime}ms`);
      console.log(`   Cache Hit Rate: ${((status.metrics.cacheHits / (status.metrics.cacheHits + status.metrics.cacheMisses)) * 100 || 0).toFixed(1)}%`);
      console.log(`   Context Extractions: ${status.metrics.contextExtractions}`);
      
      console.log('\n⚙️  Configuration:');
      console.log(`   SPARQL Enabled: ${status.config.enableSPARQL ? 'Yes' : 'No'}`);
      console.log(`   Semantic Search: ${status.config.enableSemanticSearch ? 'Yes' : 'No'}`);
      console.log(`   Optimization: ${status.config.enableOptimization ? 'Yes' : 'No'}`);
      console.log(`   Context Extraction: ${status.config.enableContextExtraction ? 'Yes' : 'No'}`);
      
      return status;
      
    } catch (error) {
      console.error('❌ Failed to get status:', error.message);
      process.exit(1);
    }
  }
};

export default sparqlCommands;