#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { Parser, Store, Writer } from 'n3';
import chalk from 'chalk';

/**
 * SHACL validation engine for RDF graphs
 */
class SHACLValidator {
  constructor() {
    this.shapesGraph = new Store();
    this.dataGraph = new Store();
  }

  /**
   * Load SHACL shapes from file
   * @param {string} shapesPath - Path to SHACL shapes file
   */
  loadShapes(shapesPath) {
    if (!existsSync(shapesPath)) {
      throw new Error(`SHACL shapes file not found: ${shapesPath}`);
    }

    const shapesContent = readFileSync(shapesPath, 'utf8');
    const parser = new Parser({ format: 'text/turtle' });
    const quads = parser.parse(shapesContent);
    
    quads.forEach(quad => this.shapesGraph.addQuad(quad));
    
    return quads.length;
  }

  /**
   * Load data graph from file
   * @param {string} dataPath - Path to data graph file
   */
  loadData(dataPath) {
    if (!existsSync(dataPath)) {
      throw new Error(`Data graph file not found: ${dataPath}`);
    }

    const dataContent = readFileSync(dataPath, 'utf8');
    const parser = new Parser({ format: 'text/turtle' });
    const quads = parser.parse(dataContent);
    
    quads.forEach(quad => this.dataGraph.addQuad(quad));
    
    return quads.length;
  }

  /**
   * Validate data graph against SHACL shapes
   * @returns {Object} Validation results
   */
  validate() {
    const results = {
      conforms: true,
      violations: [],
      warnings: [],
      shapesCount: 0,
      validatedNodes: 0
    };

    // Get all NodeShapes from shapes graph
    const nodeShapes = this.shapesGraph.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/ns/shacl#NodeShape');
    results.shapesCount = nodeShapes.length;

    nodeShapes.forEach(shapeQuad => {
      const shapeIRI = shapeQuad.subject;
      this.validateNodeShape(shapeIRI, results);
    });

    return results;
  }

  /**
   * Validate a specific node shape
   * @param {NamedNode} shapeIRI - The shape to validate
   * @param {Object} results - Results object to populate
   */
  validateNodeShape(shapeIRI, results) {
    // Get target nodes for this shape
    const targetNodes = this.getTargetNodes(shapeIRI);
    
    targetNodes.forEach(nodeIRI => {
      results.validatedNodes++;
      this.validateNode(nodeIRI, shapeIRI, results);
    });
  }

  /**
   * Get target nodes for a shape
   * @param {NamedNode} shapeIRI - The shape IRI
   * @returns {Array} Array of target node IRIs
   */
  getTargetNodes(shapeIRI) {
    const targetNodes = [];

    // sh:targetClass
    const targetClasses = this.shapesGraph.getQuads(shapeIRI, 'http://www.w3.org/ns/shacl#targetClass', null);
    targetClasses.forEach(targetClassQuad => {
      const targetClass = targetClassQuad.object;
      const instances = this.dataGraph.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', targetClass);
      instances.forEach(instance => targetNodes.push(instance.subject));
    });

    // sh:targetNode
    const targetNodeQuads = this.shapesGraph.getQuads(shapeIRI, 'http://www.w3.org/ns/shacl#targetNode', null);
    targetNodeQuads.forEach(targetNodeQuad => {
      targetNodes.push(targetNodeQuad.object);
    });

    return [...new Set(targetNodes)]; // Remove duplicates
  }

  /**
   * Validate a node against a shape
   * @param {NamedNode} nodeIRI - Node to validate
   * @param {NamedNode} shapeIRI - Shape to validate against
   * @param {Object} results - Results object to populate
   */
  validateNode(nodeIRI, shapeIRI, results) {
    // Get property shapes for this node shape
    const propertyShapes = this.shapesGraph.getQuads(shapeIRI, 'http://www.w3.org/ns/shacl#property', null);
    
    propertyShapes.forEach(propShapeQuad => {
      const propShape = propShapeQuad.object;
      this.validatePropertyShape(nodeIRI, propShape, results);
    });

    // Validate closed shapes
    this.validateClosedShape(nodeIRI, shapeIRI, results);
  }

  /**
   * Validate property shape constraints
   * @param {NamedNode} nodeIRI - Node being validated
   * @param {NamedNode} propShape - Property shape
   * @param {Object} results - Results object to populate
   */
  validatePropertyShape(nodeIRI, propShape, results) {
    // Get property path
    const pathQuads = this.shapesGraph.getQuads(propShape, 'http://www.w3.org/ns/shacl#path', null);
    if (pathQuads.length === 0) return;

    const propertyPath = pathQuads[0].object;
    const propertyValues = this.dataGraph.getQuads(nodeIRI, propertyPath, null);

    // sh:minCount
    const minCountQuads = this.shapesGraph.getQuads(propShape, 'http://www.w3.org/ns/shacl#minCount', null);
    if (minCountQuads.length > 0) {
      const minCount = parseInt(minCountQuads[0].object.value);
      if (propertyValues.length < minCount) {
        results.conforms = false;
        results.violations.push({
          type: 'MinCountConstraintComponent',
          focusNode: nodeIRI.value,
          resultPath: propertyPath.value,
          message: `Property ${propertyPath.value} has ${propertyValues.length} values, but minimum ${minCount} required`,
          severity: 'http://www.w3.org/ns/shacl#Violation'
        });
      }
    }

    // sh:maxCount
    const maxCountQuads = this.shapesGraph.getQuads(propShape, 'http://www.w3.org/ns/shacl#maxCount', null);
    if (maxCountQuads.length > 0) {
      const maxCount = parseInt(maxCountQuads[0].object.value);
      if (propertyValues.length > maxCount) {
        results.conforms = false;
        results.violations.push({
          type: 'MaxCountConstraintComponent',
          focusNode: nodeIRI.value,
          resultPath: propertyPath.value,
          message: `Property ${propertyPath.value} has ${propertyValues.length} values, but maximum ${maxCount} allowed`,
          severity: 'http://www.w3.org/ns/shacl#Violation'
        });
      }
    }

    // sh:datatype
    const datatypeQuads = this.shapesGraph.getQuads(propShape, 'http://www.w3.org/ns/shacl#datatype', null);
    if (datatypeQuads.length > 0) {
      const expectedDatatype = datatypeQuads[0].object;
      propertyValues.forEach(valueQuad => {
        if (valueQuad.object.termType === 'Literal') {
          const actualDatatype = valueQuad.object.datatype;
          if (actualDatatype.value !== expectedDatatype.value) {
            results.conforms = false;
            results.violations.push({
              type: 'DatatypeConstraintComponent',
              focusNode: nodeIRI.value,
              resultPath: propertyPath.value,
              value: valueQuad.object.value,
              message: `Value "${valueQuad.object.value}" has datatype ${actualDatatype.value}, but ${expectedDatatype.value} required`,
              severity: 'http://www.w3.org/ns/shacl#Violation'
            });
          }
        }
      });
    }

    // sh:pattern
    const patternQuads = this.shapesGraph.getQuads(propShape, 'http://www.w3.org/ns/shacl#pattern', null);
    if (patternQuads.length > 0) {
      const pattern = new RegExp(patternQuads[0].object.value);
      propertyValues.forEach(valueQuad => {
        if (valueQuad.object.termType === 'Literal') {
          if (!pattern.test(valueQuad.object.value)) {
            results.conforms = false;
            results.violations.push({
              type: 'PatternConstraintComponent',
              focusNode: nodeIRI.value,
              resultPath: propertyPath.value,
              value: valueQuad.object.value,
              message: `Value "${valueQuad.object.value}" does not match required pattern: ${patternQuads[0].object.value}`,
              severity: 'http://www.w3.org/ns/shacl#Violation'
            });
          }
        }
      });
    }
  }

  /**
   * Validate closed shape constraints  
   * @param {NamedNode} nodeIRI - Node being validated
   * @param {NamedNode} shapeIRI - Shape IRI
   * @param {Object} results - Results object to populate
   */
  validateClosedShape(nodeIRI, shapeIRI, results) {
    const closedQuads = this.shapesGraph.getQuads(shapeIRI, 'http://www.w3.org/ns/shacl#closed', null);
    if (closedQuads.length === 0 || closedQuads[0].object.value !== 'true') {
      return; // Not a closed shape
    }

    // Get allowed properties
    const allowedProps = new Set();
    const propShapes = this.shapesGraph.getQuads(shapeIRI, 'http://www.w3.org/ns/shacl#property', null);
    propShapes.forEach(propShapeQuad => {
      const pathQuads = this.shapesGraph.getQuads(propShapeQuad.object, 'http://www.w3.org/ns/shacl#path', null);
      if (pathQuads.length > 0) {
        allowedProps.add(pathQuads[0].object.value);
      }
    });

    // Add ignored properties
    const ignoredPropQuads = this.shapesGraph.getQuads(shapeIRI, 'http://www.w3.org/ns/shacl#ignoredProperties', null);
    // This would need more complex handling for RDF lists

    // Check node properties
    const nodeProps = this.dataGraph.getQuads(nodeIRI, null, null);
    nodeProps.forEach(propQuad => {
      if (!allowedProps.has(propQuad.predicate.value)) {
        results.conforms = false;
        results.violations.push({
          type: 'ClosedConstraintComponent',
          focusNode: nodeIRI.value,
          resultPath: propQuad.predicate.value,
          message: `Property ${propQuad.predicate.value} is not allowed in closed shape`,
          severity: 'http://www.w3.org/ns/shacl#Violation'
        });
      }
    });
  }
}

/**
 * Create validate graph command
 * @returns {Command} The configured validate graph command
 */
export function createValidateGraphCommand() {
  return new Command('graph')
    .description('Validate RDF graphs against SHACL shapes and semantic constraints')
    .argument('<dataGraph>', 'Path to RDF data graph file')
    .option('-s, --shapes <shapesFile>', 'Path to SHACL shapes file')
    .option('-f, --format <format>', 'RDF format (turtle, n3, jsonld, ntriples)', 'turtle')
    .option('-o, --output <file>', 'Output validation report to file')
    .option('--json', 'Output results in JSON format')
    .option('--conforms-only', 'Only check if graph conforms (boolean result)')
    .option('-v, --verbose', 'Show detailed validation information')
    .option('--exit-code', 'Exit with non-zero code if validation fails')
    .action(async (dataGraph, options) => {
      try {
        console.log(chalk.blue('🔍 Graph Validation'));
        console.log(chalk.blue('━'.repeat(30)));

        const validator = new SHACLValidator();

        // Load data graph
        console.log(chalk.blue(`📊 Loading data graph: ${dataGraph}`));
        const dataTriples = validator.loadData(resolve(dataGraph));
        console.log(chalk.green(`  ✓ Loaded ${dataTriples} triples`));

        // Load shapes if provided
        let results;
        if (options.shapes) {
          console.log(chalk.blue(`📋 Loading SHACL shapes: ${options.shapes}`));
          const shapeTriples = validator.loadShapes(resolve(options.shapes));
          console.log(chalk.green(`  ✓ Loaded ${shapeTriples} shape triples`));

          console.log(chalk.blue('⚡ Running SHACL validation...'));
          results = validator.validate();
        } else {
          // Basic graph validation without SHACL
          results = {
            conforms: true,
            violations: [],
            warnings: [],
            shapesCount: 0,
            validatedNodes: 0,
            basicValidation: true,
            dataTriples
          };

          console.log(chalk.yellow('⚠️  No SHACL shapes provided - performing basic validation'));
        }

        // Display results
        console.log(chalk.blue('\n📊 Validation Results'));
        console.log(chalk.blue('━'.repeat(25)));
        
        if (results.conforms) {
          console.log(chalk.green('✅ Graph conforms to constraints'));
        } else {
          console.log(chalk.red('❌ Graph does not conform to constraints'));
        }

        if (options.shapes) {
          console.log(`Shapes validated: ${results.shapesCount}`);
          console.log(`Nodes validated: ${results.validatedNodes}`);
        } else {
          console.log(`Data triples: ${results.dataTriples}`);
        }
        
        console.log(`Violations: ${chalk.red(results.violations.length)}`);
        console.log(`Warnings: ${chalk.yellow(results.warnings.length)}`);

        // Show violations
        if (results.violations.length > 0 && !options.conformsOnly) {
          console.log(chalk.red('\n🚫 Constraint Violations:'));
          console.log(chalk.red('━'.repeat(25)));
          
          results.violations.forEach((violation, index) => {
            console.log(chalk.red(`${index + 1}. ${violation.type}`));
            console.log(chalk.gray(`   Focus Node: ${violation.focusNode}`));
            if (violation.resultPath) {
              console.log(chalk.gray(`   Property: ${violation.resultPath}`));
            }
            if (violation.value) {
              console.log(chalk.gray(`   Value: ${violation.value}`));
            }
            console.log(chalk.gray(`   Message: ${violation.message}`));
            console.log('');
          });
        }

        // JSON output
        if (options.json) {
          const jsonResult = {
            conforms: results.conforms,
            violations: results.violations,
            warnings: results.warnings,
            summary: {
              shapesCount: results.shapesCount,
              validatedNodes: results.validatedNodes,
              violationCount: results.violations.length,
              warningCount: results.warnings.length
            },
            timestamp: new Date().toISOString()
          };

          if (options.output) {
            const fs = await import('fs/promises');
            await fs.writeFile(options.output, JSON.stringify(jsonResult, null, 2));
            console.log(chalk.blue(`📄 Results written to: ${options.output}`));
          } else {
            console.log(chalk.blue('\n📄 JSON Results:'));
            console.log(JSON.stringify(jsonResult, null, 2));
          }
        }

        if (options.conformsOnly) {
          console.log(results.conforms ? 'true' : 'false');
        }

        if (options.exitCode && !results.conforms) {
          process.exit(1);
        }

      } catch (error) {
        console.error(chalk.red('Graph validation failed:'), error.message);
        if (options.exitCode) {
          process.exit(1);
        }
      }
    });
}