#!/usr/bin/env node

/**
 * CLI Integration Example for KGEN Core RDF Processing
 * Demonstrates how to integrate the kgen-core package with CLI commands
 */

import { RDFCore } from '../src/rdf/index.js';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CLI command implementations using kgen-core
export class KgenCLI {
  constructor(options = {}) {
    this.rdf = new RDFCore({
      enableCaching: true,
      defaultFormat: 'turtle',
      validateInputs: true,
      ...options
    });
    
    this.verbose = options.verbose || false;
  }

  /**
   * Parse RDF file and return statistics
   * Usage: kgen graph parse <file> [--format turtle]
   */
  async parseCommand(filePath, options = {}) {
    try {
      this.log(`Parsing RDF file: ${filePath}`);
      
      const data = await readFile(filePath, 'utf8');
      const result = await this.rdf.parse(data, options.format);
      
      const stats = this.rdf.getStats();
      
      return {
        success: true,
        file: filePath,
        format: result.format,
        quads: result.count,
        parseTime: result.parseTime,
        subjects: stats.graph.subjects,
        predicates: stats.graph.predicates,
        objects: stats.graph.objects,
        prefixes: Object.keys(result.prefixes).length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        file: filePath
      };
    }
  }

  /**
   * Calculate content hash for RDF file
   * Usage: kgen graph hash <file> [--algorithm sha256] [--prefix kgen]
   */
  async hashCommand(filePath, options = {}) {
    try {
      this.log(`Calculating hash for: ${filePath}`);
      
      const data = await readFile(filePath, 'utf8');
      await this.rdf.add(data, options.format);
      
      const hashOptions = {
        algorithm: options.algorithm || 'sha256',
        normalization: 'rdf-dataset-canonical'
      };
      
      const hash = this.rdf.calculateHash(hashOptions);
      const contentId = this.rdf.createContentId({
        prefix: options.prefix || 'kgen',
        version: 'v1',
        algorithm: hashOptions.algorithm
      });
      
      const stats = this.rdf.getStats();
      
      return {
        success: true,
        file: filePath,
        hash,
        contentId,
        algorithm: hashOptions.algorithm,
        quads: stats.graph.totalQuads,
        deterministic: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        file: filePath
      };
    }
  }

  /**
   * Validate RDF file
   * Usage: kgen graph validate <file> [--format turtle] [--check-namespaces]
   */
  async validateCommand(filePath, options = {}) {
    try {
      this.log(`Validating RDF file: ${filePath}`);
      
      const data = await readFile(filePath, 'utf8');
      const result = await this.rdf.validate(data, options.format, {
        checkNamespaces: options.checkNamespaces || false
      });
      
      return {
        success: result.isValid,
        file: filePath,
        isValid: result.isValid,
        errors: result.errors,
        warnings: result.warnings,
        stats: result.stats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        file: filePath
      };
    }
  }

  /**
   * Convert RDF between formats
   * Usage: kgen graph convert <input> <output> --from turtle --to jsonld
   */
  async convertCommand(inputPath, outputPath, options = {}) {
    try {
      this.log(`Converting ${inputPath} → ${outputPath}`);
      
      const inputData = await readFile(inputPath, 'utf8');
      await this.rdf.add(inputData, options.from || 'turtle');
      
      const outputData = await this.rdf.serialize(null, options.to || 'jsonld', {
        deterministic: true,
        prettyPrint: true,
        includeComments: options.comments
      });
      
      await writeFile(outputPath, outputData, 'utf8');
      
      const stats = this.rdf.getStats();
      
      return {
        success: true,
        input: inputPath,
        output: outputPath,
        fromFormat: options.from || 'turtle',
        toFormat: options.to || 'jsonld',
        quads: stats.graph.totalQuads,
        outputSize: outputData.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        input: inputPath,
        output: outputPath
      };
    }
  }

  /**
   * Export graph with complete metadata
   * Usage: kgen graph export <file> <output> [--format turtle] [--include-metadata]
   */
  async exportCommand(inputPath, outputPath, options = {}) {
    try {
      this.log(`Exporting ${inputPath} with metadata → ${outputPath}`);
      
      const inputData = await readFile(inputPath, 'utf8');
      await this.rdf.add(inputData, options.format || 'turtle');
      
      const exported = await this.rdf.export(options.outputFormat || 'turtle', {
        includeComments: true,
        header: `Exported from ${inputPath}`,
        deterministic: true
      });
      
      const output = options.includeMetadata ? {
        rdf: exported.data,
        metadata: {
          hash: exported.hash,
          contentId: exported.contentId,
          stats: exported.stats,
          timestamp: exported.timestamp,
          format: exported.format
        }
      } : exported.data;
      
      const outputData = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
      await writeFile(outputPath, outputData, 'utf8');
      
      return {
        success: true,
        input: inputPath,
        output: outputPath,
        hash: exported.hash,
        contentId: exported.contentId,
        format: exported.format
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        input: inputPath,
        output: outputPath
      };
    }
  }

  /**
   * Compare two RDF files
   * Usage: kgen graph diff <file1> <file2>
   */
  async diffCommand(file1Path, file2Path, options = {}) {
    try {
      this.log(`Comparing ${file1Path} and ${file2Path}`);
      
      const rdf1 = new RDFCore();
      const rdf2 = new RDFCore();
      
      const data1 = await readFile(file1Path, 'utf8');
      const data2 = await readFile(file2Path, 'utf8');
      
      await rdf1.add(data1, options.format);
      await rdf2.add(data2, options.format);
      
      const diff = rdf1.diff(rdf2);
      
      // Calculate similarity percentage
      const totalTriples = Math.max(rdf1.getStats().graph.totalQuads, rdf2.getStats().graph.totalQuads, 1);
      const similarity = (diff.common / totalTriples) * 100;
      
      return {
        success: true,
        file1: file1Path,
        file2: file2Path,
        added: diff.added,
        removed: diff.removed,
        common: diff.common,
        similarity: Math.round(similarity * 100) / 100,
        identical: diff.added === 0 && diff.removed === 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        file1: file1Path,
        file2: file2Path
      };
    }
  }

  /**
   * Get statistics for RDF file
   * Usage: kgen graph stats <file>
   */
  async statsCommand(filePath, options = {}) {
    try {
      this.log(`Getting statistics for: ${filePath}`);
      
      const data = await readFile(filePath, 'utf8');
      await this.rdf.add(data, options.format);
      
      const stats = this.rdf.getStats();
      const health = this.rdf.healthCheck();
      
      return {
        success: true,
        file: filePath,
        graph: {
          totalQuads: stats.graph.totalQuads,
          subjects: stats.graph.subjects,
          predicates: stats.graph.predicates,
          objects: stats.graph.objects,
          graphs: stats.graph.graphs
        },
        namespaces: {
          total: stats.namespaces.total,
          standard: stats.namespaces.standard,
          custom: stats.namespaces.custom
        },
        formats: stats.formats,
        health: health.status
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        file: filePath
      };
    }
  }

  log(message) {
    if (this.verbose) {
      console.log(`[KGEN] ${message}`);
    }
  }

  cleanup() {
    this.rdf.destroy();
  }
}

// Example CLI runner for demonstration
async function runExamples() {
  const cli = new KgenCLI({ verbose: true });
  
  // Create sample RDF file for testing
  const sampleRDF = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:person1 a foaf:Person ;
           foaf:name "John Doe" ;
           foaf:age 30 ;
           foaf:knows ex:person2 .

ex:person2 a foaf:Person ;
           foaf:name "Jane Smith" ;
           foaf:age 25 .
  `;
  
  const testFile = resolve(__dirname, 'sample.ttl');
  await writeFile(testFile, sampleRDF, 'utf8');
  
  console.log('🚀 KGEN Core CLI Integration Examples\n');
  
  // Example 1: Parse
  console.log('1. Parse RDF file:');
  const parseResult = await cli.parseCommand(testFile, { format: 'turtle' });
  console.log(JSON.stringify(parseResult, null, 2));
  console.log();
  
  // Example 2: Calculate hash
  console.log('2. Calculate content hash:');
  const hashResult = await cli.hashCommand(testFile, { algorithm: 'sha256' });
  console.log(JSON.stringify(hashResult, null, 2));
  console.log();
  
  // Example 3: Validate
  console.log('3. Validate RDF:');
  const validateResult = await cli.validateCommand(testFile, { checkNamespaces: true });
  console.log(JSON.stringify(validateResult, null, 2));
  console.log();
  
  // Example 4: Convert to JSON-LD
  console.log('4. Convert to JSON-LD:');
  const jsonldFile = resolve(__dirname, 'sample.jsonld');
  const convertResult = await cli.convertCommand(testFile, jsonldFile, {
    from: 'turtle',
    to: 'jsonld'
  });
  console.log(JSON.stringify(convertResult, null, 2));
  console.log();
  
  // Example 5: Get statistics
  console.log('5. Graph statistics:');
  const statsResult = await cli.statsCommand(testFile);
  console.log(JSON.stringify(statsResult, null, 2));
  console.log();
  
  // Cleanup
  cli.cleanup();
  
  console.log('✅ All examples completed successfully!');
  console.log('\n📝 Integration Points for CLI:');
  console.log('- Import { KgenCLI } from this file');
  console.log('- Use methods like parseCommand(), hashCommand(), etc.');
  console.log('- All methods return { success, ...data } or { success: false, error }');
  console.log('- Enable verbose mode for detailed logging');
}

// Run examples if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples().catch(console.error);
}

export { KgenCLI };
export default KgenCLI;