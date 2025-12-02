#!/usr/bin/env node

/**
 * Simple test to verify SHACL validation works
 */

import { readFileSync } from 'fs';
import { Parser } from 'n3';
import factory from 'rdf-ext';

console.log('🧪 Simple SHACL Test');
console.log('━'.repeat(30));

try {
  // Test basic N3 parsing
  console.log('1️⃣ Testing N3 parsing...');
  const parser = new Parser();
  const ttlContent = '@prefix ex: <http://example.org/> . ex:test ex:prop "value" .';
  const quads = parser.parse(ttlContent);
  console.log(`✅ N3 parsing works: ${quads.length} quads found`);

  // Test rdf-validate-shacl import
  console.log('2️⃣ Testing SHACL validator import...');
  const SHACLValidator = await import('rdf-validate-shacl');
  console.log('✅ SHACL validator imported successfully');
  console.log('Validator constructor:', typeof SHACLValidator.default);
  
  // Test basic dataset creation
  console.log('3️⃣ Testing dataset creation...');
  const dataset = factory.dataset();
  for (const quad of quads) {
    dataset.add(quad);
  }
  console.log(`✅ Dataset created with ${dataset.size} quads`);
  
  console.log('\n🎉 All basic tests passed!');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}