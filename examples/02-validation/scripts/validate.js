#!/usr/bin/env node
/**
 * Semantic Validation Script
 * 
 * This script validates RDF data against SHACL shapes to ensure
 * semantic consistency and business rule compliance.
 */

import { Parser, Store } from 'n3';
import * as fs from 'node:fs/promises';
import path from 'node:path';

// Simple SHACL validator (80/20 approach)
class SHACLValidator {
  constructor() {
    this.shapesStore = new Store();
    this.dataStore = new Store();
    this.parser = new Parser();
  }

  async loadShapes(shapesContent) {
    return new Promise((resolve, reject) => {
      this.parser.parse(shapesContent, (error, quad) => {
        if (error) {
          reject(error);
        } else if (quad) {
          this.shapesStore.add(quad);
        } else {
          resolve();
        }
      });
    });
  }

  async loadData(dataContent) {
    return new Promise((resolve, reject) => {
      this.parser.parse(dataContent, (error, quad) => {
        if (error) {
          reject(error);
        } else if (quad) {
          this.dataStore.add(quad);
        } else {
          resolve();
        }
      });
    });
  }

  validate() {
    const violations = [];
    
    // Get all node shapes
    const nodeShapes = this.shapesStore.getQuads(
      null,
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      'http://www.w3.org/ns/shacl#NodeShape',
      null
    );

    console.log(`Found ${nodeShapes.length} node shapes to validate against`);

    nodeShapes.forEach(shapeQuad => {
      const shape = shapeQuad.subject.value;
      console.log(`\nValidating shape: ${this.getLocalName(shape)}`);
      
      // Get target class
      const targetClasses = this.shapesStore.getQuads(
        shapeQuad.subject,
        'http://www.w3.org/ns/shacl#targetClass',
        null,
        null
      );

      targetClasses.forEach(targetClassQuad => {
        const targetClass = targetClassQuad.object.value;
        console.log(`  Target class: ${this.getLocalName(targetClass)}`);
        
        // Find instances of target class
        const instances = this.dataStore.getQuads(
          null,
          'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
          targetClassQuad.object,
          null
        );

        console.log(`  Found ${instances.length} instances to validate`);

        instances.forEach(instanceQuad => {
          const instance = instanceQuad.subject;
          console.log(`    Validating instance: ${this.getLocalName(instance.value)}`);
          
          // Validate properties
          const shapeViolations = this.validateInstance(shape, instance);
          violations.push(...shapeViolations);
        });
      });
    });

    return {
      conforms: violations.length === 0,
      violations: violations
    };
  }

  validateInstance(shape, instance) {
    const violations = [];
    
    // Get property shapes for this node shape
    const propertyShapes = this.shapesStore.getQuads(
      { value: shape },
      'http://www.w3.org/ns/shacl#property',
      null,
      null
    );

    propertyShapes.forEach(propShapeQuad => {
      const propShape = propShapeQuad.object;
      
      // Get property path
      const pathQuads = this.shapesStore.getQuads(
        propShape,
        'http://www.w3.org/ns/shacl#path',
        null,
        null
      );

      if (pathQuads.length === 0) return;
      
      const propertyPath = pathQuads[0].object;
      const propertyValues = this.dataStore.getQuads(
        instance,
        propertyPath,
        null,
        null
      );

      // Check minCount constraint
      const minCountQuads = this.shapesStore.getQuads(
        propShape,
        'http://www.w3.org/ns/shacl#minCount',
        null,
        null
      );
      
      if (minCountQuads.length > 0) {
        const minCount = parseInt(minCountQuads[0].object.value);
        if (propertyValues.length < minCount) {
          const messageQuads = this.shapesStore.getQuads(
            propShape,
            'http://www.w3.org/ns/shacl#message',
            null,
            null
          );
          const message = messageQuads.length > 0 
            ? messageQuads[0].object.value 
            : `Property ${this.getLocalName(propertyPath.value)} has ${propertyValues.length} values, minimum is ${minCount}`;
          
          violations.push({
            focusNode: instance.value,
            resultPath: propertyPath.value,
            resultMessage: message,
            severity: 'http://www.w3.org/ns/shacl#Violation',
            constraintComponent: 'http://www.w3.org/ns/shacl#MinCountConstraintComponent',
            value: propertyValues.length,
            minCount: minCount
          });
        }
      }

      // Check maxCount constraint
      const maxCountQuads = this.shapesStore.getQuads(
        propShape,
        'http://www.w3.org/ns/shacl#maxCount',
        null,
        null
      );
      
      if (maxCountQuads.length > 0) {
        const maxCount = parseInt(maxCountQuads[0].object.value);
        if (propertyValues.length > maxCount) {
          violations.push({
            focusNode: instance.value,
            resultPath: propertyPath.value,
            resultMessage: `Property ${this.getLocalName(propertyPath.value)} has ${propertyValues.length} values, maximum is ${maxCount}`,
            severity: 'http://www.w3.org/ns/shacl#Violation',
            constraintComponent: 'http://www.w3.org/ns/shacl#MaxCountConstraintComponent',
            value: propertyValues.length,
            maxCount: maxCount
          });
        }
      }

      // Check datatype constraint
      const datatypeQuads = this.shapesStore.getQuads(
        propShape,
        'http://www.w3.org/ns/shacl#datatype',
        null,
        null
      );
      
      if (datatypeQuads.length > 0 && propertyValues.length > 0) {
        const expectedDatatype = datatypeQuads[0].object.value;
        propertyValues.forEach(valueQuad => {
          if (valueQuad.object.datatype && valueQuad.object.datatype.value !== expectedDatatype) {
            violations.push({
              focusNode: instance.value,
              resultPath: propertyPath.value,
              resultMessage: `Property ${this.getLocalName(propertyPath.value)} has datatype ${valueQuad.object.datatype.value}, expected ${expectedDatatype}`,
              severity: 'http://www.w3.org/ns/shacl#Violation',
              constraintComponent: 'http://www.w3.org/ns/shacl#DatatypeConstraintComponent',
              value: valueQuad.object.value
            });
          }
        });
      }

      // Check pattern constraint
      const patternQuads = this.shapesStore.getQuads(
        propShape,
        'http://www.w3.org/ns/shacl#pattern',
        null,
        null
      );
      
      if (patternQuads.length > 0 && propertyValues.length > 0) {
        const pattern = new RegExp(patternQuads[0].object.value);
        propertyValues.forEach(valueQuad => {
          if (!pattern.test(valueQuad.object.value)) {
            const messageQuads = this.shapesStore.getQuads(
              propShape,
              'http://www.w3.org/ns/shacl#message',
              null,
              null
            );
            const message = messageQuads.length > 0 
              ? messageQuads[0].object.value 
              : `Property ${this.getLocalName(propertyPath.value)} value '${valueQuad.object.value}' does not match pattern '${patternQuads[0].object.value}'`;
            
            violations.push({
              focusNode: instance.value,
              resultPath: propertyPath.value,
              resultMessage: message,
              severity: 'http://www.w3.org/ns/shacl#Violation',
              constraintComponent: 'http://www.w3.org/ns/shacl#PatternConstraintComponent',
              value: valueQuad.object.value,
              pattern: patternQuads[0].object.value
            });
          }
        });
      }
    });

    return violations;
  }

  getLocalName(uri) {
    return uri.split(/[#/]/).pop() || uri;
  }

  formatValidationReport(result) {
    const { conforms, violations } = result;
    
    let report = `\n=== SHACL Validation Report ===\n`;
    report += `Conforms: ${conforms ? '✅ YES' : '❌ NO'}\n`;
    report += `Violations: ${violations.length}\n`;

    if (violations.length > 0) {
      report += `\n--- Violations ---\n`;
      violations.forEach((violation, index) => {
        report += `\n${index + 1}. ${violation.resultMessage}\n`;
        report += `   Focus Node: ${this.getLocalName(violation.focusNode)}\n`;
        report += `   Property: ${this.getLocalName(violation.resultPath)}\n`;
        report += `   Severity: ${this.getLocalName(violation.severity)}\n`;
        if (violation.value !== undefined) {
          report += `   Current Value: ${violation.value}\n`;
        }
      });
    } else {
      report += `\n✅ All validation checks passed!\n`;
    }

    return report;
  }
}

// Main validation function
async function validateFile(dataFilePath) {
  console.log(`\n🔍 Validating: ${dataFilePath}`);
  
  try {
    const validator = new SHACLValidator();
    
    // Load SHACL shapes
    const shapesPath = path.join(path.dirname(dataFilePath), 'validation-rules.ttl');
    const shapesContent = await fs.readFile(shapesPath, 'utf-8');
    await validator.loadShapes(shapesContent);
    
    // Load data to validate
    const dataContent = await fs.readFile(dataFilePath, 'utf-8');
    await validator.loadData(dataContent);
    
    // Run validation
    const result = validator.validate();
    
    // Display results
    console.log(validator.formatValidationReport(result));
    
    return result.conforms;
  } catch (error) {
    console.error(`❌ Validation error: ${error.message}`);
    return false;
  }
}

// CLI usage
if (process.argv.length < 3) {
  console.log('Usage: node validate.js <data-file.ttl>');
  console.log('\nExamples:');
  console.log('  node validate.js ./data/valid-data.ttl');
  console.log('  node validate.js ./data/invalid-data.ttl');
  process.exit(1);
}

const dataFile = process.argv[2];
validateFile(dataFile)
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });