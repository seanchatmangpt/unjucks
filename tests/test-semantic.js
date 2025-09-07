#!/usr/bin/env node

// Test the semantic libraries directly to ensure they work
import { TurtleParser, TurtleParseError } from '../src/lib/turtle-parser.js';
import { SemanticRDFValidator } from '../src/lib/semantic-rdf-validator.js';
import fs from 'fs-extra';
import chalk from 'chalk';

async function testSemanticValidation() {
  console.log(chalk.blue("🧪 Testing Semantic Libraries"));
  
  try {
    // Test 1: TurtleParser
    console.log(chalk.cyan("1. Testing TurtleParser..."));
    const content = await fs.readFile('./tests/sample-ontology.ttl', 'utf-8');
    
    const parser = new TurtleParser({
      baseIRI: 'http://example.org/',
      format: 'text/turtle'
    });
    
    const parseResult = await parser.parse(content);
    console.log(chalk.green(`✅ Parsed ${parseResult.stats.tripleCount} triples`));
    console.log(chalk.gray(`   Prefixes: ${parseResult.stats.prefixCount}`));
    console.log(chalk.gray(`   Parse time: ${parseResult.stats.parseTime}ms`));
    
    // Test 2: SemanticRDFValidator
    console.log(chalk.cyan("\n2. Testing SemanticRDFValidator..."));
    const validator = new SemanticRDFValidator({
      validationLevel: 'standard',
      enableValidation: true
    });
    
    const validationResult = await validator.validateRDF(content);
    console.log(chalk.green(`✅ Validation completed: ${validationResult.valid ? 'VALID' : 'INVALID'}`));
    console.log(chalk.gray(`   Errors: ${validationResult.errors.length}`));
    console.log(chalk.gray(`   Warnings: ${validationResult.warnings.length}`));
    
    if (validationResult.errors.length > 0) {
      console.log(chalk.red("\n❌ Validation Errors:"));
      validationResult.errors.forEach(error => {
        console.log(chalk.red(`   • ${error.message}`));
      });
    }
    
    if (validationResult.warnings.length > 0) {
      console.log(chalk.yellow("\n⚠️ Validation Warnings:"));
      validationResult.warnings.forEach(warning => {
        console.log(chalk.yellow(`   • ${warning.message}`));
      });
    }
    
    // Test 3: N3.js integration
    console.log(chalk.cyan("\n3. Testing N3.js integration..."));
    const { Store, Parser, Writer, DataFactory } = await import('n3');
    
    const n3Parser = new Parser();
    const store = new Store();
    const quads = [];
    
    n3Parser.parse(content, (error, quad, prefixes) => {
      if (error) {
        console.log(chalk.red(`❌ N3 parse error: ${error.message}`));
        return;
      }
      if (quad) {
        quads.push(quad);
        store.addQuad(quad);
      } else {
        // Parsing complete
        console.log(chalk.green(`✅ N3.js parsed ${quads.length} quads`));
        console.log(chalk.green(`✅ Store contains ${store.size} quads`));
        
        // Test queries
        const typeQuads = store.getQuads(null, DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null);
        console.log(chalk.gray(`   Type declarations: ${typeQuads.length}`));
      }
    });
    
    console.log(chalk.green("\n🎉 All semantic library tests completed successfully!"));
    
  } catch (error) {
    console.log(chalk.red(`❌ Test failed: ${error.message}`));
    if (error instanceof TurtleParseError) {
      console.log(chalk.red(`   Parse error at line ${error.line}, column ${error.column}`));
    }
    console.error(error.stack);
    process.exit(1);
  }
}

testSemanticValidation();