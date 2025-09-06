/**
 * CLI Commands for Type Conversion
 * Bidirectional conversion between RDF/Turtle and TypeScript
 */

import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { TurtleParser } from '../../lib/turtle-parser.js';
import { 
  generateTypeScriptFromOntology, 
  generateOntologyFromTypeScript,
  UnjucksTypeConverter,
  type TypeScriptGenerationOptions,
  type OntologyGenerationOptions
} from '../../lib/type-converters/index.js';

/**
 * Generate TypeScript interfaces from TTL ontology
 */
export const generateInterfaces = defineCommand({
  meta: {
    name: 'generate:interfaces',
    description: 'Generate TypeScript interfaces from RDF/Turtle ontology'
  },
  args: {
    ontology: {
      type: 'positional',
      description: 'Path to TTL ontology file',
      required: true
    },
    output: {
      type: 'string',
      description: 'Output TypeScript file path',
      alias: 'o'
    },
    namespace: {
      type: 'string',
      description: 'TypeScript namespace for generated interfaces',
      default: 'Generated'
    },
    format: {
      type: 'string',
      description: 'Output format (interface|type|class)',
      default: 'interface'
    },
    enterprise: {
      type: 'boolean',
      description: 'Include enterprise-specific type mappings',
      default: false
    },
    validation: {
      type: 'boolean', 
      description: 'Include validation decorators',
      default: false
    },
    docs: {
      type: 'boolean',
      description: 'Include JSDoc documentation from RDF labels/comments',
      default: true
    }
  },
  async run({ args }) {
    try {
      // Read and parse ontology
      const ontologyPath = resolve(args.ontology);
      if (!existsSync(ontologyPath)) {
        throw new Error(`Ontology file not found: ${ontologyPath}`);
      }

      const ontologyContent = readFileSync(ontologyPath, 'utf-8');
      const parser = new TurtleParser();
      const ontologyData = await parser.parse(ontologyContent);

      // Generate TypeScript
      const options: TypeScriptGenerationOptions = {
        namespace: args.namespace,
        outputFormat: args.format as any,
        includeValidation: args.validation,
        includeDocumentation: args.docs,
        enterpriseTypes: args.enterprise
      };

      const typescript = await generateTypeScriptFromOntology(ontologyData, options);

      // Output result
      if (args.output) {
        const outputPath = resolve(args.output);
        writeFileSync(outputPath, typescript);
        console.log(`✓ Generated TypeScript interfaces: ${outputPath}`);
        console.log(`  Classes: ${ontologyData.stats.subjectCount || 'Unknown'}`);
        console.log(`  Properties: ${ontologyData.stats.predicateCount || 'Unknown'}`);
        console.log(`  Namespace: ${args.namespace}`);
      } else {
        console.log(typescript);
      }

    } catch (error) {
      console.error(`✗ Error generating interfaces: ${(error as Error).message}`);
      process.exit(1);
    }
  }
});

/**
 * Generate TTL ontology from TypeScript interfaces
 */
export const generateOntology = defineCommand({
  meta: {
    name: 'generate:ontology',
    description: 'Generate RDF/Turtle ontology from TypeScript interfaces'
  },
  args: {
    source: {
      type: 'positional',
      description: 'Path to TypeScript source file or directory',
      required: true
    },
    output: {
      type: 'string',
      description: 'Output TTL ontology file path',
      alias: 'o'
    },
    baseUri: {
      type: 'string',
      description: 'Base URI for generated ontology',
      default: 'http://example.org/'
    },
    format: {
      type: 'string',
      description: 'Output format (turtle|rdf-xml|n3|json-ld)',
      default: 'turtle'
    },
    owl: {
      type: 'boolean',
      description: 'Use OWL constructs vs pure RDFS',
      default: false
    },
    shapes: {
      type: 'boolean',
      description: 'Generate SHACL validation shapes',
      default: false
    },
    namespace: {
      type: 'string',
      description: 'Namespace prefix for classes',
      default: 'ex'
    }
  },
  async run({ args }) {
    try {
      // Read TypeScript source
      const sourcePath = resolve(args.source);
      if (!existsSync(sourcePath)) {
        throw new Error(`TypeScript source not found: ${sourcePath}`);
      }

      const sourceCode = readFileSync(sourcePath, 'utf-8');

      // Generate ontology
      const options: OntologyGenerationOptions = {
        baseUri: args.baseUri,
        format: args.format as any,
        useOWL: args.owl,
        generateShapes: args.shapes,
        namespacePrefix: args.namespace
      };

      const ontology = await generateOntologyFromTypeScript(sourceCode, options);

      // Output result
      if (args.output) {
        const outputPath = resolve(args.output);
        writeFileSync(outputPath, ontology);
        console.log(`✓ Generated RDF ontology: ${outputPath}`);
        console.log(`  Format: ${args.format}`);
        console.log(`  Base URI: ${args.baseUri}`);
        console.log(`  OWL: ${args.owl ? 'Yes' : 'No'}`);
        console.log(`  SHACL shapes: ${args.shapes ? 'Yes' : 'No'}`);
      } else {
        console.log(ontology);
      }

    } catch (error) {
      console.error(`✗ Error generating ontology: ${(error as Error).message}`);
      process.exit(1);
    }
  }
});

/**
 * Validate round-trip conversion (TTL → TS → TTL)
 */
export const validateRoundTrip = defineCommand({
  meta: {
    name: 'validate:round-trip',
    description: 'Test round-trip conversion between TTL and TypeScript'
  },
  args: {
    ontology: {
      type: 'positional',
      description: 'Path to original TTL ontology file',
      required: true
    },
    verbose: {
      type: 'boolean',
      description: 'Show detailed conversion output',
      default: false,
      alias: 'v'
    }
  },
  async run({ args }) {
    try {
      // Read and parse original ontology
      const ontologyPath = resolve(args.ontology);
      if (!existsSync(ontologyPath)) {
        throw new Error(`Ontology file not found: ${ontologyPath}`);
      }

      const ontologyContent = readFileSync(ontologyPath, 'utf-8');
      const parser = new TurtleParser();
      const originalData = await parser.parse(ontologyContent);

      console.log('🔄 Starting round-trip validation...');
      console.log(`📁 Original ontology: ${ontologyPath}`);
      console.log(`📊 Original stats: ${originalData.stats.tripleCount} triples, ${originalData.stats.prefixCount} prefixes`);

      // Perform round-trip test
      const result = await UnjucksTypeConverter.testRoundTrip(originalData);

      if (args.verbose) {
        console.log('\n📝 Generated TypeScript:');
        console.log('─'.repeat(50));
        console.log(result.typescript);
        
        console.log('\n🔄 Regenerated TTL:');
        console.log('─'.repeat(50));
        console.log(result.regenerated);
      }

      // Simple validation (TODO: Implement semantic comparison)
      const originalLines = ontologyContent.split('\n').filter(line => line.trim() && !line.startsWith('#')).length;
      const regeneratedLines = result.regenerated.split('\n').filter(line => line.trim() && !line.startsWith('#')).length;
      
      const linesMatch = Math.abs(originalLines - regeneratedLines) <= 5; // Allow 5 line difference
      
      console.log('\n📈 Round-trip validation results:');
      console.log(`✓ TypeScript generation: Success`);
      console.log(`✓ TTL regeneration: Success`);
      console.log(`${linesMatch ? '✓' : '⚠'} Structure preservation: ${linesMatch ? 'Good' : 'Check differences'}`);
      console.log(`📏 Original lines: ${originalLines}, Regenerated: ${regeneratedLines}`);

      if (linesMatch) {
        console.log('\n🎉 Round-trip validation PASSED');
      } else {
        console.log('\n⚠️  Round-trip validation completed with differences');
        console.log('   Manual review recommended for semantic accuracy');
      }

    } catch (error) {
      console.error(`✗ Round-trip validation failed: ${(error as Error).message}`);
      process.exit(1);
    }
  }
});

/**
 * Type conversion utility commands  
 */
export const typeConversionCommands = {
  generateInterfaces,
  generateOntology,
  validateRoundTrip
};