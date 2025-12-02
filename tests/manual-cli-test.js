#!/usr/bin/env node

/**
 * Manual test of CLI graph validation to demonstrate functionality
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { SHACLValidationEngine } from '../packages/kgen-rules/src/validator/shacl.js';

console.log('🔍 Manual SHACL CLI Validation Test');
console.log('━'.repeat(40));

async function simulateCliValidation() {
  try {
    const dataFile = resolve('tests/sample-data.ttl');
    const shapesFile = resolve('tests/sample-shapes.ttl');
    
    console.log(`📊 Loading data graph: ${dataFile}`);
    if (!existsSync(dataFile)) {
      console.error('❌ Data graph file not found');
      return;
    }
    const dataContent = readFileSync(dataFile, 'utf8');
    console.log(`✅ Loaded data graph (${dataContent.length} characters)`);

    console.log(`📋 Loading SHACL shapes: ${shapesFile}`);
    if (!existsSync(shapesFile)) {
      console.error('❌ SHACL shapes file not found');
      return;
    }
    const shapesContent = readFileSync(shapesFile, 'utf8');
    console.log(`✅ Loaded SHACL shapes (${shapesContent.length} characters)`);

    console.log('⚡ Running SHACL validation...');
    
    const validationEngine = new SHACLValidationEngine();
    const validationResult = await validationEngine.validateGraph(
      dataContent, 
      shapesContent,
      { debug: false }
    );

    console.log(`✅ SHACL validation completed (${validationResult.executionTime}ms)`);

    // Display results
    console.log('\n📊 Validation Results');
    console.log('━'.repeat(25));
    
    if (validationResult.conforms) {
      console.log('✅ Graph conforms to constraints');
    } else {
      console.log('❌ Graph does not conform to constraints');
    }

    console.log(`Violations found: ${validationResult.violationCount || 0}`);
    console.log(`Validation time: ${validationResult.executionTime}ms`);

    console.log('\n🎉 SHACL validation system successfully implemented!');

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
  }
}

simulateCliValidation();
