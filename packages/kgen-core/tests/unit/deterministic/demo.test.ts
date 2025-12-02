/**
 * Demonstration of deterministic artifact generation system
 * This shows how the same inputs ALWAYS produce identical bytes across all systems
 */

import {
  createDeterministicHash,
  sortObjectKeys,
  stableStringify,
  createDeterministicId,
  stripNonDeterministic,
  createDeterministicFilename
} from '../../../src/deterministic/utils';

describe('deterministic system demonstration', () => {
  it('should demonstrate the key principle: same inputs = identical bytes', () => {
    console.log('\n🎯 DETERMINISTIC ARTIFACT GENERATION DEMO\n');
    
    // Sample project data that might come from different systems/times
    const projectData = {
      name: 'kgen-project',
      version: '1.0.0',
      timestamp: '2024-01-01T00:00:00Z', // This would normally be non-deterministic
      dependencies: {
        'z-last-package': '^3.0.0',
        'a-first-package': '^1.0.0', 
        'm-middle-package': '^2.0.0'
      },
      files: [
        { path: 'src/index.ts', content: 'export * from "./lib";' },
        { path: 'package.json', content: '{"name": "test"}' },
        { path: 'README.md', content: '# Test Project' }
      ],
      buildId: Math.random(), // This would be non-deterministic
      created: new Date() // This would be non-deterministic
    };
    
    console.log('📦 Original project data (with non-deterministic fields):');
    console.log(JSON.stringify(projectData, null, 2).substring(0, 200) + '...\n');
    
    // Step 1: Strip non-deterministic fields
    const cleanData = stripNonDeterministic(projectData, ['buildId', 'created']);
    console.log('🧹 After stripping non-deterministic fields:');
    console.log(JSON.stringify(cleanData, null, 2).substring(0, 200) + '...\n');
    
    // Step 2: Sort object keys for consistent ordering
    const sortedData = sortObjectKeys(cleanData);
    console.log('🔤 After sorting object keys:');
    console.log(JSON.stringify(sortedData, null, 2).substring(0, 200) + '...\n');
    
    // Step 3: Generate deterministic artifacts
    const hash = createDeterministicHash(sortedData);
    const stableJson = stableStringify(sortedData, 2);
    const artifactId = createDeterministicId('project', sortedData);
    const filename = createDeterministicFilename(stableJson, { type: 'project' }, 'json');
    
    console.log('🎲 Generated deterministic artifacts:');
    console.log(`   Hash: ${hash}`);
    console.log(`   Artifact ID: ${artifactId}`);
    console.log(`   Filename: ${filename}`);
    console.log(`   JSON Size: ${stableJson.length} bytes\n`);
    
    // Step 4: Prove determinism by running multiple times
    console.log('🔄 Proving determinism - running 5 times:');
    const results = Array.from({ length: 5 }, (_, i) => {
      const cleanData = stripNonDeterministic(projectData, ['buildId', 'created']);
      const sortedData = sortObjectKeys(cleanData);
      return {
        iteration: i + 1,
        hash: createDeterministicHash(sortedData),
        id: createDeterministicId('project', sortedData),
        filename: createDeterministicFilename(stableStringify(sortedData), { type: 'project' }, 'json')
      };
    });
    
    results.forEach(result => {
      console.log(`   Run ${result.iteration}: ${result.hash.substring(0, 16)}... | ${result.id} | ${result.filename}`);
    });
    
    // Verify all results are identical
    const firstResult = results[0];
    const allIdentical = results.every(result => 
      result.hash === firstResult.hash &&
      result.id === firstResult.id &&
      result.filename === firstResult.filename
    );
    
    console.log(`\n✅ All 5 runs produced identical results: ${allIdentical}\n`);
    
    // Step 5: Demonstrate system independence
    console.log('🌍 Demonstrating cross-system determinism:');
    
    // Simulate data from "different systems" with various orderings
    const systemAData = {
      dependencies: { 'z-last': '3.0.0', 'a-first': '1.0.0' },
      version: '1.0.0',
      name: 'kgen-project'
    };
    
    const systemBData = {
      name: 'kgen-project',
      version: '1.0.0', 
      dependencies: { 'a-first': '1.0.0', 'z-last': '3.0.0' }
    };
    
    const hashA = createDeterministicHash(systemAData);
    const hashB = createDeterministicHash(systemBData);
    
    console.log(`   System A hash: ${hashA.substring(0, 16)}...`);
    console.log(`   System B hash: ${hashB.substring(0, 16)}...`);
    console.log(`   Hashes match: ${hashA === hashB}\n`);
    
    // Final verification
    expect(allIdentical).toBe(true);
    expect(hashA).toBe(hashB);
    
    console.log('🎉 DEMONSTRATION COMPLETE: Deterministic artifact generation verified!\n');
    console.log('Key principles demonstrated:');
    console.log('  ✓ Same inputs always produce identical bytes');
    console.log('  ✓ Object key ordering is normalized');
    console.log('  ✓ Non-deterministic fields are stripped');
    console.log('  ✓ Results are reproducible across systems');
    console.log('  ✓ Cryptographic hashes ensure integrity\n');
  });
});