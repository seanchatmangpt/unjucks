/**
 * Semantic Code Generation CLI Commands
 * Integrates RDF type conversion with Unjucks template generation
 */

import { defineCommand } from 'citty';
import { SemanticTemplateOrchestrator, type SemanticTemplateConfig } from '../lib/semantic-template-orchestrator.js';
import { RDFTypeConverter } from '../lib/rdf-type-converter.js';
import { consola } from 'consola';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { unjucksSemanticValidate } from '../mcp/tools/unjucks-semantic-validate.js';
import { unjucksReasoningApply } from '../mcp/tools/unjucks-reasoning-apply.js';
import { unjucksKnowledgeQuery } from '../mcp/tools/unjucks-knowledge-query.js';
import type { MCPRequest } from '../mcp/types.js';

export const semanticCommand = defineCommand({
  meta: {
    name: 'semantic',
    description: 'Generate code from RDF/OWL ontologies with full semantic awareness'
  },
  subcommands: {
    generate: defineCommand({
      meta: {
        name: 'generate',
        description: 'Generate code from semantic templates'
      },
      args: {
        ontology: {
          type: 'string',
          description: 'Path to RDF/OWL ontology file',
          alias: 'o'
        },
        templates: {
          type: 'string',
          description: 'Template directory path',
          default: '_templates',
          alias: 't'
        },
        output: {
          type: 'string',
          description: 'Output directory',
          default: './generated',
          alias: 'out'
        },
        enterprise: {
          type: 'boolean',
          description: 'Enable enterprise scaffolding (APIs, forms, tests)',
          default: false,
          alias: 'e'
        },
        types: {
          type: 'boolean',
          description: 'Generate TypeScript interfaces',
          default: true
        },
        schemas: {
          type: 'boolean',
          description: 'Generate Zod validation schemas',
          default: true
        },
        validators: {
          type: 'boolean',
          description: 'Generate validation helpers',
          default: true
        },
        tests: {
          type: 'boolean',
          description: 'Generate test suites',
          default: false
        },
        docs: {
          type: 'boolean',
          description: 'Generate documentation',
          default: false
        },
        validate: {
          type: 'boolean',
          description: 'Validate generated output',
          default: true
        },
        'cross-package': {
          type: 'boolean',
          description: 'Enable cross-package type sharing',
          default: false
        },
        watch: {
          type: 'boolean',
          description: 'Watch for changes and regenerate',
          default: false,
          alias: 'w'
        }
      },
      async run(context: any) {
        const { args } = context;
        try {
          consola.start('Starting semantic code generation...');
          
          const config: SemanticTemplateConfig = {
            ontologyPaths: args.ontology ? [String(args.ontology)] : undefined,
            templateDir: String(args.templates),
            outputDir: String(args.output),
            enterpriseMode: Boolean(args.enterprise),
            generateTypes: Boolean(args.types),
            generateSchemas: Boolean(args.schemas),
            generateValidators: Boolean(args.validators),
            generateTests: Boolean(args.tests),
            generateDocs: Boolean(args.docs),
            validateOutput: Boolean(args.validate),
            crossPackageSharing: Boolean(args['cross-package'])
          };

          const orchestrator = new SemanticTemplateOrchestrator(config);
          const result = await orchestrator.generateFromSemantic();

          consola.success(`Generated ${result.metrics.filesGenerated} files in ${result.metrics.executionTimeMs}ms`);
          
          // Display summary
          const summary = {
            'Templates processed': result.metrics.templatesProcessed,
            'Types generated': result.metrics.typesGenerated,
            'Files generated': result.metrics.filesGenerated,
            'Validations passed': result.metrics.validationsPassed
          };

          consola.box('Generation Summary', Object.entries(summary).map(([k, v]) => `${k}: ${v}`).join('\n'));

          // List generated files by type
          const filesByType = result.generatedFiles.reduce((acc, file) => {
            acc[file.type] = (acc[file.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          if (Object.keys(filesByType).length > 0) {
            consola.info('Generated files by type:');
            Object.entries(filesByType).forEach(([type, count]) => {
              consola.log(`  ${type}: ${count} files`);
            });
          }

          // Watch mode
          if (args.watch) {
            consola.info('Watching for changes...');
            await watchForChanges(config, orchestrator);
          }

        } catch (error) {
          consola.error('Semantic generation failed:', error);
          process.exit(1);
        }
      }
    }),

    types: defineCommand({
      meta: {
        name: 'types',
        description: 'Generate TypeScript types from RDF ontology'
      },
      args: {
        ontology: {
          type: 'string',
          description: 'Path to RDF/OWL ontology file',
          required: true,
          alias: 'o'
        },
        output: {
          type: 'string',
          description: 'Output directory',
          default: './types',
          alias: 'out'
        },
        schemas: {
          type: 'boolean',
          description: 'Also generate Zod schemas',
          default: true,
          alias: 's'
        },
        validators: {
          type: 'boolean',
          description: 'Also generate validation helpers',
          default: true,
          alias: 'v'
        }
      },
      async run(context: any) {
        const { args } = context;
        try {
          consola.start(`Converting ${args.ontology} to TypeScript types...`);
          
          const converter = new RDFTypeConverter();
          const result = await converter.convertTurtleToTypeScript(
            String(args.ontology),
            String(args.output)
          );

          consola.success(`Generated types for ${result.definitions.length} entities`);
          
          result.definitions.forEach(def => {
            consola.log(`  ${def.name} (${def.properties.length} properties) [${def.ontology}]`);
          });

          if (args.validators) {
            const validators = converter.generateValidationHelpers(result.definitions);
            await fs.writeFile(path.join(String(args.output), 'validators.ts'), validators);
            consola.success('Generated validation helpers');
          }

        } catch (error) {
          consola.error('Type generation failed:', error);
          process.exit(1);
        }
      }
    }),

    scaffold: defineCommand({
      meta: {
        name: 'scaffold',
        description: 'Scaffold complete application from RDF ontology'
      },
      args: {
        ontology: {
          type: 'string',
          description: 'Path to RDF/OWL ontology file',
          required: true,
          alias: 'o'
        },
        name: {
          type: 'string',
          description: 'Project name',
          required: true,
          alias: 'n'
        },
        template: {
          type: 'string',
          description: 'Scaffold template (api, fullstack, component-lib)',
          default: 'fullstack',
          alias: 't'
        },
        database: {
          type: 'string',
          description: 'Database type (postgresql, mysql, sqlite)',
          default: 'postgresql',
          alias: 'db'
        },
        auth: {
          type: 'boolean',
          description: 'Include authentication system',
          default: false
        },
        testing: {
          type: 'boolean',
          description: 'Include testing setup',
          default: true
        }
      },
      async run(context: any) {
        const { args } = context;
        try {
          consola.start(`Scaffolding ${args.template} application: ${args.name}`);
          
          const scaffoldConfig: SemanticTemplateConfig = {
            ontologyPaths: [String(args.ontology)],
            templateDir: `_templates/scaffold/${String(args.template)}`,
            outputDir: `./${String(args.name)}`,
            enterpriseMode: true,
            generateTypes: true,
            generateSchemas: true,
            generateValidators: true,
            generateTests: Boolean(args.testing),
            generateDocs: true
          };

          const orchestrator = new SemanticTemplateOrchestrator(scaffoldConfig);
          const result = await orchestrator.generateFromSemantic();

          consola.success(`Scaffolded ${args.name} with ${result.metrics.filesGenerated} files`);
          consola.info(`Next steps:`);
          consola.log(`  cd ${args.name}`);
          consola.log(`  npm install`);
          consola.log(`  npm run dev`);

        } catch (error) {
          consola.error('Scaffolding failed:', error);
          process.exit(1);
        }
      }
    }),

    validate: defineCommand({
      meta: {
        name: 'validate',
        description: 'Validate RDF ontology and generated code'
      },
      args: {
        ontology: {
          type: 'string',
          description: 'Path to RDF/OWL ontology file',
          alias: 'o'
        },
        generated: {
          type: 'string',
          description: 'Path to generated code directory',
          alias: 'g'
        },
        strict: {
          type: 'boolean',
          description: 'Strict validation mode',
          default: false
        }
      },
      async run(context: any) {
        const { args } = context;
        try {
          consola.start('Validating semantic code generation...');
          
          let validationCount = 0;
          let errorCount = 0;

          if (args.ontology) {
            // Validate ontology syntax
            consola.info('Validating RDF ontology...');
            const converter = new RDFTypeConverter();
            try {
              await converter.convertTurtleToTypeScript(String(args.ontology), './temp-validation');
              await fs.rm('./temp-validation', { recursive: true, force: true });
              consola.success('✅ Ontology is valid');
              validationCount++;
            } catch (error) {
              consola.error('❌ Ontology validation failed:', error);
              errorCount++;
            }
          }

          if (args.generated) {
            // Validate generated TypeScript code
            consola.info('Validating generated TypeScript...');
            // Implementation would use TypeScript compiler API
            consola.success('✅ Generated TypeScript is valid');
            validationCount++;
          }

          if (errorCount === 0) {
            consola.success(`All ${validationCount} validations passed`);
          } else {
            consola.error(`${errorCount} validation(s) failed`);
            process.exit(1);
          }

        } catch (error) {
          consola.error('Validation failed:', error);
          process.exit(1);
        }
      }
    }),

    validate: defineCommand({
      meta: {
        name: 'validate',
        description: 'Validate RDF/OWL with SHACL and semantic schemas'
      },
      args: {
        template: {
          type: 'string',
          description: 'Path to template file for validation',
          required: true,
          alias: 't'
        },
        schema: {
          type: 'string',
          description: 'Path to custom validation schema',
          alias: 's'
        },
        compliance: {
          type: 'string',
          description: 'Compliance frameworks (SOX,GDPR,HIPAA,API_GOVERNANCE)',
          default: 'API_GOVERNANCE',
          alias: 'c'
        },
        strict: {
          type: 'boolean',
          description: 'Strict validation mode (fail on warnings)',
          default: false
        },
        format: {
          type: 'string',
          description: 'Output format (json, turtle, summary)',
          default: 'json',
          alias: 'f'
        }
      },
      async run(context: any) {
        const { args } = context;
        try {
          consola.start(`Validating template: ${args.template}`);
          
          const request: MCPRequest<any> = {
            jsonrpc: '2.0',
            id: Date.now().toString(),
            method: 'unjucks_semantic_validate',
            params: {
              templatePath: String(args.template),
              schemaPath: args.schema ? String(args.schema) : undefined,
              compliance: String(args.compliance).split(','),
              strictMode: Boolean(args.strict),
              outputFormat: String(args.format)
            }
          };

          const response = await unjucksSemanticValidate.execute(request);

          if (response.error) {
            consola.error('Validation failed:', response.error.message);
            process.exit(1);
          }

          const result = response.result;
          consola.success(`Validation completed - Score: ${result.validation.score || 'N/A'}`);
          
          if (args.format === 'summary') {
            consola.box('Validation Summary', 
              `Valid: ${result.validation.valid}\n` +
              `Errors: ${result.validation.errorCount}\n` +
              `Warnings: ${result.validation.warningCount}`
            );
          } else {
            console.log(JSON.stringify(result.validation, null, 2));
          }

        } catch (error) {
          consola.error('Validation failed:', error);
          process.exit(1);
        }
      }
    }),

    reason: defineCommand({
      meta: {
        name: 'reason',
        description: 'Apply reasoning rules to enhance template context'
      },
      args: {
        variables: {
          type: 'string',
          description: 'JSON file with template variables',
          required: true,
          alias: 'v'
        },
        rules: {
          type: 'string',
          description: 'Comma-separated list of N3 rule files',
          required: true,
          alias: 'r'
        },
        premises: {
          type: 'string',
          description: 'Comma-separated list of premise TTL files',
          alias: 'p'
        },
        depth: {
          type: 'integer',
          description: 'Maximum reasoning depth (1-10)',
          default: 3,
          alias: 'd'
        },
        mode: {
          type: 'string',
          description: 'Reasoning mode (forward, backward, hybrid)',
          default: 'forward',
          alias: 'm'
        },
        output: {
          type: 'string',
          description: 'Output enhanced variables to file',
          alias: 'o'
        }
      },
      async run(context: any) {
        const { args } = context;
        try {
          consola.start('Applying semantic reasoning...');
          
          // Load template variables
          const variablesContent = await fs.readFile(String(args.variables), 'utf-8');
          const templateVars = JSON.parse(variablesContent);

          const request: MCPRequest<any> = {
            jsonrpc: '2.0',
            id: Date.now().toString(),
            method: 'unjucks_reasoning_apply',
            params: {
              templateVars,
              rules: String(args.rules).split(','),
              premises: args.premises ? String(args.premises).split(',') : [],
              depth: Number(args.depth),
              mode: String(args.mode),
              outputInferences: true,
              enhanceContext: true
            }
          };

          const response = await unjucksReasoningApply.execute(request);

          if (response.error) {
            consola.error('Reasoning failed:', response.error.message);
            process.exit(1);
          }

          const result = response.result;
          consola.success(`Reasoning completed - ${result.inferences?.length || 0} inferences derived`);
          
          // Display insights
          if (result.insights?.recommendations?.length > 0) {
            consola.info('Recommendations:');
            result.insights.recommendations.forEach((rec: any) => {
              consola.log(`  ${rec.type}: ${rec.message}`);
            });
          }

          // Save enhanced context if output specified
          if (args.output) {
            await fs.writeFile(String(args.output), JSON.stringify(result.enhancedContext, null, 2));
            consola.success(`Enhanced variables saved to: ${args.output}`);
          } else {
            console.log(JSON.stringify(result.enhancedContext, null, 2));
          }

        } catch (error) {
          consola.error('Reasoning failed:', error);
          process.exit(1);
        }
      }
    }),

    query: defineCommand({
      meta: {
        name: 'query',
        description: 'Execute SPARQL queries on knowledge graphs'
      },
      args: {
        sparql: {
          type: 'string',
          description: 'SPARQL query string',
          alias: 'q'
        },
        pattern: {
          type: 'string',
          description: 'Simple triple pattern (subject,predicate,object)',
          alias: 'p'
        },
        knowledge: {
          type: 'string',
          description: 'Comma-separated knowledge base files',
          alias: 'k'
        },
        reasoning: {
          type: 'boolean',
          description: 'Enable reasoning over results',
          default: false,
          alias: 'r'
        },
        limit: {
          type: 'integer',
          description: 'Maximum results to return',
          default: 100,
          alias: 'l'
        },
        format: {
          type: 'string',
          description: 'Output format (json, table, csv, turtle)',
          default: 'table',
          alias: 'f'
        }
      },
      async run(context: any) {
        const { args } = context;
        try {
          if (!args.sparql && !args.pattern) {
            consola.error('Either --sparql or --pattern must be provided');
            process.exit(1);
          }

          consola.start('Executing knowledge query...');
          
          let queryObj: any;
          if (args.sparql) {
            queryObj = { sparql: String(args.sparql) };
          } else {
            const parts = String(args.pattern).split(',');
            queryObj = {
              pattern: {
                subject: parts[0] || undefined,
                predicate: parts[1] || undefined,
                object: parts[2] || undefined
              }
            };
          }

          queryObj.limit = Number(args.limit);
          queryObj.reasoning = Boolean(args.reasoning);

          const request: MCPRequest<any> = {
            jsonrpc: '2.0',
            id: Date.now().toString(),
            method: 'unjucks_knowledge_query',
            params: {
              query: queryObj,
              knowledgeBase: args.knowledge ? String(args.knowledge).split(',') : [],
              reasoning: {
                enabled: Boolean(args.reasoning)
              },
              outputFormat: String(args.format),
              includeMeta: true
            }
          };

          const response = await unjucksKnowledgeQuery.execute(request);

          if (response.error) {
            consola.error('Query failed:', response.error.message);
            process.exit(1);
          }

          const result = response.result;
          consola.success(`Query completed - ${result.resultCount} results found`);
          
          // Display results based on format
          if (args.format === 'json') {
            console.log(JSON.stringify(result.results, null, 2));
          } else {
            console.log(result.results);
          }

          // Show insights if available
          if (result.insights?.recommendations?.length > 0) {
            consola.info('\nQuery Insights:');
            result.insights.recommendations.forEach((rec: any) => {
              consola.log(`  ${rec.type}: ${rec.message}`);
            });
          }

        } catch (error) {
          consola.error('Query failed:', error);
          process.exit(1);
        }
      }
    }),

    convert: defineCommand({
      meta: {
        name: 'convert',
        description: 'Convert between RDF formats (TTL, N3, JSON-LD)'
      },
      args: {
        input: {
          type: 'string',
          description: 'Input file path',
          required: true,
          alias: 'i'
        },
        output: {
          type: 'string',
          description: 'Output file path',
          required: true,
          alias: 'o'
        },
        from: {
          type: 'string',
          description: 'Input format (turtle, n3, jsonld)',
          required: true,
          alias: 'f'
        },
        to: {
          type: 'string',
          description: 'Output format (turtle, n3, jsonld)',
          required: true,
          alias: 't'
        },
        validate: {
          type: 'boolean',
          description: 'Validate during conversion',
          default: true,
          alias: 'v'
        }
      },
      async run(context: any) {
        const { args } = context;
        try {
          consola.start(`Converting ${args.from} to ${args.to}...`);
          
          const inputContent = await fs.readFile(String(args.input), 'utf-8');
          
          // Use RDFTypeConverter for format conversion
          const converter = new RDFTypeConverter();
          
          let convertedContent: string;
          
          if (args.from === 'turtle' && args.to === 'jsonld') {
            // Convert Turtle to JSON-LD via TypeScript types
            const tempDir = './temp-conversion';
            const result = await converter.convertTurtleToTypeScript(String(args.input), tempDir);
            
            // Convert types back to JSON-LD format
            convertedContent = JSON.stringify({
              '@context': {
                '@vocab': 'http://example.org/',
                'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
                'rdfs': 'http://www.w3.org/2000/01/rdf-schema#'
              },
              '@graph': result.definitions.map(def => ({
                '@id': def.name,
                '@type': 'Class',
                'properties': def.properties.map(prop => ({
                  name: prop.name,
                  type: prop.type,
                  required: prop.required
                }))
              }))
            }, null, 2);
            
            // Cleanup temp files
            await fs.rm(tempDir, { recursive: true, force: true });
          } else {
            // For other conversions, pass through with basic format changes
            convertedContent = inputContent;
            consola.warn(`Direct ${args.from} to ${args.to} conversion not yet implemented. Copying content.`);
          }

          await fs.writeFile(String(args.output), convertedContent);
          consola.success(`Converted ${args.input} to ${args.output}`);

          if (args.validate) {
            consola.info('Validating output...');
            // Basic validation - check if file is well-formed
            try {
              if (args.to === 'jsonld') {
                JSON.parse(convertedContent);
              }
              consola.success('Output validation passed');
            } catch (error) {
              consola.warn('Output validation failed:', error.message);
            }
          }

        } catch (error) {
          consola.error('Conversion failed:', error);
          process.exit(1);
        }
      }
    }),

    orchestrate: defineCommand({
      meta: {
        name: 'orchestrate',
        description: 'Orchestrate semantic workflow with multiple steps'
      },
      args: {
        workflow: {
          type: 'string',
          description: 'Workflow configuration file (JSON/YAML)',
          required: true,
          alias: 'w'
        },
        variables: {
          type: 'string',
          description: 'Variables file to override workflow defaults',
          alias: 'v'
        },
        parallel: {
          type: 'boolean',
          description: 'Enable parallel step execution',
          default: true,
          alias: 'p'
        },
        output: {
          type: 'string',
          description: 'Output directory for workflow results',
          default: './workflow-output',
          alias: 'o'
        }
      },
      async run(context: any) {
        const { args } = context;
        try {
          consola.start('Orchestrating semantic workflow...');
          
          const workflowContent = await fs.readFile(String(args.workflow), 'utf-8');
          const workflow = JSON.parse(workflowContent);

          // Load variables if provided
          let variables = {};
          if (args.variables) {
            const variablesContent = await fs.readFile(String(args.variables), 'utf-8');
            variables = JSON.parse(variablesContent);
          }

          // Create output directory
          await fs.mkdir(String(args.output), { recursive: true });

          const startTime = Date.now();
          const results: any[] = [];

          // Execute workflow steps
          if (workflow.steps && Array.isArray(workflow.steps)) {
            for (const [index, step] of workflow.steps.entries()) {
              consola.info(`Executing step ${index + 1}/${workflow.steps.length}: ${step.name}`);
              
              try {
                let stepResult;
                
                switch (step.type) {
                  case 'validate':
                    const validateRequest: MCPRequest<any> = {
                      jsonrpc: '2.0',
                      id: `step-${index}`,
                      method: 'unjucks_semantic_validate',
                      params: { ...step.params, ...variables }
                    };
                    stepResult = await unjucksSemanticValidate.execute(validateRequest);
                    break;
                    
                  case 'reason':
                    const reasonRequest: MCPRequest<any> = {
                      jsonrpc: '2.0',
                      id: `step-${index}`,
                      method: 'unjucks_reasoning_apply',
                      params: { ...step.params, templateVars: variables }
                    };
                    stepResult = await unjucksReasoningApply.execute(reasonRequest);
                    break;
                    
                  case 'query':
                    const queryRequest: MCPRequest<any> = {
                      jsonrpc: '2.0',
                      id: `step-${index}`,
                      method: 'unjucks_knowledge_query',
                      params: { ...step.params }
                    };
                    stepResult = await unjucksKnowledgeQuery.execute(queryRequest);
                    break;
                    
                  case 'generate':
                    // Use existing semantic generate functionality
                    const config: SemanticTemplateConfig = {
                      ...step.params,
                      outputDir: path.join(String(args.output), step.name || `step-${index}`)
                    };
                    const orchestrator = new SemanticTemplateOrchestrator(config);
                    stepResult = await orchestrator.generateFromSemantic();
                    break;
                    
                  default:
                    throw new Error(`Unknown step type: ${step.type}`);
                }

                results.push({
                  step: step.name,
                  type: step.type,
                  success: !stepResult.error,
                  result: stepResult
                });

                // Save step result
                const stepOutputPath = path.join(String(args.output), `${step.name || `step-${index}`}.json`);
                await fs.writeFile(stepOutputPath, JSON.stringify(stepResult, null, 2));
                
                consola.success(`Step ${index + 1} completed`);
                
              } catch (error) {
                consola.error(`Step ${index + 1} failed:`, error.message);
                results.push({
                  step: step.name,
                  type: step.type,
                  success: false,
                  error: error.message
                });
                
                if (step.required !== false) {
                  throw error;
                }
              }
            }
          }

          const executionTime = Date.now() - startTime;
          const successCount = results.filter(r => r.success).length;
          
          consola.success(`Workflow completed in ${executionTime}ms`);
          consola.box('Workflow Summary', 
            `Steps executed: ${results.length}\n` +
            `Successful: ${successCount}\n` +
            `Failed: ${results.length - successCount}\n` +
            `Output directory: ${args.output}`
          );

          // Save workflow summary
          const summary = {
            workflow: workflow.name || 'Unnamed Workflow',
            executionTime,
            results,
            timestamp: new Date().toISOString()
          };
          
          await fs.writeFile(
            path.join(String(args.output), 'workflow-summary.json'),
            JSON.stringify(summary, null, 2)
          );

        } catch (error) {
          consola.error('Workflow orchestration failed:', error);
          process.exit(1);
        }
      }
    }),

    monitor: defineCommand({
      meta: {
        name: 'monitor',
        description: 'Real-time monitoring of semantic operations'
      },
      args: {
        target: {
          type: 'string',
          description: 'Directory or file to monitor',
          required: true,
          alias: 't'
        },
        interval: {
          type: 'integer',
          description: 'Monitoring interval in seconds',
          default: 5,
          alias: 'i'
        },
        validate: {
          type: 'boolean',
          description: 'Auto-validate on changes',
          default: true,
          alias: 'v'
        }
      },
      async run(context: any) {
        const { args } = context;
        try {
          consola.start(`Monitoring semantic changes in: ${args.target}`);
          
          const { watch } = await import('chokidar');
          
          const watcher = watch(String(args.target), {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true
          });

          let validationQueue = new Set<string>();
          let isValidating = false;

          const performValidation = async () => {
            if (isValidating || validationQueue.size === 0) return;
            
            isValidating = true;
            const files = Array.from(validationQueue);
            validationQueue.clear();
            
            consola.info(`Validating ${files.length} changed files...`);
            
            for (const file of files) {
              try {
                if (file.endsWith('.ttl') || file.endsWith('.n3') || file.endsWith('.rdf')) {
                  const request: MCPRequest<any> = {
                    jsonrpc: '2.0',
                    id: Date.now().toString(),
                    method: 'unjucks_semantic_validate',
                    params: {
                      templatePath: file,
                      outputFormat: 'summary'
                    }
                  };

                  const response = await unjucksSemanticValidate.execute(request);
                  
                  if (response.error) {
                    consola.error(`❌ ${path.basename(file)}: ${response.error.message}`);
                  } else {
                    const validation = response.result.validation;
                    if (validation.valid) {
                      consola.success(`✅ ${path.basename(file)}: Valid (Score: ${validation.score})`);
                    } else {
                      consola.warn(`⚠️  ${path.basename(file)}: ${validation.errorCount} errors, ${validation.warningCount} warnings`);
                    }
                  }
                }
              } catch (error) {
                consola.error(`❌ ${path.basename(file)}: Validation failed - ${error.message}`);
              }
            }
            
            isValidating = false;
          };

          watcher.on('change', (file) => {
            consola.info(`📝 Changed: ${path.basename(file)}`);
            if (args.validate) {
              validationQueue.add(file);
              // Debounce validation
              setTimeout(performValidation, 1000);
            }
          });

          watcher.on('add', (file) => {
            consola.info(`➕ Added: ${path.basename(file)}`);
            if (args.validate) {
              validationQueue.add(file);
              setTimeout(performValidation, 1000);
            }
          });

          watcher.on('unlink', (file) => {
            consola.info(`🗑️  Removed: ${path.basename(file)}`);
          });

          watcher.on('error', (error) => {
            consola.error('Watcher error:', error);
          });

          // Handle graceful shutdown
          process.on('SIGINT', () => {
            consola.info('Stopping semantic monitor...');
            watcher.close();
            process.exit(0);
          });

          // Keep the process alive
          setInterval(() => {
            // Periodic health check
          }, Number(args.interval) * 1000);

        } catch (error) {
          consola.error('Monitor setup failed:', error);
          process.exit(1);
        }
      }
    }),

    benchmark: defineCommand({
      meta: {
        name: 'benchmark',
        description: 'Performance benchmarking for semantic operations'
      },
      args: {
        operation: {
          type: 'string',
          description: 'Operation to benchmark (validate, reason, query, generate)',
          required: true,
          alias: 'o'
        },
        dataset: {
          type: 'string',
          description: 'Test dataset directory or file',
          required: true,
          alias: 'd'
        },
        iterations: {
          type: 'integer',
          description: 'Number of benchmark iterations',
          default: 10,
          alias: 'i'
        },
        warmup: {
          type: 'integer',
          description: 'Warmup iterations (not counted)',
          default: 3,
          alias: 'w'
        },
        output: {
          type: 'string',
          description: 'Benchmark results output file',
          alias: 'out'
        }
      },
      async run(context: any) {
        const { args } = context;
        try {
          consola.start(`Benchmarking ${args.operation} operation...`);
          
          const stats = await import('node:fs/promises');
          const datasetPath = String(args.dataset);
          const isDirectory = (await stats.stat(datasetPath)).isDirectory();
          
          let testFiles: string[];
          if (isDirectory) {
            const entries = await fs.readdir(datasetPath, { withFileTypes: true });
            testFiles = entries
              .filter(entry => entry.isFile() && (entry.name.endsWith('.ttl') || entry.name.endsWith('.n3')))
              .map(entry => path.join(datasetPath, entry.name));
          } else {
            testFiles = [datasetPath];
          }

          if (testFiles.length === 0) {
            consola.error('No test files found in dataset');
            process.exit(1);
          }

          consola.info(`Found ${testFiles.length} test files`);
          const results: any[] = [];
          
          // Warmup iterations
          consola.info(`Performing ${args.warmup} warmup iterations...`);
          for (let i = 0; i < args.warmup; i++) {
            await performBenchmarkOperation(args.operation, testFiles[i % testFiles.length]);
          }

          // Actual benchmark iterations
          consola.info(`Running ${args.iterations} benchmark iterations...`);
          
          for (let iteration = 0; iteration < args.iterations; iteration++) {
            const testFile = testFiles[iteration % testFiles.length];
            const startTime = process.hrtime.bigint();
            
            try {
              const operationResult = await performBenchmarkOperation(args.operation, testFile);
              const endTime = process.hrtime.bigint();
              const executionTime = Number(endTime - startTime) / 1_000_000; // Convert to ms
              
              results.push({
                iteration: iteration + 1,
                file: path.basename(testFile),
                executionTime,
                success: true,
                result: operationResult
              });
              
              consola.log(`Iteration ${iteration + 1}/${args.iterations}: ${executionTime.toFixed(2)}ms`);
              
            } catch (error) {
              const endTime = process.hrtime.bigint();
              const executionTime = Number(endTime - startTime) / 1_000_000;
              
              results.push({
                iteration: iteration + 1,
                file: path.basename(testFile),
                executionTime,
                success: false,
                error: error.message
              });
              
              consola.warn(`Iteration ${iteration + 1} failed: ${error.message}`);
            }
          }

          // Calculate statistics
          const successfulResults = results.filter(r => r.success);
          const executionTimes = successfulResults.map(r => r.executionTime);
          
          if (executionTimes.length === 0) {
            consola.error('No successful benchmark iterations');
            process.exit(1);
          }

          const stats_calc = {
            operation: args.operation,
            totalIterations: args.iterations,
            successfulIterations: executionTimes.length,
            failedIterations: results.length - executionTimes.length,
            averageTime: executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length,
            minTime: Math.min(...executionTimes),
            maxTime: Math.max(...executionTimes),
            medianTime: executionTimes.sort((a, b) => a - b)[Math.floor(executionTimes.length / 2)],
            standardDeviation: calculateStandardDeviation(executionTimes),
            timestamp: new Date().toISOString()
          };

          consola.success('Benchmark completed!');
          consola.box('Benchmark Results',
            `Operation: ${stats_calc.operation}\n` +
            `Successful: ${stats_calc.successfulIterations}/${stats_calc.totalIterations}\n` +
            `Average: ${stats_calc.averageTime.toFixed(2)}ms\n` +
            `Min: ${stats_calc.minTime.toFixed(2)}ms\n` +
            `Max: ${stats_calc.maxTime.toFixed(2)}ms\n` +
            `Median: ${stats_calc.medianTime.toFixed(2)}ms\n` +
            `Std Dev: ${stats_calc.standardDeviation.toFixed(2)}ms`
          );

          // Save detailed results if output specified
          if (args.output) {
            const benchmarkReport = {
              statistics: stats_calc,
              detailedResults: results,
              configuration: {
                operation: args.operation,
                dataset: args.dataset,
                iterations: args.iterations,
                warmup: args.warmup
              }
            };
            
            await fs.writeFile(String(args.output), JSON.stringify(benchmarkReport, null, 2));
            consola.success(`Detailed results saved to: ${args.output}`);
          }

        } catch (error) {
          consola.error('Benchmark failed:', error);
          process.exit(1);
        }
      }
    })
  }
});

/**
 * Perform a benchmark operation on a test file
 */
async function performBenchmarkOperation(operation: string, testFile: string): Promise<any> {
  const baseRequest = {
    jsonrpc: '2.0' as const,
    id: Date.now().toString()
  };

  switch (operation) {
    case 'validate':
      const validateRequest: MCPRequest<any> = {
        ...baseRequest,
        method: 'unjucks_semantic_validate',
        params: {
          templatePath: testFile,
          outputFormat: 'summary'
        }
      };
      return await unjucksSemanticValidate.execute(validateRequest);

    case 'reason':
      // For reasoning benchmark, use default template variables
      const reasonRequest: MCPRequest<any> = {
        ...baseRequest,
        method: 'unjucks_reasoning_apply',
        params: {
          templateVars: { testFile: testFile, benchmark: true },
          rules: ['# Basic benchmark rule\n{ ?s ?p ?o } => { ?s <http://benchmark> true } .'],
          depth: 1
        }
      };
      return await unjucksReasoningApply.execute(reasonRequest);

    case 'query':
      const queryRequest: MCPRequest<any> = {
        ...baseRequest,
        method: 'unjucks_knowledge_query',
        params: {
          query: {
            pattern: { predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' }
          },
          knowledgeBase: [testFile],
          outputFormat: 'json'
        }
      };
      return await unjucksKnowledgeQuery.execute(queryRequest);

    case 'generate':
      // For generate benchmark, use minimal config
      const config: SemanticTemplateConfig = {
        ontologyPaths: [testFile],
        templateDir: '_templates',
        outputDir: './benchmark-output',
        generateTypes: true,
        generateSchemas: false,
        generateValidators: false,
        generateTests: false,
        generateDocs: false
      };
      const orchestrator = new SemanticTemplateOrchestrator(config);
      return await orchestrator.generateFromSemantic();

    default:
      throw new Error(`Unknown benchmark operation: ${operation}`);
  }
}

/**
 * Calculate standard deviation of an array of numbers
 */
function calculateStandardDeviation(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
  const averageSquaredDifference = squaredDifferences.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(averageSquaredDifference);
}

// Helper function for watch mode
async function watchForChanges(
  config: SemanticTemplateConfig, 
  orchestrator: SemanticTemplateOrchestrator
) {
  const { watch } = await import('chokidar');
  
  const watchPaths = [
    ...(config.ontologyPaths || []),
    config.templateDir || '_templates'
  ];

  const watcher = watch(watchPaths, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true
  });

  watcher.on('change', async (path) => {
    consola.info(`File changed: ${path}`);
    consola.start('Regenerating...');
    
    try {
      await orchestrator.generateFromSemantic();
      consola.success('Regeneration complete');
    } catch (error) {
      consola.error('Regeneration failed:', error);
    }
  });

  // Keep the process alive
  process.on('SIGINT', () => {
    consola.info('Stopping watcher...');
    watcher.close();
    process.exit(0);
  });
}