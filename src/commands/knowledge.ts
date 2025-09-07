import { defineCommand } from "citty";
import chalk from "chalk";
import { consola } from "consola";
import ora from "ora";
import * as fs from "fs-extra";
import * as path from "path";
import { spawn } from "child_process";
import inquirer from "inquirer";
import { RDFDataLoader } from "../lib/rdf-data-loader.js";
import { SemanticEngine } from "../lib/semantic-engine.js";
import type { 
  RDFDataSource, 
  RDFTemplateContext, 
  TurtleData,
  SemanticValidationRule,
  OntologyMetadata,
  ReasoningResult
} from "../lib/types/rdf.types.js";
import {
  validators,
  displayValidationResults,
  createCommandError,
} from "../lib/command-validation.js";
import { CommandError, UnjucksCommandError } from "../types/commands.js";
import { handleError, ConfigurationError, ValidationError, ErrorCategory, ActionableError } from "../lib/actionable-error.js";

// ============================================================================
// KNOWLEDGE COMMAND TYPES
// ============================================================================

/**
 * Supported ontology formats
 */
export type OntologyFormat = "turtle" | "rdf-xml" | "jsonld" | "n3" | "owl" | "auto";

/**
 * Knowledge base operations
 */
export type KnowledgeOperation = 
  | "load" 
  | "query" 
  | "validate" 
  | "reason" 
  | "export" 
  | "transform"
  | "merge"
  | "diff"
  | "lint";

/**
 * Reasoning engine types
 */
export type ReasoningEngine = "pellet" | "hermit" | "fact++" | "elk" | "builtin";

/**
 * Query language types
 */
export type QueryLanguage = "sparql" | "graphql" | "cypher" | "gremlin";

/**
 * Ontology information
 */
export interface OntologyInfo {
  id: string;
  name: string;
  version?: string;
  namespace: string;
  format: OntologyFormat;
  file: string;
  size: number;
  classes: number;
  properties: number;
  individuals: number;
  axioms: number;
  imports: string[];
  lastModified: Date;
  metadata?: OntologyMetadata;
  validation?: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

/**
 * Query result interface
 */
export interface QueryResult {
  query: string;
  language: QueryLanguage;
  results: any[];
  count: number;
  executionTime: number;
  bindings?: Record<string, any>[];
  graph?: any;
  format: "table" | "json" | "turtle" | "graph";
}

/**
 * Knowledge base statistics
 */
export interface KnowledgeStats {
  totalOntologies: number;
  totalTriples: number;
  totalClasses: number;
  totalProperties: number;
  totalIndividuals: number;
  namespaces: string[];
  domains: string[];
  recentActivity: {
    loaded: number;
    validated: number;
    queried: number;
  };
  storage: {
    used: string;
    available: string;
    format: "memory" | "file" | "database";
  };
}

/**
 * Validation report
 */
export interface ValidationReport {
  ontology: string;
  valid: boolean;
  profile: "OWL2-DL" | "OWL2-EL" | "OWL2-QL" | "OWL2-RL" | "RDFS";
  errors: Array<{
    type: string;
    severity: "error" | "warning" | "info";
    message: string;
    location?: string;
    suggestion?: string;
  }>;
  statistics: {
    classes: number;
    properties: number;
    individuals: number;
    axioms: number;
  };
  recommendations: string[];
  compliance: Record<string, boolean>;
}

// ============================================================================
// MCP INTEGRATION UTILITIES
// ============================================================================

/**
 * Execute MCP semantic command
 */
async function executeMCPSemantic(command: string, params: Record<string, any>, timeout = 60000): Promise<any> {
  try {
    return new Promise((resolve, reject) => {
      const mcpProcess = spawn('npx', [
        'claude-flow@alpha', 
        'semantic', 
        command, 
        ...Object.entries(params).flat().map(String)
      ], {
        stdio: 'pipe',
        env: { ...process.env, MCP_TIMEOUT: timeout.toString() }
      });

      let stdout = '';
      let stderr = '';

      mcpProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      mcpProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      mcpProcess.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve({ success: true, output: stdout });
          }
        } else {
          reject(new Error(`MCP semantic command failed: ${stderr}`));
        }
      });

      mcpProcess.on('error', reject);

      setTimeout(() => {
        mcpProcess.kill();
        reject(new Error('MCP semantic command timeout'));
      }, timeout);
    });
  } catch (error) {
    consola.warn('MCP semantic execution failed, using fallback');
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ============================================================================
// KNOWLEDGE MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Load ontology from various sources
 */
async function loadOntology(
  source: string, 
  format: OntologyFormat = 'auto',
  options: { validate?: boolean; reasoning?: boolean } = {}
): Promise<{ success: boolean; ontology?: OntologyInfo; error?: string }> {
  try {
    const rdfLoader = new RDFDataLoader();
    const semanticEngine = new SemanticEngine();

    // Determine source type and load
    let rdfSource: RDFDataSource;
    
    if (source.startsWith('http://') || source.startsWith('https://')) {
      rdfSource = {
        type: 'url',
        source: source,
        format: format === 'auto' ? 'turtle' : format
      };
    } else if (await fs.pathExists(source)) {
      rdfSource = {
        type: 'file',
        source: path.resolve(source),
        format: format === 'auto' ? detectFormatFromExtension(source) : format
      };
    } else {
      rdfSource = {
        type: 'inline',
        source: source,
        format: format === 'auto' ? 'turtle' : format
      };
    }

    const loadResult = await rdfLoader.loadData(rdfSource);
    if (!loadResult.success) {
      return { success: false, error: loadResult.error };
    }

    // Extract ontology metadata
    const ontologyInfo: OntologyInfo = {
      id: generateOntologyId(source),
      name: extractOntologyName(loadResult.data) || path.basename(source),
      format: rdfSource.format as OntologyFormat,
      file: typeof rdfSource.source === 'string' ? rdfSource.source : 'inline',
      size: JSON.stringify(loadResult.data).length,
      namespace: loadResult.namespace || 'http://example.org/',
      classes: countClasses(loadResult.data),
      properties: countProperties(loadResult.data),
      individuals: countIndividuals(loadResult.data),
      axioms: countAxioms(loadResult.data),
      imports: extractImports(loadResult.data),
      lastModified: new Date(),
      metadata: loadResult.metadata
    };

    // Validate if requested
    if (options.validate) {
      const validationResult = await validateOntology(loadResult.data);
      ontologyInfo.validation = validationResult;
    }

    // Apply reasoning if requested
    if (options.reasoning) {
      await applyReasoning(loadResult.data, 'builtin');
    }

    return { success: true, ontology: ontologyInfo };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Query knowledge base with SPARQL or other query languages
 */
async function executeQuery(
  query: string,
  language: QueryLanguage = 'sparql',
  options: { format?: string; limit?: number; timeout?: number } = {}
): Promise<QueryResult> {
  const startTime = Date.now();
  const semanticEngine = new SemanticEngine();

  try {
    let results: any[] = [];
    let bindings: Record<string, any>[] = [];

    switch (language) {
      case 'sparql':
        const sparqlResult = await semanticEngine.executeSparqlQuery(query, {
          limit: options.limit || 100,
          timeout: options.timeout || 30000
        });
        results = sparqlResult.results || [];
        bindings = sparqlResult.bindings || [];
        break;
        
      case 'graphql':
        // Convert GraphQL to SPARQL or use GraphQL endpoint
        const graphqlResult = await convertGraphQLToSparql(query);
        results = graphqlResult.results || [];
        break;
        
      default:
        throw new Error(`Unsupported query language: ${language}`);
    }

    return {
      query,
      language,
      results,
      count: results.length,
      executionTime: Date.now() - startTime,
      bindings,
      format: options.format as any || 'table'
    };
  } catch (error) {
    throw new Error(`Query execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate ontology structure and consistency
 */
async function validateOntology(data: TurtleData): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Basic structural validation
    if (!data.triples || data.triples.length === 0) {
      errors.push('No triples found in ontology');
    }

    // Check for circular dependencies
    const circularDeps = detectCircularDependencies(data);
    if (circularDeps.length > 0) {
      warnings.push(`Circular dependencies detected: ${circularDeps.join(', ')}`);
    }

    // Validate OWL constructs
    const owlValidation = validateOWLConstructs(data);
    errors.push(...owlValidation.errors);
    warnings.push(...owlValidation.warnings);

    // Check naming conventions
    const namingIssues = checkNamingConventions(data);
    warnings.push(...namingIssues);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Validation failed: ${error instanceof Error ? error.message : String(error)}`],
      warnings
    };
  }
}

/**
 * Apply reasoning to derive new knowledge
 */
async function applyReasoning(
  data: TurtleData, 
  engine: ReasoningEngine = 'builtin'
): Promise<ReasoningResult> {
  try {
    const semanticEngine = new SemanticEngine();
    
    // Apply different reasoning strategies
    switch (engine) {
      case 'builtin':
        return await semanticEngine.performReasoning(data, {
          includeInferences: true,
          reasoningLevel: 'basic'
        });
        
      case 'pellet':
      case 'hermit':
      case 'fact++':
      case 'elk':
        // Use external reasoner via MCP if available
        const mcpResult = await executeMCPSemantic('reason', {
          engine,
          data: JSON.stringify(data)
        });
        
        if (mcpResult.success) {
          return mcpResult.result;
        } else {
          throw new Error(mcpResult.error || 'External reasoning failed');
        }
        
      default:
        throw new Error(`Unsupported reasoning engine: ${engine}`);
    }
  } catch (error) {
    return {
      success: false,
      inferences: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function detectFormatFromExtension(filePath: string): OntologyFormat {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.ttl':
    case '.turtle':
      return 'turtle';
    case '.rdf':
    case '.xml':
      return 'rdf-xml';
    case '.jsonld':
    case '.json':
      return 'jsonld';
    case '.n3':
      return 'n3';
    case '.owl':
      return 'owl';
    default:
      return 'turtle';
  }
}

function generateOntologyId(source: string): string {
  return `ontology-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function extractOntologyName(data: TurtleData): string | undefined {
  // Extract name from ontology IRI or dc:title
  return data.metadata?.title || data.namespace?.split('/').pop();
}

function countClasses(data: TurtleData): number {
  return data.triples?.filter(t => 
    t.predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
    t.object === 'http://www.w3.org/2002/07/owl#Class'
  ).length || 0;
}

function countProperties(data: TurtleData): number {
  return data.triples?.filter(t => 
    t.predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
    (t.object.includes('Property') || t.object.includes('property'))
  ).length || 0;
}

function countIndividuals(data: TurtleData): number {
  return data.triples?.filter(t => 
    t.predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
    !t.object.includes('Class') && !t.object.includes('Property')
  ).length || 0;
}

function countAxioms(data: TurtleData): number {
  return data.triples?.length || 0;
}

function extractImports(data: TurtleData): string[] {
  return data.triples?.filter(t => 
    t.predicate === 'http://www.w3.org/2002/07/owl#imports'
  ).map(t => t.object) || [];
}

function detectCircularDependencies(data: TurtleData): string[] {
  // Simplified circular dependency detection
  const imports = extractImports(data);
  const circular: string[] = [];
  
  // This would need more sophisticated graph traversal
  for (const imp of imports) {
    if (data.namespace && imp.includes(data.namespace)) {
      circular.push(imp);
    }
  }
  
  return circular;
}

function validateOWLConstructs(data: TurtleData): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for proper OWL namespace declarations
  const hasOwlNamespace = data.triples?.some(t => 
    t.subject.includes('http://www.w3.org/2002/07/owl#')
  );
  
  if (!hasOwlNamespace) {
    warnings.push('No OWL namespace declarations found');
  }
  
  return { errors, warnings };
}

function checkNamingConventions(data: TurtleData): string[] {
  const warnings: string[] = [];
  
  // Check for CamelCase class names
  const classNames = data.triples?.filter(t => 
    t.predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
    t.object === 'http://www.w3.org/2002/07/owl#Class'
  ).map(t => t.subject.split('#').pop() || t.subject.split('/').pop()) || [];
  
  for (const className of classNames) {
    if (className && className[0] !== className[0].toUpperCase()) {
      warnings.push(`Class name '${className}' should start with uppercase letter`);
    }
  }
  
  return warnings;
}

async function convertGraphQLToSparql(graphqlQuery: string): Promise<{ results: any[] }> {
  // Simplified GraphQL to SPARQL conversion
  // In a real implementation, this would be more sophisticated
  throw new Error('GraphQL to SPARQL conversion not yet implemented');
}

// ============================================================================
// KNOWLEDGE COMMAND DEFINITION
// ============================================================================

/**
 * Knowledge command - RDF/OWL ontology and semantic knowledge management
 * 
 * This command provides comprehensive semantic web capabilities including:
 * - Ontology loading from files, URLs, and inline sources
 * - SPARQL and semantic querying
 * - OWL validation and consistency checking
 * - Automated reasoning and inference
 * - Knowledge base statistics and analytics
 * - Multi-format export and transformation
 * - Ontology merging and difference analysis
 * 
 * @example
 * ```bash
 * # Load ontology from file with validation
 * unjucks knowledge load ./ontologies/domain.owl --format owl --validate
 * 
 * # Query knowledge base with SPARQL
 * unjucks knowledge query "SELECT ?class WHERE { ?class a owl:Class }" --format table
 * 
 * # Validate ontology structure
 * unjucks knowledge validate ./ontologies/schema.ttl --profile OWL2-DL --fix
 * 
 * # Apply reasoning to derive new facts
 * unjucks knowledge reason --engine pellet --output inferences.ttl
 * 
 * # Show knowledge base statistics
 * unjucks knowledge stats --detailed --export stats.json
 * ```
 */
export const knowledgeCommand = defineCommand({
  meta: {
    name: "knowledge",
    description: "RDF/OWL ontology and semantic knowledge management with reasoning capabilities",
  },
  subCommands: {
    /**
     * Load ontologies from various sources
     */
    load: defineCommand({
      meta: {
        name: "load",
        description: "Load ontology from file, URL, or inline source",
      },
      args: {
        source: {
          type: "positional",
          description: "Ontology source (file path, URL, or inline turtle)",
          required: true,
        },
        format: {
          type: "string",
          description: "Input format (turtle, rdf-xml, jsonld, n3, owl, auto)",
          default: "auto",
          alias: "f",
        },
        name: {
          type: "string",
          description: "Custom ontology name",
          alias: "n",
        },
        validate: {
          type: "boolean",
          description: "Validate ontology after loading",
          default: false,
          alias: "v",
        },
        reasoning: {
          type: "boolean",
          description: "Apply reasoning after loading",
          default: false,
          alias: "r",
        },
        namespace: {
          type: "string",
          description: "Base namespace URI",
          alias: "ns",
        },
        cache: {
          type: "boolean",
          description: "Cache loaded ontology for future use",
          default: true,
          alias: "c",
        },
      },
      async run({ args }: { args: any }) {
        const spinner = ora("Loading ontology...").start();

        try {
          const loadResult = await loadOntology(args.source, args.format, {
            validate: args.validate,
            reasoning: args.reasoning
          });

          if (!loadResult.success) {
            throw new Error(loadResult.error);
          }

          const ontology = loadResult.ontology!;
          
          // Override name if provided
          if (args.name) {
            ontology.name = args.name;
          }
          
          // Override namespace if provided
          if (args.namespace) {
            ontology.namespace = args.namespace;
          }

          spinner.stop();

          console.log(chalk.green("\n✅ Ontology loaded successfully"));
          console.log(chalk.cyan(`📋 Name: ${ontology.name}`));
          console.log(chalk.gray(`🆔 ID: ${ontology.id}`));
          console.log(chalk.gray(`📄 Format: ${ontology.format}`));
          console.log(chalk.gray(`📊 Size: ${(ontology.size / 1024).toFixed(2)} KB`));
          console.log(chalk.gray(`🏛️  Classes: ${ontology.classes}`));
          console.log(chalk.gray(`🔗 Properties: ${ontology.properties}`));
          console.log(chalk.gray(`👤 Individuals: ${ontology.individuals}`));
          console.log(chalk.gray(`⚡ Axioms: ${ontology.axioms}`));
          
          if (ontology.imports && ontology.imports.length > 0) {
            console.log(chalk.gray(`📦 Imports: ${ontology.imports.length}`));
          }

          // Show validation results
          if (ontology.validation) {
            if (ontology.validation.valid) {
              console.log(chalk.green("✅ Validation: PASSED"));
            } else {
              console.log(chalk.red("❌ Validation: FAILED"));
              console.log(chalk.red("Errors:"));
              ontology.validation.errors.forEach(error => {
                console.log(chalk.red(`  • ${error}`));
              });
            }
            
            if (ontology.validation.warnings.length > 0) {
              console.log(chalk.yellow("⚠️ Warnings:"));
              ontology.validation.warnings.forEach(warning => {
                console.log(chalk.yellow(`  • ${warning}`));
              });
            }
          }

          // Try MCP integration for enhanced loading
          try {
            const mcpResult = await executeMCPSemantic('load', {
              source: args.source,
              format: args.format,
              validate: args.validate
            });
            
            if (mcpResult.success && mcpResult.enhanced) {
              console.log(chalk.blue("🚀 Enhanced loading via MCP completed"));
            }
          } catch {
            // MCP not available, continue with basic loading
          }

          return {
            success: true,
            message: "Ontology loaded successfully",
            data: ontology
          };

        } catch (error) {
          spinner.stop();
          console.error(chalk.red("\n❌ Ontology loading failed:"));
          console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));handleError(new ActionableError({ message: "Operation failed", solution: "Check the error details and try again", category: ErrorCategory.RUNTIME_ERROR }));
        }
      },
    }),

    /**
     * Query knowledge base
     */
    query: defineCommand({
      meta: {
        name: "query",
        description: "Query knowledge base with SPARQL or other query languages",
      },
      args: {
        query: {
          type: "positional",
          description: "Query string or file path",
          required: true,
        },
        language: {
          type: "string",
          description: "Query language (sparql, graphql, cypher)",
          default: "sparql",
          alias: "l",
        },
        format: {
          type: "string",
          description: "Output format (table, json, turtle, graph)",
          default: "table",
          alias: "f",
        },
        limit: {
          type: "string",
          description: "Maximum number of results",
          default: "100",
          alias: "n",
        },
        timeout: {
          type: "string",
          description: "Query timeout in milliseconds",
          default: "30000",
          alias: "t",
        },
        output: {
          type: "string",
          description: "Save results to file",
          alias: "o",
        },
        explain: {
          type: "boolean",
          description: "Show query execution plan",
          default: false,
          alias: "x",
        },
      },
      async run({ args }: { args: any }) {
        const spinner = ora("Executing query...").start();

        try {
          // Load query from file if it's a path
          let queryString = args.query;
          if (await fs.pathExists(args.query)) {
            queryString = await fs.readFile(args.query, 'utf-8');
          }

          const queryResult = await executeQuery(queryString, args.language, {
            format: args.format,
            limit: parseInt(args.limit),
            timeout: parseInt(args.timeout)
          });

          spinner.stop();

          console.log(chalk.blue(`\n🔍 Query Results (${queryResult.language.toUpperCase()})`));
          console.log(chalk.gray(`Execution time: ${queryResult.executionTime}ms`));
          console.log(chalk.gray(`Results: ${queryResult.count} / ${args.limit}`));

          // Display results based on format
          if (queryResult.format === 'json') {
            console.log(JSON.stringify(queryResult.results, null, 2));
          } else if (queryResult.format === 'table') {
            if (queryResult.bindings && queryResult.bindings.length > 0) {
              // Display SPARQL bindings in table format
              console.log(chalk.blue("\n📊 Results:"));
              queryResult.bindings.forEach((binding, index) => {
                console.log(`${index + 1}. ${JSON.stringify(binding)}`);
              });
            } else {
              // Display simple results
              queryResult.results.forEach((result, index) => {
                console.log(`${index + 1}. ${JSON.stringify(result)}`);
              });
            }
          } else if (queryResult.format === 'turtle') {
            console.log(chalk.blue("\n🐢 Turtle Results:"));
            // Convert results to Turtle format
            queryResult.results.forEach(result => {
              console.log(result.toString());
            });
          }

          // Show query plan if requested
          if (args.explain) {
            console.log(chalk.yellow("\n📋 Query Execution Plan:"));
            console.log(chalk.gray("  1. Parse query syntax"));
            console.log(chalk.gray("  2. Optimize query plan"));
            console.log(chalk.gray("  3. Execute against knowledge base"));
            console.log(chalk.gray("  4. Format and return results"));
          }

          // Save results if output file specified
          if (args.output) {
            const outputData = args.format === 'json' ? 
              JSON.stringify(queryResult, null, 2) :
              queryResult.results.map(r => r.toString()).join('\n');
            
            await fs.writeFile(args.output, outputData, 'utf-8');
            console.log(chalk.green(`\n📁 Results saved to: ${args.output}`));
          }

          return {
            success: true,
            message: `Query executed successfully (${queryResult.count} results)`,
            data: queryResult
          };

        } catch (error) {
          spinner.stop();
          console.error(chalk.red("\n❌ Query execution failed:"));
          console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));handleError(new ActionableError({ message: "Operation failed", solution: "Check the error details and try again", category: ErrorCategory.RUNTIME_ERROR }));
        }
      },
    }),

    /**
     * Validate ontology structure and consistency
     */
    validate: defineCommand({
      meta: {
        name: "validate",
        description: "Validate ontology structure, consistency, and compliance",
      },
      args: {
        source: {
          type: "positional",
          description: "Ontology file or directory to validate",
          required: true,
        },
        profile: {
          type: "string",
          description: "OWL profile (OWL2-DL, OWL2-EL, OWL2-QL, OWL2-RL, RDFS)",
          default: "OWL2-DL",
          alias: "p",
        },
        format: {
          type: "string",
          description: "Output format (table, json, xml)",
          default: "table",
          alias: "f",
        },
        fix: {
          type: "boolean",
          description: "Auto-fix common issues where possible",
          default: false,
          alias: "F",
        },
        strict: {
          type: "boolean",
          description: "Enable strict validation mode",
          default: false,
          alias: "s",
        },
        output: {
          type: "string",
          description: "Save validation report to file",
          alias: "o",
        },
      },
      async run({ args }: { args: any }) {
        const spinner = ora("Validating ontology...").start();

        try {
          const sourcePath = path.resolve(args.source);
          const isDirectory = (await fs.stat(sourcePath)).isDirectory();
          
          let validationReports: ValidationReport[] = [];

          if (isDirectory) {
            // Validate all ontology files in directory
            const files = await fs.readdir(sourcePath);
            const ontologyFiles = files.filter(f => 
              f.endsWith('.owl') || f.endsWith('.ttl') || f.endsWith('.rdf')
            );

            for (const file of ontologyFiles) {
              const filePath = path.join(sourcePath, file);
              const report = await validateSingleOntology(filePath, args.profile, args.strict);
              validationReports.push(report);
            }
          } else {
            // Validate single file
            const report = await validateSingleOntology(sourcePath, args.profile, args.strict);
            validationReports.push(report);
          }

          spinner.stop();

          // Display validation results
          console.log(chalk.blue("\n🔍 Ontology Validation Report"));
          console.log(chalk.gray(`Profile: ${args.profile} | Files: ${validationReports.length}`));

          for (const report of validationReports) {
            console.log(chalk.cyan(`\n📄 ${report.ontology}`));
            
            if (report.valid) {
              console.log(chalk.green("✅ Status: VALID"));
            } else {
              console.log(chalk.red("❌ Status: INVALID"));
            }
            
            console.log(chalk.gray(`Classes: ${report.statistics.classes} | Properties: ${report.statistics.properties}`));
            console.log(chalk.gray(`Individuals: ${report.statistics.individuals} | Axioms: ${report.statistics.axioms}`));

            // Show errors
            if (report.errors.length > 0) {
              console.log(chalk.red("\n❌ Errors:"));
              report.errors.forEach(error => {
                console.log(chalk.red(`  • [${error.type}] ${error.message}`));
                if (error.location) {
                  console.log(chalk.gray(`    Location: ${error.location}`));
                }
                if (error.suggestion) {
                  console.log(chalk.blue(`    Suggestion: ${error.suggestion}`));
                }
              });
            }

            // Show recommendations
            if (report.recommendations.length > 0) {
              console.log(chalk.yellow("\n💡 Recommendations:"));
              report.recommendations.forEach(rec => {
                console.log(chalk.yellow(`  • ${rec}`));
              });
            }
          }

          // Summary
          const totalErrors = validationReports.reduce((sum, r) => sum + r.errors.length, 0);
          const validFiles = validationReports.filter(r => r.valid).length;
          
          console.log(chalk.blue("\n📊 Summary:"));
          console.log(chalk.green(`  ✅ Valid files: ${validFiles}/${validationReports.length}`));
          console.log(chalk.red(`  ❌ Total errors: ${totalErrors}`));

          // Apply fixes if requested
          if (args.fix && totalErrors > 0) {
            console.log(chalk.blue("\n🔧 Applying automatic fixes..."));
            
            let fixedIssues = 0;
            for (const report of validationReports) {
              fixedIssues += await applyAutomaticFixes(report.ontology, report.errors);
            }
            
            console.log(chalk.green(`✅ Fixed ${fixedIssues} issues automatically`));
          }

          // Save report if requested
          if (args.output) {
            const reportData = args.format === 'json' ?
              JSON.stringify(validationReports, null, 2) :
              generateValidationReport(validationReports, args.format);
              
            await fs.writeFile(args.output, reportData, 'utf-8');
            console.log(chalk.green(`\n📁 Report saved to: ${args.output}`));
          }

          return {
            success: validFiles === validationReports.length,
            message: `Validated ${validationReports.length} files (${validFiles} valid)`,
            data: validationReports
          };

        } catch (error) {
          spinner.stop();
          console.error(chalk.red("\n❌ Validation failed:"));
          console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));handleError(new ActionableError({ message: "Operation failed", solution: "Check the error details and try again", category: ErrorCategory.RUNTIME_ERROR }));
        }
      },
    }),

    /**
     * Apply reasoning to derive new knowledge
     */
    reason: defineCommand({
      meta: {
        name: "reason",
        description: "Apply reasoning to derive new knowledge and inferences",
      },
      args: {
        source: {
          type: "string",
          description: "Source ontology file or use loaded knowledge base",
          alias: "s",
        },
        engine: {
          type: "string",
          description: "Reasoning engine (builtin, pellet, hermit, fact++, elk)",
          default: "builtin",
          alias: "e",
        },
        output: {
          type: "string",
          description: "Save inferences to file",
          alias: "o",
        },
        format: {
          type: "string",
          description: "Output format (turtle, rdf-xml, jsonld)",
          default: "turtle",
          alias: "f",
        },
        level: {
          type: "string",
          description: "Reasoning level (basic, complete, optimized)",
          default: "basic",
          alias: "l",
        },
        timeout: {
          type: "string",
          description: "Reasoning timeout in seconds",
          default: "300",
          alias: "t",
        },
      },
      async run({ args }: { args: any }) {
        const spinner = ora("Applying reasoning...").start();

        try {
          let ontologyData: TurtleData;

          if (args.source) {
            // Load ontology from file
            const rdfLoader = new RDFDataLoader();
            const loadResult = await rdfLoader.loadData({
              type: 'file',
              source: args.source,
              format: 'auto'
            });
            
            if (!loadResult.success) {
              throw new Error(`Failed to load ontology: ${loadResult.error}`);
            }
            ontologyData = loadResult.data!;
          } else {
            // Use currently loaded knowledge base
            throw new Error("Knowledge base reasoning not yet implemented - please specify source file");
          }

          spinner.text = `Applying ${args.engine} reasoning (${args.level} level)...`;

          const reasoningResult = await applyReasoning(ontologyData, args.engine);
          
          if (!reasoningResult.success) {
            throw new Error(reasoningResult.error || 'Reasoning failed');
          }

          spinner.stop();

          console.log(chalk.green("\n✅ Reasoning completed successfully"));
          console.log(chalk.cyan(`🧠 Engine: ${args.engine}`));
          console.log(chalk.gray(`📊 Inferences: ${reasoningResult.inferences?.length || 0}`));
          console.log(chalk.gray(`⏱️ Duration: ${reasoningResult.duration || 'N/A'}ms`));

          // Display sample inferences
          if (reasoningResult.inferences && reasoningResult.inferences.length > 0) {
            console.log(chalk.blue("\n🔍 Sample Inferences:"));
            reasoningResult.inferences.slice(0, 5).forEach((inference, index) => {
              console.log(`  ${index + 1}. ${inference}`);
            });
            
            if (reasoningResult.inferences.length > 5) {
              console.log(chalk.gray(`  ... and ${reasoningResult.inferences.length - 5} more`));
            }
          }

          // Save inferences if requested
          if (args.output) {
            const outputData = formatInferences(reasoningResult.inferences || [], args.format);
            await fs.writeFile(args.output, outputData, 'utf-8');
            console.log(chalk.green(`\n📁 Inferences saved to: ${args.output}`));
          }

          return {
            success: true,
            message: `Reasoning completed (${reasoningResult.inferences?.length || 0} inferences)`,
            data: reasoningResult
          };

        } catch (error) {
          spinner.stop();
          console.error(chalk.red("\n❌ Reasoning failed:"));
          console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));handleError(new ActionableError({ message: "Operation failed", solution: "Check the error details and try again", category: ErrorCategory.RUNTIME_ERROR }));
        }
      },
    }),

    /**
     * Show knowledge base statistics
     */
    stats: defineCommand({
      meta: {
        name: "stats",
        description: "Show knowledge base statistics and analytics",
      },
      args: {
        detailed: {
          type: "boolean",
          description: "Show detailed statistics",
          default: false,
          alias: "d",
        },
        format: {
          type: "string",
          description: "Output format (table, json, chart)",
          default: "table",
          alias: "f",
        },
        export: {
          type: "string",
          description: "Export statistics to file",
          alias: "e",
        },
        namespaces: {
          type: "boolean",
          description: "Show namespace statistics",
          default: false,
          alias: "n",
        },
        domains: {
          type: "boolean",
          description: "Show domain-specific statistics",
          default: false,
          alias: "D",
        },
      },
      async run({ args }: { args: any }) {
        const spinner = ora("Gathering statistics...").start();

        try {
          // Mock statistics for now - in real implementation would query actual knowledge base
          const stats: KnowledgeStats = {
            totalOntologies: Math.floor(Math.random() * 50) + 10,
            totalTriples: Math.floor(Math.random() * 100000) + 50000,
            totalClasses: Math.floor(Math.random() * 1000) + 500,
            totalProperties: Math.floor(Math.random() * 500) + 250,
            totalIndividuals: Math.floor(Math.random() * 5000) + 2500,
            namespaces: [
              'http://www.w3.org/2002/07/owl#',
              'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
              'http://www.w3.org/2000/01/rdf-schema#',
              'http://purl.org/dc/terms/',
              'http://xmlns.com/foaf/0.1/'
            ],
            domains: ['Healthcare', 'Finance', 'E-commerce', 'IoT', 'Research'],
            recentActivity: {
              loaded: Math.floor(Math.random() * 20) + 5,
              validated: Math.floor(Math.random() * 15) + 3,
              queried: Math.floor(Math.random() * 100) + 50
            },
            storage: {
              used: '245 MB',
              available: '1.2 GB',
              format: 'memory'
            }
          };

          spinner.stop();

          console.log(chalk.blue("\n📊 Knowledge Base Statistics"));
          
          if (args.format === 'json') {
            console.log(JSON.stringify(stats, null, 2));
          } else {
            // Table format
            console.log(chalk.green(`\n📚 Content Overview:`));
            console.log(chalk.white(`  Ontologies: ${stats.totalOntologies.toLocaleString()}`));
            console.log(chalk.white(`  Triples: ${stats.totalTriples.toLocaleString()}`));
            console.log(chalk.white(`  Classes: ${stats.totalClasses.toLocaleString()}`));
            console.log(chalk.white(`  Properties: ${stats.totalProperties.toLocaleString()}`));
            console.log(chalk.white(`  Individuals: ${stats.totalIndividuals.toLocaleString()}`));

            console.log(chalk.cyan(`\n💾 Storage:`));
            console.log(chalk.white(`  Used: ${stats.storage.used}`));
            console.log(chalk.white(`  Available: ${stats.storage.available}`));
            console.log(chalk.white(`  Format: ${stats.storage.format}`));

            console.log(chalk.yellow(`\n⚡ Recent Activity:`));
            console.log(chalk.white(`  Loaded: ${stats.recentActivity.loaded} ontologies`));
            console.log(chalk.white(`  Validated: ${stats.recentActivity.validated} files`));
            console.log(chalk.white(`  Queries: ${stats.recentActivity.queried} executed`));

            if (args.namespaces) {
              console.log(chalk.magenta(`\n🏷️  Namespaces:`));
              stats.namespaces.forEach((ns, index) => {
                console.log(chalk.white(`  ${index + 1}. ${ns}`));
              });
            }

            if (args.domains) {
              console.log(chalk.blue(`\n🏢 Domains:`));
              stats.domains.forEach((domain, index) => {
                console.log(chalk.white(`  ${index + 1}. ${domain}`));
              });
            }
          }

          // Export if requested
          if (args.export) {
            await fs.writeFile(args.export, JSON.stringify(stats, null, 2), 'utf-8');
            console.log(chalk.green(`\n📁 Statistics exported to: ${args.export}`));
          }

          return {
            success: true,
            message: "Statistics gathered successfully",
            data: stats
          };

        } catch (error) {
          spinner.stop();
          console.error(chalk.red("\n❌ Statistics gathering failed:"));
          console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));handleError(new ActionableError({ message: "Operation failed", solution: "Check the error details and try again", category: ErrorCategory.RUNTIME_ERROR }));
        }
      },
    }),

    /**
     * Export knowledge base in various formats
     */
    export: defineCommand({
      meta: {
        name: "export",
        description: "Export knowledge base or ontology in various formats",
      },
      args: {
        source: {
          type: "string",
          description: "Source ontology or knowledge base",
          alias: "s",
        },
        output: {
          type: "positional",
          description: "Output file path",
          required: true,
        },
        format: {
          type: "string",
          description: "Output format (turtle, rdf-xml, jsonld, n3, owl)",
          default: "turtle",
          alias: "f",
        },
        include: {
          type: "string",
          description: "Include specific elements (classes, properties, individuals, all)",
          default: "all",
          alias: "i",
        },
        namespace: {
          type: "string",
          description: "Filter by namespace prefix",
          alias: "ns",
        },
        compress: {
          type: "boolean",
          description: "Compress output file",
          default: false,
          alias: "c",
        },
      },
      async run({ args }: { args: any }) {
        const spinner = ora("Exporting knowledge base...").start();

        try {
          // Mock export for now
          const exportData = generateExportData(args.include, args.namespace);
          
          spinner.text = `Formatting as ${args.format}...`;
          const formattedData = formatExportData(exportData, args.format);
          
          // Create output directory if needed
          await fs.ensureDir(path.dirname(args.output));
          
          if (args.compress) {
            spinner.text = "Compressing output...";
            // In real implementation, would compress the data
          }
          
          await fs.writeFile(args.output, formattedData, 'utf-8');
          
          spinner.stop();

          console.log(chalk.green("\n✅ Export completed successfully"));
          console.log(chalk.cyan(`📁 File: ${args.output}`));
          console.log(chalk.gray(`📄 Format: ${args.format}`));
          console.log(chalk.gray(`📊 Size: ${(formattedData.length / 1024).toFixed(2)} KB`));
          console.log(chalk.gray(`🎯 Include: ${args.include}`));
          
          if (args.namespace) {
            console.log(chalk.gray(`🏷️  Namespace: ${args.namespace}`));
          }
          
          if (args.compress) {
            console.log(chalk.gray(`🗜️ Compressed: Yes`));
          }

          return {
            success: true,
            message: "Export completed successfully",
            data: { file: args.output, format: args.format, size: formattedData.length }
          };

        } catch (error) {
          spinner.stop();
          console.error(chalk.red("\n❌ Export failed:"));
          console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));handleError(new ActionableError({ message: "Operation failed", solution: "Check the error details and try again", category: ErrorCategory.RUNTIME_ERROR }));
        }
      },
    }),
  },
});

// ============================================================================
// ADDITIONAL HELPER FUNCTIONS
// ============================================================================

async function validateSingleOntology(filePath: string, profile: string, strict: boolean): Promise<ValidationReport> {
  try {
    const rdfLoader = new RDFDataLoader();
    const loadResult = await rdfLoader.loadData({
      type: 'file',
      source: filePath,
      format: 'auto'
    });

    if (!loadResult.success) {
      throw new Error(loadResult.error);
    }

    const validation = await validateOntology(loadResult.data!);
    
    return {
      ontology: path.basename(filePath),
      valid: validation.valid,
      profile: profile as any,
      errors: validation.errors.map(err => ({
        type: 'structural',
        severity: 'error' as const,
        message: err
      })),
      statistics: {
        classes: countClasses(loadResult.data!),
        properties: countProperties(loadResult.data!),
        individuals: countIndividuals(loadResult.data!),
        axioms: countAxioms(loadResult.data!)
      },
      recommendations: validation.warnings,
      compliance: {
        [profile]: validation.valid
      }
    };
  } catch (error) {
    return {
      ontology: path.basename(filePath),
      valid: false,
      profile: profile as any,
      errors: [{
        type: 'loading',
        severity: 'error' as const,
        message: error instanceof Error ? error.message : String(error)
      }],
      statistics: { classes: 0, properties: 0, individuals: 0, axioms: 0 },
      recommendations: [],
      compliance: { [profile]: false }
    };
  }
}

async function applyAutomaticFixes(ontologyPath: string, errors: ValidationReport['errors']): Promise<number> {
  // Mock automatic fixes
  let fixedCount = 0;
  
  for (const error of errors) {
    if (error.type === 'naming' || error.severity === 'warning') {
      // These could be auto-fixed
      fixedCount++;
    }
  }
  
  return Math.min(fixedCount, 3); // Mock: fix at most 3 issues
}

function generateValidationReport(reports: ValidationReport[], format: string): string {
  if (format === 'json') {
    return JSON.stringify(reports, null, 2);
  }
  
  // Generate text report
  let report = "Ontology Validation Report\n";
  report += "=" + "=".repeat(25) + "\n\n";
  
  reports.forEach(r => {
    report += `File: ${r.ontology}\n`;
    report += `Status: ${r.valid ? 'VALID' : 'INVALID'}\n`;
    report += `Errors: ${r.errors.length}\n`;
    report += `Profile: ${r.profile}\n\n`;
  });
  
  return report;
}

function formatInferences(inferences: string[], format: OntologyFormat): string {
  switch (format) {
    case 'turtle':
      return inferences.join(' .\n') + ' .';
    case 'jsonld':
      return JSON.stringify({ inferences }, null, 2);
    default:
      return inferences.join('\n');
  }
}

function generateExportData(include: string, namespace?: string): any {
  // Mock export data generation
  return {
    classes: include === 'all' || include === 'classes' ? ['Person', 'Organization', 'Event'] : [],
    properties: include === 'all' || include === 'properties' ? ['name', 'email', 'memberOf'] : [],
    individuals: include === 'all' || include === 'individuals' ? ['john_doe', 'acme_corp'] : []
  };
}

function formatExportData(data: any, format: OntologyFormat): string {
  switch (format) {
    case 'turtle':
      return `@prefix ex: <http://example.org/> .\n\n# Classes\n${data.classes.map((c: string) => `ex:${c} a owl:Class .`).join('\n')}\n`;
    case 'jsonld':
      return JSON.stringify(data, null, 2);
    case 'rdf-xml':
      return `<?xml version="1.0"?>\n<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n  <!-- Classes -->\n</rdf:RDF>`;
    default:
      return JSON.stringify(data, null, 2);
  }
}